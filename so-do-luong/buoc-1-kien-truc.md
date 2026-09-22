# Bước 1 — Gửi câu hỏi

Trình duyệt gom câu hỏi và những gì người dùng đang nhìn trên màn hình thành một request, gửi qua BFF. BFF gắn token rồi chuyển tiếp tới `Assistant.Api`, sau đó chuyển ngược luồng trả lời về trình duyệt.

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/ship/`

## Luồng của bước 1

```
Panel AI trong app VF Structures
│  Người dùng gõ câu hỏi, bấm gửi
▼
1.1 ĐỌC NGỮ CẢNH TRANG                          FE · readPageContext
│  Làm gì:     Biết người dùng đang nhìn gì: dự án nào, cấu kiện nào, đã tính chưa
│  Làm thế nào: Đọc từ store của app, không có ô nhập tay cho projectId hay memberId
│              Bắt buộc gửi hasResult, resultKind, calcAt (AD-15)
▼
1.2 DỰNG REQUEST                                FE · Panel AI
│  Làm gì:     Gom thành một khối JSON duy nhất
│  Làm thế nào: conversationId (FE tự sinh uuid ở lượt đầu, lượt sau dùng lại)
│              + message + locale + context (pageContext)
│              KHÔNG gửi lịch sử, KHÔNG gửi system prompt
▼
1.3 GỬI TỚI BFF                                 FE · fetch
│  Làm gì:     POST /api/assistant/chat
│  Làm thế nào: Dùng fetch rồi đọc res.body, không dùng EventSource
│              Cookie HttpOnly đi kèm, JavaScript không đọc được token
▼
1.4 GẮN TOKEN, CHUYỂN TIẾP                      Next.js BFF
│  Làm gì:     Đổi cookie thành header Authorization: Bearer
│  Làm thế nào: Middleware làm mới token nếu sắp hết hạn
│              POST /v1/chat tới Assistant.Api, truyền req.signal vào fetch upstream
│              KHÔNG tự retry khi lỗi mạng: mỗi lần retry là một lượt mới, tốn tiền
▼
1.5 MỞ LUỒNG SSE                                Assistant.Api → BFF → FE
│  Làm gì:     Trả lời chảy về tới đâu hiện tới đó
│  Làm thế nào: Content-Type: text/event-stream, X-Accel-Buffering: no
│              BFF chuyển tiếp không buffer
│              nginx proxy_buffering off · ALB idle_timeout ≥ 120 giây
│              CloudFront không cache /v1/chat
▼
1.6 PHÂN LOẠI LỖI                               FE
   Trước luồng → HTTP status (401, 403, 429, 503, 500), body có code
   Trong luồng → HTTP đã là 200, lỗi đến dưới dạng event error
   Hai loại xử lý ở hai chỗ khác nhau
```

## Request mẫu

```
POST /v1/chat
Authorization: Bearer <JWT Keycloak>

{
  "conversationId": "c-8f3a...",
  "message": "Cốt đai tối thiểu cho dầm này?",
  "locale": "fr",
  "context": {
    "module": "beam-shear",
    "projectId": "p-42",
    "memberId": "B12",
    "selectedElementIds": ["B12"],
    "activeView": "results",
    "unitSystem": "metric",
    "codeStandard": "EC2",
    "hasResult": true,
    "resultKind": "shear",
    "calcAt": "2026-09-19T08:12:00Z",
    "inputs":  { "b": 300, "h": 600, "unit": "mm" },
    "outputs": { "VRd": 184.2, "unit": "kN" }
  }
}
```

## Khi người dùng bấm Dừng hoặc đóng tab

- FE gọi `AbortController.abort()`. Hook stream nằm ở store của app, không nằm trong panel, nên đóng panel không hủy lượt.
- BFF đã truyền `req.signal`, nên kết nối tới `Assistant.Api` đóng theo.
- Backend hủy lượt trong ≤ 2 giây, ghi message trạng thái `aborted` kèm phần chữ đã sinh (AD-25).
- Tải lại trang thì FE đọc `GET /v1/conversations/{id}` và hiện message đó với nhãn "chưa hoàn tất". v1 không nối lại stream đang chạy.

## Từ khóa

**pageContext**
<!-- alias: pageContext -->
- Là gì: Khối `context` trong request, mô tả những gì người dùng đang nhìn: dự án, cấu kiện đang chọn, màn hình kết quả, hệ đơn vị, tiêu chuẩn.
- Ở kiến trúc này: Là dữ liệu **untrusted**. Backend chỉ dùng để hiểu "dầm này" là dầm nào và để phát hiện kết quả trên màn hình lệch bản đã lưu. Quyền đọc tài liệu lấy từ JWT, không bao giờ từ `pageContext`.
- Vì sao: Chỉ gửi câu chữ thì hệ thống phải hỏi lại người dùng về thứ họ đang nhìn, hoặc để mô hình tự đoán cấu kiện rồi trả lời trôi chảy về sai đối tượng.
- Nguồn: `ship/02-hop-dong.md` §3 · `ship/04-frontend.md` bước 1 · `ship/03-backend.md` BE-1

**readPageContext**
<!-- alias: readPageContext -->
- Là gì: Hàm ở FE đọc ngữ cảnh trang từ store của app.
- Ở kiến trúc này: Nguồn duy nhất của `projectId`, `memberId`, `selectedElementIds`. Không có ô nhập tay nào cho các trường này.
- Vì sao: Cho người dùng gõ tay `projectId` là mở đường hỏi vào dự án của người khác. Main API vẫn chặn, nhưng sai từ đầu thì không nên để lọt tới đó.
- Nguồn: `ship/04-frontend.md` bước 1

**hasResult, resultKind, calcAt (AD-15)**
<!-- alias: hasResult, resultKind, calcAt -->
- Là gì: Ba trường cho biết màn hình đang có kết quả tính hay không, loại kết quả gì, tính lúc nào.
- Ở kiến trúc này: Bắt buộc từ AD-15. Router ở bước 5 dựa vào đây để ra nhãn `explain_result`.
- Vì sao: Thiếu ba trường này thì nhãn `explain_result` không bao giờ xuất hiện, và câu "giải thích kết quả này" bị hiểu thành câu hỏi tra tài liệu. Đây là điểm chặn giữa FE và BE.
- Nguồn: `ship/02-hop-dong.md` §3, §9

**conversationId**
<!-- alias: conversationId -->
- Là gì: Mã định danh một cuộc trò chuyện, dạng uuid.
- Ở kiến trúc này: FE tự sinh ở lượt đầu, các lượt sau gửi lại đúng mã đó. Backend dùng nó để đọc lịch sử ở bước 4.
- Vì sao: Lịch sử nằm ở server. FE chỉ cần gửi mã, không gửi lại cả cuộc trò chuyện, nên request gọn và client không sửa được lịch sử.
- Nguồn: `ship/02-hop-dong.md` §2

**locale**
<!-- alias: locale -->
- Là gì: Ngôn ngữ của người dùng, `fr` hoặc `en`.
- Ở kiến trúc này: Quyết định ngôn ngữ của câu trả lời. `search_query` gửi cho Knowledge Base giữ nguyên ngôn ngữ gốc, không dịch.
- Vì sao: Tiêu chuẩn có bản tiếng Pháp và tiếng Anh. Dịch câu hỏi trước khi tìm làm lệch thuật ngữ so với văn bản gốc.
- Nguồn: `ship/02-hop-dong.md` §2

**EventSource và fetch**
<!-- alias: EventSource, fetch -->
- Là gì: `EventSource` là API có sẵn của trình duyệt để nhận SSE. `fetch` là API gọi HTTP chung, đọc được body dạng luồng qua `res.body`.
- Ở kiến trúc này: FE dùng `fetch` rồi tự tách khung SSE theo dòng trống.
- Vì sao: `EventSource` không gửi được header tùy ý, nên không mang được `Authorization: Bearer`. Phát hiện muộn thì phải viết lại cả lớp mạng.
- Nguồn: `ship/02-hop-dong.md` §7 · `ship/04-frontend.md` FE-1

**Cookie HttpOnly**
<!-- alias: Cookie HttpOnly -->
- Là gì: Cookie mà JavaScript trên trang không đọc được, chỉ trình duyệt tự gửi kèm request.
- Ở kiến trúc này: Access token của Keycloak nằm trong cookie này. Trình duyệt chỉ nói chuyện với BFF. BFF đọc cookie rồi gắn Bearer.
- Vì sao: Token không lộ ra JavaScript, nên một đoạn script bị chèn vào trang không lấy được token.
- Nguồn: `ship/06-bao-mat.md` §1 · `ship/01-kien-truc.md` §8.8

**BFF (Next.js)**
<!-- alias: Next.js BFF, BFF -->
- Là gì: Backend for Frontend. Một lớp server mỏng nằm giữa trình duyệt và các API phía sau, ở đây là route của Next.js.
- Ở kiến trúc này: Nhận `POST /api/assistant/chat`, làm mới token nếu sắp hết hạn, gắn `Authorization: Bearer`, chuyển tiếp tới `/v1/chat` và chuyển luồng SSE ngược về. Không chứa logic AI.
- Vì sao: Giữ token ngoài trình duyệt, và dùng lại đúng mô hình đăng nhập app đang chạy. Cái bẫy là BFF phải chuyển tiếp không buffer và không tự retry.
- Nguồn: `ship/02-hop-dong.md` §7 · `ship/06-bao-mat.md` §1

**Authorization: Bearer (JWT Keycloak)**
<!-- alias: Authorization: Bearer -->
- Là gì: Header mang access token dạng JWT do Keycloak cấp. JWT là chuỗi đã ký, chứa người dùng là ai, token cho ai (`aud`), hết hạn lúc nào.
- Ở kiến trúc này: BFF gắn header này khi gọi `Assistant.Api`. Bước 2 kiểm chữ ký và `aud` chứa `assistant-api`. Khi gọi Main API, `Assistant.Api` chuyển tiếp đúng token này.
- Vì sao: Một nguồn danh tính duy nhất cho cả app và trợ lý. Main API áp `[ApiAccess]` như mọi request khác, trợ lý không có quyền nào hơn người dùng.
- Nguồn: `ship/06-bao-mat.md` §1 · `ship/01-kien-truc.md` §8.8

**req.signal và AbortController**
<!-- alias: req.signal, AbortController -->
- Là gì: Cơ chế hủy request của JavaScript. `AbortController.abort()` phát tín hiệu hủy. `req.signal` là tín hiệu đó ở phía route của BFF.
- Ở kiến trúc này: FE gọi `abort()` khi bấm Dừng. BFF truyền `req.signal` vào `fetch` upstream nên kết nối tới backend đóng theo.
- Vì sao: Ngắt kết nối không tự lan xuống backend. Thiếu `req.signal` thì người dùng đóng tab mà lượt vẫn chạy tới hết và tính tiền đầy đủ.
- Nguồn: `ship/02-hop-dong.md` §7 · `ship/01-kien-truc.md` §6.7 (AD-25)

**SSE (Server-Sent Events)**
<!-- alias: SSE -->
- Là gì: Giao thức server đẩy từng sự kiện về client trên một kết nối HTTP mở lâu, mỗi sự kiện cách nhau một dòng trống.
- Ở kiến trúc này: `/v1/chat` trả `text/event-stream` với 11 loại sự kiện. Chữ của câu trả lời hiện dần thay vì chờ cả bài.
- Vì sao: Một lượt có thể kéo dài tới 60 giây, 90 giây với `optimize`. Không streaming thì người dùng nhìn màn hình trắng suốt thời gian đó.
- Nguồn: `ship/02-hop-dong.md` §4 · `ship/01-kien-truc.md` §8.7

**Buffer trên đường đi**
<!-- alias: X-Accel-Buffering: no, buffer -->
- Là gì: Proxy gom dữ liệu lại rồi mới gửi đi một lần. Với SSE thì mọi sự kiện dồn thành một cục ở cuối.
- Ở kiến trúc này: `Assistant.Api` gửi header `X-Accel-Buffering: no`. nginx đặt `proxy_buffering off`, ALB `idle_timeout` ≥ 120 giây, CloudFront không cache `/v1/chat`. Nghiệm thu bằng `curl -N` qua đúng tuyến production.
- Vì sao: Chạy localhost thì chữ hiện dần, lên production qua proxy thì dồn cục. Lỗi này chỉ lộ ra trên đúng tuyến thật.
- Nguồn: `ship/02-hop-dong.md` §7 · `ship/05-devops.md` bước 1

**Lỗi trước luồng và lỗi trong luồng**
<!-- alias: Trước luồng, Trong luồng -->
- Là gì: Lỗi trước luồng đến dưới dạng HTTP status, trước khi SSE mở. Lỗi trong luồng đến khi HTTP đã là 200, dưới dạng sự kiện `error`.
- Ở kiến trúc này: `401` thì FE làm mới token và thử lại một lần. `429` và `503` có thông điệp riêng. Sự kiện `error` luôn có `retryable` và `requestId`.
- Vì sao: Gộp hai loại vào một chỗ xử lý là sai: lỗi trong luồng có thể đến sau khi đã hiện nửa câu trả lời.
- Nguồn: `ship/02-hop-dong.md` §6 · `ship/04-frontend.md` FE-2
