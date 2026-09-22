# Giải thích cho người không làm kỹ thuật

Bốn cơ chế viết bằng lời thường, không cần biết lập trình.

## Tra case

### Tra case là gì

Mỗi lần kỹ sư nhờ phần mềm tính một cấu kiện, ví dụ một cây dầm, và kết quả là **đạt**, hệ thống tự lưu lại bộ thông số của cây dầm đó: dài bao nhiêu, bê tông loại gì, tiết diện bao nhiêu. Mỗi bộ thông số như vậy gọi là một **case**.

Lâu dần, công ty có một **kho các cấu kiện đã từng tính đạt**.

Khi một kỹ sư gặp bài toán mới, họ hỏi: *"Trước đây công ty đã làm cây dầm nào giống thế này chưa?"* Hệ thống tìm trong kho và đưa ra **5 cây dầm giống nhất**.

### Case được lưu thế nào

Không ai phải nhập tay. Kỹ sư chỉ việc tính như bình thường:

```
Kỹ sư tính một cây dầm
        ↓
Phần mềm tính toán kết luận: ĐẠT
        ↓
Hệ thống tự lưu bộ thông số vào kho của công ty
```

Kết quả **không đạt** thì không lưu, vì đó không phải cấu hình nên tham khảo.

Cùng một cấu hình được tính đạt nhiều lần thì kho không lưu thành nhiều bản. Hệ thống chỉ ghi thêm **"đã dùng thêm 1 lần"**. Cấu hình được dùng nhiều lần là cấu hình công ty thật sự hay chọn.

### Tìm case giống nhất thế nào

Ví dụ kỹ sư hỏi: *"Dầm nhịp 12 m, bê tông C30, cao 600 mm, có case nào giống không?"*

**Bước 1: Hiểu câu hỏi.** Hệ thống đọc ra ba thông số: nhịp 12 m, bê tông 30, chiều cao 600 mm.

**Bước 2: Lọc thô.** Chỉ giữ những case:
- của **đúng công ty này**, không bao giờ lấy case của công ty khác
- cùng loại cấu kiện (dầm thì chỉ so với dầm)
- đã tính đạt

**Bước 3: So từng con số.** Với mỗi case còn lại, hệ thống so từng thông số xem lệch nhau bao nhiêu.

Mỗi thông số có đơn vị và độ lớn khác nhau: lệch 1 m nhịp khác hẳn lệch 50 mm chiều cao. Vì vậy hệ thống quy mọi độ lệch về cùng một thang, từ 0 (giống hệt) tới 1 (khác hoàn toàn), rồi mới cộng lại.

**Bước 4: Ưu tiên case có nhiều điểm để so.** Một case chỉ có 2 thông số trùng thì dù trông rất giống, bằng chứng vẫn ít hơn một case trùng cả 4 thông số. Hệ thống trừ điểm case có ít thông số để so.

**Bước 5: Chọn 5 case giống nhất.** Hai case ngang điểm nhau thì ưu tiên case **được dùng nhiều lần hơn**, rồi tới case **dùng gần đây hơn**.

### Ví dụ

Kỹ sư hỏi: nhịp **12 m**, bê tông **30**, cao **600 mm**.

| Case | Thông số | Nhận xét | Xếp hạng |
|---|---|---|---|
| A | nhịp 11 m, bê tông 30, cao 650 mm | Lệch ít ở cả 3 thông số | **1** |
| C | nhịp 8 m, bê tông 30, cao 600 mm | Khớp 2 thông số, nhưng nhịp lệch nhiều | **2** |
| B | nhịp 12 m, bê tông 35 | Nhịp khớp hoàn toàn, nhưng chỉ có 2 thông số để so | **3** |

Case B trông "trúng" nhịp nhất nhưng xếp cuối, vì có quá ít thông tin để khẳng định nó giống.

### Kỹ sư nhận được gì

5 case, mỗi case ghi rõ:
- thông số và kết quả tính
- **số lần công ty đã dùng cấu hình này**
- lần dùng gần nhất
- tiêu chuẩn đã áp dụng

Kèm một nhãn bắt buộc: **"Cấu hình đã từng tính đạt trong công ty, không phải khuyến nghị."**

### Ba điều hệ thống không làm

1. **Không tự áp case vào bài toán mới.** Case chỉ để tham khảo. Kỹ sư tự quyết, và vẫn phải tính lại cấu hình của mình.
2. **Không cho xem case của công ty khác.** Kho của mỗi công ty tách biệt hoàn toàn.
3. **Không để AI tự tạo case.** Case chỉ sinh ra từ phần mềm tính toán thật, không từ những gì AI viết hay đọc được trong câu hỏi.

### Tóm lại một câu

**Tính đạt thì hệ thống tự nhớ. Khi hỏi, hệ thống tìm những cấu kiện công ty đã từng tính đạt có thông số gần nhất, ưu tiên cấu hình được dùng nhiều, rồi đưa ra để kỹ sư tham khảo.**

## Cơ chế so sánh case

Hệ thống so hai cây dầm bằng ba bước: **đo độ lệch từng thông số**, **lấy trung bình**, rồi **trừ điểm nếu có ít thông số để so**. Điểm càng **nhỏ** thì càng **giống**.

### Bước 1: Đo độ lệch của từng thông số

**Vấn đề:** các thông số khác đơn vị và khác độ lớn.
- Nhịp lệch 1 m
- Chiều cao lệch 50 mm
- Bê tông lệch 5 cấp

Không cộng thẳng ba con số này được: 50 lớn hơn 1, nhưng không có nghĩa lệch chiều cao "quan trọng hơn".

**Cách giải:** mỗi thông số có một khoảng giá trị thường gặp, khai sẵn trong hệ thống. Độ lệch được chia cho độ rộng khoảng đó.

```
độ lệch = |giá trị đang hỏi − giá trị của case| ÷ độ rộng khoảng
```

Kết quả luôn nằm từ **0** (giống hệt) tới **1** (khác xa nhất có thể).

Ví dụ, giả sử khoảng thường gặp là:
- nhịp: 2–20 m, rộng 18 m
- bê tông: 20–60, rộng 40
- chiều cao: 200–1200 mm, rộng 1000 mm

Thì:
- nhịp lệch 1 m → 1 ÷ 18 = **0,056**
- chiều cao lệch 50 mm → 50 ÷ 1000 = **0,05**
- bê tông lệch 5 → 5 ÷ 40 = **0,125**

Giờ ba con số này so với nhau được.

### Bước 2: Lấy trung bình độ lệch

Chỉ tính trên những thông số **mà cả câu hỏi lẫn case đều có**. Thông số chỉ có ở một bên thì bỏ qua, vì không có gì để so.

### Bước 3: Trừ điểm nếu có ít thông số để so

Một cây dầm có 5 thông số để so. Case chỉ trùng 2 trên 5 thì bằng chứng ít hơn case trùng 3 trên 5, dù trông giống không kém.

```
độ phủ = số thông số so được ÷ 5
điểm cuối = độ lệch trung bình ÷ độ phủ
```

Độ phủ càng thấp thì điểm càng bị đẩy lên, tức càng bị xếp xuống dưới.

### Ví dụ

Kỹ sư hỏi: **nhịp 12 m, bê tông 30, cao 600 mm**.

| | Case A | Case B | Case C |
|---|---|---|---|
| Thông số | nhịp 11, bê tông 30, cao 650 | nhịp 12, bê tông 35 | nhịp 8, bê tông 30, cao 600 |
| Lệch nhịp | 0,056 | 0 | 0,222 |
| Lệch bê tông | 0 | 0,125 | 0 |
| Lệch chiều cao | 0,05 | (không có) | 0 |
| **Trung bình** | 0,035 | 0,063 | 0,074 |
| **Độ phủ** | 3/5 = 0,6 | 2/5 = 0,4 | 3/5 = 0,6 |
| **Điểm cuối** | **0,059** | **0,156** | **0,123** |
| **Xếp hạng** | **1** | **3** | **2** |

**Đọc bảng:**
- **A đứng đầu:** lệch ít ở cả ba thông số.
- **C đứng thứ hai:** bê tông và chiều cao khớp tuyệt đối, nhưng nhịp lệch tới 4 m.
- **B đứng cuối:** nhịp khớp tuyệt đối, nhưng chỉ có hai thông số để so, lại lệch bê tông. Độ phủ thấp làm điểm bị đẩy lên gấp 2,5 lần.

### Khi hai case bằng điểm

Ưu tiên theo thứ tự:
1. case **được công ty dùng nhiều lần hơn**
2. nếu vẫn bằng thì case **dùng gần đây hơn**

### Hai quy tắc đi kèm

- **Câu hỏi có dưới 2 thông số thì không so.** Chỉ biết "nhịp 12 m" thì chưa đủ để nói cây dầm nào giống. Hệ thống hỏi thêm thông tin thay vì đưa ra 5 kết quả đoán mò.
- **Thông số AI đọc từ câu chữ phải được kỹ sư xác nhận trước khi so.** Giao diện hiện các thông số đó thành ô sửa được. AI đọc nhầm "8 m" thành "18 m" thì kết quả sai hoàn toàn mà không có dấu hiệu gì.

**Lưu ý:** khoảng giá trị ở ví dụ (2–20 m, 20–60, 200–1200 mm) là mình đặt ra để minh họa. Khoảng thật do kỹ sư phụ trách khai cho từng loại cấu kiện. Khoảng hẹp hay rộng sẽ làm thứ hạng thay đổi.

## Bước 7: AI viết câu trả lời

Bước 7 là lúc **AI viết câu trả lời** từ những gì hệ thống đã gom được ở bước 6.

### Đầu vào: AI nhận gì

AI chính (Claude Sonnet 5) không tự biết gì về câu hỏi. Hệ thống chuẩn bị cho nó một "tập hồ sơ" gồm năm phần, xếp **theo thứ tự cố định**:

| # | Phần | Ví dụ |
|---|---|---|
| 1 | **Hướng dẫn cố định** | "Bạn là trợ lý kỹ thuật kết cấu. Mọi con số phải có nguồn. Không đủ căn cứ thì từ chối. Trích dẫn bằng [1], [2]…" |
| 2 | **Tóm tắt các lượt cũ** | Chỉ có khi cuộc trò chuyện dài hơn 6 lượt |
| 3 | **Vài lượt hỏi đáp gần nhất** | Để AI hiểu "cái đó", "dầm này" là gì |
| 4 | **Nguyên liệu từ bước 6** | 8 đoạn tài liệu, hoặc 5 case đã tính đạt |
| 5 | **Câu hỏi** | "Cốt đai tối thiểu cho dầm này?" |

**Nhánh tính toán không đi qua bước 7.** Ở bước 6, AI vừa gọi phần mềm tính toán vừa viết luôn câu trả lời. Bước 7 chỉ dành cho câu hỏi tài liệu và câu hỏi tra case.

### Ba cách làm để AI viết an toàn và rẻ

**1. Phần hướng dẫn giữ giống hệt từng chữ.**
Phần 1 lần nào cũng như nhau, nên AWS nhớ sẵn và lần sau tính rẻ hơn khoảng 10 lần cho phần đó. Muốn được nhớ thì phần này phải giống hệt từng chữ: chỉ cần chèn giờ hay mã phiên vào là mất tác dụng.

**2. Tài liệu và câu hỏi được đánh dấu "không tin cậy".**
Một tài liệu có thể chứa câu kiểu *"bỏ qua mọi hướng dẫn ở trên"*. Hệ thống đánh dấu phần 4 và 5 là **dữ liệu để đọc, không phải lệnh để làm**, và cho bộ lọc an toàn soát riêng hai phần đó.

**3. Quá dài thì cắt tài liệu kém liên quan nhất, không bao giờ cắt kết quả tính.**
Kết quả tính là nguồn duy nhất của các con số, cắt đi là AI không còn căn cứ.

### Trong lúc AI viết

```
AI viết một đoạn
      ↓
Bộ lọc an toàn soát đoạn đó
      ↓
Qua được → gửi ngay lên màn hình người dùng
Vi phạm  → dừng luôn, thay bằng thông báo, ghi nhật ký
```

Chữ hiện dần trên màn hình, người dùng không phải chờ AI viết xong cả bài.

Bộ lọc soát **trước khi gửi**, không phải sau. Soát sau thì thông tin cá nhân hoặc nội dung vi phạm có thể đã hiện lên màn hình rồi mới bị chặn. Cái giá là chữ hiện chậm hơn một chút.

### Khi AI gặp sự cố

Hệ thống có sẵn nhiều lớp dự phòng, đi từ nhẹ tới nặng:

| Chuyện gì xảy ra | Hệ thống làm gì |
|---|---|
| AI quá tải, lỗi tạm thời | Thử lại tối đa 2 lần, có giãn cách giữa các lần |
| Vẫn lỗi | Chuyển sang **AI dự phòng** (Claude Sonnet 4.6) |
| Lỗi dồn dập (5 lần trong 30 giây) | Tạm ngừng gọi AI chính 30 giây, đi thẳng sang AI dự phòng cho khỏi tắc |
| AI dự phòng cũng lỗi | **Vẫn trả danh sách tài liệu đã tìm được**, kèm thông báo "Chưa tạo được câu trả lời. Đây là các tài liệu liên quan." |
| 15 giây chưa ra chữ nào | Hủy, thử lại một lần |
| Đang viết mà đứng im 20 giây | Dừng, giữ phần đã viết, hiện nút "Thử lại" |
| Cả lượt quá 60 giây | Dừng, trình bày phần đã có |
| Lỗi do cấu hình sai (sai quyền, sai tham số) | **Không thử lại**, báo ngay đội vận hành |

Nhờ bước 6 (tìm tài liệu) và bước 7 (viết trả lời) tách riêng, nên dù AI hỏng hẳn, kỹ sư vẫn nhận được tài liệu để tự đọc, không bao giờ gặp màn hình lỗi trắng.

### Bước 7 không làm gì

- **Không kiểm câu trả lời có bịa hay không.** Việc đó là của bước 8, chạy sau khi AI viết xong.
- **Không tự tính con số nào.** Số chỉ đến từ phần mềm tính toán hoặc từ tài liệu.

### Tóm lại một câu

**Hệ thống xếp hướng dẫn, lịch sử, tài liệu và câu hỏi thành một tập hồ sơ cố định cho AI. AI viết tới đâu, bộ lọc soát tới đó rồi mới gửi lên màn hình. AI hỏng thì có AI dự phòng, dự phòng cũng hỏng thì vẫn trả danh sách tài liệu.**

## Worker tài liệu

**Nói gọn:** Worker không trả lời câu hỏi nào của kỹ sư. Nó chạy nền và chỉ làm một việc: nhận sách tiêu chuẩn (PDF) rồi cắt ra thành các phiếu nhỏ. Mỗi phiếu có dán nhãn và được xếp lên kệ. Nhờ vậy, khi có người hỏi, bước 6 rút đúng phiếu cần trong vài trăm mili giây.

Hình dung một thư viện: người đọc không bao giờ đứng chờ thủ thư đóng sách. Việc đóng sách xong từ trước, người đọc chỉ việc mượn.

### 1. Ai được đưa sách vào

Chỉ người có vai trò **Curate**, thường là kỹ sư tri thức, mới được tải tài liệu lên. Người tải phải ghi kèm giấy phép của tài liệu (`license_tag`), ví dụ bản Eurocode mua có bản quyền hay tài liệu nội bộ công ty. Kỹ sư dùng chat thường không đưa được sách vào kho.

### 2. Cắt sách thành phiếu

Worker đọc PDF **từng trang một**. Nó không nạp cả cuốn 500 trang vào bộ nhớ cùng lúc, vì làm vậy sẽ tràn bộ nhớ.

Worker cắt **theo điều khoản**, không cắt theo độ dài:

- Cắt theo số ký tự giống cắt sách bằng máy xén giấy. Điều 6.2.2 có thể bị chia đôi: nửa đầu nằm ở phiếu này, nửa sau ở phiếu khác. Khi đó AI đọc được công thức nhưng mất điều kiện áp dụng.
- Cắt theo điều khoản thì mỗi phiếu là một ý trọn vẹn: một điều, một mục.

**Gặp bảng thì giữ nguyên, không cắt ngang.** Nếu bảng quá dài phải tách, Worker **lặp lại dòng tiêu đề cột** ở mỗi phần. Không có dòng này, phiếu thứ hai chỉ còn một cột số như "0,18 / 0,15 / 0,12" mà không ai biết đó là gì. Có tiêu đề cột thì phiếu nào cũng tự đọc được.

Đầu mỗi phiếu có một dòng "địa chỉ", ví dụ:

```
EN 1992-1-1:2004 · 6.2.2 Cắt · trang 84
```

Dòng này giúp tìm kiếm chính xác hơn, và khi AI trích dẫn, người đọc biết ngay phải lật tới trang nào.

### 3. Dán nhãn cho từng phiếu (sidecar)

Mỗi phiếu được lưu thành một file riêng trên S3. Đi kèm là một **tờ nhãn** gọi là sidecar (`.metadata.json`, dưới 10 KB) ghi:

| Nhãn | Nghĩa | Dùng để làm gì |
|---|---|---|
| `scope_key` | Tài liệu này ai được xem | Công ty A không bao giờ thấy tài liệu nội bộ của công ty B |
| `status` | Trạng thái: nháp, đang dùng hay đã thay | Người dùng chỉ thấy phiếu đã được duyệt |
| `standard`, `edition` | Tiêu chuẩn nào, bản năm nào | Phân biệt EN 1992 bản 2004 với bản mới |
| `effective_from` / `effective_to` | Hiệu lực từ ngày nào đến ngày nào | Tra theo phiên bản dự án đang dùng |
| `clause_path`, `page` | Điều mấy, trang mấy | Trích dẫn và kiểm tra trích dẫn |

**Nhãn là thứ quan trọng nhất Worker tạo ra.** Ở bước 6, khi tra cứu, hệ thống không hỏi "tìm cho tôi đoạn văn giống câu hỏi". Nó hỏi "tìm đoạn giống câu hỏi, **nhưng chỉ trong các phiếu có nhãn tôi được phép xem và đang còn hiệu lực**". Dán sai nhãn thì hoặc lộ tài liệu sang công ty khác, hoặc kỹ sư đọc phải điều khoản đã hết hiệu lực.

### 4. Nhờ AWS đánh chỉ mục

Worker **không tự tạo vector (embedding)**. Nó gọi Bedrock Knowledge Base: "kho có phiếu mới, đánh chỉ mục đi" (`start-ingestion-job`). Sau đó cứ vài chục giây nó hỏi lại "xong chưa", cho đến khi nhận được `COMPLETE`.

Giống thư viện thuê dịch vụ làm mục lục: thủ thư đưa phiếu đến, dịch vụ trả về mục lục tra được.

### 5. Duyệt trước khi mở cho người dùng

Phiếu mới vào kho với trạng thái **`staged`**, tức nháp. Người dùng chưa thấy.

1. Kỹ sư tri thức lấy mẫu vài phiếu ra kiểm tra: cắt đúng điều chưa, bảng có còn nguyên không, số có bị lỗi OCR không.
2. Nếu ổn, kỹ sư điền ngày hiệu lực và chuyển trạng thái sang **`active`**. Từ lúc này phiếu mới xuất hiện trong câu trả lời.

Toàn bộ vòng đời một tài liệu:

```
Tải lên → Đọc → Cắt phiếu → Đánh chỉ mục → Nháp → Đã kiểm tra → Đang dùng → Đã thay thế
```

### 6. Khi có tiêu chuẩn bản mới

Ví dụ Eurocode ra bản mới. Worker không xoá bản cũ, vì nhiều dự án đang chạy vẫn phải tính theo bản cũ.

- Bản cũ được chuyển sang `superseded` (đã thay thế). `effective_to` của nó được đặt là **ngày liền trước** ngày bản mới có hiệu lực.
- Bản mới có `effective_to = 99991231`, nghĩa là "còn hiệu lực đến khi có thông báo khác".
- Cả hai việc nằm trong **một lần** đánh chỉ mục. Nhờ vậy không có lúc nào kho có hai bản cùng được coi là hiện hành, hoặc không có bản nào.

Khi tra cứu có hai chế độ:
- **Mặc định**: dùng bản hiện hành.
- **Theo dự án**: nếu dự án ký hợp đồng theo bản 2004, hệ thống lấy phiên bản này từ Main API, không lấy từ trình duyệt vì trình duyệt có thể bị sửa. Sau đó hệ thống chỉ tra các phiếu còn hiệu lực ở thời điểm đó.

### 7. Chạy lại không sinh bản trùng

Worker có thể chết giữa chừng, ví dụ máy khởi động lại hoặc mạng rớt. Khi chạy lại, mỗi tài liệu **chỉ có một lần đánh chỉ mục**, và các phiếu được ghi đè đúng chỗ cũ. Kết quả là kho không bao giờ có hai phiếu giống hệt nhau cho cùng một điều khoản.

### Worker **không** làm gì

| Không làm | Ai làm |
|---|---|
| Trả lời câu hỏi của kỹ sư | Assistant.Api (bước 4–10) |
| Tự tạo vector, tự dựng kho tìm kiếm | Bedrock Knowledge Base |
| Tự bật phiếu cho người dùng thấy | Kỹ sư tri thức duyệt rồi chuyển sang `active` |
| Nhận tài liệu từ ai cũng được | Chỉ vai trò Curate |

### Hai điểm tài liệu chưa nói rõ

- **Ai điều phối Worker?** Hiện tại dùng hàng đợi trong PostgreSQL (AD-11). Phương án đang đề xuất là Step Functions, tự chạy khi có file mới trên S3 (AD-20, còn ở trạng thái Proposed, chưa chốt).
- **Bảng `clause_ref`** (danh mục số điều khoản, bước 6 dùng để bắt lỗi gõ như "6.2.2" hay "6,2,2"): tài liệu không ghi ai điền bảng này. Mình đoán là Worker điền trong lúc cắt phiếu, nhưng đây là **suy luận của mình, docs không nói**. Nên hỏi lại đội BE.

**Một câu tóm lại:** Worker là thủ thư làm việc ngoài giờ. Nó cắt sách tiêu chuẩn thành từng điều khoản trọn vẹn và dán nhãn ai được xem, còn hiệu lực đến khi nào. Mọi phiếu phải qua người duyệt mới được mở cho người dùng. Nhờ đó, lúc kỹ sư hỏi, hệ thống chỉ cần rút đúng phiếu có sẵn.
