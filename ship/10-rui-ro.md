# 10 · Rủi ro, câu hỏi mở và cạm bẫy đã biết

**Ai đọc:** Tất cả. Người quản lý đọc mục 1, kỹ sư đọc mục 2 và 3.

---

## Vì sao có tài liệu này

Một tài liệu kiến trúc chỉ mô tả cái sẽ được xây. Tài liệu này mô tả **cái có thể hỏng**, và **cái chưa ai biết**.

Ba loại nội dung, ba cách dùng khác nhau:

| Mục | Là gì | Ai xử lý |
| --- | --- | --- |
| **Câu hỏi mở (Q)** | Thứ **đội kỹ thuật không quyết được** — pháp lý, bản quyền, ngân sách | Công ty, trước khi bắt đầu |
| **Rủi ro (R)** | Thứ có thể hỏng, kèm biện pháp giảm thiểu và người chịu trách nhiệm | Đội kỹ thuật, liên tục |
| **Cạm bẫy** | Lỗi đã biết trước, thường là mặc định sai của một dịch vụ | Đội kỹ thuật, một lần khi dựng |

**Mục lục**

1. Câu hỏi cần công ty quyết định trước khi bắt đầu
2. Bảng rủi ro
3. Cạm bẫy đã biết
4. Những gì tài liệu này chưa kiểm chứng
5. Phân loại rủi ro mới phát hiện
6. Độ chắc chắn của các cổng đo

## Vì sao phân biệt ba loại này

Một **câu hỏi mở** không phải rủi ro — nó là chỗ trống trong đầu vào. Đưa nó vào bảng rủi ro rồi "giảm thiểu" thì thành tự lừa mình: không ai giảm thiểu được việc chưa biết công ty có quyền dùng tài liệu hay không.

Một **cạm bẫy** cũng không phải rủi ro — nó là chuyện chắc chắn xảy ra nếu không làm gì. Xác suất bằng một. Ví dụ: sáu giá trị mặc định của dịch vụ vòng lặp AWS đều sai với dự án này, và **hệ thống vẫn chạy** nếu không đụng vào — chỉ là chạy sai.

## Cách đọc bảng rủi ro

Thang điểm: **X** = xác suất, **T** = tác động. T/V/C = thấp/vừa/cao.

Có một loại rủi ro đáng chú ý hơn các loại khác: **rủi ro dây chuyền**. Khung đánh giá một tầng không nhìn thấy nó vì mỗi mắt xích riêng lẻ trông không nghiêm trọng:

> mô hình bịa một con số → con số vào hồ sơ → hồ sơ được ký → thiệt hại pháp lý và uy tín

Những rủi ro thuộc loại này được chấm **tác động = cao** ngay cả khi xác suất thấp.

---
## 1. Câu hỏi cần công ty quyết định trước khi bắt đầu

Bảy quyết định dưới đây **không thuộc đội kỹ thuật** và có thể đổi hướng kiến trúc. Ghi nhận ngày quyết định và người quyết định vào repo.

| # | Câu hỏi | Hệ quả nếu trả lời khác giả định | Mức |
| --- | --- | --- | --- |
| Q1 | **Data residency, hai khu vực pháp lý.** Người dùng ở **Việt Nam và Pháp**, nên câu hỏi có hai nửa. (a) Với người dùng Pháp: chấp nhận request Bedrock route trong **8 region EU** (Frankfurt, Zurich, Stockholm, Milan, Spain, Ireland, London, Paris — model card 22/09/2026), hay bắt buộc single-region? (b) Với người dùng Việt Nam: dữ liệu cá nhân của công dân Việt Nam đi ra nước ngoài thuộc phạm vi **Luật Bảo vệ dữ liệu cá nhân (Luật 91/2025/QH15) và Nghị định 356, đã có hiệu lực** — cần hồ sơ đánh giá tác động chuyển dữ liệu xuyên biên giới nộp Bộ Công an, và Bộ Công an có quyền đình chỉ việc chuyển. Mức phạt tới **5% doanh thu năm liền trước**. Ai làm hồ sơ này và theo lịch nào? | Sonnet 5 trên `bedrock-runtime` **bắt buộc** dùng profile geo/global, không có in-region. Single-region chỉ còn `bedrock-mantle` (in-region ở `eu-west-1`, `eu-north-1`), nhưng endpoint này **không có Guardrails, Knowledge Bases, Converse**. Chọn single-region nghĩa là thiết kế lại tầng guardrail và gọi mô hình | **Chặn** — trước khi viết `ILlmClient` |
| Q2 | **Bản quyền tiêu chuẩn:** công ty có quyền ingest và xử lý tự động các tiêu chuẩn NF EN/DTU vào kho nội bộ không? | Kho khởi điểm thu hẹp về tài liệu nội bộ và tiêu chuẩn miễn phí. Kiến trúc không đổi, giá trị sản phẩm giảm | **Chặn** |
| Q3 | **Dữ liệu cá nhân:** câu hỏi và hội thoại của người dùng có được lưu, bao lâu, dựa trên cơ sở pháp lý nào? Ai là DPO? Đã rà soát pháp lý việc dữ liệu đi qua nhà cung cấp mô hình (Anthropic, Cohere, bán qua AWS Marketplace) chưa? | Đổi retention, cần thông báo người dùng, có thể cần DPIA. Nếu dùng AgentCore Harness (AD-13): trang tổng quan AgentCore ghi dịch vụ có thể lưu và dùng nội dung để cải thiện dịch vụ; cần DPO xác nhận (chưa biết có tùy chọn từ chối không) | Trước khi dùng dữ liệu thật của khách hàng; giai đoạn thử chỉ dùng tài liệu và dữ liệu mẫu |
| Q4 | **Topology production:** nền tảng chạy container là gì? Assistant dùng chung instance PostgreSQL hiện có hay cần instance mới? Sau AD-17 kho vector nằm ở MKB nên đây là câu hỏi vận hành, không còn là ràng buộc kỹ thuật | Cập nhật [09](09-trien-khai.md); chọn phương án quan sát; chi phí | **Chặn** |
| Q5 | **Tài liệu hướng dẫn sử dụng VF:** có ở dạng nạp được không (PDF, Markdown, trợ giúp trong ứng dụng), ai giữ bản mới nhất, phiên bản nào đang chạy ở khách hàng? | Yêu cầu 2 không làm được nếu không có nguồn; nếu tài liệu lỗi thời thì trả lời sai thao tác (R36) | **Chặn** |
| Q6 | **Phạm vi giai đoạn đầu:** làm bản rút gọn hay bản phạm vi hiện tại? | Bản rút gọn phủ yêu cầu 3 và 4 ở mức hẹp; bản phạm vi hiện tại phủ đầy đủ hơn | **Chặn** |
| Q8 | **Ngôn ngữ giao diện — đã có quyết định:** giao diện chỉ tiếng Pháp và tiếng Anh, thị trường mục tiêu là EU, không làm bản tiếng Việt. Phần còn để mở: tỉ lệ câu hỏi tiếng Anh so với tiếng Pháp, vì nó quyết định trọng số của nhóm câu hỏi tiếng Anh trong golden set | Thành phần bộ eval và cấu hình FTS cho câu hỏi tiếng Anh (R42) | **Chặn** — trước khi chốt embedding |
| Q7 | **Lưu vết khi có tranh chấp:** `audit_event` cố ý không chứa nội dung câu hỏi và `message` bị xóa sau thời hạn retention ([06](06-bao-mat.md)). Với lượt có phương án được ghi thành case, công ty muốn giữ bản ghi bất biến để dựng lại assistant đã nói gì, hay chấp nhận không dựng lại được? | Đổi thiết kế retention và xung đột với bảo vệ dữ liệu cá nhân | Trước beta |

---

## 2. Bảng rủi ro

Điểm: **X** = xác suất, **T** = tác động (T/V/C = thấp/vừa/cao). Luôn hỏi thêm: rủi ro này có **dây chuyền** sang tầng khác không (ví dụ ảo giác → hồ sơ sai → thiệt hại pháp lý và uy tín)? Rủi ro dây chuyền gây thiệt hại lớn nhất vì khung một tầng dễ bỏ sót; chúng được đánh dấu T = C ngay cả khi X thấp. **R27 đến R33 và R39 phụ thuộc trực tiếp vào AD-13 (AgentCore Harness là đường chính); R28, R29 và R32 phải quyết trước khi làm bất kỳ việc nào khác của nhánh Harness, ở cổng hạ tầng.**

> **Mã chủ sở hữu (cột cuối) là ký hiệu vai trò.** Bảng phân trách nhiệm đầy đủ ở [09](09-trien-khai.md) §12.

| # | Rủi ro | X | T | Giảm thiểu | Chủ sở hữu |
| --- | --- | --- | --- | --- | --- |
| R1 | Residency bắt buộc single-region (Q1) | V | C | Hỏi ngay giai đoạn đầu; nếu có, dừng và thiết kế lại trước khi viết `ILlmClient` | L |
| R2 | Không có quyền ingest tiêu chuẩn có bản quyền (Q2) | V | C | Xác nhận giai đoạn đầu; kế hoạch B: tài liệu nội bộ + tiêu chuẩn miễn phí; cột `license_tag` kiểm soát nạp | L, E |
| R3 | **API Gateway hoặc nginx production buffer SSE** | V | C | Kiểm tra qua đúng chuỗi khi đo. Nếu gateway không stream được, phương án dự phòng: đường SSE đi thẳng qua nginx, bỏ qua gateway; lớp dự phòng thấp: đường polling lấy nội dung lượt theo mã tin nhắn (việc của Frontend) khi không thể tránh buffer | L |
| R4 | Recall < 70% (cổng chất lượng truy xuất) | V | C | đo recall trước khi viết code RAG; cổng chất lượng truy xuất là cổng cứng; giai đoạn sau chỉ sửa truy xuất; hybrid, cắt theo điều khoản, thử nhiều embedding | B1 |
| R5 | Kỹ sư E không đủ thời gian soạn/chấm golden set | V | C | Xếp lịch E ngay giai đoạn đầu; bắt đầu bằng 20 câu, tăng dần; không có E thì hoãn nghiệm thu, không tự chấm | L |
| R6 | Quota Bedrock mặc định thấp ở EU (Sonnet 5) | V | V | Yêu cầu tăng ngay giai đoạn đầu (duyệt vài ngày làm việc); `maxTokens` tường minh; cache | L |
| R7 | Bảng và công thức trong PDF bị mất cấu trúc | C | C | Vision cho trang bảng; bảng dạng JSON kèm tiêu đề cột; nhóm eval riêng cho bảng | B1 |
| R8 | Tool sai đơn vị hoặc gọi ngoài phạm vi áp dụng | V | C | Manifest khai báo đơn vị và **giới hạn áp dụng**; test so số với engine; owner chuyên môn duyệt | E, B2 |
| R9 | Main API trả `Forbidden` nhưng HTTP 200; tool coi là thành công | C | C | Tool client đọc `ApiResult.Code`; test riêng cho từng tool | B2 |
| R10 | Kỹ sư tin mù quáng vào câu trả lời | V | C | Trích dẫn bấm được, hiện phiên bản tiêu chuẩn, thẻ kết quả kèm tham số, cảnh báo `unverified`; theo dõi tỉ lệ bấm trích dẫn; phát hiện dùng case thiếu kiểm tra ([07](07-giao-dien.md)) | F, E |
| R11 | ~~Case memory không có dữ liệu (kỹ sư không bấm Duyệt)~~ **Đóng bởi AD-28**: case tự ghi khi engine tính đạt. Rủi ro còn lại: kho case chỉ có phép tính đi qua trợ lý, chưa có phép tính kỹ sư tự làm trong ứng dụng (R35) | T | T | [12](12-tra-case.md) | B2 |
| R12 | Prompt injection qua tài liệu bên thứ ba | V | C | Phòng thủ nhiều lớp ([06](06-bao-mat.md)); không có tool ghi; bộ eval đối kháng | L |
| R13 | Chi phí vượt dự toán 3–5 lần | C | V | Công thức + giám sát từ giai đoạn đầu; Budgets; quota người dùng/organization; cache | L |
| R14 | Tải ghi của `tool_run`, `message` và `audit_event` làm chậm PostgreSQL dùng chung | V | C | Logical database `assistant` riêng; instance riêng nếu đo thấy cần (AD-12) | L |
| R15 | Credential dev/staging: khóa tĩnh lọt ra ngoài | V | C | IAM Roles Anywhere; nếu buộc dùng khóa tĩnh: quyền tối thiểu, xoay vòng, chỉ ở dev | L |
| R16 | Adaptive thinking bật mặc định làm tăng độ trễ và chi phí ngoài dự kiến | V | V | Tắt tường minh ở đường RAG; xác minh cách truyền khi đo; theo dõi token đầu ra | B2 |
| R17 | Sonnet 5 chỉ có tier Standard, không mua được ưu tiên độ trễ | V | V | Fallback Sonnet 4.6; prompt caching; ngân sách độ trễ đo thật khi đo | L |
| R18 | Đội 5 người, phụ thuộc cá nhân (bus factor) | V | V | Review chéo; tài liệu quyết định trong repo; interface rõ ràng | L |
| R19 | Mô hình/giám khảo trôi dạt làm điểm eval đổi | V | V | Ghim version; eval hằng đêm; lưu version giám khảo cùng kết quả | B1 |
| R20 | Dữ liệu ngữ cảnh trang (`pageContext`) bị giả | C | V | Engine tính lại; báo lệch ([01](01-kien-truc.md)) | B2 |
| R21 | Chưa dùng được Claude/Cohere ngày đầu: biểu mẫu use-case Anthropic, đăng ký Marketplace, lỗi `INVALID_PAYMENT_INSTRUMENT` với thanh toán SEPA | V | C | Thử một lệnh gọi thật ở việc đầu tiên của giai đoạn đo ([01](01-kien-truc.md) mục 7) | L |
| R22 | Bộ lọc `scope_key` rất chọn lọc làm MKB bỏ sót ứng viên, không báo lỗi. Tham số chỉ mục nằm trong hộp đen nên **không có nút nào để chỉnh**, nhưng KB có metric, ingestion log và trace X-Ray cho `Retrieve` để quan sát ([05](05-devops.md) bảng 4A) | V | C | `numberOfResults = 40` thay vì mặc định 5; đo recall theo từng scope; nhóm eval G ([01](01-kien-truc.md), [08](08-eval-quan-sat.md)). Hỏng thì xử lý ở mức quyết định, không phải mức cấu hình | B1 |
| R23 | ~~**Haiku 4.5 đã công bố mốc EOL.**~~ **Không còn áp dụng từ AD-15:** đường chính không gọi Haiku 4.5 nữa. Rủi ro vòng đời mô hình nay dồn vào Sonnet 5, và cách theo dõi giữ nguyên | C | V | `ILlmClient` đổi mô hình bằng cấu hình (AD-02) nên đổi là việc cấu hình, không phải sửa mã; đưa Nova 2 Lite và Sonnet 4.6 vào bộ so sánh định tuyến **sớm**, không đợi tới lúc phải đổi; kiểm trạng thái vòng đời **hằng tuần trong giai đoạn đầu**, không phải hằng tháng. Legacy tối thiểu 6 tháng nghĩa là mô hình vẫn gọi được sau EOL, nhưng không nên bắt đầu một giai đoạn đầu trên một mô hình sắp hết đời | L |
| R24 | Guardrails không đánh giá `toolResult`/`toolUse.input`; chunk trả về qua tool lọt vào ngữ cảnh không được kiểm | V | C | `ApplyGuardrail` riêng trên chunk trước khi đưa vào `toolResult`; ToolGate schema; nhóm eval đối kháng phủ đường `mixed` ([01](01-kien-truc.md)) | B2 |
| R25 | Chuyển tiếp token đầu vào tới Main API bị kiểm toán coi là nhòe ranh giới tin cậy | C | V | Chấp nhận có ghi nhận ở MVP; nếu yêu cầu, chuyển sang token exchange RFC 8693 ([06](06-bao-mat.md)) | L |
| R26 | Kho case chứa cấu hình chạy thử hoặc tính theo phiên bản engine cũ (AD-28) | C | V | Chỉ `verdict = pass`; `use_count`; `tool_version`; cảnh báo tiêu chuẩn cũ; rút case. Điều khiển ở [12](12-tra-case.md) §8 | B2 |
| R27 | ToolGate bị đặt ở lifecycle hook của Harness thay vì facade: hook không mang danh tính người dùng và không thấy thân phản hồi Main API, nên R9 (`Forbidden` trong HTTP 200) và R24 (chunk không qua guardrail) quay lại | V | C | Facade C# giữ ToolGate ([01](01-kien-truc.md)); test riêng từng tool; V-A8. **Rủi ro sống của giai đoạn đầu từ AD-13** | B2 |
| R28 | Cold start của microVM đánh vào lượt đầu mỗi hội thoại và vượt ngân sách p95 chữ đầu tiên (≲ 3 giây) | V | V | Số công bố : cold start **P75 khoảng 2 giây**, phiên ấm **dưới 100 ms**, nên chỉ lượt đầu chịu. Giữ `runtimeSessionId` một phiên cho một hội thoại; V-A4 đo thật ở giai đoạn đầu; không đạt thì bỏ AgentCore ngay trong giai đoạn đầu (AD-13, cổng hạ tầng) | L |
| R29 | Gọi `InvokeHarness` bằng Bearer JWT cần `HttpClient` thô và parser event stream (SDK ký SigV4); chỉ SigV4 thì mất danh tính người dùng ở Gateway | V | **C** | V-A1 **việc đầu tiên**; không đạt thì bỏ AgentCore khỏi giai đoạn đầu ngay (AD-13; tool inline đã bị loại). Đây là một trong hai điều kiện chặn của cổng hạ tầng | B2 |
| R30 | Mặc định của Harness sai chủ ý: model `global.*` (vi phạm Q1), `shell` và `file_operations` bật, Managed Memory bật, giới hạn 75 vòng và 3 600 giây | C | C | Cấu hình khai báo trong repo; test đọc lại sau triển khai; `allowedTools`; Memory tắt ([06](06-bao-mat.md), §12) | L |
| R31 | Nội dung hội thoại đi qua thêm một dịch vụ; AgentCore có thể lưu và dùng nội dung để cải thiện dịch vụ | V | C | Q3; DPO; che PII ở biên đầu vào | L |
| R32 | Keycloak chưa bật token exchange (RFC 8693), audience không khớp, hoặc Gateway không tới được facade: OBO không chạy, `[ApiAccess]` của Main API không áp dụng đúng | V | **C** | V-A6 **trước hết mốc chặn**; dự phòng 1: facade chạy như target AgentCore Runtime (HTTP) vốn hỗ trợ token passthrough (theo bảng outbound auth; chưa thử); dự phòng 2: bỏ AgentCore, chạy vòng lặp C#. Điều kiện chặn thứ hai của cổng hạ tầng | L |
| R33 | Lớp dịch stream và kênh phụ `tool_result` là mã mới, dễ lệch hợp đồng SSE 11 sự kiện | **C** | V | Contract test giữa mẫu stream của Harness và hợp đồng ở [02](02-hop-dong.md); V-A3 ở giai đoạn đầu. Không chặn giai đoạn đầu: `tool_call` và `tool_result` đều suy được từ `tool_run` của facade | B2 |
| R34 | Kỹ sư tin phương án "đã qua engine" trong khi engine chỉ kiểm các điều kiện đã lập trình, không thay đánh giá tổng thể | V | C | Thẻ nêu rõ đây là đề xuất và những điều kiện engine đã kiểm; mức Supervision; phát hiện dùng case thiếu kiểm tra ([07](07-giao-dien.md)); nhóm J của eval | E, F |
| R35 | Bốn yêu cầu không vừa trong bản rút gọn; Main API chưa có endpoint đọc kết quả theo dự án và cấu kiện | **C** | C | Bản nén bản rút gọn và điểm cắt sau cổng truy xuất ([01](01-kien-truc.md)); hỏi Main API ở giai đoạn đầu; Q6. AD-13 làm giai đoạn đầu nặng thêm, xem R39 | L |
| R36 | Tài liệu hướng dẫn VF lỗi thời hoặc khác phiên bản với bản đang chạy, dẫn tới thao tác sai | V | V | Ghi phiên bản trong câu trả lời; cảnh báo khi khác phiên bản; Q5; nhóm H của eval | B1 |
| R37 | Engine tính theo một phiên bản hoặc phụ lục quốc gia của tiêu chuẩn, kho tài liệu lại giữ phiên bản khác: gợi ý dẫn điều khoản không khớp với cách engine tính | V | C | `standardRef` trong manifest ghi phiên bản; kiểm phiên bản sau khi viết; câu trả lời nêu phiên bản của cả hai ([01](01-kien-truc.md)) | E, B1 |
| R43 | Quyền gọi mô hình có **ba cổng chặn độc lập** mà kế hoạch hiện gộp thành một dòng: thỏa thuận Marketplace cho Claude Sonnet 5 và Opus 5 (thông báo lỗi chỉ sang liên hệ AWS Sales, thời gian chờ khó đoán nhất), biểu mẫu use case của Anthropic cho Haiku 4.5 và Sonnet 4.6, và hạn mức requests/tokens mỗi phút. Đo thật trên một tài khoản thử nghiệm cho thấy cả ba đều chặn và mỗi cái báo một lỗi khác nhau ([01](01-kien-truc.md)) | V | C | Chạy lại bốn lệnh gọi đó trên **tài khoản production** trước khi bắt đầu để biết đang ở cổng nào; mở thỏa thuận Marketplace sớm nhất vì chờ lâu nhất; nếu nó phải qua AWS Sales thì **hoãn việc phụ thuộc vào nó, không cắt phạm vi**. Đường lui trong khi chờ: dựng khung bằng mô hình đã có quyền, chốt mô hình sau | L |
| R44 | **AD-15 biến AgentCore Harness thành điểm chết đơn, và bỏ hẳn đường lùi.** Phân loại và trả lời nay nằm trên cùng một dịch vụ, nên `InvokeHarness` hỏng là lượt hỏng hẳn: phát `error` kèm `requestId`, người dùng không nhận được câu trả lời nào. Bản trước còn luật nhanh gánh tạm ở chế độ giảm; bản này không còn. Đây là lựa chọn có ý thức — một câu trả lời sai vì mất khả năng giải đại từ nguy hiểm hơn một thông báo lỗi thành thật — nhưng nó dời toàn bộ rủi ro sẵn sàng sang AgentCore | C | C | Cảnh báo CloudWatch trên tỉ lệ lỗi và p95 độ trễ của `InvokeHarness`, ngưỡng đặt trước khi mở beta; đo tỉ lệ lỗi thật của dịch vụ trong giai đoạn đầu và đối chiếu với SLA của AWS; `error` phải kèm `requestId` để tra được; ngân sách ≲3 giây tới chữ đầu tiên đo lại vì mọi lượt bỏ được 300–500 ms nhưng 67% số lượt nay phải dựng phiên Harness. **Còn mở:** có chấp nhận chạy hẳn không có đường lùi, hay dựng một đường tối thiểu (trả lời bằng RAG cố định, bỏ tool) | M |
| R45 | **AD-16: router bóc sai tham số thì kỹ sư nhận tiền lệ sai.** `case_hints` quyết định case nào được đem ra so sánh. Bóc `nhịp 12 m` thành `1,2 m`, hoặc gán `fck` vào key `fyk`, thì hệ thống trả về 5 case trông hợp lý nhưng thuộc bài toán khác. Khác với ảo giác trong văn bản, sai ở đây **không để lại dấu vết trong câu trả lời** — con số hiển thị là con số có thật của case có thật, chỉ sai ở chỗ không liên quan. Kỹ sư ký hồ sơ có thể coi đó là tiền lệ nội bộ | V | C | Schema router chỉ nhận key thuộc `similarity_keys` và đơn vị thuộc enum của manifest; giá trị chỉ đến từ `case_hints` phải hiện thành chip cho kỹ sư xác nhận trước khi tra ([07](07-giao-dien.md)); dưới 2 key giải được thì hỏi lại thay vì trả kết quả yếu; golden set có nhóm câu đo riêng độ chính xác bóc tham số, tách theo đơn vị, trước cổng chất lượng truy xuất; mọi lượt `case_lookup` ghi `case_hints` gốc vào `audit_event` để dựng lại được khi có tranh chấp | M |
| R46 | **AD-17 đưa biên phân quyền ra khỏi câu SQL.** Nếu tự xây trên PostgreSQL, `scope_key = ANY(@scopes)` nằm trong cùng câu lệnh với tìm vector, nên bỏ qua nó là chuyện không làm được về mặt cấu trúc. Với MKB, nó là `retrievalConfiguration.managedSearchConfiguration.filter` — một tham số của lời gọi API (`vectorSearchConfiguration` chỉ dành cho custom KB). Bất kỳ đường mã nào gọi `Retrieve` mà không dựng filter sẽ trả về tài liệu của **mọi organization**, và trả về đúng định dạng, không lỗi, không cảnh báo | V | C | Bọc `Retrieve` trong đúng **một** lớp duy nhất nhận scope đã phân giải làm tham số khởi tạo bắt buộc; cấm gọi thẳng `bedrock-agent-runtime` retrieve ở nơi khác bằng architecture test trong CI chứ không bằng quy ước; test tích hợp đa organization chạy trên đường MKB trước cổng chất lượng truy xuất; bật CloudTrail data event cho `AWS::Bedrock::KnowledgeBase` (mặc định **không** ghi) để truy được ai đã truy vấn cái gì | M |
| R47 | **AD-17: bộ lọc metadata của Bedrock có ba đường có thể hỏng im lặng.** (1) Lọc trên thuộc tính không có trong sidecar của tài liệu đã nạp: tài liệu managed ghi thuộc tính phải có trên tài liệu đã nạp, còn khi thiếu thì trả **rỗng** hay báo lỗi là **chưa kiểm chứng** (tài liệu custom KB ghi là rỗng); (2) `startsWith` và `stringContains`: tài liệu managed ghi **không được hỗ trợ**, còn báo lỗi hay **bị bỏ qua** (tức truy vấn chạy không filter và trả về mọi thứ) là **chưa kiểm chứng**; `listContains` không nằm trong danh sách không hỗ trợ; (3) `numberOfResults` bỏ trống: tài liệu chung ghi mặc định **5**, trang managed không nêu | C | C | Chốt danh sách thuộc tính trong sidecar trước lô nạp đầu tiên, cùng lúc chốt embedding; chỉ dùng `equals`, `in`, `notIn` và các toán tử số — **cấm** `startsWith`, `stringContains` và `listContains` bằng review; đặt `numberOfResults` tường minh mọi lời gọi; V-K4 thử cả ba đường trên KB thật để biết đường nào báo lỗi, đường nào im lặng | M |
| R40 | Công ty đặt tại Việt Nam và một phần người dùng là công dân Việt Nam, nên đưa dữ liệu cá nhân của họ sang vùng AWS nước ngoài thuộc phạm vi Luật 91/2025/QH15 và Nghị định 356 (đã có hiệu lực): cần hồ sơ đánh giá tác động nộp Bộ Công an, Bộ Công an có quyền đình chỉ, phạt tới 5% doanh thu năm liền trước. **Không tránh được bằng cách chọn vùng** vì AWS không có vùng tại Việt Nam. AgentCore còn ghi rõ có thể lưu và dùng nội dung để cải thiện dịch vụ, làm rộng thêm phạm vi | C | C | Q1 nửa (b) và Q3; pháp chế mở hồ sơ **trước beta**, không đợi GA; che PII ở biên đầu vào ([06](06-bao-mat.md)) để thu hẹp phạm vi dữ liệu bị chuyển; nghĩa vụ này độc lập với GDPR, phải làm **song song** chứ không thay thế nhau | L, DPO |
| R41 | Kỹ sư ngồi tại Việt Nam gọi vùng EU cộng khoảng 250 đến 320 ms đường truyền mỗi lượt; cộng cold start của microVM (khoảng 2 giây, R28) thì ngân sách p95 chữ đầu tiên ≲ 3 giây chật cho nhóm này. Nhóm người dùng chính ở EU không chịu ảnh hưởng | V | V | Đã chấp nhận ở AD-14 vì thị trường mục tiêu là EU. Đo p95 **tách theo nơi gọi**, không gộp một số chung ([08](08-eval-quan-sat.md)); giữ phiên ấm; nếu nhóm tại Việt Nam trở thành nhóm chính thì xem lại phương án C ([01](01-kien-truc.md)) | L, B2 |
| R42 | Truy vấn xuyên ngôn ngữ ở mức nhẹ: câu hỏi **tiếng Anh** trên kho tài liệu **tiếng Pháp**. Từ AD-17, tìm kiếm hybrid (ngữ nghĩa + từ khóa) trên nội dung tài liệu nằm trong `Retrieve` của MKB, không còn là một cấu hình FTS theo ngôn ngữ mà đội tự đặt trong PostgreSQL — nên đội **không còn nút nào để chỉnh riêng cho từng ngôn ngữ câu hỏi**. Nhánh embedding vẫn chạy tốt nếu mô hình đa ngữ. Số hiệu điều khoản (ví dụ "6.2.2") và thuật ngữ tiêu chuẩn vẫn khớp được vì chúng không phụ thuộc ngôn ngữ | V | V | Cohere Embed v4 là mô hình đa ngữ, giữ nguyên lựa chọn; **không có tham số FTS nào để đặt riêng theo `locale`** vì nó nằm trong hộp đen của MKB; thêm nhóm câu hỏi tiếng Anh vào golden set và **đo recall tách theo ngôn ngữ** ở cổng truy xuất — đây là cách duy nhất còn lại để biết chỗ này có yếu không, vì không quan sát được cấu hình bên trong MKB | B1, E |
| R39 | AD-13 đưa ba hạ tầng mới (facade C#, Gateway `vf-tools`, Cedar Policy) cùng một lớp dịch stream vào giai đoạn đầu, trong khi giai đoạn đầu đã kín việc; phạm vi đã nén bản rút gọn chịu nặng nhất | C | C | Điểm cắt sớm: V-A1 và V-A6 không đạt hết mốc chặn thì bỏ AgentCore khỏi giai đoạn đầu, không chờ cổng hạ tầng; thứ tự ưu tiên khi giai đoạn đầu vỡ ghi ở ([01](01-kien-truc.md) và §10); vòng lặp C# ([01](01-kien-truc.md)) giữ nguyên là đường thoát đã thiết kế; L làm IAM/Gateway/Cedar, B2 làm facade | L, B2 |
| R38 | `tools.manifest.yaml` (đơn vị, giới hạn áp dụng, `standardRef`, biên tham số) là tài sản an toàn, nhưng chỉ kỹ sư E duyệt; E rời dự án thì manifest không còn chủ sở hữu chuyên môn | V | C | Ghi chủ sở hữu chuyên môn của từng tool trong manifest; đổi manifest phải qua review của kỹ sư có thẩm quyền và qua eval ([01](01-kien-truc.md)) | L, E |
| R48 | **Client ngắt nhưng lượt vẫn chạy.** Đóng tab hoặc rớt mạng mà `CancellationToken` không được truyền ở một lời gọi, hoặc BFF không truyền `req.signal`, thì lượt chạy tới hết và tính tiền đầy đủ. Harness phía AWS có thể chạy tiếp dù `Assistant.Api` đã dừng đọc stream (V-A11) | V | V | AD-25: một token hủy cho mỗi lượt; BFF truyền `req.signal`; nghiệm thu bằng `curl -N` + `Ctrl+C`; chỉ số token tiêu sau thời điểm ngắt ([08](08-eval-quan-sat.md)). Trần `maxIterations`, `timeoutSeconds` chặn thiệt hại tối đa | B1 |
| R49 | **Văn bản kết luận trái verdict của engine.** `NumberValidator` xác nhận số đúng, nhưng câu "dầm đạt" có thể sai khi engine báo không đạt. Rủi ro dây chuyền: kết luận sai vào hồ sơ | V | C | AD-24: nhãn trên thẻ lấy từ verdict của `tool_run`; `VerificationValidator` so nhãn với verdict; `submit_recommendation` không nhận verdict từ mô hình; nhóm J có câu engine báo không đạt | B2, E |
| R50 | **Retrieval trả sai ấn bản.** Trong lúc ingestion job chuyển ấn bản, hai bản cùng `active`; hoặc dự án theo bản cũ nhận đoạn trích của bản mới. Hai đoạn có thể khác đúng một hệ số. Liên quan R37 (engine và kho khác phiên bản) | V | C | AD-26: ngày hiệu lực trong sidecar; hai chế độ retrieval; loại trùng ấn bản trong `ScopedKnowledgeBaseClient`; nhóm K của eval | B1, E |
| R51 | **Retry hạ tầng chạy tool hoặc tạo case hai lần.** Hiện không có tool ghi nên chỉ tốn tiền; upsert case trong facade (AD-28) là đường ghi duy nhất, và `ON CONFLICT` giữ nó idempotent. Tác động lên mức cao ngay khi có tool ghi (nhóm C) | T | V | AD-27: khử trùng theo `toolUseId`; unique index cho case; luật chặn tool ghi thiếu khóa idempotency | B2 |

---

## 3. Cạm bẫy đã biết

Triệu chứng thường thấy và nguyên nhân thật. Đây là danh sách để đọc **trước** khi gỡ lỗi.

| Triệu chứng | Nguyên nhân thật |
| --- | --- |
| Truy vấn chạy bình thường nhưng kết quả như ngẫu nhiên | Tài liệu và câu hỏi nhúng bằng **hai mô hình khác nhau**, hoặc sai `input_type` |
| Câu trả lời bám đúng nguồn nhưng vẫn sai thực tế | Tài liệu trong kho đã cũ: lỗi khâu nạp và phiên bản, không phải mô hình |
| Trả lời "tôi không biết" kèm nhiều chi tiết lạc đề | Truy xuất sót đoạn chứa đáp án; **không phải ảo giác** |
| Kết quả trùng từ vựng nhưng lạc chủ đề | Thiếu ngưỡng tương đồng, hoặc ngưỡng dưới 0,6 |
| Tìm kiếm luôn trả về kết quả kể cả câu hỏi vô nghĩa | Bản chất tìm kiếm láng giềng gần nhất: phải có bộ lọc ngưỡng |
| Số liệu trong bảng bị lấy ra mà **mất tiêu đề cột** | Cắt bảng như cắt văn xuôi |
| Câu trả lời trôi chảy, định dạng đẹp, và sai | Chữ ký kinh điển của ảo giác; hệ thống không tự biết |
| Bộ đếm hạn mức tăng trên request đã bị từ chối | Kiểm tra hạn mức đặt trước giới hạn tốc độ |
| `ThrottlingException` dù không nhiều request | `maxTokens` không đặt tường minh, giữ chỗ quota quá lớn |
| `cacheReadInputTokens` luôn bằng 0 | Khối tĩnh dưới 1 024 token, hoặc có timestamp/tham số động lọt trước `cachePoint`, hoặc TTL hết hạn |
| Mọi lệnh nhúng bị `AccessDenied` sau khi thêm chính sách guardrail | Điều kiện `bedrock:GuardrailIdentifier` áp cả cho mô hình embedding (không hỗ trợ Guardrails) |
| `AccessDenied` khi gọi profile `eu.*` dù đã cấp quyền | Thiếu ARN foundation-model wildcard region, hoặc SCP chặn một region đích của profile |
| Người dùng thấy toàn bộ câu trả lời hiện ra một lần | Gateway/nginx/BFF buffer luồng SSE |
| Chất lượng giảm dần theo tháng mà không có lỗi | Một phần kho nhúng bằng mô hình khác; phát hiện bằng cột `embedding_model` |
| Test xanh nhưng production hỏng | Mock nhầm thứ cần mô hình thật; mock logic của mình, **không mock chất lượng suy luận** |
| Điểm eval tự động cao nhưng câu trả lời "thấy sai sai" | So khớp văn bản không bắt được lỗi một dữ kiện; dùng kiểm tra biến thể |
| Điểm eval thay đổi dù hệ thống không đổi | Trôi dạt của giám khảo LLM; ghim version |
| Lượng câu hỏi tăng vọt rồi giảm trong 2–một thời gian ngắn | Chất lượng kém hoặc chờ lâu, không phải "hào hứng lắng xuống" |
| Tool gọi được nhưng người không có quyền vẫn nhận kết quả | Coi HTTP 200 là thành công, bỏ qua `ApiResult.Code = Forbidden` |
| Mô hình được giao nhiều tool hơn mức cần | Tăng xác suất hành vi ngoài ý muốn; chỉ giao đúng tool user được phép dùng |
| Lịch sử hội thoại vẫn được gửi kèm sau khi bảo "bỏ qua câu trước" | Cần nút Phiên mới thật sự, không dựa vào câu dặn |

---

## 4. Những gì tài liệu này chưa kiểm chứng

Để không biến giả định thành sự thật:

| Hạng mục | Trạng thái |
| --- | --- |
| Managed Knowledge Base: khả dụng ở `eu-central-1` (V-K2) | **Đã xác minh** bằng tài liệu AWS |
| `overrideSearchType: HYBRID` (V-K5) | **Đã trả lời, bỏ.** Managed KB luôn hybrid và không có field này |
| Harness ở chế độ VPC cần NAT gateway (V-A10) | **Đã trả lời:** không cần để kéo image; cần endpoint `ecr.dkr`, `ecr.api`, `s3`, `bedrock-runtime` Skill `amazon-bedrock` (`v6`) vẫn ghi ngược lại; giữ theo tài liệu AWS, kiểm lại ở lần dựng đầu ([05](05-devops.md) mục 4C) |
| Hủy đọc stream `InvokeHarness` có dừng tool loop phía AWS không (V-A11) | **Chưa kiểm chứng.** Skill `amazon-bedrock` không nêu API dừng phiên. Không chặn: chỉ ảnh hưởng chi phí (R48) |
| Gateway có chuyển `toolUseId` xuống facade không (V-A12) | **Chưa kiểm chứng.** Thiếu thì dùng khóa thay thế ([01](01-kien-truc.md) §8.11) |
| Vị trí `filter` khi gọi `Retrieve` trên MKB | Tài liệu AWS ghi `managedSearchConfiguration`; skill `amazon-bedrock` (`v6`) ghi `vectorSearchConfiguration`. V-K3 gửi thử cả hai vị trí, vì vị trí sai có thể bị bỏ qua im lặng (R46) |
| Filter số trên `effective_from`, `effective_to` của MKB (AD-26) | **Chưa kiểm chứng trên MKB.** Toán tử số có trong cú pháp filter chung; gộp vào V-K4 |
| AWS SDK for .NET hỗ trợ `MANAGED` và gửi được `managedSearchConfiguration` (V-K3), managed S3 connector đọc sidecar có kiểu và lọc đúng, gồm hai đường chưa có câu trả lời trong tài liệu (V-K4) | **Chưa xác minh, và nay là đường chính** kể từ AD-17. Hai kiểm chứng chặn; trượt cái nào thì phải đưa lại quyết định lên bàn ngay, không đổi thứ tự ưu tiên |
| Reranker sẵn của MKB đủ tốt so với Cohere Rerank 3.5 (V-K6) | **Chưa đo.** Ràng buộc mới: reranker sẵn chỉ dùng được với embedding `MANAGED` |
| ACL của S3 ánh xạ được organization/project sang nhóm | **Đã trả lời: không.** ACL của S3 chỉ nhận `USER` (email) |
| Số chiều và `output_dimension` của Cohere Embed v4 | **Đã xác minh từ tài liệu:** 256/512/1024/1536, mặc định 1536. Còn cần đo: chiều nào cho recall tốt nhất, độ trễ |
| Cách truyền thinking/effort của Sonnet 5 qua Converse | **Đã xác minh từ tài liệu** (`additionalModelRequestFields`, `output_config.effort`). Còn cần gọi thật để xác nhận hành vi và độ trễ |
| Contextual grounding trên luồng stream | **Đã xác minh từ tài liệu:** không hỗ trợ chatbot hội thoại; stream chỉ đánh dấu sau khi xong; giới hạn 5 000 ký tự cho phản hồi. Thiết kế đã chuyển sang hậu kiểm bằng `ApplyGuardrail` |
| Action IAM cho Rerank | **Đã xác minh từ tài liệu:** `bedrock:Rerank` (Resource `*`) + `bedrock:InvokeModel`. Còn cần gọi thật để xác nhận cùng quyền Marketplace của Cohere |
| Độ trễ thật của từng bước | Toàn bộ số ở [01](01-kien-truc.md) và [02](02-hop-dong.md) là **ngân sách mục tiêu**, không phải số đo |
| Đơn giá và dự toán tiền | Không ghi; điền sau giai đoạn đo bằng trang giá chính thức |
| IAM Roles Anywhere cho máy chủ dev | Đề xuất; chưa dựng thử |
| Cấu hình audience Keycloak và `KeycloakPolicyProvider` chấp nhận token nhiều audience | Chưa kiểm tra trên hệ thống thật |
| Nền tảng chạy production | Chưa biết (Q4) |
| Chất lượng thư viện.NET cho PDF (PdfPig) trên tiêu chuẩn tiếng Pháp thật | Đo ở giai đoạn đầu; phương án dự phòng: trích xuất trang bằng vision toàn bộ với chi phí cao hơn |

---

## 5. Phân loại rủi ro mới phát hiện

Enterprise GenAI phân loại theo ba trục; dùng khi thêm rủi ro vào bảng ở §2, vì mỗi trục trả lời một câu hỏi khác:

| Trục | Trả lời | Ví dụ áp vào bảng hiện có |
| --- | --- | --- |
| Nguồn (dữ liệu, mô hình, con người, quy trình, bên thứ ba) | Sửa **ở đâu** | R12: bên thứ ba (tài liệu). R16: mô hình (mặc định của nhà cung cấp) |
| Bản chất (kỹ thuật, pháp lý, bảo mật, vận hành, uy tín, tương tác người-AI) | **Ai** sở hữu | R2: pháp lý. R10: tương tác người-AI |
| Ý định (vô ý, cố ý, hệ thống) | Là **lỗi** hay là **tấn công** | R12, R26: cố ý. R16, R7: vô ý |

Sách còn đề xuất chấm điểm có trọng số (rủi ro cố hữu nặng hơn rủi ro nhất thời, nặng hơn rủi ro hiệu năng). **Không áp dụng**: trọng số tùy ý cho một bảng 51 dòng chỉ tạo cảm giác chính xác; bảng X × T hiện có đủ để xếp thứ tự ở quy mô này.

---

## 6. Độ chắc chắn của các cổng đo

Với tỉ lệ đo được khoảng 70%, khoảng tin cậy 95% xấp xỉ ±1,96 × √(0,7 × 0,3 / n):

| Số câu (n) | Sai số khoảng |
| --- | --- |
| 30 | ±16 điểm phần trăm |
| 50 | ±13 điểm phần trăm |
| 100 | ±9 điểm phần trăm |

Hệ quả: với bộ 50 câu, cổng chất lượng truy xuất (recall ≥ 70%) có thể qua hoặc trượt chỉ do lấy mẫu, nhất là khi điểm đo nằm trong khoảng 57% đến 83%. Cách xử lý: mở rộng bộ câu hỏi trước cổng truy xuất nếu điểm rơi vào vùng này, hoặc phát biểu cổng theo cận dưới của khoảng tin cậy. Kết quả **theo từng nhóm** câu hỏi (mỗi nhóm chỉ vài câu) chỉ có giá trị định hướng.

---

## Liên quan

| Cần gì | Đọc |
| --- | --- |
| Kiến trúc tổng thể, điểm vào của bộ | [01-kien-truc.md](01-kien-truc.md) |
| Kiểm chứng chặn quyết định | [01-kien-truc.md](01-kien-truc.md) §11.1 |
| Rủi ro thi công của từng đội | [03](03-backend.md) · [04](04-frontend.md) · [05](05-devops.md) |
| Mục lục cả bộ | [README.md](README.md) |
