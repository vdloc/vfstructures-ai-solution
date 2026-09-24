# 16 · Hướng dẫn cấu hình AWS qua Console — trợ lý AI kỹ sư kết cấu

**Ai đọc:** Người thực thi là DevOps và kỹ sư dựng hạ tầng. Tài liệu đồng thời dành cho quản lý, cổ đông và người không chuyên kỹ thuật muốn hiểu mỗi bước làm gì và vì sao quan trọng: mỗi phần mở đầu bằng một khung **"Giải thích cho người không chuyên"** viết bằng ngôn ngữ thường ngày, phần còn lại là thao tác kỹ thuật chi tiết. Đây là bản hướng dẫn thao tác THỰC TẾ trên **AWS Management Console** cho toàn bộ tính năng của kiến trúc. Nó không thay [05-devops.md](05-devops.md) (runbook CLI, các bẫy production) mà bổ trợ: 05 cho biết *phải đặt giá trị gì và vì sao*, tài liệu này cho biết *bấm vào đâu*.

**Region chuẩn:** `eu-central-1` (Frankfurt) cho MỌI dịch vụ — Bedrock, KMS, S3, RDS, CloudWatch, AgentCore. Lý do: cư trú dữ liệu EU (AD-03, AD-14). Luôn kiểm góc trên bên phải Console đang ở đúng region trước mỗi bước.

**Quy ước:**
- Nhãn nút/menu trên Console đặt trong `"..."`. Console UI đổi thường xuyên; chỗ nào ghi **[kiểm lại nhãn trên Console]** là nhãn có thể đã đổi — đối chiếu link doc kèm theo.
- **[CLI/API]** đánh dấu phần KHÔNG làm được trên Console, phải dùng AWS CLI/SDK.
- **[SQL]** đánh dấu phần chỉ làm được bằng câu lệnh SQL trong database.
- Giá trị `<...>` là chỗ điền theo tài khoản của bạn.

> **Về mô hình:** đề bài yêu cầu bật Claude Haiku 4.5, Sonnet, Opus. Kiến trúc thực tế ([01](01-kien-truc.md) §8.3) dùng **Haiku 4.5** (routing), **Sonnet 5** (trả lời + tool loop), **Sonnet 4.6** (fallback) — không dùng Opus. Bật đúng bộ mô hình kiến trúc cần; nếu công ty muốn dự phòng thêm Opus thì bật thêm, quy trình y hệt.

---

## Bức tranh tổng thể cho người không chuyên

> **Giải thích cho người không chuyên**
> Phần này kể một lượt toàn bộ câu chuyện, để người không chuyên kỹ thuật có khung hình dung trước khi đọc từng phần lắp ráp bên dưới. Có thể bỏ qua nếu chỉ cần thao tác.

Hệ thống này là một trợ lý AI cho kỹ sư kết cấu: người dùng đặt câu hỏi về tính toán kết cấu hoặc tra cứu tiêu chuẩn, trợ lý trả lời kèm trích dẫn nguồn để đối chiếu. Một câu hỏi đi qua các chặng sau.

1. **Xác thực danh tính.** Trước khi xử lý, hệ thống xác nhận người hỏi là ai và thuộc công ty nào, để mỗi người chỉ thấy dữ liệu của mình.
2. **Định tuyến (routing).** Hệ thống chọn mô hình AI phù hợp với độ khó của câu hỏi: câu đơn giản dùng mô hình nhanh và rẻ, câu phức tạp dùng mô hình mạnh hơn. Cách này cân bằng giữa chất lượng và chi phí.
3. **Tra tài liệu có nguồn (RAG).** Trước khi trả lời, hệ thống tìm các đoạn tài liệu và tiêu chuẩn liên quan trong một kho riêng của công ty, rồi soạn câu trả lời dựa trên đó. Nhờ vậy câu trả lời có căn cứ và hạn chế bịa đặt.
4. **Bộ lọc an toàn (Guardrails).** Hệ thống chặn các câu hỏi ngoài phạm vi, nội dung nguy hiểm và che thông tin cá nhân, ở cả đầu vào lẫn đầu ra.
5. **Gọi công cụ tính toán (Tool Use).** Với các con số quan trọng, trợ lý không tự tính nhẩm mà gọi phần mềm tính chuyên dụng, rồi lấy kết quả đó đưa vào câu trả lời.
6. **Trả lời kèm trích dẫn.** Câu trả lời cuối cùng luôn dẫn nguồn tài liệu và số hiệu tiêu chuẩn, để người dùng kiểm chứng được.

Toàn bộ hạ tầng đặt tại **Frankfurt (`eu-central-1`)** để dữ liệu ở lại châu Âu theo yêu cầu pháp lý. Các phần bên dưới là những "viên gạch" dựng nên chuỗi trên:

| Phần | Viên gạch | Vai trò một câu |
| --- | --- | --- |
| §1 | Quyền dùng mô hình (Model access) | Mở khoá để tài khoản được gọi các mô hình AI của Anthropic (Claude). |
| §2 | Kho tài liệu (Knowledge Base) | Nơi lưu và tra cứu tài liệu, tiêu chuẩn của công ty để trả lời có nguồn. |
| §3 | Bộ lọc an toàn (Guardrails) | Chặn nội dung ngoài phạm vi và che thông tin nhạy cảm. |
| §4 | Theo dõi chi phí (Inference profiles + tags) | Gắn nhãn để biết mỗi dự án, mỗi đội tiêu tốn bao nhiêu. |
| §5 | Cổng gọi công cụ (Gateway) | Cửa an toàn để mô hình gọi phần mềm tính bên ngoài. |
| §6 | Bộ điều phối (Harness) | Bộ máy điều khiển vòng lặp "hỏi mô hình — gọi công cụ — trả lời". |
| §7 | Phân quyền (IAM) | Cấp cho mỗi thành phần đúng quyền tối thiểu cần dùng, không hơn. |
| §8 | Khoá mã hoá (KMS) | Khoá của công ty dùng để mã hoá mọi dữ liệu lưu trữ. |
| §9 | Kho tệp nguồn (S3) | Nơi cất các tệp tài liệu gốc một cách an toàn. |
| §10 | Nguồn danh tính (Keycloak/Cognito) | Hệ thống xác thực người đăng nhập. |
| §11 | Cơ sở dữ liệu (PostgreSQL) | Nơi lưu hồ sơ, lịch sử hội thoại và nhật ký kiểm toán. |
| §12 | Giám sát và chi phí | Ghi nhật ký, cảnh báo và kiểm soát ngân sách. |
| §13 | Hạn mức theo người dùng | Giới hạn số lượt và lượng dùng của mỗi người để tránh lạm dụng. |

Thứ tự dựng các viên gạch này không đảo được, vì mỗi phần cần kết quả của phần trước — sơ đồ phụ thuộc ở ngay mục kế tiếp.

---

## 0. Thứ tự dựng và các đồng hồ chạy song song

### 0.1 Chuỗi phụ thuộc (dựng tuần tự)

Không đảo được thứ tự này, vì mỗi mắt xích cần ARN của mắt trước:

```
KMS (khoá công ty)
  │  cần khoá trước để bật SSE-KMS cho các dịch vụ sau
  ▼
S3 (bucket nguồn: SSE-KMS + Versioning + chặn public)
  │
  ▼
Bedrock Knowledge Base (managed)  ── kmsKeyArn đặt LÚC TẠO, không sửa được
  │
  ▼
Bedrock Guardrail (đánh số version)
  │
  ▼
Application inference profile (gắn tag chi phí)   [CLI/API — không tạo được trên Console]
  │
  ▼
AgentCore Gateway + Harness (chế độ VPC)
  ▲
  │
IAM role  ──────── xuyên suốt: gắn vào mọi bước ở trên (assistant-runtime, assistant-ingest, service role của KB, execution role của Harness)
```

### 0.2 Ba đồng hồ phải bấm NGAY NGÀY ĐẦU (song song với chuỗi trên)

Ba loại cổng dưới đây **độc lập** với chuỗi phụ thuộc và có thời gian chờ riêng. Nộp muộn thì chờ đúng lúc cần chạy eval ([05](05-devops.md) mở đầu). Bắt đầu **ngày 1**, đừng đợi tới lượt trong sơ đồ:

| Đồng hồ | Việc | Chờ | Mục |
| --- | --- | --- | --- |
| Marketplace/Anthropic | Gửi biểu mẫu use-case cho mô hình Anthropic | Vài giờ–vài ngày | §1 |
| Quota | Xin tăng TPM/RPM cho Sonnet 5, Haiku 4.5 | 1–3 ngày làm việc | §12 |
| Pháp lý | Hồ sơ dữ liệu cá nhân ra nước ngoài (DPO) | Ngoài kỹ thuật | — |

---

## 1. Bật quyền truy cập model (Model access)

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Mở khoá quyền để tài khoản AWS được phép gọi các mô hình AI của Anthropic (Claude) — nếu ví AWS như một trung tâm cho thuê máy móc, thì đây là bước đăng ký để được dùng dòng máy Claude.
> **Cách hoạt động:** AWS yêu cầu gửi một biểu mẫu khai mục đích sử dụng một lần cho mô hình của Anthropic; sau khi được duyệt, tài khoản mới gọi được mô hình. Bật quyền không mất phí, phí chỉ phát sinh khi thực sự dùng.
> **Nếu làm sai thì sao:** Chưa gửi biểu mẫu hoặc chưa được cấp quyền thì mọi lời gọi mô hình đều bị từ chối, và trợ lý không trả lời được câu nào.

**Mục tiêu:** cho tài khoản gọi được Claude Haiku 4.5, Sonnet 5, Sonnet 4.6 ở `eu-central-1`.

> **Thay đổi lớn năm 2025 — [kiểm lại trên tài khoản của bạn].** AWS đã **đơn giản hoá và đang loại bỏ trang "Model access" cũ**: quyền truy cập serverless model nay **mặc định bật** khi tài khoản có đúng quyền AWS Marketplace, điều khiển chính bằng IAM policy (action `bedrock:InvokeModel*`). Riêng **mô hình Anthropic vẫn cần gửi một biểu mẫu use-case một lần** trước khi gọi lần đầu. Tài khoản/region cũ có thể vẫn thấy trang "Model access"; tài khoản mới có thể không. Xử lý cả hai trường hợp bên dưới.

### Các bước Console

1. Mở **Amazon Bedrock** Console, xác nhận region `eu-central-1`.
2. **Nếu còn trang "Model access"** (menu trái, mục `"Model access"` — có thể nằm trong `"Bedrock configurations"`): bấm `"Modify model access"` (hoặc `"Enable specific models"`) → tick các mô hình Anthropic Claude cần dùng → `"Next"` → `"Submit"`. **[kiểm lại nhãn trên Console]**
3. **Nếu tài khoản đã chuyển sang trải nghiệm mới** (không còn trang Model access): vào `"Model catalog"` (menu trái), chọn một mô hình Claude, mở trong `"Playground"` — lần đầu Console sẽ nhắc điền **biểu mẫu use-case của Anthropic**; điền và gửi.
4. Nghiệm thu bằng cách gọi thử (không phải Console — xem [05](05-devops.md) "bốn lệnh gọi thử"): `aws bedrock-runtime converse` với `eu.anthropic.claude-sonnet-5` và `eu.anthropic.claude-haiku-4-5-20251001-v1:0`.

### Tham số chính

- Gọi Sonnet 5 **bắt buộc dùng inference profile `eu.*`** (`eu.anthropic.claude-sonnet-5`), không có bản single-region ([01](01-kien-truc.md) §2). Profile `global.*` có thể route ra ngoài EU — cấm.
- Ba loại lỗi phân biệt ba cổng: `AccessDeniedException` = thiếu thoả thuận Marketplace; `ResourceNotFoundException` + "use case details have not been submitted" = chưa gửi biểu mẫu; `ThrottlingException`/quota `0.0` = quota bằng 0 (§12).

### Lưu ý bảo mật/chi phí

- Đừng cấp `AmazonBedrockFullAccess`; siết IAM theo ARN từng mô hình (§7).
- Bật quyền không phát sinh phí; phí phát sinh khi gọi (token).

**Doc:** [Request access to models](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html) · [Simplified model access](https://aws.amazon.com/blogs/security/simplified-amazon-bedrock-model-access/)

---

## 2. Bedrock Knowledge Base (managed)

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Dựng kho tài liệu để trợ lý tra cứu rồi trả lời dựa trên nguồn thật (kỹ thuật gọi là RAG), thay vì trả lời theo trí nhớ chung chung dễ sai.
> **Cách hoạt động:** Tài liệu gốc nằm trong kho tệp, được cắt thành từng đoạn nhỏ và chuyển sang dạng máy tìm kiếm theo ý nghĩa; khi có câu hỏi, hệ thống lấy các đoạn liên quan nhất rồi mới soạn câu trả lời kèm trích dẫn.
> **Nếu làm sai thì sao:** Khoá mã hoá và mô hình xử lý của kho được ấn định ngay lúc tạo và không sửa được về sau; chọn sai thì buộc phải xoá kho và nạp lại toàn bộ tài liệu từ đầu, tốn nhiều thời gian.

**Mục tiêu:** kho RAG quản lý sẵn (AD-17): S3 nguồn → embedding → vector store → `Retrieve`, mã hoá bằng khoá công ty, có rerank.

> **CẢNH BÁO đọc TRƯỚC khi bấm "Create":**
> - **`kmsKeyArn` của KB chỉ đặt được LÚC TẠO** và **không sửa được sau đó**. Quên là KB dùng khoá AWS-owned; muốn đổi phải **xoá KB và tạo lại + ingest lại toàn kho**.
> - **Mô hình embedding cũng bất biến sau khi tạo** (AD-06). Chọn embedding do AWS quản (`MANAGED`) mặc định; nếu chọn embedding riêng (`CUSTOM`) thì **mất managed reranker**. Chốt embedding + rerank cùng lúc, trước khi tạo.
> - **Hai khoá KMS khác nhau, đừng gộp:** (a) khoá của KB — quyền nằm ở **key policy, cấp cho danh tính TẠO KB**, service role KHÔNG cần quyền gì trên khoá này; (b) khoá của bucket nguồn — **service role** cần `kms:Decrypt` với điều kiện `kms:ViaService = s3.eu-central-1.amazonaws.com`.

### 2.1 Tạo S3 bucket nguồn (làm trước — xem §9 để đủ chi tiết)

1. **S3** Console → `"Create bucket"` → tên `<vf-assistant-kb-source>`, region `eu-central-1`.
2. `"Block Public Access settings for this bucket"` → giữ `"Block all public access"` **bật**.
3. `"Bucket Versioning"` → `"Enable"`.
4. `"Default encryption"` → `"Server-side encryption with AWS Key Management Service keys (SSE-KMS)"` → `"Choose from your AWS KMS keys"` → chọn khoá công ty (§8). Bật `"Bucket Key"` để giảm phí KMS.

### 2.2 Tạo Knowledge Base

1. **Amazon Bedrock** Console → menu trái `"Knowledge Bases"` → `"Create"`.
2. Ở dropdown `"Create"`, chọn tuỳ chọn **managed knowledge base** (AWS tự quản vector store, embedding, rerank) — KHÔNG chọn `"Knowledge Base with vector store"` (đường customer-managed, sẽ hỏi vector store và có `"Quick create a new vector store"` = S3 Vectors/OpenSearch). Doc riêng cho đường managed là [kb-managed-create](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-create.html). **[kiểm lại nhãn dropdown — đổi thường xuyên; nếu Console không hiện tuỳ chọn managed, tạo bằng SDK/CLI theo [05](05-devops.md) §4A, tuyệt đối KHÔNG dùng "Quick create a new vector store"]**
3. `"Knowledge Base name"`: `<vf-assistant-kb>`.
4. `"IAM permissions"` → chọn `"Create and use a new service role"` hoặc gắn service role đã tạo ở §7 (`AmazonBedrockExecutionRoleForKB-*`).
5. **Embedding model:** giữ mặc định `MANAGED` (AWS chọn). Chỉ đổi sang mô hình cụ thể nếu đã đo và quyết theo AD-06 nhánh B — nhớ mất managed reranker.
6. **Encryption (KMS):** mở `"Advanced settings"` → chọn `"Customize encryption settings (advanced)"` → chọn **khoá KMS công ty**. Đây là chỗ đặt `kmsKeyArn` — làm ngay, không bỏ qua. **[kiểm lại nhãn]**
7. **Data source:** chọn `"Amazon S3"` → trỏ tới bucket §2.1. Nếu bucket khác tài khoản, điền `bucketOwnerAccountId`.
8. `"Create Knowledge Base"`. Tạo KB **bất đồng bộ** — chờ trạng thái `"Available"`/`ACTIVE`.

### 2.3 Đồng bộ và bật Rerank

1. Trong trang KB → tab `"Data source"` → chọn data source → `"Sync"`. Chờ trạng thái đồng bộ `"Completed"`. **Query trước khi sync xong trả về rỗng.**
2. **Rerank:** trên managed KB, reranker `MANAGED` **bật sẵn** (miễn phí, chỉ khi embedding do AWS quản), không có cờ bật/tắt riêng trên Console. Nếu muốn Cohere Rerank 3.5 (`CUSTOM`) hoặc tắt hẳn (`NONE`), cấu hình đó nằm ở tham số `Retrieve` phía ứng dụng, **không phải trên Console** — xem [01](01-kien-truc.md) §8.2.
3. Nghiệm thu: tab `"Test knowledge base"` → nhập câu hỏi → kiểm số kết quả và điểm.

### Tham số chính

- Data source dùng shape managed connector (`MANAGED_KNOWLEDGE_BASE_CONNECTOR`, `connectorParameters.type = S3`), Console tự dựng — **đừng** copy shape `s3Configuration.bucketArn` từ blog (đó là đường customer-managed).
- Metadata lọc lấy từ sidecar `.metadata.json` mỗi chunk (≤ 10 KB). Danh sách thuộc tính chốt **trước lô ingest đầu tiên** (sửa sau = ingest lại). Không đặt tên thuộc tính bắt đầu bằng `_`.
- `numberOfResults`, `filter`, ngưỡng điểm là tham số phía ứng dụng khi gọi `Retrieve`, **không cấu hình trên Console**.

### Lưu ý bảo mật/chi phí

- Sau khi tạo KB, vào IAM siết trust policy của service role từ `knowledge-base/*` về đúng KB ID (chống confused deputy) — xem §7.
- Bật **CloudTrail data event** cho `AWS::Bedrock::KnowledgeBase` (§12): `Retrieve` mặc định **không** được ghi.
- Phí KB + rerank khoảng ~2% chi phí biến đổi ([05](05-devops.md)); token mô hình mới là phần lớn.

**Doc:** [Create a knowledge base](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-create.html) · [KB regions](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-regions.html) · [KB permissions](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-permissions.html)

---

## 3. Bedrock Guardrails

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Đặt bộ lọc an toàn (Guardrails) để chặn câu hỏi ngoài phạm vi, ngăn nội dung nguy hiểm và che thông tin cá nhân, ở cả câu người dùng gửi vào lẫn câu trợ lý trả về.
> **Cách hoạt động:** Guardrail kiểm nội dung theo các luật đã khai sẵn; bản vừa tạo là bản nháp, phải chốt thành một bản đánh số cố định thì mới đưa vào dùng thật.
> **Nếu làm sai thì sao:** Nếu để ở bản nháp hoặc quên khai đủ tham số khi gọi, bộ lọc sẽ im lặng không áp và không báo lỗi — hệ thống trông như an toàn nhưng thực ra không có rào chắn nào.

**Mục tiêu:** một guardrail đánh số version, chống prompt attack, chặn chủ đề cấm riêng ngành, che/chặn PII; lấy `guardrailIdentifier` + `version` để ứng dụng gắn vào lời gọi.

> **Ba điều phải biết** ([05](05-devops.md) §2A): (1) không có guardrail mặc định — không tạo là không có gì áp; (2) tạo xong là bản **`DRAFT`**, phải chốt thành bản đánh số mới dùng production; (3) guardrail chỉ chạy khi lời gọi khai đủ **cả** `guardrailIdentifier` **lẫn** `guardrailVersion` — thiếu một là **im lặng không áp, không báo lỗi**.

### Các bước Console

1. **Amazon Bedrock** Console → menu trái `"Guardrails"` → `"Create guardrail"`.
2. **`"Provide guardrail details"`:** tên `vf-assistant-guardrail`; thông điệp chặn viết bằng **tiếng Pháp** (giao diện chỉ `fr`/`en`), chung chung, không nêu bộ lọc nào kích hoạt:
   - `"Messaging for blocked prompts"`: *"Je ne traite que les questions de calcul de structure et de consultation de normes."*
   - `"Messaging for blocked responses"`: *"Réponse bloquée par la politique de sécurité."*
   - Mở phần **KMS**: chọn `"Customize encryption settings"` → khoá KMS công ty (bắt buộc theo thiết kế — cấu hình chứa chủ đề cấm và regex nhạy cảm). **[kiểm lại nhãn]**
3. **`"Configure content filters"`:** bật 6 loại. Đặt `PROMPT_ATTACK` = **HIGH**; các loại khác **MEDIUM**; riêng **`VIOLENCE` = LOW** (ngành kết cấu dùng "rupture", "effondrement" làm thuật ngữ — HIGH sẽ chặn nhầm).
4. **`"Add denied topics"`:** thêm hai chủ đề DENY, mô tả + ví dụ bằng tiếng Pháp:
   - `Contournement-verification` (lách kiểm định: khai gian tải, hạ hệ số an toàn).
   - `Conseil-juridique-ou-assurance` (tư vấn trách nhiệm dân sự, bảo hiểm, garantie décennale).
   - Giới hạn: ≤ 30 chủ đề, `definition` ≤ 200 ký tự, ≤ 5 ví dụ mỗi cái ≤ 100 ký tự.
5. **`"Add sensitive information filters"` (PII):**
   - `ANONYMIZE`: `NAME`, `EMAIL`, `PHONE`, `ADDRESS`.
   - `BLOCK`: `PASSWORD`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `CREDIT_DEBIT_CARD_NUMBER`, `INTERNATIONAL_BANK_ACCOUNT_NUMBER`.
   - **Regex tự viết** (AWS không có sẵn PII của Pháp/Việt Nam): `FR_NIR` (số an sinh Pháp), `FR_SIRET`, `VN_CCCD` (căn cước công dân) → hành động `ANONYMIZE`. Giới hạn cứng: **≤ 10 regex**, mỗi pattern **≤ 500 ký tự**. Mẫu regex đầy đủ ở [05](05-devops.md) §2A.2.
6. **`"Add contextual grounding check"`:** bật `Grounding` và `Relevance`, ngưỡng khởi điểm **0.7**. Lưu ý: chỉ dùng làm **lớp hậu kiểm** gắn cờ `unverified`, không phải hàng rào chính ([06](06-bao-mat.md) §13).
7. **`"Review and create"`** → `"Create guardrail"`. Kết quả là bản **`DRAFT`**.
8. **Chốt version (bước riêng, bắt buộc):** trong trang guardrail → `"Create version"`. Ra bản `1`. **Ghim số bản này vào cấu hình ứng dụng**, không bao giờ dùng `DRAFT` ở production.

### Hai chế độ tích hợp phía ứng dụng (không cấu hình ở Console)

Console chỉ tạo *định nghĩa* guardrail. *Cách gắn* nằm trong mã ([06](06-bao-mat.md) §13):
- **`guardrailConfig`** trên `Converse`/`ConverseStream`: áp lên đầu ra mô hình chính; chế độ stream `sync` (che PII được; `async` KHÔNG che PII). Bắt buộc kèm cả `guardrailIdentifier` + `guardrailVersion`.
- **`ApplyGuardrail`** (gọi rời): kiểm đầu vào; và bọc nội dung tool trả về (`guardrailConfig` **không** soát `toolResult`).

### Tham số chính

- `tierConfig = CLASSIC` (hỗ trợ Anh/Pháp/Tây Ban Nha, **không cần cross-Region**). `STANDARD` thêm ngôn ngữ nhưng **bắt buộc cross-Region** — đổi hạng là quyết định có hệ quả pháp lý.
- `trace = disabled` ở production (bật sẽ trả về nguyên văn PII đã kích hoạt bộ lọc).

### Lưu ý bảo mật/chi phí

- **Ép bằng IAM** để lập trình viên không bỏ guardrail: điều kiện `bedrock:GuardrailIdentifier`, **chỉ áp cho ARN mô hình chat** (không áp embedding — Cohere Embed không hỗ trợ Guardrails). Xem §7.
- Che PII của Guardrails **chỉ áp cho response API**; bản gốc vẫn vào log nguyên văn — xử lý log ở §12.
- Đặt cảnh báo CloudWatch trên `UpdateGuardrail`/`CreateGuardrailVersion` (CloudTrail management event) để biết khi có người hạ độ nhạy.

**Doc:** [Create a guardrail](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-create.html) · [Guardrail KMS](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-permissions-kms.html) · [Enforce via IAM](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-permissions-id.html)

---

## 4. Application inference profiles + cost allocation tags

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Gắn nhãn chi phí để biết mỗi dự án, mỗi đội tiêu tốn bao nhiêu tiền cho AI — giống như dán nhãn từng khoản chi để cuối tháng biết tiền đi đâu.
> **Cách hoạt động:** Mỗi lời gọi mô hình đi qua một "hồ sơ" (inference profile) có gắn nhãn dự án; hệ thống tính tiền của AWS cộng dồn chi phí theo nhãn đó, xem được trong công cụ Cost Explorer.
> **Nếu làm sai thì sao:** Nhãn không hồi tố — chỉ chi phí phát sinh sau khi bật nhãn mới được tính; bật muộn thì mất số liệu của giai đoạn đầu và không truy ngược lại được.

**Mục tiêu:** tách chi phí Bedrock theo dự án/đội bằng inference profile có gắn tag, rồi bật tag trong Billing.

> **[CLI/API] — KHÔNG tạo được trên Console.** AWS ghi rõ: *"You must use the AWS CLI or AWS API to create application inference profiles."* Console chỉ dùng để **xem** profile và **kích hoạt tag** trong Billing. Đây là điểm chỉ-CLI đầu tiên.

### 4.1 Tạo profile và gắn tag — [CLI/API]

```bash
# Tạo profile bọc quanh mô hình chat (làm cho từng mô hình cần theo dõi).
# QUAN TRỌNG: ở eu-central-1, phải copyFrom SYSTEM inference profile (eu.*),
# KHÔNG copyFrom ::foundation-model/ — để giữ residency EU và route đúng.
aws bedrock create-inference-profile --region eu-central-1 \
  --inference-profile-name "vf-assistant-sonnet5" \
  --model-source '{"copyFrom":"arn:aws:bedrock:eu-central-1:<acct>:inference-profile/eu.anthropic.claude-sonnet-5"}'
# → ghi lại inferenceProfileArn trả về

# Gắn tag chi phí
aws bedrock tag-resource --region eu-central-1 \
  --resource-arn <INFERENCE_PROFILE_ARN> \
  --tags key=CostCenter,value=<CC> key=Project,value=vf-assistant
```

IAM cần: `bedrock:CreateInferenceProfile`, `bedrock:TagResource`, `bedrock:InvokeModel*`, `ce:UpdateCostAllocationTagsStatus`.

### 4.2 Kích hoạt tag chi phí — Console

1. Mở **AWS Billing and Cost Management** Console → menu trái `"Cost allocation tags"`.
2. Tab `"User-defined cost allocation tags"` → tick `CostCenter` và `Project` → `"Activate"`.
3. Chờ **~24 giờ** tag mới xuất hiện trong Cost Explorer. Tag **không hồi tố** — chỉ chi phí sau khi kích hoạt mới được gắn.

### 4.3 Dùng profile

Trong mã ứng dụng, thay `modelId` bằng **ARN của inference profile** khi gọi `Converse`. Kiểm chi phí ở **Cost Explorer** (Console): `"Cost Explorer"` → lọc theo tag `Project = vf-assistant`, nhóm theo `Service = Amazon Bedrock`.

### Tham số chính

- `--model-source copyFrom` = ARN **system inference profile** `eu.*` (không phải `::foundation-model/`).
- Tag chuẩn: `CostCenter`, `Project`. Tag **không hồi tố**, hiện sau ~24 giờ.
- Một profile ứng dụng gắn với **một** mô hình (model-specific); tạo riêng cho Sonnet 5 / Haiku 4.5 nếu muốn tách chi phí từng mô hình.

### Lưu ý bảo mật/chi phí

- Profile là chỗ móc chi phí theo dự án — kết hợp với Budgets (§12) đặt ngưỡng 80%.
- Không nhầm với **system inference profile** `eu.*` (do AWS tạo sẵn cho cross-region): profile ứng dụng là bản của bạn tạo để gắn tag, có thể bọc quanh chính `eu.*`.

**Doc:** [Application inference profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/cost-mgmt-application-inference-profiles.html) · [Cost allocation tags on inference profiles](https://aws.amazon.com/about-aws/whats-new/2024/11/amazon-bedrock-cost-allocation-tags-inference-profiles)

---

## 5. AgentCore Gateway

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Tạo một cửa an toàn để mô hình AI gọi được các công cụ và phần mềm tính bên ngoài, ví dụ engine tính kết cấu.
> **Cách hoạt động:** Gateway kiểm tra danh tính người gọi bằng "vé điện tử" (token), áp luật phân quyền xem ai được dùng công cụ nào, rồi mới chuyển yêu cầu tới công cụ; token còn được đổi sang loại hẹp quyền hơn trước khi ra ngoài.
> **Nếu làm sai thì sao:** Nếu tắt bước kiểm danh tính, bất kỳ ai cũng có thể gọi công cụ nội bộ — một lỗ hổng bảo mật nghiêm trọng khi hệ thống chứa dữ liệu thật.

**Mục tiêu:** biến facade tool (OpenAPI) thành tool mô hình gọi được; xác thực JWT của Keycloak; áp Cedar policy; đổi token khi ra facade.

> **Console CÓ hỗ trợ tạo Gateway** (`CreateGateway` API hoặc Console, "a few clicks"), nhưng phần lớn cấu hình tinh (Cedar policy, target theo OpenAPI, credential provider) thao tác nhanh hơn và rõ hơn qua CLI. Thứ tự **bắt buộc**: credential provider → target. Tạo target trước là lỗi "credential provider not found".

> **[CHỜ] Backend:** không tạo được Gateway target nếu chưa có schema OpenAPI của facade. Đây là điểm đồng bộ cứng — BE phát hành schema trước ([05](05-devops.md) 4D).

### 5.1 Tạo Gateway với inbound auth = CUSTOM_JWT

Console:
1. **Amazon Bedrock AgentCore** Console (trong Bedrock Console, mục `"AgentCore"`) → `"Gateways"` → `"Create gateway"`. **[kiểm lại nhãn]**
2. Đặt **inbound authorization** = **`CUSTOM_JWT`** (OAuth JWT), điền:
   - `"Discovery URL"`: `https://<keycloak-host>/realms/<realm>/.well-known/openid-configuration`.
   - `"Allowed clients"`: client ID của app.
   - `"Allowed audience"`: audience của endpoint MCP/Gateway.
   - Đặt **cả** `allowedClients` **và** `allowedAudience` — AWS đòi ít nhất một, đặt cả hai để token hợp lệ của client khác trên cùng Keycloak không gọi được.
3. **Cấm** `authorizerType = NONE` và `AUTHENTICATE_ONLY` ở mọi môi trường có dữ liệu thật ([06](06-bao-mat.md) §1a). Nếu có SCP thì chặn bằng condition key `bedrock-agentcore:GatewayAuthorizerType`.

### 5.2 Tạo credential provider (nếu target cần key/OAuth) — thường [CLI]

Nếu target là facade nội bộ dùng IAM/token exchange thì bỏ qua. Với target cần API key/OAuth ngoài:
- **Đừng** truyền key trên dòng lệnh: `export API_KEY=<key>` rồi:
```bash
aws bedrock-agentcore-control create-api-key-credential-provider --name <name> --api-key "$API_KEY"
# hoặc OAuth:
aws bedrock-agentcore-control create-oauth2-credential-provider --name <name> \
  --credential-provider-vendor <vendor> --oauth2-provider-config-input '...'
```
Service tự lưu vào Secrets Manager (đừng tự tạo secret tay).

### 5.3 Thêm target (tool/Lambda/OpenAPI)

1. Upload schema OpenAPI 3.0/3.1 của facade lên S3 (mô tả operation rõ — Gateway dùng nó sinh mô tả tool).
2. Console: trong Gateway → `"Add target"` → chọn kiểu (`OpenAPI` cho facade `vf-tools`, hoặc `Lambda`, hoặc MCP) → trỏ S3 URI schema → gắn credential provider (nếu có). **[kiểm lại nhãn]**
3. Chờ trạng thái target = **`READY`** (không có state `ACTIVE`; trạng thái lỗi là `FAILED`/`UPDATE_UNSUCCESSFUL` — đọc `statusReasons`).

### 5.4 Cedar policy và token exchange (egress)

- **Cedar policy** (AgentCore Policy) áp trước mọi lời gọi tool qua Gateway: ai gọi được tool nào, với dự án nào. Cấu hình ở mục `"Policy"` của AgentCore. Chưa xác minh Cedar kiểm được điều kiện số học (`b >= 100`); nếu không, dồn về facade — báo BE sớm (V-A9).
- **Egress/token exchange (RFC 8693):** Gateway đổi token người dùng lấy token hẹp trước khi gọi facade. Keycloak phải **bật token exchange**, audience khớp (kiểm chứng V-A6, chặn). Không chuyển tiếp thẳng token client xuống Main API ([06](06-bao-mat.md) §1a).

### Tham số chính

- Inbound: `authorizerType = CUSTOM_JWT`, `discoveryUrl`, `allowedClients`, `allowedAudience` (đặt **cả hai** ràng buộc). Cấm `NONE`/`AUTHENTICATE_ONLY`.
- Thứ tự tạo bắt buộc: credential provider → target.
- Target: schema OpenAPI 3.0/3.1 trên S3, endpoint HTTPS, chờ trạng thái `READY` (không có `ACTIVE`).

### Lưu ý bảo mật/chi phí

- Target endpoint bắt buộc HTTPS (Gateway từ chối HTTP).
- Bật CloudTrail cho mọi `bedrock-agentcore-control` API; mã hoá log KMS (key/token có thể lọt vào log).

**Doc:** [Creating your Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/create-gateway-methods.html) · [AgentCore Policy](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html)

---

## 6. AgentCore Harness / Runtime / Identity / Memory / Observability

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Dựng bộ máy điều phối vòng lặp "hỏi mô hình — gọi công cụ — nhận kết quả — trả lời" một cách tự động và có kiểm soát (gọi là Harness).
> **Cách hoạt động:** Harness quản số vòng lặp tối đa, thời gian chờ, danh sách công cụ được phép dùng và mô hình nào chạy; nó chạy cách ly trong mạng riêng của công ty để dữ liệu không ra internet.
> **Nếu làm sai thì sao:** Sáu giá trị mặc định của Harness đều không phù hợp dự án này, nhưng hệ thống vẫn chạy như thường nếu để nguyên — đây là loại lỗi nguy hiểm vì không lộ ra ngay, rất dễ lọt lên production mà không ai phát hiện.

**Mục tiêu:** vòng lặp gọi tool quản lý sẵn (Harness), chạy trong VPC, sáu mặc định bị ghi đè.

> **Console CÓ tạo Harness được** ("a few clicks in the console") hoặc qua AgentCore CLI (`npm i -g @aws/agentcore@preview`) / boto3. **Nhưng sáu mặc định của Harness đều SAI với dự án này và hệ thống vẫn chạy nếu để nguyên** — đây là loại lỗi tệ nhất. Vì phải ghi đè chính xác + có test đọc lại cấu hình sau deploy ([05](05-devops.md) 4B, [06](06-bao-mat.md) §12), **thiết kế coi cấu hình Harness là mã trong repo**, không dựng tay trên Console cho production. Console dùng để thử/khám phá; production đi bằng CLI/IaC.

### 6.1 Sáu mặc định phải ghi đè (dù tạo bằng Console hay CLI)

| Tham số | Mặc định | Đặt thành |
| --- | --- | --- |
| Model | `global.anthropic.claude-sonnet-4-6` | `eu.anthropic.claude-sonnet-5`, `apiFormat = converse_stream` |
| `maxIterations` | 75 | 5 (thường) / 7 (`optimize`) |
| `timeoutSeconds` | 3600 | 60 / 90 |
| `shell`, `file_operations` | Bật sẵn | Loại khỏi `allowedTools` |
| `memory` | Tự tạo managed memory | `disabled` |
| Inbound auth | SigV4 | `CUSTOM_JWT` + cả `allowedClients` và `allowedAudience` |

Thêm: `runtimeSessionId` 33–100 ký tự; guardrail qua `additionalParams.guardrailConfig`, `trace = disabled`.

### 6.2 Các bước (Console để thử; production dùng CLI)

Console: `"AgentCore"` → `"Harness"` → `"Create harness"` → đặt tên (chỉ chữ/số/gạch dưới, ≤ 40 ký tự), chọn execution role (§7), mở `"Advanced"` để đặt model/limits/tools/auth theo bảng trên → tạo → chờ `"READY"`. **[kiểm lại nhãn]**

CLI (production):
```bash
aws bedrock-agentcore-control create-harness \
  --harness-name "VfAssistant" \
  --execution-role-arn arn:aws:iam::<acct>:role/assistant-harness-exec \
  --max-iterations 7 --timeout-seconds 90 ...
aws bedrock-agentcore-control get-harness --harness-id <id>   # chờ READY
```

### 6.3 Mạng chế độ VPC — MÂU THUẪN NGUỒN, phải biết

> Có **hai bản mô tả khác nhau** về cách Harness kéo image trong VPC, tài liệu đã nêu rõ ([05](05-devops.md) 4C):
> - **Skill `amazon-bedrock` (bản v6):** Harness kéo image từ **ECR Public**, nên VPC-mode **BẮT BUỘC có NAT gateway**.
> - **Tài liệu AWS đọc trực tiếp (harness-security):** ở chế độ VPC, Harness kéo image từ **ECR riêng trong region**, **KHÔNG cần NAT gateway**, nhưng **bắt buộc** có interface endpoint `ecr.dkr`, `ecr.api`, `bedrock-runtime` và **gateway** endpoint cho `s3`; thiếu là phiên chết vì image-pull timeout.
>
> **Thiết kế này theo tài liệu AWS** (bản đọc trực tiếp, mô tả riêng chế độ VPC). **Quy tắc lần dựng đầu:** nếu phiên không khởi động với lỗi image-pull timeout **dù đã đủ bốn endpoint**, kiểm lại điểm này **TRƯỚC** khi thêm NAT gateway.

VPC endpoint phải có (tạo ở **VPC Console** → `"Endpoints"` → `"Create endpoint"`):

| Endpoint | Loại | Dùng cho |
| --- | --- | --- |
| `com.amazonaws.eu-central-1.ecr.dkr` | Interface | Kéo layer image Harness |
| `com.amazonaws.eu-central-1.ecr.api` | Interface | Xác thực/metadata ECR |
| `com.amazonaws.eu-central-1.s3` | Gateway | Layer image nằm trên S3 |
| `com.amazonaws.eu-central-1.bedrock-runtime` | Interface | Harness gọi mô hình |
| `com.amazonaws.eu-central-1.bedrock-agent-runtime` | Interface | `Assistant.Api` gọi `Retrieve` |

Bật `"Enable DNS name"` (private DNS) trên các interface endpoint. Gắn endpoint policy chỉ cho đúng action cần.

### 6.4 Runtime — không có code riêng, chỉ cấu hình IAM

Harness chạy **trên hạ tầng AgentCore Runtime**, nhưng thiết kế này **không deploy Runtime code tự viết** (không container ARM64, không loop tự viết) — vòng lặp do Harness quản (Strands). Vì vậy ở mức Runtime chỉ có cấu hình **IAM + audit**, không có bước Console tạo Runtime riêng:

- `InvokeHarness` đòi **cả** `bedrock-agentcore:InvokeHarness` **và** `bedrock-agentcore:InvokeAgentRuntime` — chỉ cấp cho `Assistant.Api`.
- **Không ai** có `bedrock-agentcore:InvokeAgentRuntimeCommand` (chạy lệnh shell trực tiếp trong microVM, bỏ qua LLM và `allowedTools`).
- CloudTrail data event cho `AWS::BedrockAgentCore::Runtime` (`InvokeAgentRuntime`, `InvokeAgentRuntimeCommand`) — Harness không có resource type CloudTrail riêng, truy qua Runtime (§12.2).

Nếu về sau cần vòng lặp/khung tuỳ biến (LangGraph, graph/workflow, bidirectional streaming) thì mới dựng Runtime code + container — ngoài phạm vi hiện tại.

### 6.5 Identity, Memory, Observability

- **Identity:** ba lớp OAuth (inbound JWT ← caller; outbound credential provider → API ngoài; Gateway → MCP upstream) — cấu hình độc lập; per-user identity xuống tool **chỉ có trên đường OAuth JWT**, SigV4 không mang danh tính người dùng.
- **Memory:** dự án đặt `disabled` (dùng PostgreSQL của assistant làm kho hội thoại, tránh hai kho song song và phí AgentCore Memory).
- **Observability:** trace/OTEL → CloudWatch (§12). Trace Harness ghi cả input/output tool (`shell`, `file_operations`) — mã hoá log group bằng KMS, đặt retention.

### Tham số chính

- Sáu giá trị ghi đè ở bảng §6.1 (model `eu.*` + `converse_stream`, `maxIterations`, `timeoutSeconds`, loại `shell`/`file_operations`, `memory=disabled`, inbound `CUSTOM_JWT`).
- `runtimeSessionId` 33–100 ký tự, một phiên cho một hội thoại (dựng từ `orgId`+`conversationId`).
- Năm VPC endpoint bắt buộc (§6.3), private DNS bật. `harnessName` chỉ chữ/số/gạch dưới, ≤ 40 ký tự.

### Lưu ý bảo mật

- Execution role: trust `bedrock-agentcore.amazonaws.com` + điều kiện `aws:SourceAccount` và `aws:SourceArn = arn:aws:bedrock-agentcore:eu-central-1:<acct>:harness/*` (§7). `CreateHarness` cần thêm `iam:PassRole` (thiếu là `AccessDenied` phổ biến nhất).
- Chỉ `Assistant.Api` có `InvokeHarness` + `InvokeAgentRuntime`. **Không ai** có `InvokeAgentRuntimeCommand` (chạy lệnh shell trực tiếp, bỏ qua LLM và `allowedTools`).

**Doc:** [Harness get started](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-get-started.html) · [Harness security](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-security.html)

---

## 7. IAM roles (assistant-runtime, assistant-ingest, service role KB, execution role Harness)

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Cấp cho mỗi thành phần đúng quyền tối thiểu cần dùng và không hơn — nguyên tắc "chìa khoá nào chỉ mở đúng cửa nấy".
> **Cách hoạt động:** Mỗi vai trò (role) được liệt kê chính xác được làm gì với tài nguyên nào; kèm các điều kiện chống việc một thành phần bị lợi dụng để truy cập nhầm sang dữ liệu không thuộc quyền.
> **Nếu làm sai thì sao:** Cấp quyền quá rộng thì một tài khoản bị lộ có thể chạm tới nhiều dữ liệu hơn mức cần, mở rộng thiệt hại; cấp thiếu quyền thì thành phần không chạy được.

**Mục tiêu:** hai role tách biệt cho runtime và ingest, least-privilege theo ARN, chống confused deputy.

### Các bước Console

1. **IAM** Console → `"Roles"` → `"Create role"`.
2. `"Trusted entity type"`:
   - `assistant-runtime`, `assistant-ingest`: chọn `"AWS service"` phù hợp nơi chạy (ECS task role → `"Elastic Container Service" → "Elastic Container Service Task"`).
   - Service role KB: trust `bedrock.amazonaws.com`.
   - Execution role Harness: trust `bedrock-agentcore.amazonaws.com`.
3. `"Add permissions"` → `"Create policy"` → tab `"JSON"` → dán policy least-privilege (mẫu dưới) → đặt tên → gắn vào role.
4. Với role có trust policy tuỳ biến (KB, Harness): sau khi tạo, mở tab `"Trust relationships"` → `"Edit trust policy"` → thêm điều kiện confused-deputy.

### Least-privilege chính

**`assistant-runtime`** (Assistant.Api): gọi mô hình chat, Rerank, `ApplyGuardrail`, `Retrieve`, `InvokeHarness`. Liệt kê ARN từng mô hình (Sonnet 5, Haiku 4.5, Sonnet 4.6), **không** `bedrock:*`. Kèm **Deny khi thiếu guardrail** (chỉ ARN mô hình chat):

```json
{
  "Effect": "Deny",
  "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
  "Resource": ["arn:aws:bedrock:eu-central-1::foundation-model/<mô hình chat>"],
  "Condition": {
    "StringNotEquals": {
      "bedrock:GuardrailIdentifier": "arn:aws:bedrock:eu-central-1:<acct>:guardrail/<id>:<version>"
    }
  }
}
```
`bedrock:Rerank` đòi `Resource: "*"` — tách statement riêng. Không gắn Deny-guardrail cho embedding.

**`assistant-ingest`** (Worker): đọc/ghi S3 nguồn; **không** Rerank, **không** Guardrails.

**Service role KB:** `s3:ListBucket` + `s3:GetObject` đúng ARN bucket, **kèm `aws:ResourceAccount`** = tài khoản của bạn (chặn đọc bucket trùng tên tài khoản khác). Nếu bucket SSE-KMS: `kms:Decrypt` với `kms:ViaService = s3.eu-central-1.amazonaws.com`. **Không** cần quyền trên khoá KMS của KB. Trust policy:

```json
{
  "Effect": "Allow",
  "Principal": {"Service": "bedrock.amazonaws.com"},
  "Action": "sts:AssumeRole",
  "Condition": {
    "StringEquals": {"aws:SourceAccount": "<acct>"},
    "ArnLike": {"aws:SourceArn": "arn:aws:bedrock:eu-central-1:<acct>:knowledge-base/*"}
  }
}
```
Sau khi tạo KB, thay `knowledge-base/*` bằng KB ID cụ thể.

**Execution role Harness:** trust `bedrock-agentcore.amazonaws.com` + `aws:SourceAccount` + `aws:SourceArn = ...:harness/*`; quyền pull ECR `harness-*` (`ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchCheckLayerAvailability`, `ecr:GetAuthorizationToken`), giới hạn Bedrock model ARN theo inference profile, không `sts:AssumeRole` sang role khác.

### Tham số chính

- Điều kiện chống confused-deputy: `aws:SourceAccount` + `aws:SourceArn` (KB, Harness), `aws:ResourceAccount` (S3 của service role KB), `kms:ViaService` (giải mã bucket nguồn).
- Không dùng `bedrock:*` / `AmazonBedrockFullAccess`; liệt kê ARN từng mô hình. `bedrock:Rerank` = statement `Resource: "*"` riêng.
- `iam:PassRole` cần cho `CreateHarness` (thiếu = `AccessDenied` phổ biến nhất).

### Lưu ý

- IAM có độ trễ lan truyền: lỗi "unable to assume role" ngay sau khi tạo role thì đợi ~10 giây rồi thử lại.
- Không dùng khoá AWS tĩnh trong image — chỉ dùng role.

**Doc:** [Bedrock IAM](https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html) · [KB permissions](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-permissions.html)

---

## 8. KMS — customer-managed key

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Tạo khoá mã hoá do chính công ty quản để bảo vệ mọi dữ liệu lưu trữ; năm nơi (cơ sở dữ liệu, kho tệp, kho tài liệu, bộ lọc an toàn, nhật ký) đều dùng khoá này.
> **Cách hoạt động:** Dữ liệu được xáo trộn bằng khoá của công ty; ai không có quyền dùng khoá thì không đọc được nội dung, kể cả khi lấy được tệp gốc.
> **Nếu làm sai thì sao:** Tắt hoặc xoá nhầm khoá thì toàn bộ dữ liệu mã hoá bằng nó lập tức thành không đọc được — vì vậy phải kiểm soát rất chặt ai có quyền tắt khoá.

**Mục tiêu:** một (hoặc vài) khoá công ty mã hoá năm chỗ: PostgreSQL, S3 nguồn, KB, Guardrail, CloudWatch Logs. Loại khoá: **customer-managed** ở cả năm chỗ (khoá AWS-owned không đạt phần lớn khung tuân thủ).

### Các bước Console

1. **KMS** Console → `"Customer managed keys"` → `"Create key"`.
2. `"Key type"` = `"Symmetric"`; `"Key usage"` = `"Encrypt and decrypt"`.
3. `"Alias"`: ví dụ `alias/vf-assistant`. (Cân nhắc khoá riêng cho S3-nguồn vs KB vì hai bên có nhóm quyền khác nhau.)
4. `"Key administrators"`: nhóm admin hạ tầng. `"Key users"`: các role §7 cần dùng khoá (theo từng chỗ).
5. Mở `"Edit"` key policy (JSON) để cấp đúng:
   - Khoá của **KB**: cấp quyền cho **danh tính TẠO KB** (không cấp cho service role của KB).
   - Khoá của **bucket nguồn**: cấp `kms:Decrypt` cho service role KB với điều kiện `kms:ViaService`.
6. Bật `"Automatic key rotation"`.

### Tham số chính

- **Khoá KB đặt lúc tạo KB, bất biến** (§2). Bedrock tự tạo grant lúc tạo KB, thu hồi khi xoá KB.
- Guardrail: khoá qua `--kms-key-id`/`"Customize encryption"` (§3). CloudWatch Logs: gắn khoá qua §12.

### Lưu ý

- Khoá dùng ở nhiều region phải cùng region với dịch vụ — tất cả ở `eu-central-1`.
- Tắt khoá là toàn bộ dữ liệu mã hoá bằng nó thành không đọc được — kiểm soát ai tắt được.

**Doc:** [Bedrock KMS](https://docs.aws.amazon.com/bedrock/latest/userguide/encryption.html) · [Guardrail KMS key policy](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-permissions-kms.html)

---

## 9. S3 — bucket policy, SSE-KMS mặc định, versioning, chặn public

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Cất các tệp tài liệu gốc một cách an toàn để làm nguồn cho kho tra cứu ở §2.
> **Cách hoạt động:** Kho tệp (bucket) bật mã hoá khi lưu, chặn mọi truy cập công khai, và giữ lại các bản cũ mỗi khi một tệp bị ghi đè.
> **Nếu làm sai thì sao:** Để lộ công khai thì tài liệu nội bộ ai trên internet cũng đọc được; không giữ bản cũ thì một lần ghi đè nhầm là mất bản gốc, không khôi phục được.

**Mục tiêu:** bucket tài liệu nguồn an toàn (tệp gốc + chunk + sidecar).

### Các bước Console

1. **S3** → `"Create bucket"` (đã tóm ở §2.1). Region `eu-central-1`.
2. **`"Block Public Access"`:** giữ `"Block all public access"` bật (cả bốn tuỳ chọn).
3. **`"Bucket Versioning"`:** `"Enable"` (giữ được bản cũ khi ghi đè nhầm; tệp gốc là nguồn sự thật).
4. **`"Default encryption"`:** `"SSE-KMS"` → khoá công ty (§8) → bật `"Bucket Key"`.
5. **Bucket policy** (tab `"Permissions"` → `"Bucket policy"` → `"Edit"`): siết `aws:SourceAccount`, chỉ cho service role KB đọc, từ chối request không TLS (`aws:SecureTransport = false` → Deny).
6. (Tuỳ) `"Object Lock"` nếu cần kho chỉ-ghi-một-lần cho audit ([06](06-bao-mat.md) §9).

### Tham số chính

- Block all public access: bật cả 4 tuỳ chọn. Versioning: `Enable`. Default encryption: SSE-KMS + Bucket Key.
- Bucket policy: `aws:SourceAccount`, Deny khi `aws:SecureTransport = false`, chỉ service role KB được `GetObject`.

### Lưu ý

- Nếu xuất log Bedrock sang S3: cùng bộ SSE-KMS + versioning + chặn public + bucket policy `aws:SourceAccount`.
- Chunk là dữ liệu dẫn xuất; tệp gốc mới cần versioning nghiêm.

**Doc:** [S3 security best practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)

---

## 10. Xác thực người dùng: Keycloak và/hoặc Cognito

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Dựng nguồn danh tính phát "vé điện tử" (token) xác nhận người đăng nhập là ai và thuộc công ty nào.
> **Cách hoạt động:** Người dùng đăng nhập một lần và nhận token; các thành phần khác trong hệ thống tin vào token đó thay vì tự kiểm mật khẩu, nên đăng nhập tập trung ở một chỗ.
> **Nếu làm sai thì sao:** Cấu hình sai đối tượng nhận token thì token của một ứng dụng khác trên cùng hệ thống có thể bị dùng chéo để truy cập trái phép dữ liệu.

**Mục tiêu:** nguồn danh tính phát JWT cho Assistant.Api và cho inbound auth `CUSTOM_JWT` của Gateway/Harness.

### 10.1 Keycloak (self-managed — NGOÀI AWS Console)

Kiến trúc dùng Keycloak làm nguồn sự thật danh tính ([06](06-bao-mat.md) §1). **Cấu hình Keycloak KHÔNG nằm trong AWS Console** — làm ở Keycloak Admin Console (self-managed):
- Thêm audience `assistant-api` vào token client `vfstructures-app` bằng **audience mapper**.
- **Bật token exchange (RFC 8693)** cho đường Gateway → facade (V-A6).
- Discovery URL `https://<host>/realms/<realm>/.well-known/openid-configuration` khai vào Gateway/Harness (§5, §6). Nếu Keycloak trong VPC, dùng `privateEndpoint`, không mở IdP ra internet.
- Phần AWS Console duy nhất liên quan: điền discovery URL/allowed clients/audience khi tạo Gateway/Harness.

### 10.2 Cognito User Pool (phương án AWS-native — nếu chọn)

Nếu muốn IdP AWS-native thay/song song Keycloak:
1. **Amazon Cognito** Console → `"User pools"` → `"Create user pool"`.
2. Cấu hình sign-in, MFA, password policy theo yêu cầu.
3. `"App integration"` → `"App clients"` → `"Create app client"`: lấy **client ID**, cấu hình `"Allowed OAuth flows"`, `"scopes"`.
4. **JWKS/Discovery** dùng cho `CUSTOM_JWT`:
   - Issuer/discovery: `https://cognito-idp.eu-central-1.amazonaws.com/<userPoolId>/.well-known/openid-configuration`.
   - JWKS: `.../.well-known/jwks.json`.
   - `"Audience"` = app client ID.
5. Khai discovery URL + allowed clients + audience vào Gateway/Harness (§5, §6).

### Tham số chính

- Keycloak (self-managed): audience mapper thêm `assistant-api`; bật token exchange (RFC 8693); discovery `.../realms/<realm>/.well-known/openid-configuration`.
- Cognito: discovery `.../cognito-idp.eu-central-1.amazonaws.com/<userPoolId>/.well-known/openid-configuration`, JWKS `.../.well-known/jwks.json`, audience = app client ID.
- Dù dùng IdP nào: đặt cả `allowedClients` và `allowedAudience`; claim `sub` là mã định danh.

### Lưu ý

- Claim `sub` trong token phải là mã định danh, không phải email/tên đăng nhập (CloudTrail lưu `sub`; PII lọt vào log không xoá theo retention).
- Đặt cả `allowedClients` và `allowedAudience` để token client khác cùng issuer không dùng chéo.

**Doc:** [Cognito user pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html) · [AgentCore inbound auth](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-security.html)

---

## 11. Cơ sở dữ liệu: RDS/Aurora PostgreSQL

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Cơ sở dữ liệu lưu hồ sơ tài liệu, hồ sơ vụ việc, lịch sử hội thoại, nhật ký chạy công cụ và nhật ký kiểm toán.
> **Cách hoạt động:** Dữ liệu được mã hoá khi lưu; một cơ chế cách ly (Row-Level Security) đảm bảo mỗi công ty chỉ đọc được dữ liệu của chính mình, do bản thân cơ sở dữ liệu ép buộc chứ không phó mặc cho ứng dụng.
> **Nếu làm sai thì sao:** Nếu ứng dụng kết nối bằng một vai trò có quyền vượt rào, cơ chế cách ly bị bỏ qua và dữ liệu giữa các công ty có thể lẫn sang nhau.

**Mục tiêu:** PostgreSQL giữ `document`, `case`, `tool_run`, `message`, `audit_event`, `clause_ref`; mã hoá at-rest bằng KMS; RLS cách ly `org_id` cho bảng `case`.

> **Ghi chú AD-17:** **không còn cần `pgvector`** (vector store ở MKB), nên ràng buộc phiên bản RDS PostgreSQL 15.18+/16.6+/17.3+ (sinh ra vì pgvector) **không còn**. Extension thật sự cần là **`fuzzystrmatch`** (cho `levenshtein()` gợi ý mã điều khoản, AD-29). Instance riêng hay chung nay là quyết định vận hành (Q4), không phải ràng buộc kỹ thuật. **Không** dùng Aurora DSQL (không hỗ trợ extension).

### Các bước Console

1. **RDS** Console → `"Create database"` → `"Standard create"` → `"PostgreSQL"` (hoặc `"Aurora PostgreSQL-Compatible"`).
2. `"Templates"`: `"Production"`. Đặt instance identifier, master credentials (nên dùng `"Manage master credentials in AWS Secrets Manager"`).
3. **`"Connectivity"`:** đặt trong VPC, **không** `"Public access"`; chọn/tạo **security group** chỉ cho phép cổng 5432 từ security group của Assistant.Api/Worker/facade (không mở `0.0.0.0/0`).
4. **`"Encryption"` (at-rest):** bật `"Enable encryption"` → chọn **khoá KMS công ty** (§8).
5. Cân nhắc `"RDS Proxy"` khi chạy nhiều instance (pool kết nối).
6. Tạo xong, kết nối và bật extension: `CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;`

### 11.1 Row-Level Security — [SQL], KHÔNG có trên Console

RLS **không cấu hình được trên Console**, chỉ bằng SQL. Bật cho bảng `case` để database ép cách ly `org_id` thay ứng dụng. **Điều kiện ràng buộc** ([06](06-bao-mat.md) dòng 112): role ứng dụng **không được là owner của bảng** và **không có `BYPASSRLS`**, nếu không RLS bị bỏ qua.

```sql
-- App phải kết nối bằng role KHÔNG phải owner và KHÔNG có BYPASSRLS
ALTER TABLE case ENABLE ROW LEVEL SECURITY;
ALTER TABLE case FORCE ROW LEVEL SECURITY;   -- ép cả với owner

CREATE POLICY case_org_isolation ON case
  USING (org_id = current_setting('app.current_org', true));

-- Ứng dụng đặt org của phiên trước mỗi truy vấn (từ Payment API, không từ client):
-- SET app.current_org = '<org_id>';
```

### Lưu ý bảo mật/chi phí

- `org_id` đặt vào session phải lấy từ **thuộc tính đã xác thực** (Payment API), không từ giá trị client gửi lên.
- Chỉ mục Btree trên `clause_ref (document_id, clause_path)` và `(document_id, clause_digits)` cho stage 1 phân giải mã điều khoản.

**Doc:** [RDS encryption](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html) · [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

## 12. Quan sát và chi phí

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Ghi nhật ký, giám sát hoạt động và kiểm soát ngân sách để hệ thống không âm thầm "vượt chi" ngoài tầm kiểm soát.
> **Cách hoạt động:** Hệ thống ghi lại các lời gọi mô hình (ở dạng tối giản để tránh lộ dữ liệu cá nhân), đặt cảnh báo khi chi phí chạm ngưỡng đã định và khi có mức chi bất thường.
> **Nếu làm sai thì sao:** Không bật cảnh báo ngân sách và phát hiện bất thường trước khi tăng lưu lượng thì chi phí có thể tăng vọt mà không ai hay, cho tới khi nhận hoá đơn cuối tháng.

**Mục tiêu:** log gọi mô hình (mã hoá), OTLP→CloudWatch, Budgets, Cost Anomaly Detection, Service Quotas.

### 12.1 Model invocation logging — Console

1. **Amazon Bedrock** Console → `"Settings"` (menu trái, có thể trong `"Bedrock configurations"`) → `"Model invocation logging"`. **[kiểm lại nhãn]**
2. Bật, chọn đích CloudWatch Logs (và/hoặc S3). **Production chỉ nên ghi metadata** — cân nhắc tắt ghi text vì bản gốc chưa che PII vào log nguyên văn (OPS-3). Logging bật theo **cả tài khoản và region** → dùng tài khoản AWS riêng cho assistant.
3. **Mã hoá log group:** CloudWatch → `"Log groups"` → chọn group → `"Actions" → "Encrypt log group"` (hoặc `associate-kms-key`) → khoá công ty (§8). Đặt `"Retention setting"` (GDPR đòi tối thiểu hoá — không giữ vô thời hạn).

### 12.2 OTLP → CloudWatch (Observability)

- Trace của Assistant.Api/AgentCore đẩy qua OTLP tới **CloudWatch** (X-Ray/Application Signals). Bật vended log delivery cho KB metric (`PutDeliverySource`/`PutDeliveryDestination`/`CreateDelivery` — [CLI/API], cần `bedrock:AllowVendedLogDeliveryForResource`).
- CloudTrail **data event** (bật ở CloudTrail Console → trail → `"Data events"`): `AWS::Bedrock::KnowledgeBase` (`Retrieve`), `AWS::Bedrock::Guardrail`, `AWS::BedrockAgentCore::Runtime` (`InvokeAgentRuntime`, `InvokeAgentRuntimeCommand`). Ba loại này **không** ghi mặc định.

### 12.3 AWS Budgets — Console

1. **AWS Billing and Cost Management** → `"Budgets"` → `"Create budget"` → `"Cost budget"`.
2. Đặt `"Budgeted amount"` hằng tháng, `"Filters"` → `Service = Amazon Bedrock` (hoặc lọc theo tag `Project` §4).
3. `"Alert threshold"` = **80%** (ACTUAL), thêm mốc 50%/100% khớp cảnh báo hạn mức token ([06](06-bao-mat.md) §5). Người nhận = email đội vận hành.

### 12.4 Cost Anomaly Detection — Console

1. **Billing and Cost Management** → `"Cost Anomaly Detection"` → `"Create monitor"`.
2. `"Monitor type"`: `"AWS services"` (hoặc theo tag/`Amazon Bedrock`). Tạo `"Alert subscription"` với ngưỡng và email.
3. **Bật Budgets + Anomaly Detection TRƯỚC khi tăng lưu lượng**, không phải sau ([05](05-devops.md)).

### 12.5 Service Quotas (TPM/RPM) — Console

1. **Service Quotas** Console → `"AWS services"` → `"Amazon Bedrock"`.
2. Tìm quota theo tên mô hình (ví dụ chứa "Claude" và "tokens per minute" / "requests per minute").
3. Chọn quota → `"Request increase at account level"` → nhập giá trị mong muốn → gửi. **Xin tăng TPM/RPM cho Sonnet 5 và Haiku 4.5 ngày đầu** (chờ 1–3 ngày làm việc). Quota mặc định tài khoản mới có thể là **0**.
4. Cảnh báo CloudWatch cho `InvocationThrottles > 0` và `ThrottlingException`.

### Tham số chính

- Budgets: ngưỡng ACTUAL 80% (+ 50%/100%), lọc `Service = Amazon Bedrock` hoặc tag `Project`.
- CloudTrail data event: `AWS::Bedrock::KnowledgeBase`, `AWS::Bedrock::Guardrail`, `AWS::BedrockAgentCore::Runtime`.
- Log group: mã hoá KMS công ty + retention hữu hạn. Service Quotas: TPM/RPM Sonnet 5 + Haiku 4.5, xin tăng ở account level.

### Lưu ý

- Đặt `maxTokens` tường minh mọi lời gọi — bỏ trống giữ chỗ quota theo trần mô hình, nguyên nhân phổ biến nhất của `ThrottlingException`.
- Claude 3.7+ có **burndown 5×** cho output token khi tính quota.

**Doc:** [Model invocation logging](https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html) · [CloudTrail Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/logging-using-cloudtrail.html) · [Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html) · [Service Quotas](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas.html)

---

## 13. Hạn mức token theo người dùng

> **Giải thích cho người không chuyên**
> **Việc này để làm gì:** Giới hạn số lượt hỏi và lượng sử dụng của mỗi người dùng để tránh lạm dụng và tránh chi phí phình to ngoài ý muốn.
> **Cách hoạt động:** AWS chỉ giới hạn ở mức toàn tài khoản, không giới hạn theo từng người; vì vậy hạn mức theo người và theo công ty phải được đếm trong cơ sở dữ liệu của ứng dụng.
> **Nếu làm sai thì sao:** Nếu đếm hạn mức trong bộ nhớ tạm của từng bản chạy, mỗi bản đếm riêng của mình, cộng lại vượt xa hạn mức dự kiến — một con đường khiến chi phí phình to.

**Mục tiêu:** làm rõ ranh giới giữa quota của AWS và hạn mức per-user của ứng dụng.

> **Bedrock KHÔNG có quota per-end-user.** Quota Bedrock chỉ ở mức **per-model, per-region** (TPM/TPD, và RPM với một số mô hình). Console chỉ lo **quota tài khoản** (§12.5) và **Budgets/Anomaly** (§12.3–12.4). **Không có nút nào trên Console** đặt "user X được N token/ngày".

### Phần này đo ở tầng ứng dụng (không phải Console)

Hạn mức per-user/per-org là logic của ứng dụng ([06](06-bao-mat.md) §2a, §5), không cấu hình trên AWS:
- **Mọi bộ đếm nằm trong PostgreSQL**, không trong bộ nhớ tiến trình (bộ đếm in-process đếm theo instance → N instance = N lần hạn mức, là đường denial-of-wallet).
- Cửa sổ trượt **20 lượt/phút/user**; **1 lượt đồng thời/user** ép bằng một hàng `active_turn` (`INSERT ... ON CONFLICT DO NOTHING`, 0 dòng ⇒ `429 concurrent_turn`).
- **Hạn mức token/ngày** theo user và org, **trừ SAU khi lượt kết thúc** từ `metadata.usage`; cảnh báo **50/80/100%** đặt trùng mốc AWS Budgets.
- Đếm token trước lượt: Sonnet 5 (dạng CRIS) có thể không hỗ trợ `CountTokens` trên `bedrock-runtime` — gọi thử một lần; không được thì dùng `bedrock-mantle` (`CountTokens`); cả hai không được thì ước lượng theo độ dài. Vì vậy **trừ sau** là phương án an toàn nhất ([06](06-bao-mat.md) §5).

### Tham số chính

- Ngưỡng ứng dụng: 20 lượt/phút/user, 1 lượt đồng thời/user, hạn mức token/ngày theo user + org, cảnh báo 50/80/100% (trùng mốc Budgets).
- Quota AWS (Console lo được): chỉ per-model/region (TPM/TPD, RPM một số mô hình) — không có per-end-user.

### Lưu ý

- Token không quy đổi thẳng ra tiền (token cache đọc giá khác; lượt `optimize` đắt hơn `doc_qa` dù cùng số token) → thêm hạn mức **chi phí ước tính/ngày** theo org khi đã có bảng đơn giá.

**Doc:** [Bedrock quotas](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas.html) · [CountTokens](https://docs.aws.amazon.com/bedrock/latest/userguide/count-tokens.html)

---

## Tổng hợp các phần "chỉ CLI/API/SQL" (không làm được trên Console)

| Phần | Việc | Vì sao |
| --- | --- | --- |
| §4 | **Tạo application inference profile** (`aws bedrock create-inference-profile` + `tag-resource`) | AWS: chỉ tạo được bằng CLI/API; Console chỉ kích hoạt tag trong Billing |
| §2 / §6 | Tham số `Retrieve` (`filter`, `numberOfResults`, ngưỡng điểm, `rerankingModelType`) và cấu hình Harness production | Là tham số phía ứng dụng / mã trong repo; Console chỉ tạo tài nguyên, không đặt các tham số này |
| §5 | Credential provider của Gateway (`create-api-key-credential-provider` / `create-oauth2-credential-provider`) | Truyền qua API để service tự lưu Secrets Manager; không nên nhập key trên Console/CLI trần |
| §11 | **Row-Level Security** trên bảng `case` (`ENABLE/FORCE ROW LEVEL SECURITY`, `CREATE POLICY`) | Chỉ có trong SQL của PostgreSQL; RDS Console không có |
| §11 | `CREATE EXTENSION fuzzystrmatch` | SQL trong database |
| §12 | Vended log delivery cho KB metric, một số data-event selector chi tiết | Cấu hình qua API/CLI |
| §13 | Hạn mức token per-user/org, `active_turn`, đếm token | Logic ứng dụng + SQL; Bedrock không có quota per-end-user |
| §1 | Biểu mẫu use-case Anthropic (có thể qua `PutUserCaseForModelAccess`) và nghiệm thu bằng lệnh gọi thử | Console playground có thể điền form, nhưng nghiệm thu phải gọi thật bằng CLI/SDK |

---

## Checklist nghiệm thu

**Nền tảng (thứ tự dựng)**
- [ ] KMS: khoá customer-managed ở `eu-central-1`, bật rotation; key policy cấp đúng (KB → danh tính tạo KB; bucket nguồn → service role qua `kms:ViaService`)
- [ ] S3 nguồn: SSE-KMS mặc định + Versioning + chặn toàn bộ public + bucket policy `aws:SourceAccount` + Deny non-TLS
- [ ] KB: trạng thái `Available`; `kmsKeyArn` = khoá công ty (đặt lúc tạo); embedding đã chốt; sync `Completed`; test truy vấn ra kết quả
- [ ] Guardrail: đã **`Create version`** (bản `1`), `trace = disabled`, mã hoá KMS; ứng dụng ghim `id:version`
- [ ] Inference profile: tạo bằng CLI, gắn tag `CostCenter`/`Project`, đã `Activate` tag trong Billing

**Danh tính và mạng**
- [ ] Keycloak: audience `assistant-api`, token exchange bật; (hoặc) Cognito user pool + app client + discovery/JWKS
- [ ] VPC endpoint đủ: `ecr.dkr`, `ecr.api`, `s3` (gateway), `bedrock-runtime`, `bedrock-agent-runtime`, private DNS bật
- [ ] Phiên Harness khởi động trong VPC không image-pull timeout (kiểm điểm 6.3 trước khi thêm NAT)

**Quyền (IAM)**
- [ ] `assistant-runtime` và `assistant-ingest` tách riêng, ARN cụ thể, không `bedrock:*`/`AmazonBedrockFullAccess`
- [ ] Deny khi thiếu guardrail chỉ áp ARN mô hình chat; guardrail cùng tài khoản với role
- [ ] Service role KB: trust có `aws:SourceAccount` + `aws:SourceArn` (siết về KB ID); S3 policy có `aws:ResourceAccount`
- [ ] Execution role Harness: `iam:PassRole` có; **không ai** có `InvokeAgentRuntimeCommand`

**AgentCore**
- [ ] Gateway inbound = `CUSTOM_JWT` với cả `allowedClients` và `allowedAudience`; cấm `NONE`/`AUTHENTICATE_ONLY`
- [ ] Target `READY`; Cedar policy áp; token exchange ra facade
- [ ] Sáu mặc định Harness đã ghi đè; test đọc lại cấu hình sau deploy

**Database**
- [ ] RDS/Aurora PostgreSQL trong VPC, không public, encryption KMS; `fuzzystrmatch` đã cài
- [ ] RLS bật + FORCE trên `case`; role app không phải owner, không `BYPASSRLS`

**Quan sát và chi phí**
- [ ] Model invocation logging: production chỉ metadata; log group mã hoá KMS + retention
- [ ] CloudTrail data event: `AWS::Bedrock::KnowledgeBase`, `AWS::Bedrock::Guardrail`, `AWS::BedrockAgentCore::Runtime`
- [ ] Budgets ngưỡng 80% (+50/100%) + Cost Anomaly Detection bật **trước** khi tăng lưu lượng
- [ ] Service Quotas: xin tăng TPM/RPM Sonnet 5 + Haiku 4.5 (ngày đầu); alarm `InvocationThrottles > 0`
- [ ] Hạn mức per-user/org đo ở tầng ứng dụng (PostgreSQL), không trông vào quota Bedrock

---

## Liên quan

| Cần gì | Đọc |
| --- | --- |
| Runbook CLI đầy đủ, bốn file guardrail, các bẫy production | [05-devops.md](05-devops.md) |
| Quyết định bảo mật, guardrail §13, IAM, ranh giới tin cậy Harness | [06-bao-mat.md](06-bao-mat.md) |
| Kiến trúc tổng thể, view triển khai §7, các AD | [01-kien-truc.md](01-kien-truc.md) |
| Bedrock và KMS ở năm chỗ, sơ đồ phụ thuộc | [so-do-luong/aws-bedrock-kms-kien-truc.md](../so-do-luong/aws-bedrock-kms-kien-truc.md) |
| Chi tiết DevOps dạng CDK, KMS, IAM, alarm, Budgets | [15-chi-tiet-devops.md](15-chi-tiet-devops.md) |
