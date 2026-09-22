# Hồ sơ đề xuất giải pháp CNTT — VF Structures AI Assistant

**Phiên bản:** 1.1 · **Ngày:** 22/09/2026
**Đối tượng đọc:** CTO, Giám đốc Kỹ thuật, Giám đốc Kỹ thuật Công trình, Ban lãnh đạo công ty
**Mục đích:** hồ sơ trình duyệt đầu tư — trình bày kiến trúc tổng thể, mô hình vận hành, chi phí và rủi ro để ra quyết định xây dựng hệ thống trợ lý AI kỹ thuật cho VF Structures.
**Nguồn:** toàn bộ nội dung kỹ thuật trong tài liệu này lấy từ bộ tài liệu kỹ thuật (13 file, bản chính thức đã bàn giao), đã đối chiếu trực tiếp với tài liệu AWS và sách chuyên ngành trong đợt rà soát gần nhất (21/09/2026). Tài liệu này là bản trình bày lại cho đối tượng đọc doanh nghiệp — khi có xung đột về chi tiết kỹ thuật, bộ tài liệu kỹ thuật là nguồn đúng.

---

## Mục lục

0. Tóm tắt điều hành
1. Vì sao công ty nên xây dựng hệ thống này
2. Nền tảng khái niệm
3. Kiến trúc kỹ thuật tổng thể
4. Mô hình vận hành AI
5. Vòng đời tri thức
6. Khung đánh giá AI
7. Nền tảng tri thức kỹ thuật
8. Kiến trúc triển khai production trên AWS
9. Cân nhắc chi phí
10. Rủi ro và quản trị rủi ro
11. Câu hỏi cần công ty quyết định
12. Hướng mở rộng tương lai
13. Phụ lục

---

## 0. Tóm tắt điều hành

VF Structures đang vận hành một hệ thống tính toán kết cấu đã chạy ổn định nhiều năm. Kỹ sư dùng hệ thống này hằng ngày, nhưng ba việc xung quanh phép tính — tra cứu tiêu chuẩn, tìm lại tình huống tương tự đã làm trước đó, và diễn giải kết quả — vẫn hoàn toàn thủ công. Đề xuất này không thay hệ thống tính toán hiện có. Đề xuất là thêm một tầng trợ lý AI đứng cạnh hệ thống đó, giải quyết đúng ba việc thủ công trên, trong khi phép tính kỹ thuật vẫn chạy nguyên qua engine đang có.

Kiến trúc đề xuất dựa trên ba nguyên tắc không đổi trong toàn bộ hồ sơ: mô hình ngôn ngữ không được phép tự tính hay tự quyết — mọi con số kỹ thuật đi qua engine hiện tại; mọi câu trả lời phải truy được về nguồn, không có ngoại lệ; và hệ thống chỉ đóng vai trò hỗ trợ, quyết định kỹ thuật và trách nhiệm ký hồ sơ vẫn thuộc về kỹ sư.

Hồ sơ này trình bày kiến trúc kỹ thuật, mô hình vận hành, cách đo hiệu quả, chi phí dự kiến và rủi ro cần quản trị, làm căn cứ cho quyết định đầu tư. Một số điểm — bản quyền dữ liệu nguồn, phạm vi triển khai giai đoạn đầu, chỉ tiêu kinh doanh cụ thể — nằm ngoài phạm vi kỹ thuật và cần công ty quyết định trước khi triển khai, liệt kê ở mục 11.

---

## 1. Vì sao công ty nên xây dựng hệ thống này

### 1.1 Bài toán kinh doanh

Ba việc kỹ sư đang làm thủ công quanh mỗi phép tính:

- **Tra cứu tiêu chuẩn.** Tìm đúng điều khoản trong hàng nghìn trang tiêu chuẩn NF EN, DTU, hoặc tài liệu nội bộ — tốn thời gian, và kết quả phụ thuộc vào trí nhớ hoặc kinh nghiệm cá nhân của từng kỹ sư.
- **Tìm tình huống tương tự.** Một cấu kiện tương tự đã từng được tính trước đó, nhưng không có cách nào tra lại có hệ thống — kinh nghiệm nằm rải rác trong đầu từng người, không phải trong một kho dùng chung.
- **Diễn giải kết quả.** Đọc và giải thích một bảng kết quả tính toán cho đồng nghiệp hoặc khách hàng đòi hỏi kỹ sư tự soạn lại bằng lời, mỗi lần một cách.

Ba việc này không tạo ra giá trị kỹ thuật mới — chúng chỉ là chi phí thời gian đứng giữa kỹ sư và phép tính thật. Hệ thống đề xuất nhắm thẳng vào ba việc đó.

### 1.2 Phạm vi chức năng đề xuất

| Mã | Chức năng | Giá trị |
| --- | --- | --- |
| F1 | Hỏi đáp tiêu chuẩn có trích dẫn | Thay tra cứu thủ công bằng câu trả lời có dẫn nguồn kiểm chứng được |
| F2 | Tính toán qua engine hiện có | Kỹ sư hỏi bằng lời, hệ thống gọi đúng engine đang chạy, không đoán số |
| F3 | Tra tình huống nội bộ đã tính đạt | Biến kinh nghiệm cá nhân rải rác thành tài sản tri thức dùng chung |
| F4 | Nạp và phát hành tài liệu nguồn | Kho tài liệu luôn cập nhật, không phụ thuộc một người giữ file |
| F5 | Giải thích kết quả đang mở trên trang | Kỹ sư không phải soạn lại lời giải thích mỗi lần |
| F6 | Kiểm lại số, trích dẫn và nhãn kết luận sau khi sinh | Chặn sai số và trích dẫn ảo trước khi tới tay người dùng |
| F7 | Đánh giá chất lượng và quan sát vận hành | Phát hiện chất lượng trôi dạt trước khi khách hàng gặp lỗi |

### 1.3 Giữ tri thức, không chỉ tăng tốc

Giá trị lớn nhất không phải là tốc độ trả lời, mà là việc biến tri thức đang nằm trong đầu từng kỹ sư — cách đọc một điều khoản mơ hồ, tình huống nào từng gặp lỗi, kinh nghiệm nào chỉ người làm lâu năm mới biết — thành một tài sản của công ty, tra được, kiểm chứng được, không mất đi khi một kỹ sư nghỉ việc. Mục 7 trình bày chi tiết cơ chế biến kinh nghiệm cá nhân thành tài sản dùng chung.

### 1.4 Tác động năng suất — cần đo, không suy diễn

Tài liệu kỹ thuật nguồn xác định điểm giá trị năng suất lớn nhất nằm ở chức năng giải thích kết quả (F5): kỹ sư không phải rời màn hình đi tra cứu hay tự mô tả lại bài toán. Tuy nhiên, tại thời điểm viết hồ sơ này, công ty **chưa có số đo cụ thể** cho thời gian tiết kiệm, tỉ lệ kỹ sư sử dụng, hay mức giảm công việc lặp lại. Mục 6 trình bày kế hoạch đo các chỉ tiêu này sau khi triển khai.

---

## 2. Nền tảng khái niệm

Ba khái niệm kỹ thuật quyết định hình dạng của toàn bộ kiến trúc dưới đây.

**Một, mô hình ngôn ngữ lớn (LLM) về bản chất chỉ dự đoán chữ tiếp theo — không tra cứu, không tính toán.** Khi được hỏi một phép tính, nó không nhân chia — nó đoán chuỗi chữ khả dĩ nhất, và có thể trả về một con số sai nhưng trình bày rất tự tin. Hiện tượng bịa thông tin nghe như thật gọi là hallucination. Phần lớn thiết kế trong tài liệu này tồn tại để chặn hiện tượng đó, không để tăng thêm khả năng của mô hình.

**Hai, retrieval-augmented generation (RAG) là cơ chế bắt buộc, không phải một tùy chọn.** Thay vì hy vọng mô hình tự nhớ đúng nội dung tiêu chuẩn, hệ thống tìm đoạn tài liệu liên quan trước, đưa cho mô hình đọc, rồi mới yêu cầu trả lời dựa trên đoạn đó. Đây là cách duy nhất buộc câu trả lời truy được về một nguồn có thật.

**Ba, chi phí và giới hạn tốc độ vận hành trên hai cơ chế tính riêng của AWS.** Chi phí tính theo token thực dùng. Giới hạn tốc độ tính theo một hệ số nhân riêng của AWS — với mô hình trả lời đang chọn (Claude Sonnet 5), mỗi token sinh ra tính thành mười token trừ vào giới hạn tốc độ. Mục 9 trình bày chi tiết hệ quả kiến trúc của cơ chế này.

---

## 3. Kiến trúc kỹ thuật tổng thể

### 3.1 Các khối chính

Sáu khối chính: bốn khối phần mềm công ty tự phát triển hoặc đã có, hai khối là dịch vụ thuê của Amazon Web Services (AWS).

| Khối | Vai trò |
| --- | --- |
| Panel AI | Giao diện hội thoại, đặt trong ứng dụng tính toán hiện có — không phải một trang riêng biệt |
| `Assistant.Api` | Service điều phối trung tâm: nhận câu hỏi, kiểm quyền, phân loại, gọi mô hình, kiểm lại kết quả |
| `Assistant.Worker` | Tiến trình nền, tách khỏi lượt hỏi đáp, chuẩn bị và cập nhật kho tài liệu |
| PostgreSQL | Lưu hội thoại, bản ghi mỗi lần chạy engine, và kho tình huống đã tính đạt |
| Amazon Bedrock | Dịch vụ AWS gọi mô hình AI qua một cổng chung, tính phí theo token |
| Bedrock Managed Knowledge Base (MKB) | Dịch vụ AWS quản trọn gói kho tài liệu — nhận file, đánh chỉ mục, tìm kiếm theo yêu cầu |

Hệ thống hiện tại (Main API, chứa engine tính toán đã vận hành nhiều năm) **không bị sửa đổi**. Một service nhỏ, gọi là tool facade, đứng giữa làm nhiệm vụ gác cổng, trình bày ở mục 3.3.

### 3.2 Kiến trúc AI Agent

Vòng lặp "mô hình đề xuất gọi hàm → hệ thống gọi thật → trả kết quả → mô hình xem xét tiếp" có thể tự viết bằng mã nguồn nội bộ. Kiến trúc đề xuất dùng dịch vụ quản lý sẵn của AWS thay vì tự viết: **AgentCore Harness** quản vòng lặp gọi hàm, **AgentCore Gateway** biến các API nội bộ thành công cụ mô hình gọi được, và **Cedar** — ngôn ngữ chính sách của AWS — quy định ai được gọi công cụ nào.

Lựa chọn dùng dịch vụ quản lý thay vì tự viết vòng lặp có một điểm cần nói rõ: AgentCore Harness cho gắn điểm chèn logic (hook) vào vòng lặp, nhưng thông tin hook nhận được không có danh tính người dùng và không có kết quả thật từ hệ thống tính toán. Vì vậy toàn bộ lớp kiểm an toàn của hệ thống (mục 3.4) đặt ở một service riêng đứng sau Gateway, đúng nơi lời gọi thật sự được thực thi, chứ không đặt trong vòng lặp của Harness.

Việc phân loại một câu hỏi thuộc nhóm nào — hỏi tài liệu, yêu cầu tính toán, hay tra tình huống cũ — do một mô hình nhỏ, nhanh và rẻ (Claude Haiku) đảm nhiệm ở đầu mỗi lượt hỏi, tách biệt khỏi mô hình chính trả lời câu hỏi (Claude Sonnet 5). Mục 3.3 và 3.5 trình bày lý do dùng nhiều tầng mô hình thay vì một mô hình duy nhất cho mọi việc.

### 3.3 Kiến trúc RAG (Retrieval-Augmented Generation)

Truy xuất tài liệu chạy theo hai giai đoạn liên tiếp:

1. **Tìm rộng.** Câu hỏi được gửi tới Bedrock Managed Knowledge Base qua API `Retrieve`, trả về bốn mươi đoạn tài liệu (chunk) có điểm liên quan cao nhất, đã lọc theo quyền đọc của người dùng ngay trong tham số gọi.
2. **Chọn hẹp.** Bốn mươi đoạn đó được chấm điểm lại chính xác hơn (rerank), chọn ra tám đoạn tốt nhất. Nếu điểm cao nhất vẫn dưới một ngưỡng đã định, hệ thống từ chối trả lời thay vì trả lời dựa trên tài liệu không thật sự liên quan.

Với câu hỏi có chứa mã điều khoản tiêu chuẩn, PostgreSQL tìm mã chuẩn trước, trong đúng các tài liệu người dùng được đọc — sửa được cả khi người dùng gõ thiếu hoặc thừa dấu chấm — vì Managed Knowledge Base tìm được theo nghĩa và từ khóa nhưng không sửa được mã điều khoản gõ sai. Không chắc người dùng muốn điều nào thì hệ thống hỏi lại kèm vài mã gợi ý, chứ không đoán.

**Quyết định kiến trúc quan trọng nhất của nhánh này:** dùng Bedrock Managed Knowledge Base thay vì tự xây dựng và vận hành một kho vector riêng trên nền PostgreSQL. Đánh đổi: công ty không còn tự chỉnh được các tham số kỹ thuật sâu của việc tìm kiếm (thuật toán xếp hạng, tham số chỉ mục), và mô hình embedding không đổi được sau khi kho đã được tạo. Đổi lại, công ty không phải tự vận hành, tự vá lỗi, và tự mở rộng một hệ thống tìm kiếm vector — một hạng mục kỹ thuật phức tạp và tốn nhân lực nếu tự làm.

### 3.4 Kiến trúc tool calling (gọi hàm)

Khi câu hỏi cần một phép tính thật, đường xử lý đi qua: `Assistant.Api` → AgentCore Harness (mô hình phát tín hiệu muốn gọi hàm) → AgentCore Gateway (áp chính sách Cedar, đổi token xác thực) → tool facade → Main API (engine tính toán hiện có).

Tool facade là lớp kiểm an toàn quan trọng nhất trên đường này, gồm sáu lớp kiểm chạy tuần tự trước khi cho phép một lệnh gọi thật vào engine:

| Lớp | Kiểm gì |
| --- | --- |
| 1 | Đúng khuôn dạng tham số (schema) |
| 2 | Người dùng có quyền gọi công cụ này không |
| 3 | Giá trị tham số nằm trong khoảng hợp lệ đã khai báo |
| 4 | **Đơn vị đo bắt buộc phải có** — thiếu đơn vị thì từ chối, không suy diễn |
| 5 | Chống gọi lặp — cùng công cụ, cùng tham số, quá hai lần thì dừng |
| 6 | **Đọc đúng mã lỗi thật ẩn trong phản hồi thành công của Main API** |

Hai lớp 4 và 6 được đánh giá nguy hiểm hơn bốn lớp còn lại, vì cả hai đều là những điểm hệ thống có thể sai mà kết quả vẫn trông hợp lý trên màn hình — không đơn vị đo thì một giá trị có thể bị hiểu sai hàng nghìn lần nhưng engine vẫn trả về một con số nghe hợp lý; không đọc đúng mã lỗi ẩn trong phản hồi thành công thì một lỗi từ chối quyền có thể bị mô hình diễn giải nhầm thành dữ liệu hợp lệ.

### 3.5 Kiến trúc mô hình và giao thức công cụ (MCP)

Kiến trúc dùng ba tầng mô hình, mỗi tầng phục vụ một việc khác nhau:

| Việc | Mô hình | Lý do |
| --- | --- | --- |
| Phân loại câu hỏi, viết lại, bóc tham số | Claude Haiku 4.5 | Chạy trên mọi lượt hỏi, cần nhanh và rẻ |
| Trả lời chính, vòng lặp gọi hàm | Claude Sonnet 5 | Việc cần chất lượng suy luận cao nhất |
| Đường dự phòng khi mô hình chính lỗi | Claude Sonnet 4.6 | Giữ lượt hỏi hoàn thành thay vì gãy hẳn |

**Về giao thức MCP (Model Context Protocol):** kiến trúc **cố ý không dựng một MCP server độc lập** cho hệ thống. Danh mục công cụ (tool registry) được sinh từ đặc tả OpenAPI có sẵn của Main API, chạy trong cùng tiến trình với tool facade, rồi chỉnh tay khi cần — đơn giản hơn và dễ kiểm soát hơn một MCP server riêng phải vận hành thêm. AgentCore Gateway, ở tầng hạ tầng AWS, phơi các API nội bộ ra theo hình dạng tương thích MCP để AgentCore Harness gọi được — đây là cơ chế nội bộ của AWS, không phải một MCP server công khai mà công ty tự vận hành hay mở cho bên ngoài gọi vào.

### 3.6 Kiến trúc dữ liệu

Ba loại dữ liệu, ba cơ chế xử lý khác nhau vì đặc tính khác nhau:

| Loại dữ liệu | Đặc tính | Nơi lưu | Cơ chế truy xuất |
| --- | --- | --- | --- |
| Tài liệu tiêu chuẩn | Văn bản, không cấu trúc, khối lượng lớn | Amazon S3 (file gốc) + Bedrock MKB (đã đánh chỉ mục) | Retrieval — tìm theo nghĩa |
| Kết quả tính toán | Con số, có cấu trúc, phải chính xác tuyệt đối | PostgreSQL | Tool calling — gọi thẳng engine |
| Tình huống đã tính đạt (case) | Bộ thông số có cấu trúc của một cấu kiện mà engine đã tính và kết luận đạt | PostgreSQL | Tra cứu theo tham số tương đồng |

Cách ly dữ liệu giữa các khách hàng dùng hai cơ chế khác nhau tùy loại dữ liệu. Với tài liệu, việc lọc thực hiện bằng một tham số của API `Retrieve` — vì kho tài liệu do AWS quản lý, hệ thống không viết được câu truy vấn SQL trực tiếp vào đó. Với dữ liệu tình huống, việc lọc thực hiện bằng câu lệnh SQL trên PostgreSQL, nơi có cơ chế Row-Level Security (RLS) của chính cơ sở dữ liệu — một cơ chế khiến việc bỏ sót điều kiện lọc trở nên gần như không thể xảy ra, miễn vai trò kết nối ứng dụng bị RLS ràng buộc.

---

## 4. Mô hình vận hành AI

### 4.1 Nguyên tắc vận hành cốt lõi

**Nguyên tắc P1: hệ thống hỗ trợ kỹ sư, không thay thế kỹ sư.** Một tình huống chỉ trở thành tri thức dùng chung của công ty khi engine tính toán đã tính và kết luận đạt. Mô hình ngôn ngữ không bao giờ tự đưa câu chữ của nó vào kho tri thức dùng chung, và kỹ sư vẫn là người chịu trách nhiệm cho quyết định cuối cùng.

### 4.2 Chủ sở hữu

Kiến trúc kỹ thuật hiện đã gán vai trò tạm thời cho từng hạng mục rủi ro và vận hành, dùng ký hiệu ngắn (ví dụ: đội dẫn dắt kỹ thuật, hai đội backend, đội DevOps, đội frontend, đội quản lý sản phẩm). **Đây là ký hiệu vai trò do đội kỹ thuật đề xuất, chưa phải một ma trận RACI chính thức đã được công ty phê duyệt.** Trước khi vận hành thật, công ty cần điền tên người phụ trách cụ thể cho từng hạng mục vận hành, đặc biệt là quyền quyết định ngân sách, quyền phê duyệt thay đổi mô hình AI, và quyền xử lý sự cố dữ liệu.

### 4.3 Quy trình xác nhận kỹ thuật

Mọi giá trị đưa vào kho tri thức dùng chung đều phải là kết quả trực tiếp từ engine tính toán, sau khi engine đã kiểm tham số và kết luận đạt. Tham số hệ thống tự bóc tách được từ câu hỏi chỉ dùng để tra cứu, không bao giờ được ghi vào kho dùng chung; giá trị chỉ có nguồn từ suy diễn của mô hình ngôn ngữ cũng vậy.

### 4.4 Quản trị AI

Ba cơ chế quản trị đã có sẵn trong kiến trúc kỹ thuật, cần được công ty xác nhận là chính sách chính thức trước khi vận hành:

- **Ép an toàn ở tầng hạ tầng, không dựa vào lời dặn trong prompt.** Ở tầng quyền của AWS có một điều kiện bắt buộc: mọi lời gọi mô hình chat phải kèm theo bộ lọc nội dung (guardrail). Thiếu điều kiện này, AWS tự từ chối cuộc gọi — không phụ thuộc vào việc mô hình có "nghe lời" hay không.
- **Ghi vết đầy đủ, không thể chối bỏ.** Mọi lần gọi công cụ tính toán, mọi lần ghi hay rút một tình huống khỏi kho đều lưu bản ghi bất biến (chỉ-thêm, không sửa được) gồm ai, làm gì, khi nào — phục vụ tra soát khi có tranh chấp.
- **Kiểm lại sau khi sinh, không phải trước khi hiển thị.** Một tầng kiểm bằng mã tất định (không phải hỏi lại mô hình) chạy sau khi mô hình đã trả lời, đối chiếu mọi con số và trích dẫn với dữ liệu nguồn thật — trình bày chi tiết ở mục 6.

---

## 5. Vòng đời tri thức

Tri thức trong hệ thống không tĩnh — nó lớn dần theo từng lượt kỹ sư dùng hệ thống, qua một vòng khép kín:

```
Kỹ sư tương tác với hệ thống
        ↓
Hệ thống ghi log (tool_run) — kết quả tính toán, có cấu trúc
        ↓
Engine kết luận đạt — tham số đã qua đủ các lớp kiểm
        ↓
Hệ thống ghi bản ghi tình huống (case) — chính thức thành tri thức dùng chung
        ↓
Tình huống được tái sử dụng cho các câu hỏi tương tự sau này
```

Mỗi lần engine tính toán chạy, kết quả được ghi lại thành một bản ghi có cấu trúc (`tool_run`). Chỉ khi engine kết luận cấu kiện đạt, hệ thống mới ghi bộ thông số đó thành một bản ghi tình huống (case), ngay trong cùng một thao tác ghi với `tool_run`. Cùng một cấu hình được tính đạt nhiều lần thì chỉ có một bản ghi, kèm số lần đã dùng lại.

Từ đó, các câu hỏi tương lai có tham số tương tự (nhịp dầm, mác bê tông, loại cấu kiện...) sẽ được đối chiếu với kho tình huống này, ưu tiên lọc cứng theo công ty sở hữu và loại cấu kiện trước, rồi mới so khoảng cách theo tham số kỹ thuật.

Một vòng phản hồi thứ hai chạy song song, phục vụ việc cải thiện chất lượng: khi kỹ sư đánh dấu một câu trả lời là chưa tốt, phản hồi đó vào hàng đợi phân loại định kỳ; nếu xác định là lỗi thật (thiếu tài liệu, tài liệu lỗi thời, prompt sai, hoặc lỗi công cụ), câu hỏi đó cùng đáp án đúng được thêm vào bộ câu hỏi kiểm định chất lượng (trình bày ở mục 6), để lỗi tương tự không tái diễn trong các phiên bản sau.

---

## 6. Khung đánh giá AI

Đánh giá hệ thống theo hai nhóm chỉ tiêu tách biệt: chỉ tiêu kỹ thuật (đã có cơ chế đo) và chỉ tiêu kinh doanh (cần thiết lập trước khi vận hành).

### 6.1 Chỉ tiêu kỹ thuật

| Chỉ tiêu | Cách đo | Cơ chế |
| --- | --- | --- |
| Độ chính xác truy xuất tài liệu | Recall@8 trên bộ câu hỏi kiểm định có đáp án đúng | Bộ câu hỏi kiểm định (golden set), chạy như cổng chặn trong quy trình tích hợp liên tục, không cho phát hành nếu điểm dưới ngưỡng |
| Độ chính xác thực thi công cụ | Đối chiếu kết quả tool calling với đáp án đã biết | Nhóm câu hỏi tính toán trong bộ câu hỏi kiểm định |
| Chất lượng câu trả lời | Một mô hình khác, mạnh hơn, chấm điểm độc lập (LLM-as-judge) | Chạy song song bộ câu hỏi kiểm định |
| Không bịa số | 100% số liệu trong câu trả lời truy được về nguồn thật | Lớp kiểm chạy sau khi mô hình sinh câu trả lời |
| Không bịa trích dẫn | 100% trích dẫn phân giải được về một đoạn tài liệu có thật | Lớp kiểm chạy sau khi mô hình sinh câu trả lời |

Bộ câu hỏi kiểm định chạy tự động mỗi khi có thay đổi liên quan (prompt, cấu hình truy xuất, phiên bản mô hình), và là cổng chặn thật — không phải một báo cáo chỉ để đọc.

### 6.2 Chỉ tiêu kinh doanh — hiện là khoảng trống, cần thiết lập trước khi vận hành

Tại thời điểm viết hồ sơ này, các chỉ tiêu sau **chưa có định nghĩa hay kế hoạch đo cụ thể** trong tài liệu kỹ thuật, và hồ sơ này không đưa ra con số ước tính khi chưa có căn cứ:

- **Thời gian tiết kiệm** trên mỗi lượt hỏi, so với quy trình tra cứu thủ công hiện tại.
- **Tỉ lệ kỹ sư sử dụng** hệ thống thường xuyên, so với tổng số kỹ sư có quyền truy cập.
- **Mức giảm công việc lặp lại** — số lần một tình huống tương tự phải tính lại từ đầu thay vì tra được từ kho tình huống đã tính đạt.

Khuyến nghị: thiết lập cách đo và một mốc đo cơ sở (baseline) trước khi triển khai giai đoạn đầu, làm căn cứ so sánh sau một khoảng thời gian vận hành thật.

---

## 7. Nền tảng tri thức kỹ thuật

Tài sản tri thức của công ty, trong phạm vi hệ thống này, gồm bốn loại: tài liệu tiêu chuẩn, tình huống tính toán đã tính đạt, kết quả tính toán thô, và các quyết định kỹ thuật đi kèm lý do lựa chọn.

**Vì sao tình huống đã tính đạt có giá trị hơn tài liệu đơn thuần.** Một tài liệu tiêu chuẩn chỉ nói quy tắc chung — nó không nói quy tắc đó áp dụng thế nào vào một tình huống cụ thể mà công ty đã từng gặp. Một tình huống đã tính đạt (case) thì có cấu trúc: tham số đầu vào cụ thể, kết quả cụ thể, và engine đã kiểm kết quả đó đạt. Tra một tình huống tương tự cho câu trả lời gần với thực tế công việc hơn nhiều so với tra một điều khoản tiêu chuẩn viết chung chung — đây chính là lý do chức năng tra tình huống (F3) và cơ chế ghi tình huống (mục 5) được đặt ở trung tâm của giá trị hệ thống mang lại, chứ không chỉ là chức năng phụ đi kèm hỏi đáp tài liệu.

---

## 8. Kiến trúc triển khai production trên AWS

Sơ đồ tầm cao các thành phần hạ tầng:

| Tầng | Thành phần | Vai trò |
| --- | --- | --- |
| Frontend | Panel AI (trong ứng dụng hiện có) + lớp trung gian BFF (backend for frontend) | Giao diện hội thoại; BFF giữ mọi thông tin xác thực ở phía server |
| API | `Assistant.Api` (.NET 8) | Điều phối trung tâm: xác thực, phân loại, gọi mô hình, kiểm lại kết quả |
| Agent Runtime | AgentCore Harness + Gateway | Quản vòng lặp gọi hàm, áp chính sách truy cập công cụ |
| Cơ sở dữ liệu | PostgreSQL | Hội thoại, bản ghi tính toán, kho tình huống đã tính đạt |
| Vector Database | Bedrock Managed Knowledge Base | Chỉ mục và tìm kiếm tài liệu theo nghĩa |
| Storage | Amazon S3 | Lưu file tài liệu nguồn, mã hóa và có versioning |
| Monitoring | Amazon CloudWatch (qua chuẩn mở OpenTelemetry) | Trace theo từng lượt hỏi, chỉ số vận hành Bedrock, cảnh báo |

Danh tính người dùng dùng lại nguyên hệ thống Keycloak hiện có của công ty — kiến trúc mới không xây dựng một hệ thống quản lý quyền song song, tránh rủi ro hai bộ logic phân quyền lệch nhau theo thời gian. Toàn bộ vùng dữ liệu đặt tại khu vực châu Âu (Frankfurt, Đức) để phù hợp yêu cầu cư trú dữ liệu.

Việc chọn OpenTelemetry — một chuẩn quan sát mở, không khóa vào một công cụ cụ thể — cho phép đổi đích quan sát sau này (ví dụ sang một công cụ chuyên sâu hơn) mà không phải viết lại mã đo đạc.

---

## 9. Cân nhắc chi phí

### 9.1 Cấu trúc chi phí

Chi phí vận hành hệ thống chia thành hai nhóm có đặc tính khác nhau:

- **Chi phí theo lượt dùng (biến đổi):** chi phí gọi mô hình AI, tính theo số token xử lý — vào và ra, tùy mô hình. Đây là phần chi phí lớn nhất và biến động theo mức độ sử dụng thực tế.
- **Chi phí hạ tầng (tương đối cố định):** hạ tầng Agent Runtime, cơ sở dữ liệu, lưu trữ, và ghi log — trả theo dung lượng và cấu hình, không theo từng lượt hỏi. Tại thời điểm viết hồ sơ này, đơn giá cụ thể cho các hạng mục này **chưa được tra cứu và xác nhận** — cần điền trước khi lập ngân sách chính thức, dựa trên công cụ tính giá của AWS.

Một điểm cần lưu ý khi lập ngân sách: dịch vụ AWS Bedrock **không có gói miễn phí** — chi phí tính từ lần gọi mô hình đầu tiên. Theo dõi chi phí cần được thiết lập ngay từ giai đoạn triển khai đầu tiên, không phải việc để dành đến khi có hóa đơn đầu tiên gây bất ngờ.

### 9.2 Chiến lược tối ưu

Ba cơ chế kỹ thuật kiểm soát chi phí đã có trong kiến trúc:

1. **Phân tầng mô hình theo việc** (mục 3.5) — dùng mô hình nhỏ, rẻ để phân loại chạy trên mọi lượt hỏi, chỉ dùng mô hình lớn ở việc cần chất lượng cao nhất.
2. **Giới hạn độ dài câu trả lời tường minh trên mọi lời gọi mô hình** — nếu bỏ trống, hệ thống giữ chỗ hạn mức tốc độ theo mức tối đa của mô hình ngay từ đầu mỗi yêu cầu, làm giảm đáng kể số lượt xử lý đồng thời dù hóa đơn cuối kỳ không đổi. Đây là nguyên nhân phổ biến nhất gây từ chối yêu cầu khi lưu lượng còn thấp nếu không cấu hình đúng.
3. **Hai lớp giới hạn tốc độ tách biệt** — một lớp của AWS (theo tài khoản, chống quá tải hạ tầng dùng chung) và một lớp riêng của hệ thống (theo người dùng và theo công ty khách hàng, chống chi phí phình lên vì một khách hàng dùng quá mức). Cảnh báo ngân sách đặt ở ba mốc 50%, 80%, 100% mỗi tháng.

### 9.3 Theo dõi và phân bổ chi phí

Cơ chế gắn nhãn chi phí (cost allocation tag) của AWS cho phép tách chi phí hệ thống trợ lý AI khỏi phần còn lại của hạ tầng công ty theo từng sản phẩm, phục vụ báo cáo tài chính minh bạch mà không cần dựng công cụ phân tích riêng.

---

## 10. Rủi ro và quản trị rủi ro

Bộ rủi ro đầy đủ (47 mục, có mã, mức độ, biện pháp giảm thiểu và chủ sở hữu tạm thời) nằm trong tài liệu kỹ thuật gốc. Bốn rủi ro sau đáng chú ý nhất ở tầm quyết định đầu tư:

| Rủi ro | Vì sao trọng yếu | Biện pháp |
| --- | --- | --- |
| Điểm phân loại câu hỏi trở thành điểm chết đơn | Toàn bộ lượt hỏi phụ thuộc một lần gọi mô hình nhỏ; nếu mô hình này gặp sự cố, hệ thống mất khả năng hiểu ngữ cảnh hội thoại (dù vẫn có đường dự phòng chạy được ở mức giảm) | So sánh sẵn mô hình thay thế trước khi cần, không đợi đến lúc bắt buộc phải đổi |
| Mô hình phân loại đã công bố mốc kết thúc vòng đời | Có thể phải đổi mô hình ngay trong giai đoạn triển khai đầu tiên | Đổi mô hình chỉ là thay đổi cấu hình, không sửa mã nguồn — đã thiết kế sẵn |
| Điểm chèn logic (hook) của dịch vụ quản lý vòng lặp gọi hàm không nhận danh tính người dùng | Toàn bộ lớp kiểm an toàn phải đặt đúng vị trí ở service riêng; dời vào hook thì lỗi quyền có thể lọt vào kết quả trả về | Kiểm tra riêng từng công cụ, cô lập lớp kiểm an toàn khỏi vòng lặp AI |
| Tài liệu hướng dẫn sử dụng phần mềm nội bộ có thể lỗi thời | Có thể khiến hệ thống hướng dẫn sai thao tác cho người dùng | Phụ thuộc câu hỏi mở về nguồn tài liệu hướng dẫn (mục 11) |

---

## 11. Câu hỏi cần công ty quyết định

Bốn câu hỏi sau nằm ngoài thẩm quyền kỹ thuật, cần công ty trả lời trước khi triển khai:

1. **Bản quyền dữ liệu tiêu chuẩn.** Công ty có quyền nạp và xử lý tự động các tiêu chuẩn NF EN/DTU vào kho tài liệu nội bộ không? Nếu không, phạm vi kho tài liệu khởi điểm phải thu hẹp, kiến trúc không đổi nhưng giá trị sản phẩm giảm.
2. **Nền tảng triển khai production.** Hệ thống chạy container nào? Dùng chung hạ tầng cơ sở dữ liệu hiện có hay cần hạ tầng riêng?
3. **Nguồn tài liệu hướng dẫn sử dụng phần mềm.** Có sẵn ở dạng nạp được không (PDF, Markdown...), ai giữ bản mới nhất, và phiên bản nào đang chạy ở từng khách hàng?
4. **Phạm vi triển khai giai đoạn đầu.** Triển khai bản rút gọn hay bản đầy đủ như phạm vi kỹ thuật hiện đã thiết kế?

---

## 12. Hướng mở rộng tương lai

**Đây là một tầm nhìn dài hạn, không phải một kế hoạch triển khai gần.** Kiến trúc hiện tại xử lý bảy chức năng (mục 1.2) qua một luồng điều phối duy nhất, có phân loại đầu vào nhưng không phải kiến trúc đa agent. Hướng mở rộng khác về bản chất so với việc chia nhỏ luồng xử lý hiện tại: thay vào đó là các agent chuyên trách theo **miền chuyên môn kỹ thuật khác nhau** — ví dụ một agent cho kết cấu (Structural), một agent cho cơ điện (MEP — mechanical, electrical, plumbing), một agent cho dự toán chi phí (Cost), và một agent cho rà soát hồ sơ (Review) — mỗi agent phục vụ một mảng nghiệp vụ riêng, phối hợp với nhau khi cần.

Hai điều kiện kỹ thuật cần giải quyết trước khi hướng này khả thi, đã xác nhận trực tiếp với tài liệu AWS:

- Cơ chế cộng tác đa agent có sẵn của AWS (multi-agent collaboration) chỉ tồn tại ở dịch vụ Bedrock Agents thế hệ cũ, hiện đã ở chế độ duy trì (maintenance mode) và đóng với khách hàng mới.
- Dịch vụ đang dùng cho hệ thống hiện tại (AgentCore Harness) chưa có cơ chế điều phối đa agent (supervisor/collaborator) sẵn có tương đương.

Vì vậy, hướng mở rộng này cần một quyết định kiến trúc riêng, có đo lường lợi ích cụ thể trên bộ câu hỏi kiểm định, trước khi bắt đầu — không suy diễn từ kiến trúc hiện tại.

---

## 13. Phụ lục

### 13.1 Bảng thuật ngữ

| Thuật ngữ | Nghĩa |
| --- | --- |
| LLM (Large Language Model) | Mô hình ngôn ngữ lớn — bộ máy dự đoán chữ tiếp theo |
| RAG (Retrieval-Augmented Generation) | Tìm tài liệu liên quan trước, rồi mới cho mô hình trả lời dựa trên đó |
| Token | Đơn vị mô hình đọc và viết; chi phí tính theo token |
| Hallucination | Hiện tượng mô hình bịa thông tin nhưng trình bày như thật |
| MCP (Model Context Protocol) | Giao thức chuẩn hóa cách mô hình AI gọi công cụ bên ngoài |
| Guardrail | Bộ lọc nội dung của Amazon Bedrock, ép ở tầng hạ tầng |
| Case | Bộ thông số của một cấu kiện mà engine đã tính và kết luận đạt, trở thành tri thức dùng chung |
| Golden set | Bộ câu hỏi kiểm định có sẵn đáp án đúng, chạy như cổng chặn chất lượng |
| RLS (Row-Level Security) | Cơ chế của PostgreSQL tự chặn truy vấn thiếu điều kiện lọc dữ liệu |
| TPM/TPD | Hạn mức token mỗi phút / mỗi ngày do AWS đặt cho tài khoản |

### 13.2 Nguồn tham chiếu

Toàn bộ quyết định kỹ thuật trong tài liệu này đối chiếu với tài liệu chính thức AWS (fetch trực tiếp, ngày 18–21/09/2026) và các sách chuyên ngành về kiến trúc AI doanh nghiệp, RAG production, và Amazon Bedrock — danh sách đầy đủ kèm ngày fetch nằm ở `00-thuat-ngu-va-nguon.md`.

### 13.3 Đọc sâu hơn

Bộ tài liệu kỹ thuật đầy đủ (13 file, bản chính thức) nằm tại thư mục này, bắt đầu từ [`README.md`](README.md) (mục lục, thứ tự đọc theo vai trò). Liên quan trực tiếp tới từng mục của hồ sơ này:

| Mục hồ sơ này | File tương ứng |
| --- | --- |
| 1–2 (bài toán, khái niệm nền) | [11-thuyet-minh.md](11-thuyet-minh.md) |
| 3 (kiến trúc kỹ thuật) | [01-kien-truc.md](01-kien-truc.md), [03-backend.md](03-backend.md) |
| 4 (mô hình vận hành, quản trị) | [06-bao-mat.md](06-bao-mat.md), [10-rui-ro.md](10-rui-ro.md) §2 (chủ sở hữu) |
| 5 (vòng đời tri thức) | [02-hop-dong.md](02-hop-dong.md), [03-backend.md](03-backend.md) |
| 6 (khung đánh giá AI) | [08-eval-quan-sat.md](08-eval-quan-sat.md) |
| 8 (triển khai AWS) | [05-devops.md](05-devops.md), [09-trien-khai.md](09-trien-khai.md) |
| 9 (chi phí) | [11-thuyet-minh.md](11-thuyet-minh.md) Phần 9b, [00-thuat-ngu-va-nguon.md](00-thuat-ngu-va-nguon.md) |
| 10–11 (rủi ro, câu hỏi mở) | [10-rui-ro.md](10-rui-ro.md) |

Khi có xung đột chi tiết giữa hồ sơ này và bộ tài liệu kỹ thuật, bộ tài liệu kỹ thuật là nguồn đúng.
