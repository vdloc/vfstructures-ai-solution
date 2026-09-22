# Bước 4 — Lấy lịch sử trò chuyện

Lấy các câu hỏi và câu trả lời trước đó, rút gọn cho vừa, để AI hiểu "cái đó", "dầm này", "vậy thì sao" là gì.

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/`

## Bước 4 nằm ở đâu

```
1 Gửi câu hỏi
│
2 Chặn cổng
│
├── Soát câu hỏi          ┐
├── 3 Biết được đọc gì    ├ chạy cùng lúc
└── 4 LẤY LỊCH SỬ         ┘
       │
       ├── bản ngắn    ──▶ 5 Phân loại câu hỏi
       └── bản dài hơn ──▶ 7 Viết câu trả lời
```

## Flow con

```
Câu hỏi đã qua cổng (bước 2)
│  chạy cùng lúc với bước 3 và việc soát câu hỏi
▼
4.1 TÌM CUỘC TRÒ CHUYỆN
│  Làm gì:     Biết câu hỏi này nối vào cuộc trò chuyện nào
│  Làm thế nào: Dùng mã cuộc trò chuyện trình duyệt gửi lên
│              Mã mới (lượt đầu tiên) → chưa có lịch sử, trả rỗng, xong
▼
4.2 ĐỌC LỊCH SỬ
│  Làm gì:     Lấy các lượt đã có từ cơ sở dữ liệu
│  Làm thế nào: Lấy lời hỏi, lời đáp, và các lần tính trong từng lượt
│              KHÔNG lấy tài liệu đã tìm ở các lượt trước
▼
4.3 ĐẾM THEO LƯỢT
│  Làm gì:     Chia lịch sử thành từng lượt
│  Làm thế nào: Một lượt = một câu hỏi + mọi thứ xảy ra để trả lời nó
│              + câu trả lời. Có gọi máy tính hay không vẫn là một lượt
▼
4.4 CẮT BẢN NGẮN — cho bước phân loại
│  Làm gì:     Đủ để hiểu người dùng đang nói về cái gì
│  Làm thế nào: Lấy 3 lượt gần nhất
▼
4.5 CẮT BẢN DÀI HƠN — cho bước viết câu trả lời
│  Làm gì:     Đủ để giữ mạch trò chuyện
│  Làm thế nào: Từ 6 lượt trở xuống → giữ hết
│              Hơn 6 lượt → 4 lượt gần nhất
│                           + một đoạn tóm tắt các lượt cũ hơn (AI nhỏ viết)
▼
Kết quả: hai bản lịch sử, chỉ có lời và kết quả tính, không có tài liệu cũ

Sau khi lượt này xong (bước 10):
   Lượt mới được lưu lại, thông tin cá nhân đã che trước khi lưu
   Hết thời hạn lưu (đề xuất 90 ngày) hoặc người dùng xóa → xóa hẳn
```

## Ví dụ: cuộc trò chuyện đã có 8 lượt, người dùng hỏi câu thứ 9

```
Lịch sử:      [1] [2] [3] [4] [5] [6] [7] [8]    câu mới [9]

Bước 5 nhận:                      [6] [7] [8]  + [9]
Bước 7 nhận:  └── tóm tắt ──┘ [5] [6] [7] [8]  + [9]
```

8 lượt là hơn 6, nên bước 7 giữ 4 lượt gần nhất, còn lượt 1–4 gộp thành một đoạn tóm tắt.

## Từ khóa

### Nhóm 1 · Lấy bao nhiêu

**Lượt** (turn)
- Là gì: Một câu hỏi, cộng mọi thứ xảy ra để trả lời nó, cộng câu trả lời.
- Thiếu thì hỏng gì: Đếm theo từng tin nhắn thì lượt có gọi máy tính sinh thêm nhiều tin nhắn, chiếm nhiều chỗ hơn lượt hỏi thường. Cửa sổ lịch sử lúc rộng lúc hẹp tùy loại câu hỏi.
- Ở hệ thống này: Mọi con số của cửa sổ lịch sử đều đếm theo lượt.
- Nguồn: `19-dac-ta-kien-truc.md` AD-22 · `02-assistant-service.md` §7

**Cửa sổ trượt** (sliding window)
- Là gì: Mỗi lần hỏi chỉ gửi cho AI vài lượt gần nhất, không gửi cả cuộc trò chuyện.
- Thiếu thì hỏng gì: Cuộc trò chuyện 30 lượt thì lượt 31 phải gửi lại cả 30 lượt: đắt hơn, chậm hơn, AI dễ bám vào chuyện đã cũ.
- Ở hệ thống này: Bước phân loại nhận 3 lượt. Bước viết nhận tối đa 6 lượt; dài hơn thì 4 lượt kèm tóm tắt. Ba con số sẽ chỉnh lại ở mốc M1 sau khi đo.
- Nguồn: `19-dac-ta-kien-truc.md` AD-22 · *AI Agents on AWS* ch3

**Tóm tắt lượt cũ** (compaction)
- Là gì: Gộp nhiều lượt cũ thành một đoạn ngắn thay vì bỏ hẳn.
- Thiếu thì hỏng gì: Chỉ cắt cứng thì cuộc trò chuyện dài mất mạch: người dùng nhắc lại chuyện ở lượt 2 mà AI không còn biết.
- Ở hệ thống này: Chỉ dùng khi hơn 6 lượt. AI nhỏ (Haiku) viết đoạn tóm tắt. Cái giá: các chi tiết nhỏ ở lượt cũ có thể mất.
- Nguồn: `02-assistant-service.md` §7 · *AI Agents on AWS* ch3

**Context rot**
- Là gì: AI suy luận kém dần khi đầu vào quá dài và lẫn nhiều thứ không liên quan.
- Thiếu thì hỏng gì: Đây chính là cái hỏng. Sách xếp việc nhồi cả lịch sử vào đầu vào là cách làm sai: "chạy được khi demo, sai khi lên production".
- Ở hệ thống này: Là lý do cửa sổ trượt và tóm tắt tồn tại.
- Nguồn: *AI Agents on AWS* ch3, qua `ship/00-thuat-ngu-va-nguon.md`

**Bộ nhớ ngắn hạn và dài hạn**
- Là gì: Ngắn hạn là "đang nói chuyện gì" — lịch sử gần. Dài hạn là "biết gì" — kho tài liệu, trường hợp đã duyệt.
- Thiếu thì hỏng gì: Dùng lịch sử làm kho kiến thức thì phải giữ lịch sử rất dài, quay lại đúng vấn đề context rot.
- Ở hệ thống này: Bước 4 chỉ lo ngắn hạn. Dài hạn đi qua bước 6 (tìm tài liệu, tra trường hợp cũ).
- Nguồn: *AI Agents in Action* ch8 · *AI Agents on AWS* ch3

### Nhóm 2 · Chi phí và tốc độ

**Nhớ đệm đầu vào** (prompt caching)
- Là gì: Phần đầu vào giống hệt nhau giữa các lần gọi AI được nhớ lại, lần sau rẻ và nhanh hơn.
- Thiếu thì hỏng gì: Không hiểu chỗ này thì dễ nghĩ thêm lịch sử là "gần như miễn phí". Thực tế lịch sử gần nhất nằm sau mọi điểm nhớ đệm, nên trả đủ giá mỗi lượt. Thêm một lượt vào cửa sổ là mọi lượt sau trong phiên đều đắt thêm.
- Ở hệ thống này: Hướng dẫn cố định được nhớ 1 giờ. Đoạn tóm tắt lượt cũ được nhớ 5 phút. Lịch sử gần nhất không được nhớ.
- Nguồn: `06-tang-bedrock.md` §5 · `ship/00-thuat-ngu-va-nguon.md`

**Chạy song song**
- Là gì: Lấy lịch sử, lấy phạm vi được đọc, soát câu hỏi — ba việc độc lập nên làm cùng lúc.
- Thiếu thì hỏng gì: Làm lần lượt thì mỗi câu hỏi chậm thêm vài trăm mili giây trước khi AI kịp bắt đầu.
- Ở hệ thống này: Ba việc chạy cùng lúc, tổng khoảng 300 ms.
- Nguồn: `02-assistant-service.md` §3 · `ship/03-backend.md`

**Cấu hình, không viết cứng**
- Là gì: Các con số 3 / 6 / 4 nằm trong file cấu hình, không nằm trong code.
- Thiếu thì hỏng gì: Muốn chỉnh sau khi đo thì phải sửa code và triển khai lại.
- Ở hệ thống này: Chỉnh ở mốc M1 theo từng nhóm câu hỏi. Đơn vị "lượt" thì cố định, không chỉnh.
- Nguồn: `ship/03-backend.md` · `20-tai-lieu-thiet-ke-kien-truc.md`

### Nhóm 3 · Dữ liệu

**Mã cuộc trò chuyện**
- Là gì: Mã định danh trình duyệt tự sinh ở câu đầu tiên và gửi kèm mọi câu sau.
- Thiếu thì hỏng gì: Máy chủ không biết câu hỏi mới nối vào cuộc trò chuyện nào.
- Ở hệ thống này: Trình duyệt chỉ gửi mã, không gửi lịch sử. Máy chủ tự lưu, tự lấy.
- Nguồn: `ship/02-hop-dong.md` §2

**Phiên mới**
- Là gì: Nút bắt đầu cuộc trò chuyện mới với mã mới.
- Thiếu thì hỏng gì: Dặn AI "bỏ qua câu trước" không phải biện pháp kiểm soát — lịch sử cũ vẫn được gửi, AI vẫn đọc.
- Ở hệ thống này: Bấm Phiên mới thì lịch sử cũ không còn được gửi đi.
- Nguồn: `02-assistant-service.md` §7

**Không mang lại tài liệu lượt trước**
- Là gì: Lịch sử chỉ gồm lời và kết quả tính, không gồm các đoạn tài liệu đã tìm.
- Thiếu thì hỏng gì: Tài liệu cũ có thể lạc đề với câu hỏi mới, và trích dẫn `[1]` `[2]` trỏ lẫn giữa các lượt.
- Ở hệ thống này: Lượt nào tự tìm tài liệu cho lượt đó ở bước 6, theo câu hỏi đã viết lại.
- Nguồn: `02-assistant-service.md` §7

**Thời hạn lưu và xóa hẳn**
- Là gì: Lịch sử chỉ giữ trong một thời gian, sau đó xóa không khôi phục được.
- Thiếu thì hỏng gì: Câu hỏi có thể chứa thông tin cá nhân hoặc bí mật của chủ đầu tư. Giữ mãi là giữ rủi ro mãi.
- Ở hệ thống này: Đề xuất 90 ngày; con số cuối do công ty và người phụ trách bảo vệ dữ liệu quyết. Người dùng xóa, hết hạn, hoặc yêu cầu xóa dữ liệu cá nhân → xóa hẳn lịch sử, lần tính, lần tìm liên quan. Chỉ giữ số liệu tổng hợp và nhật ký không chứa nội dung.
- Nguồn: `07-auth-bao-mat.md` §6

**Che thông tin cá nhân trước khi lưu**
- Là gì: Làm mờ thông tin cá nhân trong câu hỏi trước khi đưa cho AI và trước khi ghi vào cơ sở dữ liệu.
- Thiếu thì hỏng gì: Lưu bản gốc thì thông tin cá nhân nằm lại trong cơ sở dữ liệu và nhật ký, và bước 4 lần sau lại đọc ra gửi cho AI.
- Ở hệ thống này: Lưu và dùng bản đã che. Che không chống được việc ghép dữ liệu để nhận diện lại, nên vẫn cần tách dữ liệu theo công ty.
- Nguồn: `07-auth-bao-mat.md` §6

## Chưa rõ

- Tài liệu chưa nói đoạn tóm tắt lượt cũ được sinh **lúc nào**: ngay trong lượt hỏi (làm lượt đó chậm thêm) hay sinh trước và lưu sẵn.
- Tài liệu chỉ ghi "AI nhỏ tóm tắt", chưa có quy tắc gì ngăn bản tóm tắt thêm thông tin sai. Ở phần trường hợp cũ, tài liệu lại cố tình **không** dùng AI để tóm tắt vì đúng lý do này.
