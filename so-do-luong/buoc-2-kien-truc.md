# Bước 2 — Chặn cổng

Trước khi tốn một đồng nào cho AI, `Assistant.Api` kiểm request qua một chuỗi middleware, việc rẻ làm trước. Trượt ở đâu thì dừng ở đó và trả mã lỗi kèm hướng xử lý.

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/ship/`

## Luồng của bước 2

```
POST /v1/chat từ BFF, có Authorization: Bearer
▼
2.1 CORS                                        Assistant.Api · middleware
│  Làm gì:     Chỉ nhận request từ origin của frontend
│  Làm thế nào: Whitelist origin của app VF Structures
▼
2.2 GẮN requestId                               CorrelationIdMiddleware
│  Làm gì:     Cho request một mã để truy vết
│  Làm thế nào: requestId đi vào mọi log, span, và mọi event error
▼
2.3 BURST THEO IP  (trước xác thực)             IpBurstLimiter
│  Làm gì:     Chặn máy gửi dồn dập, kể cả khi chưa đăng nhập
│  Làm thế nào: 5 request / 10 giây mỗi IP, counter trong PostgreSQL
│              ✗ vượt → 429
▼
2.4 XÁC THỰC JWT                                JwtBearer
│  Làm gì:     Người này đã đăng nhập hợp lệ chưa
│  Làm thế nào: Lấy JWKS của Keycloak (có cache), kiểm chữ ký, iss, exp
│              aud phải chứa assistant-api
│              ✗ thiếu hoặc hết hạn → 401
▼
2.5 KIỂM MODULE                                 ModuleGuard · Authorization API
│  Làm gì:     Người này có được dùng trợ lý AI không
│  Làm thế nào: Hỏi Authorization API (Bearer) xem có module Assistant.Use
│              ✗ không có → 403, FE ẩn panel
▼
2.6 SLIDING WINDOW THEO USER                    UserSlidingWindowLimiter
│  Làm gì:     Chặn một người hỏi quá nhiều trong một phút
│  Làm thế nào: 20 lượt / phút mỗi user_id, bảng rate_window trong PostgreSQL
│              ✗ vượt → 429 rate_limited, kèm Retry-After
▼
2.7 KILL SWITCH                                 KillSwitchMiddleware
│  Làm gì:     Tắt cả trợ lý khi có sự cố, không cần deploy lại
│  Làm thế nào: Đọc cấu hình nóng
│              ✗ đang tắt → 503 "Trợ lý đang tạm dừng"
▼
2.8 MỘT LƯỢT MỖI USER  (trong handler)          TurnGate · bảng active_turn
│  Làm gì:     Mỗi người chỉ có một câu hỏi đang chạy
│  Làm thế nào: INSERT … ON CONFLICT DO NOTHING
│              0 dòng được ghi → đã có lượt đang chạy
│              ✗ → 429 concurrent_turn, KHÔNG hủy lượt đang chạy
▼
2.9 HẠN MỨC NGÀY  (trong handler)               DailyQuotaGuard · bảng usage_daily
│  Làm gì:     Người này và công ty còn hạn mức token trong ngày không
│  Làm thế nào: Tính theo token, cho cả user_id và org_id
│              ✗ hết → 429 quota_exceeded + thời điểm reset
▼
Qua hết → bước 3 + 4 (ba việc chạy song song)

Khi lượt kết thúc, dù thành công, lỗi hay bị ngắt:
   finally → xóa hàng active_turn (token hủy riêng 5 giây, không dùng token của lượt)
   trừ quota theo token THỰC DÙNG = inputTokens + cacheReadInputTokens + cacheWriteInputTokens
```

## Bảng mã trả về

| Chặn ở | Mã | FE làm gì |
| --- | --- | --- |
| Burst theo IP | `429` | Khóa ô nhập, đếm ngược |
| JWT | `401` | Làm mới token, thử lại một lần |
| Module | `403` | Ẩn panel |
| Sliding window | `429 rate_limited` | Đếm ngược theo `Retry-After` |
| Kill switch | `503` | "Trợ lý đang tạm dừng" |
| Một lượt mỗi user | `429 concurrent_turn` | "Đang có một câu hỏi chạy dở ở nơi khác" |
| Hạn mức ngày | `429 quota_exceeded` | Hiện thời điểm reset |

## Từ khóa

**Middleware và thứ tự rẻ trước**
<!-- alias: middleware -->
- Là gì: Các lớp xử lý xếp nối tiếp trước handler. Mỗi lớp được quyền chặn request và trả lỗi luôn.
- Ở kiến trúc này: Thứ tự cố định: CORS → requestId → burst theo IP → JWT → module → sliding window → kill switch. Hai cổng cuối nằm trong handler.
- Vì sao: Đặt hạn mức trước rate limit thì counter vẫn tăng trên request đã bị từ chối, người dùng bị trừ quota cho lần gọi chưa từng được phục vụ. Lỗi này khó thấy vì mọi thứ khác vẫn chạy đúng.
- Nguồn: `ship/06-bao-mat.md` §2 · `ship/14-chi-tiet-backend.md` §3

**CORS**
<!-- alias: CORS -->
- Là gì: Cơ chế của trình duyệt quyết định trang ở origin nào được gọi API này.
- Ở kiến trúc này: Whitelist đúng origin của frontend VF Structures.
- Vì sao: Chặn trang lạ gọi thẳng API bằng phiên đăng nhập của người dùng.
- Nguồn: `ship/06-bao-mat.md` §2

**requestId**
<!-- alias: requestId -->
- Là gì: Mã duy nhất cho một request, gắn từ lớp đầu tiên.
- Ở kiến trúc này: Có trong mọi log, span và mọi event `error`. Người dùng bấm copy `requestId` để gửi cho hỗ trợ.
- Vì sao: Một lượt đi qua nhiều dịch vụ. Không có mã chung thì không ghép được log của một lượt lại với nhau.
- Nguồn: `ship/02-hop-dong.md` §6 · `ship/14-chi-tiet-backend.md` §3

**Rate limit ba tầng (AD-23)**
<!-- alias: IpBurstLimiter, UserSlidingWindowLimiter -->
- Là gì: Giới hạn tốc độ theo IP (trước xác thực) và theo user (sliding window, tức đếm trong 60 giây gần nhất tính tới lúc này), cộng giới hạn một lượt đồng thời.
- Ở kiến trúc này: 5 request / 10 giây mỗi IP, 20 lượt / phút mỗi user. **Mọi counter nằm trong PostgreSQL**, bảng `rate_window`, không nằm trong bộ nhớ tiến trình.
- Vì sao: Bộ giới hạn có sẵn của ASP.NET Core đếm theo từng instance. Chạy N task thì giới hạn thật là N lần giới hạn cấu hình. Đó là đường denial-of-wallet: bị spam tới cạn tiền.
- Nguồn: `ship/06-bao-mat.md` §2a · `ship/01-kien-truc.md` AD-23

**JWKS và aud**
<!-- alias: JWKS, aud -->
- Là gì: JWKS là bộ khóa công khai của Keycloak, dùng để kiểm chữ ký JWT. `aud` (audience) là trường ghi token này được cấp cho dịch vụ nào.
- Ở kiến trúc này: `Assistant.Api` cache JWKS, kiểm chữ ký, `iss`, `exp`, và `aud` phải chứa `assistant-api`. Audience này được thêm vào token của client `vfstructures-app` bằng audience mapper.
- Vì sao: Token vẫn giữ các audience cũ, nên Main API tiếp tục chấp nhận khi trợ lý chuyển tiếp token.
- Nguồn: `ship/06-bao-mat.md` §1

**Assistant.Use**
<!-- alias: Assistant.Use -->
- Là gì: Module quyền trong hệ thống phân quyền hiện có của VF Structures.
- Ở kiến trúc này: `ModuleGuard` hỏi Authorization API bằng Bearer của người dùng. Không có module thì trả `403`, FE ẩn panel.
- Vì sao: Bật tắt trợ lý theo người dùng hoặc gói đăng ký bằng đúng cơ chế quyền đang dùng, không dựng hệ thống quyền mới.
- Nguồn: `ship/06-bao-mat.md` §1, §2

**Kill switch**
<!-- alias: Kill switch -->
- Là gì: Công tắc tắt toàn bộ trợ lý.
- Ở kiến trúc này: `KillSwitchMiddleware` đọc cấu hình nóng, trả `503`. Bật tắt không cần deploy lại.
- Vì sao: Khi câu trả lời sai gây hại hoặc chi phí tăng vọt, phải tắt được trong vài giây. Kế hoạch ứng phó sự cố quy định ai được quyết định bật tắt.
- Nguồn: `ship/03-backend.md` bước 2 · `ship/06-bao-mat.md` §9

**active_turn và TurnGate**
<!-- alias: TurnGate, active_turn -->
- Là gì: Bảng giữ một hàng cho mỗi user đang có lượt chạy. `user_id` là khóa chính.
- Ở kiến trúc này: Đầu lượt chạy `INSERT … ON CONFLICT DO NOTHING`. Ghi được 0 dòng nghĩa là đã có lượt đang chạy, trả `429 concurrent_turn`. Cuối lượt xóa hàng trong `finally`.
- Vì sao: Ô nhập bị khóa ở giao diện chỉ có tác dụng trong một tab. Mở mười tab là mười lượt song song, mà mười request trong một giây vẫn dưới ngưỡng tính theo phút. Đây là lớp chặn spam thật sự.
- Nguồn: `ship/06-bao-mat.md` §2a · `ship/14-chi-tiet-backend.md` §3

**finally**
<!-- alias: finally -->
- Là gì: Khối lệnh luôn chạy khi hàm kết thúc, dù thành công, lỗi hay bị hủy.
- Ở kiến trúc này: Xóa hàng `active_turn` ở đây, dùng một token hủy riêng 5 giây.
- Vì sao: Xóa ở đường thành công thì lượt lỗi để lại hàng, user bị khóa tới khi job quét dọn chạy. Dùng token của lượt đã bị hủy thì chính lệnh xóa cũng bị hủy theo.
- Nguồn: `ship/14-chi-tiet-backend.md` §3 · `ship/01-kien-truc.md` §6.7 (AD-25)

**Hạn mức theo token**
<!-- alias: DailyQuotaGuard, usage_daily -->
- Là gì: Giới hạn số token AI dùng mỗi ngày, cho từng user và từng organization.
- Ở kiến trúc này: Kiểm trước khi chạy lượt. Trừ sau khi lượt kết thúc, theo token thực dùng, bằng một câu `INSERT … ON CONFLICT DO UPDATE` vào `usage_daily`. Cảnh báo ở 50%, 80%, 100%.
- Vì sao: Đếm theo số lượt là đếm sai thứ đang tốn tiền: một lượt có gọi tool tốn gấp nhiều lần một lượt hỏi thường.
- Nguồn: `ship/06-bao-mat.md` §2a · `ship/03-backend.md` bước 2

**Token thực dùng khi có prompt caching**
<!-- alias: inputTokens, cacheReadInputTokens -->
- Là gì: Khi bật prompt caching, Bedrock tách token đầu vào thành ba trường: `inputTokens` (phần không nằm trong cache), `cacheReadInputTokens`, `cacheWriteInputTokens`.
- Ở kiến trúc này: Quota ngày cộng đủ ba trường. Riêng hạn mức tốc độ (TPM) thì không tính token đọc từ cache, vì AWS không trừ chúng.
- Vì sao: Lấy thẳng `inputTokens` là đếm thiếu, và cache càng hiệu quả thì càng thiếu nhiều.
- Nguồn: `ship/03-backend.md` bước 2
