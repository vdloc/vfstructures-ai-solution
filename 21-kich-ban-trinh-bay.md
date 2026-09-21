# 21 · Kịch bản trình bày kiến trúc — buổi chung 20 phút

**Dành cho:** người trình bày (AI Solution Architect)
**Người nghe:** sếp, Backend, Frontend, DevOps — ngồi cùng phòng
**Thời lượng:** 20 phút, 6 slide, rồi tách nhánh riêng từng đội
**Ngày:** 20/09/2026 · **Phiên bản tài liệu nguồn:** 1.1

> Cột "LỜI NÓI" là thứ để đọc thành tiếng. Cột "TRÊN MÀN HÌNH" là thứ chiếu.
> Không đọc slide. Slide là bằng chứng cho câu bạn đang nói.

**Tình trạng thật phải nhớ suốt buổi:** chưa có dòng code nào chạy, tài khoản AWS hiện có là tài khoản dùng thử chỉ để tra tài liệu, chưa bật billing nên **chưa đo được số nào**. Mọi con số về độ trễ và chi phí trong buổi này là dự toán hoặc số lấy từ tài liệu AWS, không phải số đo. Nói rõ điều đó ít nhất một lần.

---

## Slide 1 · Pain point — 3 phút

### Trên màn hình

Không có slide. Chiếu màn hình máy tính thật, mở sẵn một file PDF tiêu chuẩn.

### Chuẩn bị trước

- Mở sẵn PDF `EN 1992-1-1` ở trang đầu, **chưa** bookmark.
- Có đồng hồ bấm giờ hiện trên màn (điện thoại chiếu lên cũng được).
- Chọn trước một câu hỏi thật, ví dụ: *"Hàm lượng cốt thép chịu cắt tối thiểu cho dầm là bao nhiêu, theo điều khoản nào?"*

### Lời nói

> Trước khi nói về kiến trúc, tôi muốn các anh xem một việc.
>
> Đây là câu hỏi một kỹ sư kết cấu bên mình hỏi mỗi ngày. *(đọc câu hỏi)*
>
> Tôi bấm giờ.

*(Làm thật: mở mục lục, tìm chương 6, cuộn, mở bảng tra, đối chiếu ký hiệu, đối chiếu đơn vị. Không diễn. Nếu lạc thì để nó lạc — càng thật càng tốt.)*

> *(dừng đồng hồ)* … Xong. Hết bao nhiêu đây. Và tôi đang làm chậm vì vừa làm vừa nói.
>
> Một kỹ sư làm việc này bao nhiêu lần một ngày? Nhân với số kỹ sư. Nhân với số ngày.
>
> Đó là con số tôi muốn giết. Không phải "ứng dụng AI". Con số đó.

### Vì sao mở kiểu này

Chưa có gì chạy để demo. Nhưng **pain point thì có thật và chiếu được ngay**. Không ai cãi cái họ vừa nhìn thấy bạn làm. Và tới đây bạn chưa hứa gì cả — nên chưa ai bắt bẻ được gì.

### Đừng làm

Đừng dựng sẵn bookmark để tìm cho nhanh. Đừng nói "thường thì mất khoảng…". Làm thật, để đồng hồ tự nói.

---

## Slide 2 · Đích đến — 2 phút

### Trên màn hình

Ba khung hình tĩnh, xếp ngang, mô phỏng panel AI nằm bên phải trang tính toán:

1. Kỹ sư gõ câu hỏi, panel đang chạy dòng chữ *"Đang tìm trong kho tài liệu"*.
2. Câu trả lời chảy ra, dưới mỗi khẳng định có thẻ trích dẫn `EN 1992-1-1:2004 · §6.2.2 · trang 84`.
3. Thẻ kết quả tính toán, có dòng *"Số liệu từ engine VF, không phải từ AI"* và nút **Duyệt**.

**Góc trên bên phải mỗi khung, chữ to, màu đỏ:**

```
MÔ PHỎNG — chưa có dòng code nào
```

### Lời nói

> Đây là đích. Ba khung này là ảnh vẽ, không phải ảnh chụp — tôi để chữ đỏ trên đó để không ai hiểu nhầm. Chưa có dòng code nào.
>
> Khung một: kỹ sư không rời màn hình đang làm. Panel nằm ngay cạnh trang tính toán.
>
> Khung hai: mỗi câu trả lời có trích dẫn tới đúng điều khoản và đúng trang. Không có trích dẫn thì không có câu trả lời — tôi sẽ quay lại chỗ này ở slide sau.
>
> Khung ba, và đây là khung quan trọng nhất: **con số không do AI tính**. AI gọi engine tính toán mình đang có, engine trả số, AI chỉ trình bày. Có nút duyệt, có người ký tên vào đó.

### Vì sao dán nhãn đỏ

Nhãn này không làm yếu bài. Nó làm mạnh. Người nghe thấy bạn tự phân biệt được cái đang có và cái đang hứa — đúng thứ họ đang ngầm chấm điểm ở một người làm kiến trúc. Chiếu ảnh không nhãn rồi để người ta tự hiểu nhầm, đến lúc vỡ ra là mất uy tín cho mọi câu nói còn lại của dự án.

---

## Slide 3 · Năm nguyên tắc — 3 phút

### Trên màn hình

Năm dòng, không hình:

| # | Nguyên tắc |
| --- | --- |
| P1 | AI hỗ trợ kỹ sư, không thay thế kỹ sư |
| P2 | **LLM không bao giờ tự tính số** |
| P3 | **Không có dẫn chứng thì không có câu trả lời** |
| P4 | Hàng rào kiểm soát nằm ngoài mô hình |
| P5 | Leo thang từ rẻ đến đắt |

P2 và P3 in đậm, cỡ chữ lớn hơn ba dòng còn lại.

### Lời nói

> Năm dòng này là thứ tôi không nhượng bộ trong 8 tuần. Tôi đọc hai dòng thôi, hai dòng in đậm.
>
> **P2: mô hình ngôn ngữ không bao giờ tự tính số.** Mọi con số kỹ thuật đi ra màn hình đều đến từ engine .NET mình đang chạy. AI chọn tool, điền tham số, gọi engine, rồi dựng thẻ kết quả từ JSON engine trả về. Nếu engine không chạy thì không có số, và hệ thống nói là không có số.
>
> Tôi nói trước điều này vì tôi biết trong phòng đang có một nỗi lo: AI bịa một con số kết cấu, rồi có người xây theo. Nỗi lo đó đúng. Kiến trúc này chặn nó ở tầng thiết kế, không phải bằng câu dặn trong prompt.
>
> **P3: không có dẫn chứng thì không có câu trả lời.** Tìm trong kho mà không đủ căn cứ thì hệ thống **từ chối**, và từ chối là hành vi đúng, không phải lỗi. Trong bộ đề kiểm tra của mình có hẳn một nhóm câu mà đáp án đúng là "phải từ chối".
>
> **P4** nói tiếp ý đó: hàng rào nằm ngoài mô hình. Lọc quyền chạy trước khi dữ liệu vào ngữ cảnh, guardrail chạy ở tầng Bedrock, kiểm tra tham số chạy ở cổng tool. Câu dặn trong prompt không phải biện pháp kiểm soát — nó là gợi ý, và gợi ý thì lách được.
>
> **P1** và **P5** để các anh đọc: người ký duyệt vẫn là kỹ sư, và mình đi từ rẻ tới đắt, không fine-tuning, không multi-agent trong 8 tuần.

### Vì sao đặt ở slide 3

Đây là nước cờ quan trọng nhất của cả buổi. Nỗi sợ "AI bịa số" mà nổ ra ở phút 40 thì cả buổi thành phiên phòng thủ. Giết nó ở phút thứ 6, mọi câu hỏi sau đó là câu hỏi kỹ thuật.

---

## Slide 4 · Sơ đồ — 3 phút

### Trên màn hình

Sơ đồ container, 6 khối, lấy từ [01-kien-truc-tong-the.md](01-kien-truc-tong-the.md) §Container. Khối mới tô xanh.

```
[Panel AI (FE)] → [Assistant.Api] → [Bedrock: Converse + Guardrails]
                        ↓                    ↓
                  [PostgreSQL         [Bedrock Managed KB]
                   case, tool_run,            ↑
                   audit, pg_trgm]     [S3: chunk + sidecar]
                        ↑
                  [Assistant.Worker]
```

### Lời nói

> Một hình cho cả buổi. Từ giờ tới hết ngày hôm nay tôi chỉ dùng lại đúng hình này, highlight phần đang nói.
>
> **Panel AI** — nằm trong ứng dụng hiện tại, không phải trang riêng.
>
> **Assistant.Api** — service .NET mới. Nó điều phối: nhận câu hỏi, xin quyền, đi tìm, gọi mô hình, phát chữ ra màn hình theo kiểu chảy dần.
>
> **Bedrock** — nơi mô hình chạy, ở Frankfurt. Kèm guardrail lọc nội dung.
>
> **Managed Knowledge Base** — đây là khối tôi muốn dừng lâu nhất. Đây là dịch vụ có sẵn của AWS giữ hộ mình toàn bộ phần vector: nhúng tài liệu, lưu, và tìm. Mình **không** dựng cơ sở dữ liệu vector nào cả.
>
> **S3** — chỗ chứa tài liệu gốc và các mảnh đã cắt. Managed KB đọc thẳng từ đây.
>
> **PostgreSQL** — chỉ giữ dữ liệu vận hành: hội thoại, lần chạy engine, nhật ký kiểm toán, và bảng tra mã điều khoản. Không còn giữ vector.
>
> **Assistant.Worker** — chạy nền: đọc PDF, cắt theo điều khoản, ghi ra S3. Phần này **không** biến mất khi dùng dịch vụ có sẵn, tôi sẽ nói rõ ở slide sau.

### Đừng làm

Đừng giải thích từng mũi tên. Đừng mở sơ đồ thành phần bên trong Assistant.Api — nó nằm ở tài liệu 19, ai cần sẽ đọc. Nói xong 6 khối là chuyển slide.

---

## Slide 5 · Ba quyết định và cái giá — 5 phút

### Trên màn hình

Ba khối, mỗi khối hai dòng. Dòng trên là quyết định, **dòng dưới là cái giá, chữ đỏ**.

| Quyết định | Cái giá đã biết và chấp nhận |
| --- | --- |
| **AD-17** · Truy xuất chạy trên Bedrock Managed Knowledge Base | Biên phân quyền không còn là mệnh đề SQL mà là **tham số của lời gọi API**. Quên dựng bộ lọc là trả về tài liệu của organization khác (R46) |
| **AD-15/16** · Router Haiku phân loại ý định và sinh `case_hints`, nằm ngoài luồng chính | Router đoán sai thì **không để lại vết nào trong câu trả lời** (R45) |
| **AD-12** · Một logical database `assistant` riêng | Lý do cũ để tách hẳn instance là tải chỉ mục vector — lý do đó mất rồi, nên **tách hay dùng chung là câu hỏi mở, cần sếp chốt** (Q4) |

### Lời nói

> Toàn bộ tài liệu có 22 quyết định kiến trúc. Tôi chỉ đưa ba cái mà nếu chọn sai thì phải viết lại phần lớn hệ thống.
>
> **Quyết định một: phần tìm tài liệu chạy trên dịch vụ có sẵn của AWS.**
>
> Công ty đã chốt nguyên tắc ưu tiên dịch vụ có sẵn. Tôi đi theo. AWS giữ hộ vector, mình không dựng và không vận hành kho vector nào. DevOps bớt được một hệ thống.
>
> Cái giá — và tôi nói trước khi có ai hỏi: *(chỉ vào dòng đỏ)* trước đây lọc quyền là một mệnh đề `WHERE` trong câu SQL, quên viết là câu lệnh chạy sai và dễ thấy. Bây giờ nó là một tham số của lời gọi API. Quên truyền tham số đó, API vẫn chạy, vẫn trả kết quả, nhưng trả tài liệu của mọi organization. Lỗi không kêu.
>
> Nên tôi xử lý nó ở tầng mã: chỉ có **một** class được phép gọi API đó, và class đó bắt buộc nhận đủ bốn tham số, không có tham số mặc định. Không ai gọi thẳng API. Chi tiết nằm ở tài liệu 16 cho đội Backend.
>
> **Quyết định hai: có một mô hình nhỏ chạy trước mỗi lượt để phân loại ý định.**
>
> Nó rẻ, nhanh, và làm hai việc: hiểu "nó" trong câu "nó có đạt không" là cái gì, và rút ra gợi ý về tình huống tương tự đã xử lý trước đó. Nó nằm **ngoài** đường đi chính — nó hỏng thì hệ thống rơi về luật cứng và vẫn trả lời được, chỉ kém thông minh hơn.
>
> Cái giá: router rút sai thông tin thì câu trả lời vẫn trôi chảy, vẫn có trích dẫn, nhưng dựa trên ngữ cảnh sai — và **không có dấu hiệu gì trên màn hình**. Đây là loại lỗi tôi sợ nhất trong cả kiến trúc. Cách chặn là bộ đề kiểm tra có nhóm câu riêng cho nó, chạy hằng đêm.
>
> **Quyết định ba: assistant có database logic riêng.**
>
> Tách để ranh giới dữ liệu và quyền rõ ràng, chi phí gần bằng không. Nhưng có một thay đổi cần sếp biết: trước đây tôi định xin hẳn một instance riêng, lý do là chỉ mục vector ngốn bộ nhớ. Vector đã sang AWS, lý do đó mất. Nên câu hỏi "một instance mới hay dùng chung" giờ là câu hỏi vận hành và chi phí, không còn là ràng buộc kỹ thuật. Tôi cần một quyết định ở đây.

### Vì sao nói cái giá trước

Người làm kiến trúc nói "phương án này rất tốt" thì Backend ngồi dưới đi tìm lỗ hổng, và họ sẽ tìm ra. Người làm kiến trúc nói "phương án này đổi lấy X, tôi chấp nhận X vì Y" thì Backend ngồi kiểm tra Y — mà Y bạn đã thủ sẵn. Đổi thế trận.

---

## Slide 6 · Cái chưa chắc, và bốn chữ ký — 4 phút

### Trên màn hình

Chia đôi. Nửa trên:

| Verification | Câu hỏi | Hạn |
| --- | --- | --- |
| V-K2 | Managed KB có ở Frankfurt chưa | hết ngày 3 · 23/09 |
| V-K3 | SDK .NET gọi được kiểu `MANAGED` không | hết ngày 3 · 23/09 |
| V-K4 | Connector đọc được metadata và lọc được không | hết ngày 3 · 23/09 |
| V-K5 | Tìm lai `HYBRID` có dùng được không | hết ngày 3 · 23/09 |
| V-A1 | .NET gọi được AgentCore bằng Bearer JWT không | hết ngày 3 · 23/09 |
| V-A6 | Keycloak đổi token theo RFC 8693 được không | hết ngày 3 · 23/09 |

Nửa dưới:

| Ai | Chốt gì | Hạn |
| --- | --- | --- |
| Sếp | Q4 topology và ngân sách; Q1 hồ sơ chuyển dữ liệu xuyên biên giới | trong buổi / tuần này |
| DevOps | Bật billing, mở quyền dùng mô hình Claude và Cohere | trước ngày bắt đầu |
| Backend | Nhận V-A1 | ngày 3 |
| Frontend | Đóng băng hợp đồng SSE | ngày 5 |

### Lời nói

> Phần cuối, và là phần tôi muốn các anh nhớ nhất.
>
> Tám tuần này chia làm hai phần. Phần tôi chắc: nguyên tắc, ranh giới giữa các đội, hợp đồng giữa các service — nằm hết trong tài liệu, các anh đọc và bắt bẻ được.
>
> Phần tôi **chưa** chắc là bảng trên đây. Sáu câu hỏi, chưa câu nào có câu trả lời, vì tài khoản AWS hiện tại là tài khoản dùng thử để tra tài liệu, chưa bật billing nên chưa gọi thật được lần nào.
>
> Tôi không xin các anh tin là tôi đúng. Tôi xin **ba ngày** để chứng minh.
>
> Và tôi phải nói thẳng một điều: quyết định bỏ vector store tự dựng nghĩa là **không còn fallback viết sẵn**. Lời gọi `Retrieve` của AWS giờ là phụ thuộc cứng. Trượt một trong bốn verification đầu, tôi đưa quyết định đó lại lên bàn ngay trong tuần 1 — không lùi lịch, không âm thầm chữa cháy.
>
> Thêm một rủi ro sếp nên biết sớm: mô hình nhỏ mình định dùng cho router có thông báo hết vòng đời **không sớm hơn 01/10/2026** — rơi đúng vào tuần 2 của dự án. Mô hình vẫn gọi được sau đó, nhưng tôi không muốn khởi động một dự án trên một mô hình sắp hết đời. Nên ngay tuần 1 tôi cho hai mô hình thay thế vào bộ so sánh. Đổi mô hình là đổi cấu hình, không phải sửa mã — chỗ này tôi đã thiết kế sẵn.
>
> *(chuyển xuống nửa dưới)*
>
> Hôm nay tôi cần bốn chữ ký. *(đọc từng dòng, nhìn đúng người đang ngồi)*
>
> Sếp: topology và ngân sách — Q4. Và Q1, hồ sơ chuyển dữ liệu cá nhân ra nước ngoài theo Luật 91 và Nghị định 356; cái này cần pháp chế, và nó cần bắt đầu tuần này chứ không phải tuần 6.
>
> DevOps: bật billing và mở quyền dùng mô hình. Cái này có thể mất vài ngày chờ AWS duyệt, nên nó phải chạy trước ngày bắt đầu.
>
> Backend: nhận V-A1, hết ngày 3.
>
> Frontend: đóng băng hợp đồng SSE, hết ngày 5. Sau đó đổi là đổi hai phía.
>
> Xong phần chung. Mời từng đội sang bàn riêng, mỗi đội 30 phút.

### Vì sao đóng bằng bảng chữ ký

Buổi họp kiến trúc không kết bằng danh sách cam kết có tên và có hạn thì sẽ phải họp lại.

---

## Phụ lục A · Câu hỏi thủ sẵn

| Câu hỏi | Trả lời |
| --- | --- |
| "Sao không dùng thẳng ChatGPT cho nhanh?" | P2 và P4. Số đến từ engine của mình; hàng rào nằm ngoài mô hình; tài liệu nội bộ không rời tài khoản công ty. Đây không phải chatbot, đây là lớp vỏ hội thoại đặt lên engine đang chạy. |
| "8 tuần có kịp không?" | Không hứa kịp. Hứa rằng cuối tuần 4 có cổng quyết định G3, đo bằng số trên bộ đề, và có sẵn phương án cắt phạm vi. Phạm vi đóng băng cuối tuần 6. |
| "Tốn bao nhiêu một tháng?" | Chưa đo được, vì chưa bật billing. Có công thức tính theo số lượt và kích thước ngữ cảnh; đo thật ở tuần 1 sau khi bật. Budgets và cảnh báo chi phí bật **trước** khi tăng lưu lượng. |
| "AI trả lời sai thì ai chịu?" | P1. Không có kết quả nào vào kho kinh nghiệm mà không qua thao tác duyệt có tên người và thời điểm. Mọi lần chạy engine đều ghi lại tham số vào và kết quả ra. |
| "Sao không tự dựng cho chủ động?" | Đã cân, ghi ở tài liệu 03 mục 2a.8: quyết định mua hay tự làm xét **theo từng thành phần**, không phải một lần cho cả hệ. Phần cắt đoạn theo điều khoản vẫn tự làm, vì đó là chỗ tạo khác biệt. Phần lưu và tìm vector thì mua. |
| "Dữ liệu người dùng đi đâu?" | Bedrock ở Frankfurt, tài khoản công ty, không dùng để huấn luyện. Nhưng người dùng Việt Nam thì thuộc Luật 91/2025 — đó chính là Q1 đang cần pháp chế trả lời, và nó là câu hỏi chặn. |
| "Sao phải bốn verification, đọc tài liệu AWS không đủ à?" | Tài liệu AWS nêu mốc phiên bản cho boto3 nhưng **không nói gì về .NET**. Mình viết .NET. Đó là V-K3, và không tra được, chỉ gọi thử mới biết. |

## Phụ lục B · Tuyệt đối không đưa lên màn hình

- Bảng 22 quyết định kiến trúc.
- Bảng 47 rủi ro.
- Danh sách 12 mục của arc42.
- Sơ đồ thành phần bên trong `Assistant.Api`.

Cả bốn thứ nằm trong [19-dac-ta-kien-truc.md](19-dac-ta-kien-truc.md) và [20-tai-lieu-thiet-ke-kien-truc.md](20-tai-lieu-thiet-ke-kien-truc.md), gửi trước buổi họp một ngày. Chiếu chúng lên là phát tín hiệu "phải đọc hết mới hiểu được" — ngược đúng thứ buổi này đang cố làm.

## Phụ lục C · Gửi trước một ngày

| Nhận | File |
| --- | --- |
| Sếp, người duyệt | [20-tai-lieu-thiet-ke-kien-truc.md](20-tai-lieu-thiet-ke-kien-truc.md) |
| Backend, Frontend, DevOps | [19-dac-ta-kien-truc.md](19-dac-ta-kien-truc.md) |
| Backend | [16-guideline-backend.md](16-guideline-backend.md) |
| Frontend | [17-guideline-frontend.md](17-guideline-frontend.md) |
| DevOps | [18-guideline-devops.md](18-guideline-devops.md) |
