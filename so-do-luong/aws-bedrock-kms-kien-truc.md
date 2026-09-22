# AWS · Bedrock và KMS

Hệ thống dùng năm dịch vụ Bedrock khác nhau, gọi qua mạng riêng bằng hai IAM role tách biệt. Dữ liệu ở năm chỗ được mã hóa bằng khóa KMS của công ty.

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/` — chủ yếu `06-tang-bedrock.md` §4, §7, §8 · `ship/00-thuat-ngu-va-nguon.md` · `ship/05-devops.md`

## Bedrock gồm năm dịch vụ

```
1.1 BEDROCK RUNTIME                             Bước 5, 7 · Assistant.Api
│  Gọi mô hình: Converse, ConverseStream
│  Haiku 4.5 phân loại · Sonnet 5 viết trả lời · Sonnet 4.6 dự phòng
│
1.2 BEDROCK KNOWLEDGE BASE                      Bước 6a · Assistant.Api, Assistant.Worker
│  Kho tài liệu: nạp từ S3, tạo embedding, lưu vector, trả kết quả Retrieve
│
1.3 BEDROCK RERANK                              Bước 6a · Assistant.Api
│  Chấm lại 40 chunk, giữ 8
│
1.4 BEDROCK GUARDRAILS                          Bước 3+4, 6b, 7, 8
│  ApplyGuardrail: API gọi riêng để soát một đoạn văn bản
│  guardrailConfig: gắn vào lời gọi mô hình, soát câu trả lời khi stream
│
1.5 AGENTCORE HARNESS + GATEWAY                 Bước 6b · Assistant.Api
   Vòng lặp gọi tool, Cedar policy, token exchange

Tất cả chạy ở eu-central-1 (Frankfurt)
```

## Đường gọi và quyền

```
Assistant.Api                                   IAM role: assistant-runtime
│  Được: gọi mô hình chat, Rerank, ApplyGuardrail
│  Không được: ghi vào kho tài liệu nguồn
▼
2.1 VPC ENDPOINT                                bedrock-runtime · bedrock-agent-runtime
│  Làm gì:     Đi tới Bedrock bằng mạng riêng, không ra Internet
│  Làm thế nào: Bật private DNS
│              Endpoint policy chỉ cho phép đúng các action cần dùng
▼
2.2 IAM POLICY                                  AWS kiểm trước khi cho gọi
│  Làm gì:     Chỉ cho gọi đúng thứ cần gọi
│  Làm thế nào: Liệt kê đúng ARN từng mô hình
│              Không dùng bedrock:* hay AmazonBedrockFullAccess
│              Chỉ gọi qua inference profile eu.*
│              ✗ gọi mô hình chat không kèm guardrail → Deny,
│                theo điều kiện bedrock:GuardrailIdentifier
▼
2.3 BEDROCK                                     eu-central-1

Assistant.Worker                                IAM role: assistant-ingest
   Được: đọc và ghi S3 tài liệu nguồn
   Không được: gọi Rerank, gọi Guardrails
```

## Nạp tài liệu vào Knowledge Base

```
Assistant.Worker
│  Cắt tài liệu theo điều khoản, ghi chunk kèm sidecar .metadata.json
▼
3.1 S3 TÀI LIỆU NGUỒN                           SSE-KMS · bật versioning
▼
3.2 KB ĐỒNG BỘ                                  managed connector
│  Làm gì:     Knowledge Base đọc file từ S3
│  Làm thế nào: KB đóng vai service role
│              Trust policy: chỉ đúng tài khoản, đúng knowledge base
│              Quyền đọc S3: đúng bucket, kèm aws:ResourceAccount
│              Bucket dùng SSE-KMS → service role cần kms:Decrypt,
│              điều kiện kms:ViaService = s3.eu-central-1.amazonaws.com
▼
3.3 KB LƯU VECTOR                               khóa KMS của Knowledge Base
   Tạo embedding, lưu vector store
   Mã hóa bằng khóa chỉ định lúc tạo KB
```

## KMS dùng ở năm chỗ

```
4.1 POSTGRESQL ASSISTANT                        hội thoại, tool_run, case, audit_event
│
4.2 S3 TÀI LIỆU NGUỒN                           file gốc
│
4.3 KNOWLEDGE BASE                              chunk và vector
│  Khóa chỉ định LÚC TẠO KB qua kmsKeyArn
│  Một khóa phủ cả dữ liệu tạm lúc nạp lẫn dữ liệu lưu lâu dài
│  Quyền ghi ở key policy, cấp cho danh tính TẠO ra KB
│  Service role của KB KHÔNG cần quyền trên khóa này
│  Bedrock tạo grant lúc tạo KB, xóa KB thì grant bị thu hồi
│
4.4 GUARDRAIL                                   --kms-key-id
│  Cấu hình chứa danh sách chủ đề cấm, các mẫu nhận dạng tự viết
│
4.5 CLOUDWATCH LOGS                             log group
   Log có thể chứa PII chưa che

Loại khóa: customer-managed ở cả năm chỗ, không dùng khóa AWS-owned mặc định
```

## Log và PII

```
Guardrail che PII chỉ trên response trả về
│
├── Bật model invocation logging → bản gốc chưa che vào log nguyên văn
│   Màn hình hiện {EMAIL}, trong log vẫn là email thật
▼
Cách xử lý
   5.1 Production chỉ ghi metadata: model, số token, độ trễ
   5.2 Nội dung cần audit lưu ở bảng message, bản đã che PII
   5.3 Log group mã hóa bằng khóa customer-managed, siết quyền đọc, đặt retention
   5.4 Guardrail đặt trace = disabled
   5.5 Assistant dùng tài khoản AWS riêng, vì logging bật theo cả tài khoản và region
```

## Từ khóa

**Bedrock Runtime**
<!-- alias: BEDROCK RUNTIME -->
- Là gì: Endpoint của Amazon Bedrock để gọi mô hình AI, qua các API `Converse`, `ConverseStream`, `InvokeModel`.
- Ở kiến trúc này: `Assistant.Api` gọi Haiku 4.5 ở bước 5, Sonnet 5 ở bước 7, Sonnet 4.6 khi fallback. Tính phí theo token.
- Vì sao: Một cổng chung cho nhiều mô hình. Đổi mô hình chỉ cần đổi ID và dựng lại request, không đổi hạ tầng.
- Nguồn: `06-tang-bedrock.md` §1, §2

**eu-central-1**
<!-- alias: eu-central-1 -->
- Là gì: Mã vùng AWS ở Frankfurt, Đức.
- Ở kiến trúc này: Mọi dịch vụ Bedrock, KMS, CloudWatch của Assistant đều đặt ở đây.
- Vì sao: Dữ liệu phải nằm trong EU (AD-03, AD-14). Người dùng ở cả Việt Nam lẫn Pháp; câu hỏi về cư trú dữ liệu (Q1) vẫn chờ công ty trả lời.
- Nguồn: `06-tang-bedrock.md` §10a, §11

**Bedrock Knowledge Base**
<!-- alias: BEDROCK KNOWLEDGE BASE -->
- Là gì: Dịch vụ quản lý trọn gói kho tài liệu: nhận file, tạo embedding, lưu vector store, trả kết quả tìm kiếm.
- Ở kiến trúc này: Dùng bản managed (MKB). Worker ghi chunk lên S3, KB tự đồng bộ. `Assistant.Api` gọi `Retrieve` kèm filter theo scope.
- Vì sao: Không phải tự vận hành vector store (AD-17). Cái giá: không đổi được mô hình embedding và không đổi được khóa KMS sau khi tạo kho.
- Nguồn: `03-rag.md` · `kien-truc-day-du.md` §3.3

**Bedrock Rerank**
<!-- alias: BEDROCK RERANK -->
- Là gì: API chấm lại mức liên quan giữa câu hỏi và từng chunk.
- Ở kiến trúc này: Mô hình Cohere Rerank 3.5. Action `bedrock:Rerank` bắt buộc `Resource: "*"`, nên tách thành một statement riêng trong IAM policy.
- Vì sao: `bedrock:InvokeModel` cho mô hình rerank thì vẫn giới hạn theo ARN; chỉ riêng action `Rerank` là AWS đòi `*`.
- Nguồn: `06-tang-bedrock.md` §7

**Bedrock Guardrails**
<!-- alias: BEDROCK GUARDRAILS -->
- Là gì: Bộ lọc an toàn của AWS. `ApplyGuardrail` là API gọi riêng để soát một đoạn văn bản. `guardrailConfig` là cấu hình gắn thẳng vào lời gọi mô hình.
- Ở kiến trúc này: `ApplyGuardrail` ở pha chuẩn bị (chặn tấn công, che PII), ở tool facade, và sau bước 8. `guardrailConfig` ở bước 7, chế độ `sync`.
- Vì sao: `guardrailConfig` không soát `toolResult`, nên nội dung tool trả về phải qua `ApplyGuardrail` riêng. Thiếu `guardrailVersion` thì guardrail không chạy mà không báo lỗi.
- Nguồn: `06-tang-bedrock.md` §4

**AgentCore**
<!-- alias: AGENTCORE HARNESS + GATEWAY -->
- Là gì: Nhóm dịch vụ AWS cho agent. Harness quản lý vòng lặp gọi tool. Gateway biến API nội bộ thành tool mô hình gọi được.
- Ở kiến trúc này: Chỉ dùng ở bước 6b. Chỉ `Assistant.Api` có quyền `InvokeHarness`; không ai có `InvokeAgentRuntimeCommand`.
- Vì sao: `InvokeAgentRuntimeCommand` chạy lệnh trực tiếp, bỏ qua mô hình và danh sách tool cho phép.
- Nguồn: `04-tool-calling.md` §8

**IAM role**
<!-- alias: IAM role -->
- Là gì: Danh tính của một service khi gọi AWS. AWS xét role đó được làm gì qua các IAM policy gắn vào nó.
- Ở kiến trúc này: Hai role riêng cho `Assistant.Api` và `Assistant.Worker`, thêm một service role riêng cho Knowledge Base.
- Vì sao: Không có access key cứng trong code. Quyền gắn với service, thu hồi hoặc siết lại ở một chỗ.
- Nguồn: `06-tang-bedrock.md` §7

**assistant-runtime và assistant-ingest**
<!-- alias: assistant-runtime, assistant-ingest -->
- Là gì: Hai IAM role tách riêng. `assistant-runtime` cho `Assistant.Api` phục vụ người dùng. `assistant-ingest` cho `Assistant.Worker` nạp tài liệu.
- Ở kiến trúc này: `assistant-runtime` không ghi được kho tài liệu nguồn. `assistant-ingest` không gọi được Rerank hay Guardrails.
- Vì sao: Giới hạn phạm vi thiệt hại. Một bên bị chiếm quyền thì kẻ tấn công chỉ làm được phần việc của bên đó.
- Nguồn: `06-tang-bedrock.md` §7

**VPC endpoint**
<!-- alias: VPC ENDPOINT -->
- Là gì: Cổng mạng riêng từ VPC của mình tới một dịch vụ AWS. Lưu lượng không đi ra Internet công cộng.
- Ở kiến trúc này: Hai endpoint `bedrock-runtime` và `bedrock-agent-runtime`, bật private DNS. Kiểm ở M0 rằng luồng `ConverseStream` thật sự đi qua endpoint.
- Vì sao: Câu hỏi và tài liệu không rời mạng riêng. Riêng AgentCore Harness vẫn cần NAT gateway, vì Harness kéo image từ ECR Public mà ECR Public không có VPC endpoint.
- Nguồn: `06-tang-bedrock.md` §7 · `04-tool-calling.md` §8

**Endpoint policy**
<!-- alias: Endpoint policy -->
- Là gì: Policy gắn lên VPC endpoint, quy định request nào được đi qua endpoint đó.
- Ở kiến trúc này: Chỉ cho phép đúng các action trong IAM policy, thay cho policy mặc định cho phép toàn bộ.
- Vì sao: Thêm một lớp chặn: kể cả role có quyền rộng hơn, request vẫn không đi qua endpoint được.
- Nguồn: `06-tang-bedrock.md` §7

**Least privilege theo ARN**
<!-- alias: đúng ARN -->
- Là gì: ARN là mã định danh duy nhất của một tài nguyên AWS. Least privilege là chỉ cấp đúng quyền cần dùng.
- Ở kiến trúc này: Policy liệt kê ARN của từng inference profile và từng mô hình: Sonnet 5, Haiku 4.5, Sonnet 4.6, Cohere Embed, Cohere Rerank. Thêm mô hình mới thì sửa policy.
- Vì sao: `bedrock:*` cho phép gọi mọi mô hình, kể cả qua profile có thể route ra ngoài EU.
- Nguồn: `06-tang-bedrock.md` §7

**Inference profile eu.***
<!-- alias: inference profile eu.* -->
- Là gì: Inference profile là tên gọi mô hình kèm phạm vi các vùng được phép chạy. `eu.` chỉ chạy trong các vùng EU.
- Ở kiến trúc này: Sonnet 5 không có bản chạy trong một region duy nhất trên `bedrock-runtime`, nên bắt buộc dùng `eu.anthropic.claude-sonnet-5`.
- Vì sao: Profile `global.*` có thể route request ra ngoài EU. Mặc định của AgentCore Harness là `global.anthropic.claude-sonnet-4-6`, nên phải đặt tường minh.
- Nguồn: `06-tang-bedrock.md` §1 · `04-tool-calling.md` §8

**Deny khi thiếu guardrail**
<!-- alias: bedrock:GuardrailIdentifier -->
- Là gì: Statement `Deny` trong IAM policy, điều kiện `bedrock:GuardrailIdentifier` khác đúng ARN guardrail đã đánh số version.
- Ở kiến trúc này: Áp cho mọi mô hình chat. Hệ quả: lời gọi Haiku ở bước 5 cũng phải kèm guardrail. Không áp cho embedding, vì Cohere Embed không hỗ trợ Guardrails.
- Vì sao: Lập trình viên quên gắn guardrail thì AWS từ chối request, không phụ thuộc việc có nhớ hay không. Điều kiện chỉ có hiệu lực khi guardrail cùng tài khoản với role gọi.
- Nguồn: `06-tang-bedrock.md` §7 · `ship/06-bao-mat.md`

**sidecar .metadata.json**
<!-- alias: sidecar -->
- Là gì: File đi kèm mỗi chunk trên S3, chứa thuộc tính để lọc: `scope_key`, `status`, `clause_path`, `edition`…
- Ở kiến trúc này: Worker ghi cùng lúc với chunk. KB đọc sidecar lúc đồng bộ, thuộc tính trong đó thành metadata filter.
- Vì sao: Sidecar không đọc được thì filter theo scope có thể trả về tài liệu của mọi organization mà không báo lỗi. Đây là kiểm chứng V-K4.
- Nguồn: `03-rag.md` · `ship/00-thuat-ngu-va-nguon.md`

**SSE-KMS**
<!-- alias: SSE-KMS -->
- Là gì: Server-side encryption của S3 dùng khóa KMS: S3 tự mã hóa file khi ghi, tự giải mã khi đọc.
- Ở kiến trúc này: Bucket tài liệu nguồn bật SSE-KMS và versioning.
- Vì sao: File gốc là nguồn sự thật; chunk chỉ là dữ liệu dẫn xuất. Versioning giữ được bản cũ khi ghi đè nhầm.
- Nguồn: `18-guideline-devops.md` · `ship/05-devops.md`

**managed connector**
<!-- alias: managed connector -->
- Là gì: Kết nối có sẵn của Knowledge Base để tự đồng bộ tài liệu từ một nguồn, ở đây là S3.
- Ở kiến trúc này: KB đọc chunk và sidecar từ bucket, tạo embedding, lưu vào vector store của nó.
- Vì sao: Worker chỉ lo cắt tài liệu và ghi file; việc embedding và lập chỉ mục do KB làm.
- Nguồn: `01-kien-truc-tong-the.md` §2 · `03-rag.md`

**Service role của Knowledge Base**
<!-- alias: service role -->
- Là gì: IAM role mà Bedrock "đóng vai" để đi đọc dữ liệu thay cho KB. KB không tự đọc được S3.
- Ở kiến trúc này: Quyền `s3:ListBucket`, `s3:GetObject` đúng bucket. Không dùng chung một policy cho nhiều role; AWS ghi đây là ràng buộc khi dùng service role.
- Vì sao: Role này không cần quyền trên khóa KMS của KB. Nó chỉ cần `kms:Decrypt` khi bucket nguồn dùng SSE-KMS, và đó là khóa khác.
- Nguồn: `ship/00-thuat-ngu-va-nguon.md`

**Trust policy và confused deputy**
<!-- alias: Trust policy -->
- Là gì: Trust policy quy định ai được đóng vai một role. Confused deputy là tình huống một dịch vụ có quyền bị lừa dùng quyền đó thay cho kẻ tấn công.
- Ở kiến trúc này: Chỉ `bedrock.amazonaws.com` được đóng vai, với điều kiện `aws:SourceAccount` là tài khoản của mình và `aws:SourceArn` là knowledge base của mình.
- Vì sao: Không có hai điều kiện này thì một KB ở tài khoản khác có thể mượn role để đọc bucket của công ty. Tạo KB xong nên thay `*` trong ARN bằng ID cụ thể của KB.
- Nguồn: `ship/00-thuat-ngu-va-nguon.md`

**aws:ResourceAccount**
<!-- alias: aws:ResourceAccount -->
- Là gì: Điều kiện IAM kiểm tài nguyên đang truy cập thuộc tài khoản nào.
- Ở kiến trúc này: Gắn vào quyền `s3:GetObject` của service role, bằng ID tài khoản của công ty.
- Vì sao: Chặn role bị dùng để đọc một bucket trùng tên ở tài khoản khác. Điều kiện này có sẵn trong policy mẫu của AWS nhưng dễ bị bỏ sót.
- Nguồn: `ship/00-thuat-ngu-va-nguon.md`

**kms:ViaService**
<!-- alias: kms:ViaService -->
- Là gì: Điều kiện IAM cho phép dùng khóa KMS chỉ khi request đi qua một dịch vụ AWS cụ thể.
- Ở kiến trúc này: Service role có `kms:Decrypt` trên khóa của bucket nguồn, điều kiện `kms:ViaService = s3.eu-central-1.amazonaws.com`.
- Vì sao: Role chỉ giải mã được khi đọc file qua S3. Gọi thẳng KMS bằng role đó thì bị từ chối.
- Nguồn: `ship/05-devops.md`

**KMS**
<!-- alias: khóa KMS -->
- Là gì: Key Management Service, nơi giữ khóa mã hóa. Khóa không bao giờ rời khỏi KMS. Dịch vụ cần mã hóa hay giải mã dữ liệu thì nhờ KMS làm, và KMS kiểm người gọi có quyền trên khóa không.
- Ở kiến trúc này: Dùng ở năm chỗ: PostgreSQL assistant, S3 tài liệu nguồn, Knowledge Base, cấu hình guardrail, CloudWatch Logs.
- Vì sao: Dữ liệu chứa câu hỏi của kỹ sư, tài liệu nội bộ của khách hàng, và có thể có PII. Khóa của công ty cho biết ai đã dùng khóa, và tắt khóa là dữ liệu không đọc được nữa.
- Nguồn: `06-tang-bedrock.md` §7, §8 · `10-trien-khai.md`

**kmsKeyArn**
<!-- alias: kmsKeyArn -->
- Là gì: Tham số `serverSideEncryptionConfiguration.kmsKeyArn` chỉ định khóa KMS cho Knowledge Base.
- Ở kiến trúc này: Chỉ đặt được **lúc tạo KB**. Một khóa phủ cả dữ liệu tạm lúc nạp lẫn dữ liệu lưu để lập chỉ mục.
- Vì sao: Tạo KB mà quên tham số này thì KB dùng khóa AWS-owned, muốn đổi phải tạo lại KB.
- Nguồn: `20-tai-lieu-thiet-ke-kien-truc.md` · `ship/00-thuat-ngu-va-nguon.md`

**Key policy**
<!-- alias: key policy -->
- Là gì: Policy gắn trực tiếp lên một khóa KMS, quy định ai được dùng và quản lý khóa.
- Ở kiến trúc này: Với khóa của KB, quyền cấp trong key policy cho **danh tính tạo ra KB**, không cấp cho service role.
- Vì sao: Đây là chỗ tài liệu ghi là dễ suy luận sai. Giả định tự nhiên là service role cần quyền KMS; AWS ghi rõ là không cần.
- Nguồn: `ship/00-thuat-ngu-va-nguon.md`

**Grant**
<!-- alias: grant -->
- Là gì: Quyền tạm thời trên một khóa KMS, cấp cho một dịch vụ, không phải sửa key policy.
- Ở kiến trúc này: Bedrock tự tạo grant trên khóa lúc tạo KB, và tự thu hồi khi xóa KB.
- Vì sao: Quyền của Bedrock trên khóa gắn với vòng đời của KB. Xóa KB là Bedrock hết quyền dùng khóa.
- Nguồn: `ship/00-thuat-ngu-va-nguon.md`

**--kms-key-id của guardrail**
<!-- alias: --kms-key-id -->
- Là gì: Tham số chỉ định khóa KMS khi tạo guardrail.
- Ở kiến trúc này: API không bắt buộc, nhưng thiết kế bắt buộc.
- Vì sao: Cấu hình guardrail chứa danh sách chủ đề cấm và các mẫu nhận dạng tự viết, là thông tin nhạy cảm.
- Nguồn: `06-tang-bedrock.md` §4a · `ship/05-devops.md`

**Customer-managed và AWS-owned**
<!-- alias: customer-managed -->
- Là gì: Khóa AWS-owned do AWS quản, mặc định, không xem được ai dùng, không thu hồi được. Khóa customer-managed do công ty quản, xem được lịch sử dùng qua CloudTrail, tắt được.
- Ở kiến trúc này: Dùng customer-managed ở cả năm chỗ.
- Vì sao: Tài liệu ghi rõ khóa mặc định của AWS không đạt yêu cầu của phần lớn khung tuân thủ.
- Nguồn: `06-tang-bedrock.md` §4a

**Model invocation logging**
<!-- alias: model invocation logging -->
- Là gì: Tính năng của Bedrock ghi lại mọi lời gọi mô hình, gồm cả nội dung request và response, vào CloudWatch Logs hoặc S3.
- Ở kiến trúc này: Production chỉ ghi metadata. Staging và dev ghi đầy đủ để gỡ lỗi, retention ngắn.
- Vì sao: Guardrail che PII chỉ trên response trả về, còn log vẫn giữ bản gốc. Tính năng bật theo cả tài khoản và region, nên bật lên là ghi cả lời gọi của nhóm khác nếu dùng chung tài khoản.
- Nguồn: `06-tang-bedrock.md` §8

**trace = disabled**
<!-- alias: trace = disabled -->
- Là gì: Tùy chọn của guardrail: bật `trace` thì response trả về chi tiết thứ đã kích hoạt bộ lọc.
- Ở kiến trúc này: Luôn tắt.
- Vì sao: Chi tiết đó gồm cả nguyên văn đoạn chứa PII, và đi vào mọi nơi response đi qua: log, giám sát, báo cáo lỗi.
- Nguồn: `06-tang-bedrock.md` §4a

## Chưa rõ trong tài liệu

- Instance PostgreSQL assistant dùng riêng hay dùng chung với VFSoftware vẫn là việc phải quyết. Kéo theo: dùng khóa KMS riêng hay dùng chung.
- Khi tắt ghi text, model invocation logging còn giữ `identity.arn`, số token, `requestMetadata` hay không phải xác minh ở M0.
- Muốn ép guardrail cho nhiều tài khoản thì điều kiện IAM không đủ, phải dùng `PutEnforcedGuardrailConfiguration` hoặc chính sách Bedrock của AWS Organizations.
- `06-tang-bedrock.md` §7 vẫn cho `assistant-ingest` gọi embedding qua `bedrock-runtime`. Từ AD-17, embedding do Knowledge Base tự làm, nên quyền này có thể không còn cần.
