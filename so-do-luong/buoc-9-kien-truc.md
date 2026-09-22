# Bước 9 — Gửi kết quả về giao diện

Kết quả đi về trình duyệt dưới dạng một luồng SSE gồm 11 loại event. Giao diện dựng toàn bộ màn hình từ các event đó, kể cả thẻ kết quả tính.

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/`

## Luồng của bước 9

```
Assistant.Api · SSE writer
│  Response header: Content-Type text/event-stream, X-Accel-Buffering: no
│  Flush sau mỗi event. Các event tách nhau bằng một dòng trống
▼
9.1 CHUYỂN TIẾP                                 Next.js BFF
│  Làm gì:     Đưa luồng về trình duyệt nguyên dạng
│  Làm thế nào: Route /api/assistant/* trả thẳng ReadableStream, không buffer
▼
9.2 ĐI QUA HẠ TẦNG                              nginx · ALB · CloudFront
│  Làm gì:     Không tầng nào được gom luồng lại
│  Làm thế nào: nginx proxy_buffering off, proxy_read_timeout 120s
│              ALB idle_timeout ≥ 120 giây
│              CloudFront không cache /v1/chat
▼
9.3 ĐỌC LUỒNG                                   FE · fetch + ReadableStream
│  Làm gì:     Nhận từng event
│  Làm thế nào: Không dùng EventSource
│              4xx/5xx đến TRƯỚC luồng: kiểm res.ok trước khi đọc
▼
9.4 DỰNG GIAO DIỆN                              FE · Panel AI
   status             → dòng trạng thái
   retrieval          → danh sách nguồn bấm được
   token              → nối chữ vào bubble
   tool_call          → thẻ "Đang tính B12…" kèm input
   tool_result        → thẻ kết quả, dựng từ JSON này
   approval_required  → nút Duyệt / Bỏ qua
   citation           → [n] bấm được, mở đúng trang
   refusal            → thẻ từ chối kèm gợi ý
   warning            → banner chèn lên câu trả lời đã xong
   error              → giữ phần đã có, nút Retry, nút copy requestId
   done               → mở khóa ô nhập, nút chấm tốt/xấu
```

## Bốn chuỗi event hợp lệ

```
doc_qa   : status → retrieval → token×n → citation → done
calc     : status → status → tool_call → tool_result
           → approval_required → token×n → citation → done
refusal  : status → refusal → done              ← không có token nào
error    : status → retrieval → token×3 → error
```

## Từ khóa

**SSE (Server-Sent Events)**
<!-- alias: SSE writer -->
- Là gì: Một kết nối HTTP mở sẵn, server đẩy dần từng mẩu dữ liệu xuống trình duyệt.
- Ở kiến trúc này: `POST /v1/chat` trả về `text/event-stream`. Hợp đồng 11 event đóng băng từ tuần 1, thay đổi phá vỡ phải lên `/v2`.
- Vì sao: Người dùng thấy trạng thái và chữ ngay khi có, không chờ cả lượt. Hợp đồng đóng băng thì FE dựng mock stream và làm xong giao diện trước khi BE có tool nào chạy được.
- Nguồn: `ship/02-hop-dong.md` §4 · `17-guideline-frontend.md`

**X-Accel-Buffering**
<!-- alias: X-Accel-Buffering -->
- Là gì: Response header báo cho nginx không gom dữ liệu vào buffer trước khi gửi đi.
- Ở kiến trúc này: `Assistant.Api` đặt `X-Accel-Buffering: no` cho luồng SSE.
- Vì sao: nginx mặc định buffer response. Bị buffer thì chữ không chảy dần mà hiện một cục ở cuối, nhìn như hệ thống treo.
- Nguồn: `ship/02-hop-dong.md` §2

**Next.js BFF**
<!-- alias: Next.js BFF -->
- Là gì: BFF (Backend For Frontend) là lớp server nằm trong chính ứng dụng Next.js, đứng giữa trình duyệt và backend.
- Ở kiến trúc này: Đọc cookie HttpOnly, gắn Bearer token, chuyển tiếp luồng SSE nguyên dạng. BFF là ống dẫn, không phải lớp bảo mật: không kiểm quyền, không đếm quota.
- Vì sao: Token không bao giờ vào JavaScript của trình duyệt, nên XSS không lấy được token.
- Nguồn: `01-kien-truc-tong-the.md` §2 · `07-auth-bao-mat.md` §1

**Buffering ở hạ tầng**
<!-- alias: proxy_buffering off, idle_timeout -->
- Là gì: Mỗi tầng proxy (nginx, ALB, CloudFront) đều có thể gom dữ liệu hoặc cắt kết nối lâu.
- Ở kiến trúc này: nginx tắt buffering; ALB `idle_timeout` ≥ 120 giây vì lượt `optimize` có trần 90 giây; CloudFront không cache `/v1/chat`.
- Vì sao: Timeout 60 giây sẽ cắt ngang lượt dài, FE nhận luồng đứt không có `done`. Nghiệm thu bằng `curl -N` qua đúng tuyến production; localhost không tính vì không có nginx, ALB.
- Nguồn: `ship/02-hop-dong.md` §7 · `18-guideline-devops.md`

**EventSource**
<!-- alias: EventSource -->
- Là gì: API có sẵn của trình duyệt để đọc SSE.
- Ở kiến trúc này: **Không dùng.** FE dùng `fetch` rồi đọc `res.body` bằng `ReadableStream`, tự tách event theo dòng trống.
- Vì sao: `EventSource` không gửi được header tùy ý, và chỉ làm được GET. Endpoint này là POST có body JSON.
- Nguồn: `ship/02-hop-dong.md` §7 · `17-guideline-frontend.md`

**ReadableStream**
<!-- alias: ReadableStream -->
- Là gì: API trình duyệt để đọc dữ liệu đến dần theo từng đoạn.
- Ở kiến trúc này: `res.body.pipeThrough(new TextDecoderStream()).getReader()`. Rớt mạng thì dựng lại kết nối, giữ `conversationId`, hiện lại phần đã nhận.
- Vì sao: Là cách duy nhất vừa gửi được POST có body, vừa đọc được luồng.
- Nguồn: `17-guideline-frontend.md` Bước 1

**tool_result**
<!-- alias: tool_result -->
- Là gì: Event mang output của engine: `toolRunId`, `outputs`, `units`, `standard`.
- Ở kiến trúc này: Giao diện dựng thẻ kết quả **từ JSON này**, không đọc số từ chữ mô hình viết.
- Vì sao: FE parse số từ văn bản là vô hiệu toàn bộ validator ở backend.
- Nguồn: `ship/02-hop-dong.md` §4, §10

**refusal**
<!-- alias: refusal -->
- Là gì: Event báo hệ thống từ chối trả lời, kèm lý do và gợi ý.
- Ở kiến trúc này: Phát khi không đủ căn cứ ở bước 6a, hoặc nhãn `out_of_scope` ở bước 5.
- Vì sao: Lượt từ chối không có event `token` nào. Giao diện giả định "luôn có chữ" sẽ treo ở trạng thái đang gõ.
- Nguồn: `ship/02-hop-dong.md` §4

**error và requestId**
<!-- alias: requestId -->
- Là gì: Event báo lỗi giữa luồng: `code`, `retryable`, `partial`, `requestId`.
- Ở kiến trúc này: Lỗi **trước** luồng đi bằng HTTP status (401, 403, 429, 503…). Lỗi **trong** luồng đi bằng event `error`, lúc đó HTTP đã là 200.
- Vì sao: `requestId` truy được toàn bộ lượt trong trace. Người dùng copy gửi cho đội hỗ trợ.
- Nguồn: `ship/02-hop-dong.md` §6

**done và usage**
<!-- alias: done -->
- Là gì: Event cuối của mọi lượt: `messageId` và `usage` (số token vào, ra, cache, độ trễ).
- Ở kiến trúc này: Nhận `done` thì FE mở khóa ô nhập và hiện nút chấm tốt/xấu.
- Vì sao: `usage` là số liệu thật để trừ quota và theo dõi chi phí.
- Nguồn: `ship/02-hop-dong.md` §4

## Chưa rõ trong tài liệu

- nginx, ALB, CloudFront trên tuyến production có buffer hay không phải kiểm thật ở M0. Tài liệu ghi đây là điểm chặn của cả ba đội.
