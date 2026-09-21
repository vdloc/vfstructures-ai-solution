# 18 · Hướng dẫn triển khai — đội DevOps AWS

> **Đã cập nhật trong `ship/`.** File này ghi hướng dẫn trước lượt rà soát nguồn 21/09/2026 (đặc biệt NAT gateway/Harness VPC). Bản đã sửa: `ship/05-devops.md`.

Tài liệu thi công, viết theo sáu bước của một lượt hỏi. Phần lớn việc của DevOps nằm ở bước 4, nhưng bước 1 có một cái bẫy có thể làm hỏng toàn bộ trải nghiệm mà không xuất hiện ở môi trường dev.

Thiết kế gốc ở [06](06-tang-bedrock.md), [07](07-auth-bao-mat.md), [10](10-trien-khai.md). Giải thích bằng lời thường ở [15](15-hoi-dap-tung-buoc.md).

Ký hiệu: **[T1]** việc tuần 1 · **[CHẶN]** đội khác không làm được nếu thiếu · **[CHỜ]** đang chờ đội khác.

---

## Ngày 1: bốn lệnh gọi thử trên tài khoản thật

Việc này mất vài phút và **không ai trả lời thay được**. Nó cho biết tài khoản của công ty đang vướng cổng nào.

```bash
REGION=eu-central-1

# 1. Sonnet 5
aws bedrock-runtime converse --region $REGION \
  --model-id eu.anthropic.claude-sonnet-5 \
  --messages '[{"role":"user","content":[{"text":"ping"}]}]' \
  --inference-config '{"maxTokens":16}'

# 2. Haiku 4.5
aws bedrock-runtime converse --region $REGION \
  --model-id eu.anthropic.claude-haiku-4-5-20251001-v1:0 \
  --messages '[{"role":"user","content":[{"text":"ping"}]}]' \
  --inference-config '{"maxTokens":16}'

# 3. Trạng thái vòng đời mô hình (R23)
aws bedrock get-foundation-model --region $REGION \
  --model-identifier anthropic.claude-haiku-4-5-20251001-v1:0

# 4. Quota thật
aws service-quotas list-service-quotas --region $REGION \
  --service-code bedrock --query "Quotas[?contains(QuotaName,'Claude')]"
```

**Ba loại cổng khác nhau, mỗi loại một lỗi và một cách gỡ:**

| Lỗi nhận được | Nghĩa là | Cách gỡ | Thời gian chờ |
| --- | --- | --- | --- |
| `AccessDeniedException` | Chưa có thỏa thuận Marketplace cho nhà cung cấp | Đăng ký qua AWS Marketplace, cần phương thức thanh toán | Khó đoán |
| `ResourceNotFoundException` + "Model use case details have not been submitted" | Chưa gửi biểu mẫu mô tả trường hợp sử dụng | Điền biểu mẫu trong console Bedrock | Vài giờ đến vài ngày |
| `ThrottlingException`, hoặc quota `0.0` | Có quyền nhưng hạn mức bằng 0 | Mở ticket tăng quota | 1–3 ngày làm việc |

**R43 · Lịch Gantt gộp ba cổng này vào một dòng một ngày.** Chúng là ba thủ tục độc lập với ba thời gian chờ khác nhau. Biết sớm một tuần là đáng giá — đó là lý do việc này đứng ở ngày 1 chứ không phải tuần 2.

---

## Bước 1 — Cho SSE đi qua được

Đây là cái bẫy **không xuất hiện ở môi trường dev**, vì dev không đi qua proxy.

### Phải làm

- [T1] ALB: `idle_timeout` ≥ 120 giây. Lượt `optimize` có trần 90 giây; timeout 60 giây sẽ cắt ngang và FE nhận luồng đứt không có `done`.
- [T1] CloudFront: **không cache** đường `/v1/chat`, và không đệm.
- Nếu có nginx hoặc ingress controller: `proxy_buffering off`, `proxy_read_timeout 120s`.
- Backend đặt header `X-Accel-Buffering: no` — DevOps xác nhận header này đi tới được đầu cuối.

### Nghiệm thu

```bash
curl -N -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"c-1","message":"ping","context":{}}' \
  https://<đúng tuyến production>/v1/chat
```

Sự kiện phải đến **rời rạc theo thời gian**, không dồn thành một cục ở cuối. Chạy qua đúng tuyến production, **không chỉ localhost**.

### Rủi ro

**OPS-1 · Proxy mặc định gom response rồi trả một lần.** Khi đó chữ không hiện dần và người dùng nhìn màn hình trắng 20 giây. Không có lỗi nào xuất hiện ở log.

**OPS-2 · Idle timeout quá ngắn cắt ngang lượt dài**, và FE nhận được luồng đứt không có sự kiện `done`.

---

## Bước 2 — Guardrail và quyền

### Phải làm

- [T1] [CHẶN] Tạo guardrail ở `eu-central-1`: denied topics, prompt attack, bộ lọc PII.
- Thứ **phải bắt chắc chắn** — căn cước, SIRET, mã dự án nội bộ — đi vào `regexesConfig`, không trông vào bộ nhận dạng sẵn.
- Execution role có `bedrock:ApplyGuardrail` **giới hạn đúng ARN guardrail đó**, không dùng `bedrock:*`.
- Mã hóa CloudWatch Logs bằng KMS, đặt thời hạn lưu trữ, giới hạn quyền đọc log.
- Cờ kill switch trong Parameter Store, có kiểm soát ai gạt được.
- Ghi rõ: prompt định tuyến của Haiku **cũng phải** kèm guardrail, vì nó bị chặn bởi khối Deny trong IAM policy.

### Rủi ro

**OPS-3 · Che PII của Guardrails chỉ áp dụng cho response của API.** Nội dung gốc chưa che, **gồm cả PII, vẫn được ghi nguyên văn vào CloudWatch Logs**. Với yêu cầu GDPR, đây là chỗ bắt buộc mã hóa log bằng KMS và giới hạn quyền đọc.

**OPS-4 · Bộ nhận dạng PII sẵn có không bắt đúng tuyệt đối.** Phần dựa vào mô hình luôn có bỏ sót, nên guardrail **không bao giờ là lớp bảo vệ duy nhất** — lớp chính vẫn là bộ kiểm tất định và ToolGate.

---

## Bước 3 — Quota và vòng đời mô hình

### Phải làm

- [T1] Xin tăng quota TPM và RPM cho Sonnet 5 và Haiku 4.5 ở `eu-central-1` **ngay tuần 1** — AWS duyệt 1–3 ngày làm việc.
- Chạy `get-foundation-model` ngày đầu để đọc trạng thái vòng đời thật (R23).
- Cảnh báo CloudWatch cho `ThrottlingException` và cho tỉ lệ `degraded_routing`.
- Chuẩn bị quyền và quota cho **Nova Lite** làm ứng viên thay thế mô hình định tuyến.

### Vì sao quota là việc tuần 1 chứ không phải khi cần

Quota mặc định của một tài khoản mới có thể là **0**. Nộp muộn thì ba ngày chờ rơi đúng vào tuần chạy eval.

### Rủi ro

**R23 · Model card Haiku 4.5 ghi EOL "không sớm hơn 01/10/2026"** (một dòng khác ghi 16/10/2026) — rơi vào tuần 2 của POC. Cả hai mốc đều ghi "không sớm hơn", nên phải kiểm trạng thái thật bằng `get-foundation-model` chứ không tin dòng chữ.

**R21 · Quyền dùng mô hình bên thứ ba là điểm chặn có thể xảy ra ngay ngày đầu.** Xem bảng ba loại cổng ở đầu tài liệu.

---

## Bước 4 — Phần lớn việc của DevOps

### 4A · Managed Knowledge Base (AD-17) — việc mới, chặn hết ngày 3

Kể từ AD-17, kho chunk nằm ở Bedrock MKB chứ không ở pgvector. Bốn kiểm chứng dưới đây **chặn ngang hàng với V-A1 và V-A6**.

| Mã | Kiểm | Cách kiểm |
| --- | --- | --- |
| V-K2 | MKB có GA ở `eu-central-1` | Tra trang endpoints của `bedrock`, rồi `create-knowledge-base` thật |
| V-K3 | AWS SDK for .NET có `type: MANAGED` và `MANAGED_KNOWLEDGE_BASE_CONNECTOR` | Tạo KB **bằng mã .NET**, không bằng CLI. Tài liệu AWS chỉ nêu mốc boto3/botocore ≥ 1.43.64 và không nói gì về .NET |
| V-K4 | Lọc metadata chạy đúng | Ba bước ở dưới |
| V-K5 | `overrideSearchType: HYBRID` dùng được không | Gọi `Retrieve` với `HYBRID`, xem có bị từ chối không. **Mặc định của mã là bỏ trống tham số này** để Bedrock tự chọn chiến lược hợp với kho vector; chỉ đặt tay nếu V-K5 đạt |

**V-K4 kiểm đủ ba đường**, vì cả ba đều trả kết quả trông hợp lệ: (1) nạp hai chunk khác `scope_key`, `Retrieve` kèm filter, xác nhận chỉ trả về một; (2) lọc trên thuộc tính **chưa khai là lọc được**, xác nhận trả rỗng chứ không trả tất cả; (3) thử `startsWith` trên `clause_path`, xác nhận nó bị bỏ qua — `stringContains` và `listContains` cũng nằm trong nhóm này.

**Cấu hình hạ tầng phải dựng:**

| Mục | Giá trị | Vì sao |
| --- | --- | --- |
| Role của KB | Chỉ `s3:ListBucket` và `s3:GetObject` theo ARN cụ thể | Kho vector do MKB quản, **không** cần quyền kho vector. Nhánh A của AD-06 (`embeddingModelType: MANAGED`) **không** cần `bedrock:InvokeModel`; nhánh B (`CUSTOM`) thêm quyền đó, giới hạn đúng ARN mô hình embedding |
| Trust policy | `bedrock.amazonaws.com` + `aws:SourceAccount` + `aws:SourceArn` | Chống confused deputy. Tạo xong thì siết `knowledge-base/*` về đúng KB ID |
| Data source | `MANAGED_KNOWLEDGE_BASE_CONNECTOR` + `connectorParameters` (`type: S3`, `version: "1"`, `connectionConfiguration` mang `bucketName` **và** `bucketOwnerAccountId`) | **Không** phải `s3Configuration.bucketArn` — hình dạng đó là đường customer-managed, có bài blog AWS dùng nhầm |
| VPC endpoint | `bedrock-agent-runtime` cùng với `bedrock-runtime` | `Retrieve` chạy trên `bedrock-agent-runtime`. Thiếu endpoint này thì nhánh tài liệu không gọi được từ subnet riêng — dễ sót vì mọi tài liệu đều chỉ nhắc `bedrock-runtime` |
| Mã hóa | Mặc định là khóa AWS sở hữu | Dùng KMS customer-managed qua `serverSideEncryptionConfiguration.kmsKeyArn` **lúc tạo**, vì kho chứa tài liệu có ràng buộc bản quyền |
| CloudTrail | Bật **data event** cho `AWS::Bedrock::KnowledgeBase` ngay lúc tạo KB | `Retrieve` là data event, **mặc định không ghi**. Không bật thì không truy được ai đã truy vấn cái gì |
| S3 nguồn | Bật SSE (ưu tiên SSE-KMS) và versioning | Chunk là dữ liệu dẫn xuất, tệp gốc là nguồn sự thật |
| Cảnh báo | Alarm trên ingestion job thất bại | `StartIngestionJob` là management event |
| Log group | Mã hóa bằng KMS customer-managed | Trace truy xuất phơi được bất kỳ dữ liệu nào đã nạp |

Tạo KB và tạo data source đều **bất đồng bộ**: poll `get-knowledge-base` tới `ACTIVE` và `get-data-source` tới `AVAILABLE` rồi mới `start-ingestion-job`. IAM có độ trễ lan truyền — lỗi "unable to assume role" ngay sau khi tạo role thì đợi khoảng 10 giây rồi thử lại, đừng coi là hỏng thật.

### 4A-bis · PostgreSQL

PostgreSQL vẫn cần, với hai vai trò: giữ `document`, `case`, `tool_run`, `message`, `audit_event`; và chạy `pg_trgm` trên bảng `clause_ref` để phân giải mã điều khoản ở chặng 1 của truy xuất.

**Không còn cần `pgvector`.** Kho vector nằm ở MKB, nên ràng buộc RDS PostgreSQL 15.18+/16.6+/17.3+ (sinh ra chỉ vì `pgvector` ≥ 0.8.0) không còn. Cũng vì vậy, **instance vật lý riêng cho assistant nay là tùy chọn** chứ không bắt buộc (AD-12): lý do cũ là tải bộ nhớ khi build chỉ mục HNSW.

| Mục | Giá trị | Vì sao |
| --- | --- | --- |
| Phiên bản PostgreSQL | Không ràng buộc | `pg_trgm` 1.6 và `unaccent` 1.1 có ở mọi phiên bản RDS |
| Extension | `pg_trgm`, `unaccent` | Phân giải mã điều khoản ở chặng 1 và cấu hình FTS |
| Cấu hình FTS | `fr_unaccent` (french + unaccent) **và** `english` | Giao diện có hai ngôn ngữ, câu hỏi tiếng Anh chạy trên kho tiếng Pháp |
| Chỉ mục | GIN trigram trên `clause_ref.clause_path` | Chặng 1 của truy xuất theo mã điều khoản |

Instance riêng hay dùng chung là quyết định vận hành theo Q4, không còn là ràng buộc kỹ thuật.

### 4B · AgentCore Harness và Gateway

**Sáu cấu hình bắt buộc đặt tay. Mặc định đều sai với dự án này.**

| Mục | Mặc định của AgentCore | Phải đặt | Hậu quả nếu bỏ qua |
| --- | --- | --- | --- |
| Mô hình | `global.anthropic.claude-sonnet-4-6` | `eu.anthropic.claude-sonnet-5`, `apiFormat = converse_stream` | Route ra ngoài EU, vi phạm residency (Q1) |
| Số vòng | **75 vòng** | 5 (thường), 7 (`optimize`) | Một lượt chạy tới khi hết token |
| Thời gian | **3 600 giây** | 60 giây (thường), 90 (`optimize`) | Một lượt chạy một tiếng |
| Tool sẵn có | `shell` và `file_operations` **bật sẵn** | `allowedTools` loại cả hai | Tốn ~900 token mỗi request, và cho mô hình quyền chạy lệnh |
| Memory | **Bật sẵn** | `disabled` | Hai kho hội thoại song song, rủi ro dữ liệu (Q3) |
| Danh tính gọi vào | SigV4 | `CUSTOM_JWT` + **cả** `allowedClients` **và** `allowedAudience` | Thiếu **cả hai** thì authorizer nhận **mọi** token hợp lệ của issuer |

Thêm:

- `runtimeSessionId` dài **33–100 ký tự**, dựng từ `orgId` và `conversationId`. Một phiên cho một hội thoại.
- `idleRuntimeSessionTimeout` mặc định 900 giây — giữ phiên ấm để tránh cold start. Runtime v2 tự thu hồi bộ nhớ rảnh sau 120 giây và chỉ tính theo mức tiêu thụ thật, nên kéo dài timeout **không** làm đội chi phí bộ nhớ tương ứng.
- Guardrail qua `additionalParams.guardrailConfig`, `trace = disabled`.

**Cấu hình Harness phải là mã trong repo**, và phải có test tự động đọc lại cấu hình sau mỗi lần triển khai để kiểm đúng sáu giá trị trên.

### 4C · Mạng — chỗ đã sai một lần

> **NAT gateway là bắt buộc. Không thay bằng VPC endpoint được.**

Harness kéo container từ **ECR Public** (`public.ecr.aws`) mỗi lần mở phiên, và **ECR Public không có VPC endpoint**. Thiếu NAT thì phiên hỏng vì image-pull timeout.

Endpoint riêng vẫn dùng cho `bedrock-runtime` và `s3`, nhưng **không thay được NAT**. Khi thêm route ra internet, **không nới rộng chiều vào**.

Bản thiết kế trước ghi "chỉ cần VPC endpoint cho `ecr.dkr` và `ecr.api`" — sai, và đã sửa (V-A10).

### 4D · Danh tính và Cedar

- [T1] Keycloak bật **token exchange** (RFC 8693), audience khớp — kiểm chứng **V-A6**, hạn hết ngày 3.
- Cedar policy cho từng tool: ai gọi được tool nào, với dự án nào.
- Quyền `bedrock-agentcore:InvokeHarness` và `InvokeAgentRuntime` **chỉ cấp cho `Assistant.Api`**.
- **Không ai** có `InvokeAgentRuntimeCommand`.

### [CHỜ] Đang chờ Backend

DevOps **không tạo được Gateway target** nếu chưa có schema OpenAPI của facade. BE cam kết phát hành hết ngày 3. Hai bên không làm song song được ở chỗ này — đây là điểm đồng bộ cứng của tuần 1.

### Nghiệm thu

- Test cấu hình đọc lại Harness sau deploy và khẳng định đủ sáu giá trị.
- Mở một phiên Harness trong VPC → thành công, không có image-pull timeout.
- Gọi tool bằng token của người dùng không có quyền dự án → Cedar từ chối trước khi chạm facade.
- Đo recall **theo từng scope** ở M3 (xem rủi ro OPS-5).

### Rủi ro

**V-A10 · NAT gateway.** Xem 4C.

**R30 · Sáu mặc định của Harness đều sai với ta**, và không đụng vào thì hệ thống **vẫn chạy** — chỉ là chạy sai. Đó là loại lỗi tệ nhất: không báo gì cả.

**R47 · Bộ lọc metadata của Bedrock hỏng im lặng ba đường.** Thuộc tính chưa khai là lọc được → trả rỗng. `startsWith` và `stringContains` trên kho không hỗ trợ → **bị bỏ qua**, truy vấn chạy không filter và trả về tài liệu của mọi organization. `numberOfResults` bỏ trống → mặc định **5**. Không đường nào báo lỗi. Danh sách thuộc tính lọc được phải chốt **trước lô nạp đầu tiên**, cùng lúc chốt embedding — sửa sau là nạp lại toàn kho.

**OPS-5 · Bộ lọc `scope_key` rất chọn lọc, và không ai biết MKB xử lý bộ lọc mạnh thế nào.** Với chỉ mục vector nói chung, bộ lọc chọn lọc mạnh có thể làm engine trả ít hơn số kết quả yêu cầu hoặc bỏ sót ứng viên **mà không báo lỗi**. Trước đây còn có `hnsw.iterative_scan` và overfetch để chữa; nay tham số chỉ mục nằm trong hộp đen của MKB, không có nút nào. Vì vậy **đo recall theo từng scope là bắt buộc**, và hỏng thì phải xử lý ở mức quyết định chứ không phải mức cấu hình.

**OPS-6 · `InvokeAgentRuntimeCommand` chạy lệnh trực tiếp, bỏ qua LLM và `allowedTools`.** Không cấp cho bất kỳ vai trò nào.

**V-A9 · Chưa xác minh Cedar có kiểm được điều kiện số học** kiểu `b >= 100 && b <= 2000`. Nếu không, toàn bộ việc kiểm biên tham số dồn về facade của Backend — báo cho BE biết sớm.

---

## Bước 5 — Quan sát

### Phải làm

- Chỉ số và cảnh báo cho tỉ lệ `CompletedUnverified` theo ngày và theo nhãn ý định.
- Giữ `retrieval_log` đủ lâu để phân tích recall, theo chính sách lưu trữ đã chốt.
- Cây span đủ để truy một lượt từ `requestId` tới từng lời gọi tool.
- Budgets và Cost Anomaly Detection **trước khi tăng lưu lượng**, không phải sau.

### Rủi ro

**OPS-7 · Tỉ lệ `unverified` tăng là tín hiệu sớm** của prompt hỏng, kho tài liệu lệch, hoặc mô hình đổi hành vi sau một bản cập nhật. Không có chỉ số này thì chỉ biết khi người dùng phàn nàn.

---

## Bước 6 — Không có việc riêng

Nhưng đệm response ở bước 1 làm hỏng toàn bộ bước này. Kiểm lại `curl -N` sau mỗi lần đổi cấu hình tầng mạng.

---

## Chi phí: cái gì chiếm bao nhiêu

| Khoản | Tỉ trọng ước tính |
| --- | --- |
| Token mô hình | ~98% |
| Hạ tầng AgentCore | **1–2%** |

Hệ quả cho tranh luận "tự viết vòng lặp C# cho rẻ": **tiết kiệm được 1% hóa đơn, đổi lấy vài trăm dòng mã phải tự bảo trì.** Cân nhắc đúng không nằm ở chi phí hạ tầng mà ở công sức xây dựng và rủi ro V-A1.

**Chưa có con số ngân sách hoàn chỉnh.** Đơn giá của Sonnet 5, Haiku 4.5, Cohere Embed v4 chưa tra được từ trang giá. Điền bằng AWS Pricing Calculator hoặc trang Marketplace **trước ngày đầu của M0**, và đo trên lượt thật trong hai ngày đầu POC.

---

## Bảng tra nhanh: cái gì không bao giờ được làm

| Không bao giờ | Vì sao |
| --- | --- |
| Dựng VPC cho Harness mà không có NAT gateway | ECR Public không có VPC endpoint, phiên chết |
| Nhận mặc định của Harness | Sáu giá trị đều sai, và hệ thống vẫn chạy |
| Đặt JWT authorizer mà thiếu cả `allowedClients` lẫn `allowedAudience` | Nhận mọi token hợp lệ của issuer |
| Cấp `InvokeAgentRuntimeCommand` cho bất kỳ ai | Chạy lệnh trực tiếp, bỏ qua mọi kiểm soát |
| Dùng `bedrock:*` hoặc `AmazonBedrockFullAccess` | Phạm vi quyền quá rộng |
| Để CloudWatch Logs không mã hóa khi có bộ lọc PII | Nội dung gốc chưa che được ghi nguyên văn |
| Bật cache CloudFront trên `/v1/chat` | SSE bị đệm, chữ không hiện dần |
| Giả định recall đạt mà không đo theo từng scope | Lỗi im lặng của chỉ mục vector với bộ lọc mạnh, nay nằm trong hộp đen của MKB |
| Tăng lưu lượng trước khi có Budgets và Cost Anomaly Detection | Không có phanh chi phí |

---

## Liên quan

- [06-tang-bedrock.md](06-tang-bedrock.md) — mô hình, guardrail, chịu lỗi, chi phí, §1a các điểm chưa kiểm được
- [07-auth-bao-mat.md](07-auth-bao-mat.md) — danh tính, token exchange, phân quyền
- [10-trien-khai.md](10-trien-khai.md) — topology, môi trường, CI/CD
- [12-rui-ro.md](12-rui-ro.md) — R21, R23, R30, R43, V-A6, V-A9, V-A10
- [15-hoi-dap-tung-buoc.md](15-hoi-dap-tung-buoc.md) — giải thích cùng nội dung bằng lời thường
- [16-guideline-backend.md](16-guideline-backend.md) · [17-guideline-frontend.md](17-guideline-frontend.md)
