# Mental model — luồng một lượt hỏi

Mỗi bước ghi hai thứ: **làm gì** và **làm thế nào**. Không dùng tên thành phần hay tên trường dữ liệu, trừ hai cơ chế bộ lọc an toàn `ApplyGuardrail` và `guardrailConfig` vì dễ nhầm với nhau.

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/`

```
1. GỬI CÂU HỎI
│  Làm gì:     Trình duyệt gửi câu hỏi lên hệ thống
│  Làm thế nào: Gửi kèm mã cuộc trò chuyện, ngôn ngữ, và những gì người dùng
│              đang nhìn trên màn hình (dự án nào, cấu kiện nào, đã tính chưa)
│              Không gửi lịch sử, không gửi hướng dẫn cho AI
│
│  Trên đường đi: lớp trung gian lấy phiên đăng nhập, gắn vào rồi chuyển tiếp
│                 Trả lời về sau cũng đi qua lớp này, chảy tới đâu chuyển tới đó
▼
2. CHẶN CỔNG
│  Làm gì:     Quyết định có cho câu hỏi này vào không
│  Làm thế nào: Kiểm lần lượt, trượt ở đâu dừng ở đó:
│    2.1  Máy này có gửi dồn dập quá không
│    2.2  Người này đã đăng nhập hợp lệ chưa
│    2.3  Người này có được dùng trợ lý AI không
│    2.4  Người này có hỏi quá nhiều trong một phút không
│    2.5  Người này có đang chờ một câu trả lời khác không — chỉ cho 1 câu một lúc
│    2.6  Người này còn hạn mức trong ngày không
│                                                     ✗ trượt → từ chối
▼
3 + 4. CHUẨN BỊ  (ba việc chạy cùng lúc)
│
├─ BỘ LỌC AN TOÀN SOÁT CÂU HỎI  (ApplyGuardrail)
│     Làm gì:     Chặn câu hỏi tấn công, chủ đề cấm, lộ thông tin cá nhân
│     Làm thế nào: Gọi ApplyGuardrail trên câu hỏi, trước khi đưa cho bất kỳ AI nào
│                 Chặn câu hỏi cố bẻ quy tắc, chủ đề cấm
│                 Che thông tin cá nhân (ANONYMIZE) — hệ thống chỉ đưa cho AI
│                   và chỉ lưu bản đã che
│                 ✗ bị chặn → từ chối
│
├─ 3. BIẾT NGƯỜI NÀY ĐƯỢC ĐỌC GÌ
│     Làm gì:     Lập danh sách phạm vi tài liệu người này được xem
│     Làm thế nào: Hỏi hệ thống thanh toán xem người này thuộc công ty nào
│                 Hỏi hệ thống tính toán xem người này làm những dự án nào
│                 Gộp lại: tài liệu chung + tài liệu công ty + tài liệu dự án
│                 Nhớ tạm 60 giây
│                 Chỉ tra từ phiên đăng nhập, không tin thông tin trình duyệt gửi
│
├─ 4. LẤY LỊCH SỬ TRÒ CHUYỆN
│     Làm gì:     Lấy các câu hỏi và trả lời trước đó của cuộc trò chuyện
│     Làm thế nào: Đọc từ cơ sở dữ liệu theo mã cuộc trò chuyện
│                 Đếm theo lượt (một câu hỏi + câu trả lời của nó = một lượt)
│                 Cho bước phân loại: 3 lượt gần nhất
│                 Cho bước viết trả lời: tối đa 6 lượt,
│                   dài hơn thì 4 lượt gần nhất + một đoạn tóm tắt phần cũ
│                 Chỉ lấy lời, không lấy lại tài liệu của lượt trước
▼
5. PHÂN LOẠI CÂU HỎI
│  Làm gì:     Biết người dùng muốn gì để chọn đường đi
│  Làm thế nào: Đưa câu hỏi + 3 lượt gần nhất + những gì đang trên màn hình
│              cho một AI nhỏ, nhanh, rẻ. Nó trả về:
│    5.1  Nhãn: hỏi tài liệu / tính toán / tra trường hợp cũ / lạc đề
│    5.2  Câu hỏi viết lại cho rõ nghĩa
│         "tăng lên 700 thì sao" → "kiểm tra cắt dầm B12 với h = 700 mm"
│    5.3  Tách phần lệnh ("giải thích ngắn") khỏi phần cần tra
│    5.4  Các thông số đọc được từ câu hỏi (nhịp, cấp bê tông...)
│              AI nhỏ lỗi → dùng luật đơn giản thay thế
│                                                     ✗ lạc đề → từ chối
│
├─ Hỏi tài liệu ──────────────────────────────────────────────────────┐
│  6a. TÌM TÀI LIỆU                                                  │
│    6a.1  Câu hỏi có mã điều khoản thì tra đúng mã trước,           │
│          sửa được cả khi gõ nhầm ("6.22" → "6.2.2")                │
│    6a.2  Tìm rộng: lấy 40 đoạn liên quan nhất,                     │
│          chỉ trong phạm vi được đọc (bước 3)                       │
│    6a.3  Chọn hẹp: chấm điểm lại kỹ hơn, giữ 8 đoạn                │
│    6a.4  Đoạn tốt nhất đủ liên quan không?     ✗ → từ chối         │
│    6a.5  Lấy thêm đoạn liền trước, liền sau cho đủ ý               │
│    6a.6  Ghi lại đã tìm được gì                                    │
│          → gửi danh sách nguồn cho người dùng xem trước            │
│                                                                    │
├─ Tính toán ────────────────────────────────────────────────────────┤
│  6b. GỌI MÁY TÍNH  (bước 6 và 7 gộp làm một ở nhánh này)           │
│    6b.1  Mở một vòng lặp có giới hạn: tối đa 5 vòng, 60 giây       │
│    6b.2  AI chính đọc câu hỏi, nói cần tính gì với số nào          │
│          AI KHÔNG tự tính                                          │
│    6b.3  Kiểm người này có được gọi phép tính đó không             │
│    6b.4  Kiểm tham số trước khi cho tính:                          │
│            đúng dạng không / số có hợp lý không /                  │
│            CÓ ĐƠN VỊ KHÔNG — 300 là mm hay m? thiếu thì từ chối /  │
│            có gọi lặp lại y hệt không                              │
│    6b.5  Phần mềm tính kết cấu có sẵn tính thật                    │
│    6b.6  Đọc kỹ kết quả: báo "thành công" nhưng bên trong có       │
│          lỗi ẩn không. Ghi lại lần tính. Trả nguyên kết quả,       │
│          không tóm tắt                                             │
│          Công cụ tìm tài liệu / tra trường hợp cũ: soát nội dung   │
│          trả về bằng ApplyGuardrail trước khi đưa lại cho AI       │
│          (bộ lọc gắn vào lời gọi AI không soát phần này)           │
│    6b.7  AI chính xem kết quả: cần tính thêm → quay lại 6b.2       │
│                                đủ rồi → viết câu trả lời           │
│          ✗ quá vòng / quá giờ / lỗi 2 lần → trả những gì đã có     │
│          ⏸ kết quả cần kỹ sư duyệt → chờ bấm Duyệt hoặc Bỏ qua     │
│                                                                    │
├─ Tra trường hợp cũ ────────────────────────────────────────────────┤
│  6c. TRA TRƯỜNG HỢP ĐÃ DUYỆT                                       │
│    6c.1  Gom thông số, tin theo thứ tự:                            │
│          lần tính trước > màn hình > đọc từ câu hỏi                │
│          Số chỉ đọc từ câu hỏi → hiện cho kỹ sư xác nhận           │
│    6c.2  Có ít nhất 2 thông số không?    ✗ → hỏi lại người dùng    │
│    6c.3  Lọc: đúng công ty, đã được duyệt, đúng loại cấu kiện      │
│    6c.4  So bằng con số (nhịp, bê tông, tải...), không so chữ      │
│          Giữ 5 trường hợp gần nhất                                 │
│          Gắn nhãn "kinh nghiệm nội bộ, không phải tiêu chuẩn"      │
│                                                                    │
▼◀───────────────────────────────────────────────────────────────────┘
7. VIẾT CÂU TRẢ LỜI
│  Làm gì:     Viết câu trả lời từ nguyên liệu đã gom
│              (nhánh tính toán đã làm xong việc này trong 6b.7)
│  Làm thế nào:
│    7.1  Xếp đầu vào cho AI chính theo thứ tự cố định:
│           phần cố định — hướng dẫn vai trò, cách trích dẫn, khi nào từ chối
│             (giống hệt từng chữ giữa các lần hỏi → được nhớ đệm, rẻ và nhanh)
│           tóm tắt lịch sử cũ
│           lịch sử gần nhất
│           tài liệu / kết quả tính / trường hợp cũ   ┐ đánh dấu là
│           câu hỏi                                   ┘ "không tin cậy"
│    7.2  Quá dài → bỏ đoạn tài liệu điểm thấp trước
│         Không bao giờ bỏ kết quả tính
│    7.3  Gọi AI chính, đặt giới hạn độ dài rõ ràng
│         Đường tài liệu tắt chế độ suy nghĩ thêm cho nhanh
│    7.4  Bộ lọc an toàn soát từng đoạn TRƯỚC khi gửi đi
│         Không phải ApplyGuardrail: bộ lọc gắn thẳng vào lời gọi AI
│         (guardrailConfig, chế độ sync). Thiếu số phiên bản bộ lọc
│         thì bộ lọc không chạy mà không báo lỗi
│         ✗ vi phạm → cắt luồng, thay bằng thông báo
│    7.5  Viết tới đâu gửi về tới đó
│
│  Khi AI chính gặp sự cố:
│    Chưa ra chữ nào sau 15 giây       → hủy, thử lại 1 lần
│    Lỗi tạm thời (quá tải, hết giờ)   → thử lại tối đa 2 lần, có giãn cách
│    Vẫn lỗi                           → chuyển sang AI dự phòng đời trước
│                                         (dựng lại đầu vào cho hợp AI đó)
│    5 lỗi trong 30 giây               → ngưng gọi AI chính 30 giây,
│                                         đi thẳng sang dự phòng
│    Dự phòng cũng lỗi                 → chỉ trả danh sách nguồn đã tìm
│    Lỗi cấu hình (sai quyền, sai tham số) → KHÔNG thử lại, báo đội vận hành
│    Đang viết thì đứng im 20 giây     → đóng, giữ phần đã có, nút Thử lại
│    Cả lượt quá 60 giây               → dừng, trình bày phần đã có
▼
8. SOÁT LẠI
│  Làm gì:     Kiểm câu trả lời có bịa không
│  Làm thế nào: Kiểm bằng code, không dùng AI chấm AI
│    8.1  Mỗi con số phải có trong kết quả tính,
│         hoặc có nguyên văn trong đoạn tài liệu đã tìm
│    8.2  Mỗi trích dẫn [1], [2] phải trỏ về đoạn tài liệu thật
│         đã tìm ở lượt này
│    8.3  Không được nói "đạt" nếu không có lần tính nào chứng minh
│    8.4  ApplyGuardrail kiểm câu trả lời có bám tài liệu không
│         Chỉ là lớp phụ: chỉ gắn cờ, chỉ với câu trả lời ≤ 5 000 ký tự
│              ✗ trượt → gắn cảnh báo "chưa kiểm chứng" lên câu trả lời
│                        KHÔNG xóa chữ đã hiện
▼
9. GỬI VỀ
│  Làm gì:     Đưa kết quả về màn hình người dùng
│  Làm thế nào: Gửi từng mẩu theo thứ tự: trạng thái, nguồn, chữ, kết quả
│              tính, trích dẫn, cảnh báo, kết thúc
│              Con số trên màn hình lấy từ kết quả tính, không đọc từ chữ AI viết
▼
10. GHI SỔ
   Làm gì:     Lưu lại mọi thứ đã xảy ra
   Làm thế nào: Lưu câu hỏi, câu trả lời, tài liệu đã tìm, lần tính, nhật ký
               Chạy trên MỌI đường kết thúc — kể cả bị chặn, bị từ chối, lỗi
               Trừ hạn mức theo lượng thật đã dùng
               Mở khóa để người dùng hỏi câu tiếp theo
```

## Ba nguyên tắc chạy xuyên suốt

1. **AI không bao giờ tự tính số.** Số chỉ đến từ phần mềm tính kết cấu hoặc từ tài liệu.
2. **Không đủ căn cứ thì từ chối**, không trả lời bừa.
3. **Mọi đường đều về bước 10.** Kể cả bị chặn ở cổng hay lỗi giữa chừng.
