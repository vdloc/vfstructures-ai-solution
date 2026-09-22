# 03 · Thi công — đội Backend

**Ai đọc:** đội Backend. Người khác đọc để biết Backend đang chờ gì ở mình.

**Mục lục**

- Vì sao tài liệu này viết theo sáu bước
- Ba nguyên tắc chi phối mọi bước
- Thuật ngữ trong tài liệu này
- Ký hiệu
- Việc làm trước, xếp theo thứ tự chặn
- Bước 1 — Nhận request, mở SSE
- Bước 2 — Gate và chuẩn bị song song
- Bước 3 — Routing
- Bước 4 — Lấy căn cứ
- Bước 5 — Post-validation
- Bước 6 — Giữ hợp đồng
- Bảng tra nhanh: cái gì không bao giờ được làm

---

## Vì sao tài liệu này viết theo sáu bước

Một lượt hỏi đi qua sáu bước cố định. Tài liệu bám đúng thứ tự đó thay vì chia theo module, vì **thứ tự là thứ quyết định đúng sai** ở hệ thống này.

Ví dụ: ba cổng chặn ở bước 2 phải chạy theo thứ tự `rate limit → xác thực → quota`. Đảo thứ tự thì một request đã bị chặn vì gửi quá nhanh **vẫn bị trừ quota** — người dùng mất hạn mức cho một lượt chưa bao giờ được phục vụ, và mọi thứ khác vẫn chạy đúng nên không ai phát hiện.

Mỗi bước có bốn phần:

| Phần | Nghĩa |
| --- | --- |
| **Phải làm** | Việc cụ thể, kèm lý do nếu lý do không hiển nhiên |
| **Nghiệm thu** | Cách chứng minh bước đó xong. Chạy được, không phải nói được |
| **Rủi ro** | Thứ đã biết là dễ hỏng ở bước này |
| **Ai đang chờ** | Đội khác không làm được gì nếu thiếu |

## Ba nguyên tắc chi phối mọi bước

**Một — mô hình không bao giờ tự tính số.** Mô hình chọn hàm và điền tham số; engine .NET tính. Con số ra màn hình là con số của engine. Mọi thứ trong bước 4 và bước 5 tồn tại để giữ nguyên tắc này.

**Hai — hàng rào nằm ngoài mô hình.** Câu dặn trong prompt không phải biện pháp kiểm soát; nó là lời khuyên đưa cho một bộ máy đoán chữ, và lời khuyên thì lách được. Lọc quyền, kiểm tham số, lọc nội dung đều chạy bằng mã tất định, bên ngoài mô hình.

**Ba — lỗi im lặng nguy hiểm hơn lỗi ồn ào.** Nhiều thứ trong hệ thống này hỏng mà **không báo lỗi**: quên filter thì trả về tài liệu của mọi organization; quên `GuardrailVersion` thì guardrail không chạy; bỏ trống `numberOfResults` thì phụ thuộc vào mặc định của dịch vụ (tài liệu chung ghi 5). Tài liệu đánh dấu từng chỗ như vậy, và mỗi chỗ đều kèm một cách kiểm chủ động.

## Thuật ngữ trong tài liệu này

Giải thích đầy đủ ở [00-thuat-ngu-va-nguon.md](00-thuat-ngu-va-nguon.md), kèm nguồn tham chiếu. Bản rút gọn:

| Thuật ngữ | Một câu |
| --- | --- |
| **SSE** | Một kết nối mở sẵn, server đẩy dần từng mẩu xuống trình duyệt |
| **IntentRouter** | Mô hình nhỏ chạy đầu mỗi lượt để phân loại câu hỏi, giải đại từ, bóc tham số |
| **Structured output** | Ép mô hình trả JSON đúng khuôn. Bảo đảm **hình dạng**, không bảo đảm **nghĩa** |
| **`Retrieve`** | Lời gọi API đi tìm chunk tài liệu liên quan |
| **`filter`** | Tham số lọc của `Retrieve`. **Đây là hàng rào phân quyền** |
| **`fuzzystrmatch`** | Extension PostgreSQL có hàm `levenshtein()`, dùng để gợi ý mã điều khoản gần đúng khi hỏi lại người dùng (AD-29) |
| **ToolGate** | Sáu lớp kiểm chạy trước khi engine chạy |
| **Validator** | Mã tất định kiểm lại câu trả lời **sau** khi mô hình viết xong |
| **Fallback** | Đường dự phòng khi thành phần chính hỏng |

## Ký hiệu

**[CHẶN]** đội khác không làm được nếu thiếu · **[CHỜ CHỐT]** phụ thuộc quyết định chưa chốt.

Thiết kế đầy đủ ở [01](01-kien-truc.md). Hợp đồng với Frontend ở [02](02-hop-dong.md) — **không sửa một phía**. v1.1 chỉ cộng thêm field và mã, không đổi nghĩa cái đã công bố.

---

## Việc làm trước, xếp theo thứ tự chặn

Backend chặn cả hai đội còn lại ở hai chỗ. Làm hai việc này trước mọi thứ khác.

| # | Việc | Ai đang chờ | Mức |
| --- | --- | --- | --- |
| 1 | **Hợp đồng SSE 11 sự kiện + schema `ChatRequest`** | Frontend — không dựng được mock stream nếu thiếu | **Chặn** |
| 2 | **Schema OpenAPI của facade tool** | DevOps — không tạo được Gateway target nếu thiếu | **Chặn** |
| 3 | Kiểm chứng **V-A1**: `InvokeHarness` gửi được Bearer JWT từ.NET | Cả dự án — trượt thì đổi kiến trúc vòng lặp | **Chặn** |
| 4 | Kiểm chứng **V-K3**: tạo Managed KB và data source **bằng mã.NET**, rồi gọi `Retrieve` với `managedSearchConfiguration` | Cả nhánh RAG — trượt thì phải đưa lại quyết định lên bàn ngay | **Chặn** |

Hai việc đầu là **tài liệu, không phải mã chạy được** — phát hành bản nháp ngay khi hai đội kia ký được, không đợi bản hoàn chỉnh.

---

## Bước 1 — Nhận request, mở SSE

### Phải làm

- [CHẶN] Định nghĩa `ChatRequest` và hợp đồng 11 sự kiện SSE. Có version cùng đường dẫn `/v1`.
- Endpoint `POST /v1/chat` trả `text/event-stream`, **flush sau mỗi sự kiện**.
- Sinh `requestId` tương quan ngay khi nhận request; gắn vào mọi log và mọi sự kiện `error`.
- Validate `context`: coi là gợi ý của client, không phải căn cứ phân quyền.
- **Một `CancellationToken` cho mỗi lượt** (AD-25): `CancellationTokenSource.CreateLinkedTokenSource(HttpContext.RequestAborted, timeoutCts.Token)`. Truyền token này vào **mọi** lời gọi ra ngoài: `ConverseStream`, `Retrieve`, `InvokeHarness` và vòng đọc stream của nó, Main API, PostgreSQL. Bắt `OperationCanceledException` ở `ChatOrchestrator`, ghi `message` trạng thái `aborted` kèm phần chữ đã sinh, trừ quota theo `usage` đã nhận. Việc ghi này dùng một token **riêng**, không dùng token đã hủy, nếu không thì chính lệnh ghi cũng bị hủy ([01](01-kien-truc.md) §6.7).

### Nghiệm thu

- `curl -N` qua đúng tuyến production thấy sự kiện đến rời rạc, không dồn cục.
- Gửi `context` chứa `projectId` mà người dùng không có quyền → lượt vẫn bị chặn đúng ở bước 2, không rò rỉ gì.
- Mở stream bằng `curl -N` rồi `Ctrl+C` giữa lúc Sonnet đang sinh chữ → trace kết thúc trong ≤ 2 giây với trạng thái `aborted`, không có lời gọi Bedrock nào sau đó, hàng `active_turn` đã bị xóa, và `GET /v1/conversations/{id}` trả message `aborted` kèm phần chữ đã sinh.

### Rủi ro

**BE-1 · `pageContext` là dữ liệu không tin cậy.** Dùng được để biết người dùng đang nhìn gì; không bao giờ dùng để quyết định họ được đọc gì. Quyền lấy từ token, qua `AccessScopeResolver`.

**R20 · Kết quả trong `pageContext` có thể lệch bản đã lưu ở server.** Khi lệch, ưu tiên bản đã lưu và phát cảnh báo — [01](01-kien-truc.md)

---

## Bước 2 — Gate và chuẩn bị song song

### Phải làm

- Middleware ba cổng, **đúng thứ tự rẻ trước**: rate limit → JWT → quota ngày.
- Kill switch đọc từ cấu hình nóng, trả `503`, không cần deploy lại.
- `AccessScopeResolver` + cache 60 giây trong bộ nhớ tiến trình (không có Redis).
- Ba việc độc lập chạy bằng `Task.WhenAll`: scope, guardrail input, **3 lượt gần nhất** (AD-22 — đếm theo lượt, không theo message; ba con số cửa sổ nằm trong `ConversationWindowOptions`, không viết cứng).
- **Đếm quota phải cộng đủ ba trường.** Khi bật prompt caching, `inputTokens` **chỉ còn là phần không nằm trong cache**. Tổng thật là `inputTokens + cacheReadInputTokens + cacheWriteInputTokens`. Lấy thẳng `inputTokens` là đếm thiếu, và càng cache hiệu quả thì càng thiếu nhiều. Ngược lại, khi trừ **hạn mức tốc độ** thì token đọc từ cache **không tính** — AWS không trừ chúng vào TPM.
- **Mọi counter giới hạn nằm trong PostgreSQL, không nằm trong bộ nhớ tiến trình** (AD-23). Bộ giới hạn mặc định của ASP.NET Core đếm theo instance; chạy nhiều task là nhân giới hạn lên bấy nhiêu lần.
- **Giới hạn một lượt đang chạy trên mỗi user**, ép bằng bảng `active_turn` với `INSERT... ON CONFLICT DO NOTHING`. Xóa hàng trong `finally`, không xóa ở đường thành công — quên là user bị khóa cho tới khi job quét dọn chạy. Lượt thứ hai trả `429 concurrent_turn`, **không** hủy lượt đang chạy.
- Mọi lỗi trả **mã và hướng xử lý**, không chỉ thông điệp. Kèm `requestId`.

### Nghiệm thu

- Test khẳng định ba việc chạy thật sự song song: tổng thời gian ≈ cái chậm nhất, không phải tổng ba cái.
- **Test khẳng định guardrail có chạy**: bắn một prompt chắc chắn bị chặn, kiểm `stopReason`. Đây là test bắt buộc, không phải tùy chọn.

### Rủi ro

**BE-2 · Không có Redis.** Cache scope nằm trong bộ nhớ tiến trình, nên khi scale nhiều instance mỗi instance có cache riêng. Chấp nhận được vì TTL 60 giây, nhưng phải biết: **thu hồi quyền có độ trễ tới 60 giây**. Nếu nghiệp vụ không chấp nhận, đây là chỗ cần bàn lại chứ không phải chỗ tự ý sửa.

**BE-3 · Thiếu `GuardrailVersion` thì guardrail không được áp dụng và không có lỗi nào được ném ra.** Hỏng im lặng. Chỉ phát hiện được bằng test chủ động.

---

## Bước 3 — Routing

### Phải làm

- Prompt router và schema structured output để trong repo dưới dạng hằng số **có version**, không nội suy chuỗi.
- `Temperature = 0`, `MaxTokens = 400`.
- Bộ eval độ chính xác nhãn trên câu hỏi kỹ thuật, **tách theo ngôn ngữ** tiếng Pháp và tiếng Anh.
- Fallback khi Haiku lỗi: mặc định `doc_qa`, `search_query = raw turn`, gắn cờ `degraded_routing` vào `retrieval_log`.
- **Regex bóc mã điều khoản** — giữ lại kể cả khi bỏ luật nhanh. Nó phục vụ ClauseResolver ở bước 4, không phải phục vụ routing.

### AD-16

- Router trả thêm khối `case_hints` = `{ tool_id, params: [{key, value, unit}] }`. `key` và `unit` là enum sinh từ `tools.manifest.yaml`.
- `MaxTokens` của router đặt **300–400**, không giữ 150. Sau mỗi lần gọi assert `stopReason != "max_tokens"`; chạm trần thì JSON đứt, lượt đó rơi về fallback kèm `degraded_routing`.
- `case_hints` **chỉ vào mệnh đề lọc và hàm chấm điểm**. Không bao giờ vào tham số gọi engine. P2 không đổi.

### AD-15

Luật nhanh **ra khỏi đường chính**. Ba việc kèm theo:

1. Xóa luật khỏi hot path, giữ lại **chỉ làm fallback** khi router lỗi hoặc timeout.
2. Yêu cầu FE thêm `hasResult`, `resultKind`, `calcAt` vào `pageContext`. Thiếu nó Haiku **không thể** thay được luật `explain_result`, vì luật đó dựa vào trạng thái chứ không dựa vào chữ, mà Haiku chỉ thấy khối `pageContext` rút gọn.
3. Đo lại ngân sách độ trễ: mọi lượt nay đều trả 300–500 ms cho router.

**Không xóa nhầm:** regex bóc mã điều khoản ở lại. Nó không phải luật routing — nó phục vụ ClauseResolver ở bước 4.

### Nghiệm thu

- Cùng câu hỏi chạy 20 lần ra cùng nhãn.
- Test khẳng định `stopReason != max_tokens`.
- Độ chính xác nhãn đạt ngưỡng đã chốt, đo riêng cho từng ngôn ngữ.

### Rủi ro

**BE-4 · `MaxTokens` bỏ trống thì Bedrock lấy trần của mô hình** (64K với Haiku 4.5) **và giữ chỗ quota theo con số đó**. Một lệnh cần 50 token lại khóa 64 000 token mỗi phút. Nguyên nhân `ThrottlingException` phổ biến nhất khi lưu lượng còn thấp.

**BE-5 · Thêm trường vào schema mà quên nâng `MaxTokens`** làm output bị cắt cụt, parse hỏng, và lượt rơi xuống fallback mà không ai biết.

**R42 · Câu hỏi tiếng Anh chạy trên knowledge base tiếng Pháp.** Prompt phải giữ nguyên ngôn ngữ gốc của `search_query`. Từ AD-17, tìm kiếm hybrid trên nội dung tài liệu nằm trong `Retrieve` của MKB, không còn cấu hình FTS nào ở PostgreSQL để hỏng — nhưng Haiku dịch `search_query` sang ngôn ngữ khác ngôn ngữ gốc của câu hỏi vẫn có thể làm MKB khớp kém hơn, mức độ chưa đo được. Đo bằng golden set tách theo ngôn ngữ ở bước 4.

**R23 · Haiku 4.5 đã công bố mốc EOL.** Đổi mô hình là đổi một dòng cấu hình, nhưng phải có số đo độ chính xác của Nova Lite sẵn trước khi cần.

**R46 · Từ AD-17, biên phân quyền là một tham số API, không còn là mệnh đề SQL.** Gọi `Retrieve` thiếu filter trả về tài liệu của mọi organization. Chặn bằng cấu trúc: một lớp duy nhất, scope là tham số khởi tạo bắt buộc, architecture test trong CI. Quy ước không đủ.

**R47 · Metadata filter của Bedrock có ba đường có thể hỏng im lặng.** Thuộc tính không có trong sidecar → có thể trả rỗng. `startsWith` và `stringContains` → tài liệu managed KB ghi là không được hỗ trợ; báo lỗi hay bị bỏ qua (và trả về tất cả) thì **chưa kiểm chứng**, V-K4 phải thử. `numberOfResults` bỏ trống → phụ thuộc mặc định. Vì chưa biết đường nào báo lỗi, coi cả ba là im lặng cho tới khi V-K4 chứng minh ngược lại.

**R44 · Từ AD-15, router là điểm chết đơn.** Fallback tồn tại nhưng **mất khả năng giải đại từ**, nên câu hỏi dựa vào lịch sử sẽ retrieval sai trong suốt thời gian router hỏng. So sánh Nova Lite là **bắt buộc**, không phải tùy chọn.

---

## Bước 4 — Lấy căn cứ

Ba nhánh, ba khối công việc tách biệt. Có thể chia cho ba người.

### 4A · Nhánh RAG — Managed Knowledge Base (AD-17)

**Phải làm:**

- **`ScopedKnowledgeBaseClient` là lớp duy nhất được gọi `Retrieve`.** Scope đã phân giải là tham số khởi tạo **bắt buộc**, ném lỗi khi rỗng. Thêm architecture test trong CI cấm mọi tham chiếu trực tiếp tới `bedrock-agent-runtime` retrieve ở nơi khác. Đây là R46 — quên filter là trả về tài liệu của mọi organization, đúng định dạng, không lỗi.
- **Cấu hình truy vấn đặt ở `retrievalConfiguration.managedSearchConfiguration`**, không phải `vectorSearchConfiguration` (field đó chỉ dành cho custom KB). Đây là chỗ dễ sai nhất khi copy ví dụ từ tài liệu custom KB. Kiểm bằng V-K3: gửi được `managedSearchConfiguration` từ mã .NET.
- **Đặt tường minh hai tham số API**: `numberOfResults = 40` (miền hợp lệ 1–100; trang managed không nêu mặc định, tài liệu chung ghi **5**) và `filter` luôn có `scope_key` và `status`. **Ngưỡng điểm không phải tham số API**: mã của mình so `score` của từng kết quả với ngưỡng, bắt đầu **0.5** (số `0.7` là thang cosine của pgvector, không chuyển sang MKB được).
- **Không có `overrideSearchType`.** MKB luôn tìm hybrid và không có tùy chọn chỉ tìm theo nghĩa. V-K5 đã trả lời và bị bỏ.
- **Rerank:** mặc định `rerankingModelType: MANAGED`. Muốn Cohere Rerank 3.5 thì `CUSTOM` kèm `rerankingConfiguration`, truyền ngay trong `Retrieve`. Reranker sẵn chỉ dùng được khi KB dùng embedding `MANAGED`; chốt cùng lúc với AD-06 (V-K6).
- **Chỉ dùng `equals`, `notEquals`, `in`, `notIn` và toán tử số**, ghép bằng `andAll` / `orAll`. Cấm `startsWith` và `stringContains`: tài liệu managed KB ghi *"not supported"*, còn báo lỗi hay bị bỏ qua thì chưa kiểm chứng (R47). `listContains` không nằm trong câu đó nhưng vẫn cấm theo thận trọng. `clause_path` lọc bằng `in` với danh sách đầy đủ, không bằng prefix.
- **Stage 1 là ClauseResolver trong PostgreSQL (AD-29)**: regex trích mã điều khoản, đổi `,` thành `.` và bỏ ký tự không phải số hay dấu chấm. Chỉ tra trong `clause_ref` của các tài liệu thuộc scope và ấn bản của lượt (đã có từ bước 3+4 và chế độ retrieval). Thứ tự: khớp đúng `clause_path`; không có thì khớp `clause_digits` (dãy chữ số, nên `6.22` và `622` đều ra `6.2.2`). Ra **đúng một** `clause_path` thì đưa vào filter, ghi vào `retrieval_log` rằng mã đã được hiểu thành mã nào, và câu trả lời nói rõ điều đó. Ra 0 hoặc từ 2 mã trở lên thì **không gọi `Retrieve`**: lượt kết thúc ở `AskBack`, hỏi lại kèm tối đa 5 mã gợi ý (ứng viên khớp dãy số, không có thì `levenshtein(clause_path, mã gõ) ≤ 1` trên tập đã lọc theo tài liệu). Không dùng `pg_trgm`: extension này bỏ ký tự không phải chữ hay số, nên `6.2.2`, `6.2` và `2.6` có cùng tập trigram và `similarity('6.22', …)` bằng nhau 0,5 cho cả bốn (đo trên PostgreSQL 16, [00](00-thuat-ngu-va-nguon.md) Phần F). Có filter mã mà điểm vẫn dưới ngưỡng thì đi đúng đường từ chối như mọi lượt, không âm thầm bỏ filter để tìm lại.
- **Worker ghi mỗi chunk thành một object S3 + sidecar `{tên file chunk}.metadata.json`**, tối đa **10 KB**, với `standard`, `edition`, `clause_path`, `page`, `scope_key`, `status`, `chunk_type`, `doc_id`, `chunk_index`. Mỗi thuộc tính có kiểu: `"page": { "value": { "type": "NUMBER", "numberValue": 84 } }`, chuỗi thì `"type": "STRING", "stringValue"`. Thuộc tính phải **có trong sidecar** thì mới lọc được. Không đặt tên bắt đầu bằng `_` (MKB dành riêng).
- **Vòng đời nạp giữ bằng `status`**: Worker ghi `staged`, truy vấn ở chế độ hiện hành lọc `status = "active"`, phát hành là ghi lại sidecar rồi chạy lại `start-ingestion-job`.
- **Ấn bản và ngày hiệu lực (AD-26).** Sidecar thêm `family_key` (STRING), `effective_from` và `effective_to` (NUMBER, `yyyymmdd`; bản còn hiệu lực ghi `99991231`, không bỏ trống). Chuyển ấn bản: ghi sidecar của bản mới (`active`) và bản cũ (`superseded`, `effective_to` = ngày trước `effective_from` của bản mới) rồi chạy **một** ingestion job cho cả hai.
- **Lọc theo loại tài liệu**: intent `doc_qa` lọc `doc_type in ["standard","internal_procedure"]`, intent `app_help` lọc `doc_type = "app_help"`. Tài liệu hướng dẫn VF có thêm `app_version`, `module`, `ui_path`; cắt theo tiêu đề và không cắt giữa danh sách bước.
- **Hai chế độ filter**: hiện hành (`status = "active"`) và theo dự án (`edition` = ấn bản dự án áp dụng, `status in ["active","superseded"]`). Ấn bản dự án đọc từ Main API bằng token người dùng, **không** từ `pageContext.codeStandard`.
- **Kiểm lại sau `Retrieve`**, trong `ScopedKnowledgeBaseClient`: (1) `scope_key` của từng chunk phải thuộc danh sách scope của người dùng, sai thì loại chunk, ghi `audit_event` loại `scope_violation`, bắn cảnh báo mức cao nhất; (2) cùng `family_key` mà có hai `edition` cùng `active` thì giữ bản có `effective_from` lớn hơn, ghi `audit_event` loại `edition_conflict`.
- **`ApplyGuardrail` trên nội dung chunk trước khi vào `toolResult` giữ nguyên ở facade.** Đây là chỗ dễ đánh rơi nhất khi viết lại `search_documents` để gọi `Retrieve`.
- Tạo KB và tạo data source đều **bất đồng bộ**: poll `get-knowledge-base` tới `ACTIVE` và `get-data-source` tới `AVAILABLE` rồi mới `start-ingestion-job`. Truy vấn trước khi ingestion `COMPLETE` trả về rỗng.

### 4B · Nhánh case

- **Ghi case trong facade (AD-28, [12](12-tra-case.md))**: cùng transaction ghi `tool_run`, khi `verdict = pass` và manifest đánh dấu `case_source: true`. `dedupe_key = sha256(tool_id, tool_version, params chuẩn hóa)`; `INSERT … ON CONFLICT (org_id, dedupe_key) DO UPDATE SET use_count = use_count + 1, last_seen_at = now()`. Không `summary`, không embedding, không `POST /v1/approvals`.
- `CaseSimilarityScorer`: lọc cứng SQL (`org_id` qua RLS, `status = 'active'`, `verdict = 'pass'`, `tool_id` / `element_type`) → ≤200 ứng viên → khoảng cách chuẩn hóa trên `similarity_keys` → top 5 → tie-break `use_count` giảm dần rồi `last_seen_at` giảm dần. Không dùng vector.
- **Hàm khoảng cách khi thiếu key** ([01](01-kien-truc.md)): chuẩn hóa từng key về `[0,1]` theo dải trong manifest, tính trung bình **trên tập key giải được ở cả hai phía**, chia cho `coverage` để phạt case thiếu key. Dưới 2 key giải được thì **không truy vấn** — phát sự kiện hỏi lại.
- Thứ tự ưu tiên nguồn tham số, viết ra trong mã (AD-16): `tool_run` lượt trước → `pageContext` → `case_hints`. Ghi đè theo từng key, không theo cả khối. Gắn cờ `unconfirmed` cho key chỉ có nguồn `case_hints`.
- **Sinh phần manifest nhúng vào prompt router** từ `tools.manifest.yaml`: danh sách `similarity_keys`, đơn vị hợp lệ, dải giá trị. Sinh lúc khởi động, không viết tay trong prompt — manifest đổi mà prompt không đổi là nguồn sai âm thầm.
- Ghi `case_hints` gốc (trước khi ghi đè) vào `audit_event` của lượt (R45).

### 4C · Nhánh tool loop

- Facade `/internal/tools/*` + **ToolGate sáu lớp**: schema, quyền, biên tham số, **đơn vị**, chống lặp, đọc `ApiResult.Code`.
- Facade gọi Main API **bằng token của người dùng** → `[ApiAccess]` áp dụng nguyên vẹn, không viết lại phân quyền.
- Trả **toàn bộ output JSON** của engine trong ngân sách token, không rút gọn.
- `ApplyGuardrail` trên chunk trước khi vào `toolResult` cho `search_documents` và `find_similar_cases`.
- Kiểm chứng **V-A1**: `InvokeHarness` mang Bearer JWT từ.NET. Chặn, làm trước mọi thứ khác.
- **Khử trùng theo `toolUseId`** (AD-27): `tool_run` lưu `tool_use_id`, unique. Cùng `toolUseId` đến lần hai thì trả lại output của `tool_run` đã có, không gọi engine. Gateway không chuyển `toolUseId` (V-A12) thì dùng `hash(runtimeSessionId, tool_id, tham số đã chuẩn hóa)`.
- **Tool đọc kết quả dự án** ([01](01-kien-truc.md) §5.4): `project.list_members(projectId)` và `project.get_member_result(projectId, memberId, resultKind)`, gọi Main API bằng token người dùng. Trả đầu vào, kết quả, `calcVersion`, thời điểm tính. `pageContext.outputs` lệch bản đã lưu thì ưu tiên bản đã lưu và phát cảnh báo (R20). Cần endpoint của Main API (R35).
- **Nhánh `optimize`** ([01](01-kien-truc.md) §6.9): tối đa 3 phương án mỗi lượt; manifest khai báo tham số được đổi và tham số cố định, ToolGate lớp 03 chặn đề xuất ngoài biên; module chưa có tool thì từ chối có thông báo.
- **Dịch stream Harness sang SSE** theo bảng ở [01](01-kien-truc.md) §8.14. `tool_result` không lấy từ stream mà đọc `tool_run` theo `toolUseId`. Đây là V-A4, chặn.
- **Trần mỗi lượt** ([01](01-kien-truc.md) §8.12): ToolGate đếm `search_documents` (khởi điểm 3) và `find_similar_cases` (1) theo lượt. Vượt thì trả lỗi mô tả cho mô hình, không chạy.
- **Verdict (AD-24)**: facade đọc trường verdict mà manifest khai báo cho tool, dựng `outputs.verdict = { pass, field, value }` trong `tool_result`. Tool `submit_recommendation` nhận `candidateId`, `toolRunId`, `rationale`, `citationIds`; facade kiểm `toolRunId` thuộc lượt này và tra verdict từ `tool_run`, không nhận verdict từ mô hình.

### Nghiệm thu

- Recall@8 trên bộ câu hỏi neo đạt ≥ 70%, **đo tách theo ngôn ngữ và theo scope**.
- Gọi tool với `b = 50000 mm` bị chặn ở lớp 03, thông điệp lỗi nêu khoảng hợp lệ.
- Gọi tool thiếu đơn vị bị chặn ở lớp 04, **không suy diễn đơn vị**.
- Main API trả `Code = Forbidden` trong HTTP 200 → facade đổi thành lỗi 4xx, mô hình nhận được lỗi mô tả và dừng, không diễn giải.

### Rủi ro

**V-A1 · AWS SDK for .NET ký SigV4.** Nếu không gửi được Bearer thì danh tính người dùng mất ở Gateway, Cedar không biết ai đang gọi, và hướng Harness **không đạt yêu cầu phân quyền**. Trượt thì rơi về vòng lặp C# tự viết ([01](01-kien-truc.md)) — phương án đó đã viết đầy đủ, không phải làm lại.

**R9 · `ApiResult.Code = Forbidden` nằm trong HTTP 200.** Gateway và Cedar không đọc body phản hồi. Không bắt ở facade thì lỗi trôi vào `toolResult` như dữ liệu hợp lệ.

**BE-6 · Lớp đơn vị là lớp dễ coi nhẹ nhất và nguy hiểm nhất.** `b = 0.3` là mét hay milimét? Đoán sai một nghìn lần đơn vị thì kết quả **vẫn ra một con số trông hợp lý**.

**BE-7 · Rút gọn output tool trước khi trả cho mô hình là tự bịt mắt `NumberValidator`** ở bước 5.

**R35 · Main API có thể chưa có endpoint đọc kết quả theo dự án và cấu kiện.** Tài liệu VFSoftware đã đọc chưa xác nhận. Nếu chưa có, đây là việc của Main API, làm trước, và yêu cầu 3 không thực hiện được nếu thiếu.

---

## Bước 5 — Post-validation

### Phải làm

- `NumberValidator` với **hai nguồn hợp lệ**: output của `tool_run` (cho phép làm tròn) **và** đoạn trích của chunk đã retrieval.
- `CitationValidator`: mọi `[n]` ứng với một chunk đã thật sự retrieval.
- `NumberValidator` với số lấy từ chunk: số phải nằm trong chunk mà **chính câu đó** trích. Câu không có `[n]` thì chỉ chấp nhận số từ `tool_run`. Số chỉ có trong tóm tắt lịch sử (AD-22) không phải nguồn hợp lệ.
- `VerificationValidator` (AD-24): nhãn kết luận trong văn bản phải khớp `verdict.pass` của `tool_run` được tham chiếu, không chỉ khớp tham số. Dò nhãn bằng danh sách từ tiếng Pháp và tiếng Anh, kể cả dạng phủ định (*non conforme*, *ne vérifie pas*, *fails*). Trượt thì `warning: unverified_verdict`. Tool chưa khai báo verdict mà văn bản vẫn kết luận thì cũng trượt.
- Kiểm phiên bản theo chế độ retrieval: hiện hành thì so `standardRef` của engine với `edition` của chunk; theo dự án thì citation phải cùng ấn bản dự án áp dụng.
- Lượt `aborted` **không** chạy post-validation.
- Ghi `message`, `retrieval_log`, `tool_run`, `audit_event` trên **mọi** đường kết thúc, kể cả khi lỗi.
- Chế độ `Degraded`: mô hình không dùng được thì trả **danh sách nguồn đã retrieval**, không trả lỗi trắng.
- **Chịu lỗi** ([01](01-kien-truc.md) §8.13): `RetryMode.Standard`, `MaxErrorRetry = 2`, đặt tường minh vì mặc định là `Legacy`; Polly chỉ làm circuit breaker (5 lỗi trong 30 giây, mở 30 giây) và fallback Sonnet 4.6, không thêm tầng retry; `RequestBuilder` riêng cho từng mô hình; `AmazonBedrockRuntimeClient` singleton; ngưỡng thời gian (15 giây tới token đầu, 20 giây stream đứng) đi qua `CancellationToken`, vì `Timeout` của client không có tác dụng với lời gọi async.

### Nghiệm thu

- Câu trả lời chứa một con số không có trong `tool_run` và không có trong citation → phát `warning: unverified_number`, trạng thái `CompletedUnverified`.
- Câu trả lời nêu **giá trị giới hạn của tiêu chuẩn** lấy từ citation → **không** bị gắn cờ oan.
- Tắt Bedrock giả lập → lượt vẫn trả danh sách nguồn và `done`, không phải 500.
- `tool_run` trả `verdict.pass = false`, mô hình giả lập viết "la poutre est conforme" → `warning: unverified_verdict`, thẻ kết quả vẫn hiện "không đạt".
- Giả lập `Retrieve` trả một chunk có `scope_key` của org khác → chunk bị loại, có `audit_event` loại `scope_violation`.
- Cùng cấu hình tính đạt hai lần trong hai lượt → bảng `case` có một dòng, `use_count = 2`. Facade chạy lại cùng `toolUseId` → `use_count` không tăng.

### Rủi ro

**BE-8 · Validator quá chặt gây cảnh báo oan hàng loạt**, và cảnh báo oan dạy người dùng cách phớt lờ cảnh báo. Đây là cách hỏng tệ hơn là không có cảnh báo.

**BE-9 · Contextual grounding của Guardrails không thay được validator tất định.** AWS ghi rõ nó không hỗ trợ trường hợp chatbot hội thoại, và với stream thì câu trả lời lạc có thể chỉ bị đánh dấu sau khi đã stream hết. Chỉ dùng làm lớp phụ, chỉ khi câu trả lời ≤ 5 000 ký tự, và chỉ gắn cờ.

---

## Bước 6 — Giữ hợp đồng

### Phải làm

- Hợp đồng 11 sự kiện **ổn định**. Thay đổi phá vỡ đi vào `/v2`; đường dẫn đã công bố không bị đổi nghĩa.
- Không phát `approval_required` cho case (AD-28). Event và `/v1/approvals` vẫn trong hợp đồng, dành cho tool nhóm C.

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
| Đoán một mã khi ClauseResolver ra nhiều ứng viên, hoặc bỏ filter mã khi tìm không ra | Filter khóa việc tìm vào sai điều khoản, hoặc trả lời trôi chảy về điều khác với điều người dùng hỏi |
| Sinh tóm tắt case bằng LLM | Lộ tên dự án và chi tiết khách hàng |
| Để số do mô hình đọc từ văn xuôi đi vào input engine | Phá nguyên tắc trung tâm của hệ thống |
| Gọi ra ngoài mà không truyền `CancellationToken` của lượt | Người dùng đóng tab mà lời gọi vẫn chạy và vẫn tính tiền |
| Lấy verdict từ văn bản hoặc từ tham số mô hình gửi vào `submit_recommendation` | Mô hình có thể viết ngược kết quả engine |
| Lấy ấn bản dự án từ `pageContext.codeStandard` | `pageContext` là dữ liệu client gửi lên |
| Bỏ trống `effective_to` trong sidecar | Filter trên thuộc tính thiếu có thể trả rỗng mà không báo lỗi (R47) |
| Tin filter `scope_key` là lớp chặn duy nhất | Một lỗi filter là lộ tài liệu của org khác, không có cảnh báo |

---

## Liên quan

| Cần gì | Đọc |
| --- | --- |
| Thiết kế đầy đủ, quyết định, rủi ro, kiểm chứng | [01-kien-truc.md](01-kien-truc.md) |
| Hợp đồng SSE, schema request, mã lỗi | [02-hop-dong.md](02-hop-dong.md) |
| Frontend đang chờ gì ở mình | [04-frontend.md](04-frontend.md) |
| DevOps đang chờ gì ở mình | [05-devops.md](05-devops.md) |
| Mã mẫu C#, DDL, test phải có | [14-chi-tiet-backend.md](14-chi-tiet-backend.md) |
| Case theo AD-28 | [12-tra-case.md](12-tra-case.md) |
| Chi phí mỗi lời gọi | [13-chi-phi.md](13-chi-phi.md) |
| Hồ sơ đề xuất cho lãnh đạo/CTO | [kien-truc-day-du.md](kien-truc-day-du.md) |
