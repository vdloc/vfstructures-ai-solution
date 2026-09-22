# 16 · Hướng dẫn triển khai — đội Backend

> **Đã cập nhật trong `ship/`.** File này ghi hướng dẫn trước lượt rà soát nguồn 21/09/2026. Bản đã sửa: `ship/03-backend.md`. Từ AD-28 (22/09/2026), case tự ghi khi engine tính đạt và không còn bước duyệt: xem `ship/12-tra-case.md`.

Tài liệu thi công, viết theo sáu bước của một lượt hỏi. Mỗi bước có: việc phải làm, tiêu chí nghiệm thu, rủi ro phải canh, và thứ mà đội khác đang chờ ở mình.

Thiết kế gốc ở [02](02-assistant-service.md), [03](03-rag.md), [04](04-tool-calling.md), [05](05-case-memory.md). Giải thích bằng lời thường ở [15](15-hoi-dap-tung-buoc.md). Trang tương tác: sáu bước có sơ đồ, dữ liệu vào ra và mã mẫu.

Ký hiệu: **[T1]** việc tuần 1 · **[CHẶN]** đội khác không làm được nếu thiếu · **[CHỜ CHỐT]** phụ thuộc quyết định chưa chốt.

---

## Việc tuần 1, xếp theo thứ tự chặn

Backend chặn cả hai đội còn lại ở hai chỗ. Làm hai việc này trước mọi thứ khác.

| # | Việc | Ai đang chờ | Hạn |
| --- | --- | --- | --- |
| 1 | **Hợp đồng SSE 11 sự kiện + schema `ChatRequest`** | Frontend — không dựng được luồng giả nếu thiếu | Hết ngày 2 |
| 2 | **Schema OpenAPI của facade tool** | DevOps — không tạo được Gateway target nếu thiếu | Hết ngày 3 |
| 3 | Kiểm chứng **V-A1**: `InvokeHarness` gửi được Bearer JWT từ .NET | Cả dự án — trượt thì đổi kiến trúc vòng lặp | Hết ngày 3 |
| 4 | Kiểm chứng **V-K3**: tạo Managed KB và data source **bằng mã .NET** | Cả nhánh RAG — trượt thì phải đưa lại quyết định lên bàn ngay | Hết ngày 3 |

Hai việc đầu là **tài liệu, không phải mã chạy được**. Phát hành bản nháp đủ dùng còn hơn bản hoàn hảo muộn ba ngày.

---

## Bước 1 — Nhận request, mở SSE

### Phải làm

- [T1] [CHẶN] Định nghĩa `ChatRequest` và hợp đồng 11 sự kiện SSE. Có version cùng đường dẫn `/v1`.
- Endpoint `POST /v1/chat` trả `text/event-stream`, **flush sau mỗi sự kiện**.
- Sinh `requestId` tương quan ngay khi nhận request; gắn vào mọi log và mọi sự kiện `error`.
- Validate `context`: coi là gợi ý của client, không phải căn cứ phân quyền.

### Nghiệm thu

- `curl -N` qua đúng tuyến production thấy sự kiện đến rời rạc, không dồn cục.
- Gửi `context` chứa `projectId` mà người dùng không có quyền → lượt vẫn bị chặn đúng ở bước 2, không rò rỉ gì.

### Rủi ro

**BE-1 · `pageContext` là dữ liệu không tin cậy.** Dùng được để biết người dùng đang nhìn gì; không bao giờ dùng để quyết định họ được đọc gì. Quyền lấy từ token, qua `AccessScopeResolver`.

**R20 · Kết quả trong `pageContext` có thể lệch bản đã lưu ở server.** Khi lệch, ưu tiên bản đã lưu và phát cảnh báo — [04](04-tool-calling.md) §9.

---

## Bước 2 — Cổng chặn và chuẩn bị song song

### Phải làm

- Middleware ba cổng, **đúng thứ tự rẻ trước**: rate limit → JWT → quota ngày.
- Kill switch đọc từ cấu hình nóng, trả `503`, không cần deploy lại.
- `AccessScopeResolver` + cache 60 giây trong bộ nhớ tiến trình (không có Redis).
- Ba việc độc lập chạy bằng `Task.WhenAll`: scope, guardrail input, **3 lượt gần nhất** (AD-22 — đếm theo lượt, không theo message; ba con số cửa sổ nằm trong `ConversationWindowOptions`, không viết cứng).
- **Mọi bộ đếm giới hạn nằm trong PostgreSQL, không nằm trong bộ nhớ tiến trình** (AD-23). Bộ giới hạn mặc định của ASP.NET Core đếm theo instance; chạy nhiều task là nhân giới hạn lên bấy nhiêu lần.
- **Giới hạn một lượt đang chạy trên mỗi user**, ép bằng bảng `active_turn` với `INSERT ... ON CONFLICT DO NOTHING`. Xóa hàng trong `finally`, không xóa ở đường thành công — quên là user bị khóa cho tới khi job quét dọn chạy. Lượt thứ hai trả `429 concurrent_turn`, **không** hủy lượt đang chạy.
- Mọi lỗi trả **mã và hướng xử lý**, không chỉ thông điệp. Kèm `requestId`.

### Nghiệm thu

- Test khẳng định ba việc chạy thật sự song song: tổng thời gian ≈ cái chậm nhất, không phải tổng ba cái.
- **Test khẳng định guardrail có chạy**: bắn một prompt chắc chắn bị chặn, kiểm `stopReason`. Đây là test bắt buộc, không phải tùy chọn.

### Rủi ro

**BE-2 · Không có Redis.** Cache scope nằm trong bộ nhớ tiến trình, nên khi scale nhiều instance mỗi instance có cache riêng. Chấp nhận được vì TTL 60 giây, nhưng phải biết: **thu hồi quyền có độ trễ tới 60 giây**. Nếu nghiệp vụ không chấp nhận, đây là chỗ cần bàn lại chứ không phải chỗ tự ý sửa.

**BE-3 · Thiếu `GuardrailVersion` thì guardrail không được áp dụng và không có lỗi nào được ném ra.** Hỏng im lặng. Chỉ phát hiện được bằng test chủ động.

---

## Bước 3 — Định tuyến

### Phải làm

- Prompt router và schema structured output để trong repo dưới dạng hằng số **có version**, không nội suy chuỗi.
- `Temperature = 0`, `MaxTokens = 400`.
- Bộ eval độ chính xác nhãn trên câu hỏi kỹ thuật, **tách theo ngôn ngữ** tiếng Pháp và tiếng Anh.
- Đường lùi khi Haiku lỗi: mặc định `doc_qa`, `search_query = raw turn`, gắn cờ `degraded_routing` vào `retrieval_log`.
- **Regex bóc mã điều khoản** — giữ lại kể cả khi bỏ luật nhanh. Nó phục vụ nhánh trigram ở bước 4, không phải phục vụ định tuyến.

### AD-16 — đã chốt 20/09/2026

- Router trả thêm khối `case_hints` = `{ tool_id, params: [{key, value, unit}] }`. `key` và `unit` là enum sinh từ `tools.manifest.yaml`.
- `MaxTokens` của router đặt **300–400**, không giữ 150. Sau mỗi lần gọi assert `stopReason != "max_tokens"`; chạm trần thì JSON đứt, lượt đó rơi về đường lùi kèm `degraded_routing`.
- `case_hints` **chỉ vào mệnh đề lọc và hàm chấm điểm**. Không bao giờ vào tham số gọi engine. P1 không đổi.

### AD-15 — đã chốt 20/09/2026

Luật nhanh **ra khỏi đường chính**. Ba việc kèm theo:

1. Xóa luật khỏi hot path, giữ lại **chỉ làm đường lùi** khi router lỗi hoặc quá thời gian.
2. Yêu cầu FE thêm `hasResult`, `resultKind`, `calcAt` vào `pageContext`. Thiếu nó Haiku **không thể** thay được luật `explain_result`, vì luật đó dựa vào trạng thái chứ không dựa vào chữ, mà Haiku chỉ thấy khối `pageContext` rút gọn.
3. Đo lại ngân sách độ trễ ở M0: mọi lượt nay đều trả 300–500 ms cho router.

**Không xóa nhầm:** regex bóc mã điều khoản ở lại. Nó không phải luật định tuyến — nó phục vụ nhánh trigram ở bước 4.

### Nghiệm thu

- Cùng câu hỏi chạy 20 lần ra cùng nhãn.
- Test khẳng định `stopReason != max_tokens`.
- Độ chính xác nhãn đạt ngưỡng đã chốt ở M1, đo riêng cho từng ngôn ngữ.

### Rủi ro

**BE-4 · `MaxTokens` bỏ trống thì Bedrock lấy trần của mô hình** (64K với Haiku 4.5) **và giữ chỗ quota theo con số đó**. Một lệnh cần 50 token lại khóa 64 000 token mỗi phút. Nguyên nhân `ThrottlingException` phổ biến nhất khi lưu lượng còn thấp.

**BE-5 · Thêm trường vào schema mà quên nâng `MaxTokens`** làm output bị cắt cụt, parse hỏng, và lượt rơi xuống đường lùi mà không ai biết.

**R42 · Câu hỏi tiếng Anh chạy trên kho tài liệu tiếng Pháp.** Prompt phải giữ nguyên ngôn ngữ gốc của `search_query`. Haiku dịch sang tiếng Pháp là hỏng cấu hình FTS ở bước 4.

**R23 · Haiku 4.5 có mốc EOL rơi vào tuần 2 POC.** Đổi mô hình là đổi một dòng cấu hình, nhưng phải có số đo độ chính xác của Nova Lite sẵn từ M1.

**R46 · Từ AD-17, biên phân quyền là một tham số API, không còn là mệnh đề SQL.** Gọi `Retrieve` thiếu filter trả về tài liệu của mọi organization. Chặn bằng cấu trúc: một lớp duy nhất, scope là tham số khởi tạo bắt buộc, architecture test trong CI. Quy ước không đủ.

**R47 · Bộ lọc metadata của Bedrock hỏng im lặng ba đường.** Thuộc tính chưa khai là lọc được → trả rỗng. `startsWith` và `stringContains` trên kho không hỗ trợ → bị bỏ qua, trả về tất cả. `numberOfResults` bỏ trống → mặc định 5. Không đường nào báo lỗi.

**R44 · Từ AD-15, router là điểm chết đơn.** Đường lùi tồn tại nhưng **mất khả năng giải đại từ**, nên câu hỏi dựa vào lịch sử sẽ truy xuất sai trong suốt thời gian router hỏng. So sánh Nova Lite ở M1 là **bắt buộc**, không phải tùy chọn.

---

## Bước 4 — Lấy căn cứ

Ba nhánh, ba khối công việc tách biệt. Có thể chia cho ba người.

### 4A · Nhánh RAG — Managed Knowledge Base (AD-17, chốt 20/09/2026)

**Phải làm:**

- **`ScopedKnowledgeBaseClient` là lớp duy nhất được gọi `Retrieve`.** Scope đã phân giải là tham số khởi tạo **bắt buộc**, ném lỗi khi rỗng. Thêm architecture test trong CI cấm mọi tham chiếu trực tiếp tới `bedrock-agent-runtime` retrieve ở nơi khác. Đây là R46 — quên filter là trả về tài liệu của mọi organization, đúng định dạng, không lỗi.
- **Đặt tường minh ba tham số**: `numberOfResults = 40` (mặc định của dịch vụ là **5**), `filter` luôn có `scope_key` và `status`, ngưỡng điểm bắt đầu **0.5** (số `0.7` là thang cosine của pgvector, không chuyển sang MKB được).
- **`overrideSearchType` để trống.** Bỏ trống thì Bedrock tự chọn chiến lược hợp với kho vector đang dùng. Chỉ đặt tay thành `HYBRID` nếu V-K5 chứng minh kho của MKB nhận — đặt bừa một giá trị kho không hỗ trợ là tự bỏ mất chiến lược Bedrock đã chọn đúng.
- **Chỉ dùng `equals`, `notEquals`, `in`, `notIn` và toán tử số**, ghép bằng `andAll` / `orAll`. Cấm `startsWith`, `stringContains`, `listContains`: ba toán tử này **bị bỏ qua im lặng** trên kho vector không hỗ trợ, tức truy vấn chạy như không có filter (R47). `clause_path` lọc bằng `in` với danh sách đầy đủ, không bằng prefix.
- **Chặng 1 vẫn là `pg_trgm` trong PostgreSQL**: regex trích mã điều khoản → `similarity(clause_ref, @clauseq)` → danh sách `clause_path` chuẩn hóa → đưa vào filter. Không có mã thì bỏ chặng này. Nếu V-K5 cho thấy không có `HYBRID` thì chặng này là **bắt buộc**, không còn là bổ trợ.
- **Worker ghi mỗi chunk thành một object S3 + sidecar `.metadata.json`** với `standard`, `edition`, `clause_path`, `page`, `scope_key`, `status`, `chunk_type`, `doc_id`, `chunk_index`. Thuộc tính phải khai là **lọc được** lúc tạo KB hoặc data source; lọc trên thuộc tính chưa khai trả về **rỗng** và không báo lỗi.
- **Vòng đời nạp giữ bằng `status`**: Worker ghi `staged`, mọi truy vấn **luôn** lọc `status = "active"`, phát hành là ghi lại sidecar rồi chạy lại `start-ingestion-job`.
- **`ApplyGuardrail` trên nội dung chunk trước khi vào `toolResult` giữ nguyên ở facade.** Đây là chỗ dễ đánh rơi nhất khi viết lại `search_documents` để gọi `Retrieve`.
- Tạo KB và tạo data source đều **bất đồng bộ**: poll `get-knowledge-base` tới `ACTIVE` và `get-data-source` tới `AVAILABLE` rồi mới `start-ingestion-job`. Truy vấn trước khi ingestion `COMPLETE` trả về rỗng.

### 4B · Nhánh case

- `POST /v1/approvals/{toolRunId}`: dựng case từ `tool_run`, summary bằng **template** (không dùng LLM), `dedupe_key = hash(tool_id, tool_version, input chuẩn hóa)`.
- `CaseSimilarityScorer`: lọc cứng SQL (`org_id` từ Payment API, `status = Approved`, `element_type`) → ≤200 ứng viên → khoảng cách chuẩn hóa trên `similarity_keys` → top 5 → tie-break vector khi câu hỏi có phần ngôn ngữ tự nhiên.
- **Hàm khoảng cách khi thiếu key** ([05](05-case-memory.md) §4b): chuẩn hóa từng key về `[0,1]` theo dải trong manifest, tính trung bình **trên tập key giải được ở cả hai phía**, chia cho `coverage` để phạt case thiếu key. Dưới 2 key giải được thì **không truy vấn** — phát sự kiện hỏi lại.
- Thứ tự ưu tiên nguồn tham số, viết ra trong mã (AD-16, chốt 20/09/2026): `tool_run` lượt trước → `pageContext` → `case_hints`. Ghi đè theo từng key, không theo cả khối. Gắn cờ `unconfirmed` cho key chỉ có nguồn `case_hints`.
- **Sinh phần manifest nhúng vào prompt router** từ `tools.manifest.yaml`: danh sách `similarity_keys`, đơn vị hợp lệ, dải giá trị. Sinh lúc khởi động, không viết tay trong prompt — manifest đổi mà prompt không đổi là nguồn sai âm thầm.
- Ghi `case_hints` gốc (trước khi ghi đè) vào `audit_event` của lượt (R45).

### 4C · Nhánh vòng lặp tool

- Facade `/internal/tools/*` + **ToolGate sáu lớp**: schema, quyền, biên tham số, **đơn vị**, chống lặp, đọc `ApiResult.Code`.
- Facade gọi Main API **bằng token của người dùng** → `[ApiAccess]` áp dụng nguyên vẹn, không viết lại phân quyền.
- Trả **toàn bộ output JSON** của engine trong ngân sách token, không rút gọn.
- `ApplyGuardrail` trên chunk trước khi vào `toolResult` cho `search_documents` và `find_similar_cases`.
- [T1] Kiểm chứng **V-A1**: `InvokeHarness` mang Bearer JWT từ .NET. Hạn hết ngày 3.

### Nghiệm thu

- Recall@8 trên bộ câu hỏi neo đạt ≥ 70% ở cổng G1, **đo tách theo ngôn ngữ và theo scope**.
- Gọi tool với `b = 50000 mm` bị chặn ở lớp 03, thông điệp lỗi nêu khoảng hợp lệ.
- Gọi tool thiếu đơn vị bị chặn ở lớp 04, **không suy diễn đơn vị**.
- Main API trả `Code = Forbidden` trong HTTP 200 → facade đổi thành lỗi 4xx, mô hình nhận được lỗi mô tả và dừng, không diễn giải.

### Rủi ro

**V-A1 · AWS SDK for .NET ký SigV4.** Nếu không gửi được Bearer thì danh tính người dùng mất ở Gateway, Cedar không biết ai đang gọi, và hướng Harness **không đạt yêu cầu phân quyền**. Trượt hạn ngày 3 thì rơi về vòng lặp C# tự viết ([04](04-tool-calling.md) §6) — phương án đó đã viết đầy đủ, không phải làm lại.

**R9 · `ApiResult.Code = Forbidden` nằm trong HTTP 200.** Gateway và Cedar không đọc body phản hồi. Không bắt ở facade thì lỗi trôi vào `toolResult` như dữ liệu hợp lệ.

**BE-6 · Lớp đơn vị là lớp dễ coi nhẹ nhất và nguy hiểm nhất.** `b = 0.3` là mét hay milimét? Đoán sai một nghìn lần đơn vị thì kết quả **vẫn ra một con số trông hợp lý**.

**BE-7 · Rút gọn output tool trước khi trả cho mô hình là tự bịt mắt `NumberValidator`** ở bước 5.

**R35 · Main API có thể chưa có endpoint đọc kết quả theo dự án và cấu kiện.** Tài liệu VFSoftware đã đọc chưa xác nhận. Nếu chưa có, đây là việc của Main API trong tuần 1, và yêu cầu 3 không thực hiện được nếu thiếu.

---

## Bước 5 — Hậu kiểm

### Phải làm

- `NumberValidator` với **hai nguồn hợp lệ**: output của `tool_run` (cho phép làm tròn) **và** đoạn trích của chunk đã truy xuất.
- `CitationValidator`: mọi `[n]` ứng với một chunk đã thật sự truy xuất.
- `VerificationValidator`: không có nhãn "đạt"/"thỏa mãn" gắn mã phương án mà thiếu `tool_run` khớp tham số.
- Kiểm phiên bản: `standardRef` của engine so với `edition` của chunk.
- Ghi `message`, `retrieval_log`, `tool_run`, `audit_event` trên **mọi** đường kết thúc, kể cả khi lỗi.
- Chế độ `Degraded`: mô hình không dùng được thì trả **danh sách nguồn đã truy xuất**, không trả lỗi trắng.

### Nghiệm thu

- Câu trả lời chứa một con số không có trong `tool_run` và không có trong trích dẫn → phát `warning: unverified_number`, trạng thái `CompletedUnverified`.
- Câu trả lời nêu **giá trị giới hạn của tiêu chuẩn** lấy từ trích dẫn → **không** bị gắn cờ oan.
- Tắt Bedrock giả lập → lượt vẫn trả danh sách nguồn và `done`, không phải 500.

### Rủi ro

**BE-8 · Bộ kiểm quá chặt gây cảnh báo oan hàng loạt**, và cảnh báo oan dạy người dùng cách phớt lờ cảnh báo. Đây là cách hỏng tệ hơn là không có cảnh báo.

**BE-9 · Contextual grounding của Guardrails không thay được bộ kiểm tất định.** AWS ghi rõ nó không hỗ trợ trường hợp chatbot hội thoại, và với stream thì câu trả lời lạc có thể chỉ bị đánh dấu sau khi đã stream hết. Chỉ dùng làm lớp phụ, chỉ khi câu trả lời ≤ 5 000 ký tự, và chỉ gắn cờ.

---

## Bước 6 — Giữ hợp đồng

### Phải làm

- Hợp đồng 11 sự kiện **ổn định**. Thay đổi phá vỡ đi vào `/v2`; đường dẫn đã công bố không bị đổi nghĩa.
- `POST /v1/approvals/{toolRunId}` trả `caseId`.
- Phát `approval_required` chỉ cho tool nhóm B.

### Rủi ro

**BE-10 · Tóm tắt case sinh bằng LLM có thể đưa vào tên dự án hoặc chi tiết khách hàng.** Case được người khác trong tổ chức đọc lại, nên template là **ràng buộc bảo mật**, không phải lựa chọn phong cách.

---

## Bảng tra nhanh: cái gì không bao giờ được làm

| Không bao giờ | Vì sao |
| --- | --- |
| Gọi Bedrock mà không đặt `MaxTokens` tường minh | Giữ chỗ quota theo trần mô hình, gây throttle |
| Đặt `GuardrailIdentifier` mà thiếu `GuardrailVersion` | Guardrail không chạy, không báo lỗi |
| Dùng `pageContext` của client làm căn cứ phân quyền | Rò rỉ dữ liệu |
| Suy diễn đơn vị khi tham số tool thiếu đơn vị | Sai một nghìn lần, kết quả vẫn trông hợp lý |
| Rút gọn output tool trước khi trả cho mô hình | Vô hiệu `NumberValidator` |
| Bỏ qua `ApiResult.Code` vì HTTP đã 200 | Lỗi quyền trôi vào câu trả lời |
| Đẩy cả câu hỏi vào nhánh trigram khi không có mã điều khoản | Rác có điểm, tệ hơn không có gì |
| Sinh tóm tắt case bằng LLM | Lộ tên dự án và chi tiết khách hàng |
| Để số do mô hình đọc từ văn xuôi đi vào input engine | Phá nguyên tắc trung tâm của hệ thống |

---

## Liên quan

- [02-assistant-service.md](02-assistant-service.md) · [03-rag.md](03-rag.md) · [04-tool-calling.md](04-tool-calling.md) · [05-case-memory.md](05-case-memory.md)
- [12-rui-ro.md](12-rui-ro.md) — R9, R20, R23, R35, R42, V-A1
- [15-hoi-dap-tung-buoc.md](15-hoi-dap-tung-buoc.md) — giải thích cùng nội dung bằng lời thường
- [17-guideline-frontend.md](17-guideline-frontend.md) · [18-guideline-devops.md](18-guideline-devops.md)
