# 04 · Thi công — đội Frontend

**Ai đọc:** đội Frontend. Backend đọc để biết giao diện cần gì ở mình.

**Mục lục**

- Vì sao tài liệu này viết theo sáu bước của Backend
- Hai nguyên tắc chi phối
- Thuật ngữ trong tài liệu này
- Ký hiệu
- Điều quan trọng nhất: Frontend không phải chờ Backend
- Bước 1 — Gửi câu hỏi, mở SSE stream
- Bước 2 — Điều FE phải biết dù không làm gì
- Bước 3 và 4 — Điều FE phải biết
- Bước 5 — Hiển thị cảnh báo
- Bước 6 — Dựng giao diện từ 11 sự kiện
- Ngôn ngữ giao diện
- Bảng tra nhanh: cái gì không bao giờ được làm

---

## Vì sao tài liệu này viết theo sáu bước của Backend

Frontend chỉ thật sự làm việc ở bước 1 và bước 6. Nhưng **bốn bước ở giữa quyết định giao diện phải xử lý những trạng thái nào** — và đó là phần hay bị bỏ sót nhất.

Ví dụ cụ thể: câu hỏi ngoài phạm vi bị chặn ở bước 2, chưa bao giờ chạm tới mô hình chính. Luồng sự kiện khi đó chỉ có `status → refusal → done` — **không có một sự kiện chữ nào**. Giao diện viết theo giả định "lượt nào cũng có chữ" sẽ treo ở trạng thái đang gõ vĩnh viễn.

Nên tài liệu đi theo thứ tự của Backend, và ở mỗi bước nói rõ: *bước này sinh ra trạng thái gì mà giao diện phải có sẵn chỗ*.

## Hai nguyên tắc chi phối

**Một — thẻ kết quả dựng từ JSON, không bóc số ra từ chữ.** Mô hình viết văn xuôi diễn giải; engine trả JSON có cấu trúc. Con số, đơn vị và tiêu chuẩn trong thẻ **luôn** lấy từ JSON.

Vì sao nghiêm ngặt đến vậy: Backend có ba lớp kiểm chạy sau khi chữ hiện xong, đối chiếu từng con số trong văn xuôi với kết quả engine. Nếu Frontend tự đọc số ra từ văn xuôi rồi hiển thị theo cách riêng, thì **cái được kiểm và cái được hiện là hai thứ khác nhau** — toàn bộ lớp kiểm đó thành vô nghĩa.

**Hai — gắn cờ, không xóa chữ đã hiện.** Cảnh báo đến **sau** khi chữ đã chảy xong, nên banner phải chèn được lên một câu trả lời đã hiển thị đầy đủ. Xóa chữ giữa chừng làm người dùng mất niềm tin vào cả những lượt đúng — hệ thống đã chọn cách khác, và giao diện phải thực hiện đúng lựa chọn đó.

## Thuật ngữ trong tài liệu này

Giải thích đầy đủ ở [00-thuat-ngu-va-nguon.md](00-thuat-ngu-va-nguon.md). Bản rút gọn:

| Thuật ngữ | Một câu |
| --- | --- |
| **SSE** | Một kết nối mở sẵn, server đẩy dần từng mẩu xuống. Khác `EventSource` ở chỗ phải tự đọc `res.body` |
| **`EventSource`** | API có sẵn của trình duyệt để nhận SSE. **Không dùng được ở đây** vì không gửi được header tùy ý |
| **Mock stream** | Luồng sự kiện giả do Frontend tự phát, để dựng giao diện trước khi Backend chạy |
| **`pageContext`** | Khối dữ liệu mô tả trang người dùng đang mở, gửi kèm câu hỏi |
| **Citation** | Trích dẫn — `[1]`, `[2]` bấm được, mở đúng trang và highlight vùng |
| **Chip tham số** | Ô hiện giá trị mô hình bóc ra từ câu hỏi; sửa được trước khi tra |
| **`CompletedUnverified`** | Lượt mà kiểm tra sau trượt: chữ vẫn hiện, kèm banner cảnh báo |
| **`Degraded`** | Lượt chạy ở chế độ giảm, phải nói rõ với người dùng |

## Ký hiệu

**[CHỜ]** đang chờ đội khác · **[CHỜ CHỐT]** phụ thuộc quyết định chưa chốt.

Hợp đồng với Backend ở [02](02-hop-dong.md) — 11 sự kiện **không đổi** từ v1 (v1.1 chỉ cộng thêm field và mã, xem §5 của 02), nên Frontend dựng được toàn bộ giao diện trước khi Backend có gì chạy. Nguyên tắc giao diện đầy đủ ở [07](07-giao-dien.md).

---

## Điều quan trọng nhất: Frontend không phải chờ Backend

Hợp đồng 11 sự kiện SSE **freeze** và có version cùng đường dẫn `/v1`. Nghĩa là FE dựng một mock stream bắn đúng các sự kiện đó và hoàn thiện toàn bộ giao diện **trước khi BE có tool nào chạy được**.

Bốn kịch bản mock stream là đủ:

| Kịch bản | Chuỗi sự kiện |
| --- | --- |
| Hỏi tài liệu | `status` → `retrieval` → `token`×n → `citation` → `done` |
| Có tính toán | `status` → `status` → `tool_call` → `tool_result` → `token`×n → `citation` → `done` (từ AD-28 không còn `approval_required`) |
| Bị từ chối | `status` → `refusal` → `done` — **không có `token` nào** |
| Lỗi giữa chừng | `status` → `retrieval` → `token`×3 → `error` |

Phát lại **với độ trễ thật**, không phát một lúc. Lỗi bố cục chỉ lộ ra khi chữ dài dần.

---

## Bước 1 — Gửi câu hỏi, mở SSE stream

### Phải làm

- Panel chat: ô nhập, danh sách tin nhắn, trạng thái đang xử lý.
- `readPageContext` đọc từ store của app. **Không có ô nhập tay nào** cho `projectId` hay `elementId`.
- Bộ đọc SSE tách khung theo dòng trống. **Không dùng `EventSource`.**
- Dựng lại kết nối khi rớt mạng: giữ `conversationId`, hiện lại phần đã nhận.
- Bốn kịch bản mock stream.

### Vì sao không dùng `EventSource`

`EventSource` của trình duyệt **không gửi được header tùy ý**, nên không mang được `Authorization: Bearer`. Phải dùng `fetch` rồi đọc `res.body` thủ công.

```ts
const res = await fetch("/api/assistant/chat", { method: "POST", body, headers });
if (!res.ok) throw await toApiError(res); // 4xx/5xx đến TRƯỚC luồng
const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
```

### Ngữ cảnh trang: gửi cái gì

| Trường | Nguồn | Vì sao cần |
| --- | --- | --- |
| `projectId`, `modelId` | store dự án | Định danh, và để BE đối chiếu quyền |
| `selectedElementIds` | selection trong viewport | "Dầm này" là dầm nào — **không để mô hình đoán** |
| `activeView` | trạng thái UI | Phân biệt câu hỏi giải thích kết quả với câu hỏi tra cứu |
| `unitSystem` | cài đặt người dùng | Metric hay imperial — ảnh hưởng mọi con số |
| `codeStandard` | cài đặt dự án | EC3, EC2, DTU… |
| `hasResult`, `resultKind`, `calcAt` | bảng kết quả đã tính | **Bắt buộc từ AD-15.** Router dựa vào đây để ra nhãn `explain_result`; thiếu thì nhãn đó không bao giờ xuất hiện |

Nếu FE chỉ gửi câu chữ, hệ thống còn hai lựa chọn tệ: hỏi lại người dùng về thứ họ đang nhìn thẳng vào, hoặc **để mô hình tự đoán** cấu kiện — rồi trả lời rất trôi chảy về sai đối tượng.

### Rủi ro

**FE-1 · Dùng `EventSource`.** Không gửi được Bearer token. Phát hiện muộn thì phải viết lại cả lớp mạng.

**FE-2 · Lỗi trước luồng và lỗi trong luồng là hai loại khác nhau.** `401` đến dưới dạng HTTP status; lỗi giữa chừng đến dưới dạng sự kiện `error` khi HTTP đã là 200. Xử lý chung một chỗ là sai.

---

## Bước 2 — Điều FE phải biết dù không làm gì

Bước này của Backend, nhưng nó sinh ra một trạng thái giao diện phải có sẵn từ đầu.

### Trả lời có thể kết thúc mà không có chữ nào

Câu ngoài phạm vi chết ở bước 2, chưa từng chạm mô hình chính. Luồng chỉ có:

```
status → refusal → done
```

Giao diện giả định "luôn có `token`" sẽ **treo ở trạng thái đang gõ** vĩnh viễn.

### Phải làm

- Thẻ từ chối: hiện `reason` và `suggestion`, **không hiện mã lỗi thô**.
- Khóa ô nhập khi nhận `429`, đếm ngược theo `Retry-After`.
- Nút copy `requestId` trên mọi lỗi — id này truy được toàn bộ lượt, người dùng gửi cho hỗ trợ.
- **Nút Dừng** gọi `AbortController.abort()` trên `fetch` đang mở. Hook stream nằm ở store của app, không nằm trong panel: đóng panel không hủy lượt, chỉ Dừng, đóng tab hoặc rớt mạng mới hủy (AD-25).
- **Route BFF truyền `req.signal` vào `fetch` upstream**, và **không tự retry** `POST /v1/chat` ([02](02-hop-dong.md) §7). Thiếu `req.signal` thì người dùng đóng tab mà backend vẫn chạy lượt tới hết.
- Tải lại trang giữa lượt: `GET /v1/conversations/{id}` trả message cuối `status: "aborted"` kèm phần chữ đã sinh. Hiện phần đó với nhãn **"chưa hoàn tất"**, không kèm nút chấm tốt/xấu. v1 không nối lại được stream đang chạy.

### Rủi ro

**FE-3 · Trạng thái "xong mà rỗng" là ca dễ bỏ sót nhất.** Phải có trong kịch bản mock stream ngay từ bản đầu, không vá sau.

---

## Bước 3 và 4 — Điều FE phải biết

### Độ trễ: ba mốc, không phải một

| Mốc | Thời gian mục tiêu | Giao diện hiện gì |
| --- | --- | --- |
| Sự kiện `status` đầu tiên | ≲ 300 ms | Dòng trạng thái |
| `retrieval` — danh sách nguồn | ≲ 1,5 s | Nguồn bấm được, **trước cả chữ** |
| `token` đầu tiên | ≲ 3 s | Chữ bắt đầu chảy |

Hiện danh sách nguồn trước chữ là thứ làm lượt hỏi **có vẻ** nhanh. Đừng gom lại chờ chữ.

Vượt 10 giây thì chỉ báo tiến trình là bắt buộc — đó là lý do `status` có trong hợp đồng.

### Nhánh có tool: thêm hai sự kiện

- `tool_call` → thẻ "Đang tính dầm B12…" kèm tham số đầu vào. Không phải spinner câm.
- `tool_result` → dựng thẻ kết quả.

### Chip "tra theo" — đã chốt (AD-16)

Với lượt `case_lookup`, backend phát sự kiện `retrieval` mang danh sách tham số đã gom, mỗi tham số có `key`, `value`, `unit`, `source` (`tool_run` | `pageContext` | `case_hints`) và `confirmed`.

FE bắt buộc:

- Hiện chip cho mọi tham số. Chip có `source = case_hints` và `confirmed = false` thì **sửa được và xóa được**; các chip khác hiện tĩnh.
- Dưới 2 tham số: không hiện kết quả, hiện ô nhập tham số còn thiếu.
- Chỉ gọi lại backend khi người dùng bấm **Tra**. Sửa chip không tự gọi lại.
- Không tự điền giá trị mặc định cho tham số thiếu.

Lý do bắt buộc: bóc sai tham số không để lại dấu vết trong câu trả lời (R45). Chip là chỗ duy nhất kỹ sư bắt được.

### Rủi ro

**FE-4 · Thay đổi hợp đồng sau khi freeze làm hỏng toàn bộ lợi ích của mock stream.** Quyết định `case_hints` chốt muộn thì FE đã dựng xong giao diện theo hợp đồng cũ.

---

## Bước 5 — Hiển thị cảnh báo

### Thứ tự thật trên dây

```
token → token → … → token → warning → done
```

Cảnh báo đến **sau** khi chữ đã hiện xong. Banner phải chèn được lên một câu trả lời đã hiển thị đầy đủ, **không xóa chữ đã hiện**.

Xóa chữ đã hiện là trải nghiệm tệ và làm người dùng mất tin. Hệ thống chọn gắn cờ thay vì xóa — giao diện phải thực hiện đúng lựa chọn đó.

### Phải làm

- Banner cảnh báo chèn lên câu trả lời đã đầy đủ.
- Nhãn trạng thái phân biệt `Completed` và `CompletedUnverified`.
- Chế độ Degraded: mô hình không dùng được thì hiện **danh sách nguồn** kèm một câu giải thích, không hiện lỗi trắng.

### Các mã cảnh báo

| Mã | Nghĩa | Hiện gì |
| --- | --- | --- |
| `unverified_number` | Một con số không truy được về engine hoặc citation | "Một số giá trị chưa đối chiếu được với bộ tính" |
| `unverified_citation` | Một `[n]` không ứng với chunk nào | "Một citation chưa xác minh được" |
| `standard_version_mismatch` | Engine và tài liệu khác phiên bản tiêu chuẩn | "Bộ tính dùng EC2:2004, citation từ bản 2023" |
| `degraded_retrieval_only` | Mô hình không dùng được | "Chưa tạo được câu trả lời. Đây là các tài liệu liên quan." |
| `unverified_verdict` | Văn bản kết luận trái verdict của engine (AD-24) | "Kết luận trong câu trả lời chưa khớp kết quả bộ tính. Xem thẻ kết quả." |
| Mã không biết | Mã mới thêm sau khi FE phát hành | Banner chung: "Một phần câu trả lời chưa đối chiếu được" |

**Nhãn đạt/không đạt trên thẻ kết quả** lấy từ `tool_result.outputs.verdict.pass`, không lấy từ chữ mô hình viết. Không có khối `verdict` thì thẻ không hiện nhãn ([02](02-hop-dong.md) §5).

### Rủi ro

**FE-5 · Giao diện giả định cảnh báo đến trước chữ sẽ không chèn được banner.** Kịch bản mock stream phải có ca này.

---

## Bước 6 — Dựng giao diện từ 11 sự kiện

### Quy tắc quan trọng nhất của cả tài liệu này

> **Thẻ kết quả tính toán dựng từ JSON của `tool_result`, không parse từ văn bản mô hình viết.**

Hai luồng tách biệt:

- Mô hình viết **văn xuôi diễn giải** → vào bong bóng chữ
- Engine trả **JSON có cấu trúc** → vào thẻ kết quả

Con số, đơn vị và tiêu chuẩn trong thẻ **luôn** lấy từ `outputs`, `units`, `standard` của `tool_result`.

Nếu FE parse số từ chữ, toàn bộ công sức post-validation ở bước 5 thành vô nghĩa — vì cái được kiểm là chữ, còn cái hiển thị là thứ FE tự đọc ra từ chữ đó.

### Bảng 11 sự kiện

| Sự kiện | Dữ liệu chính | Giao diện làm gì |
| --- | --- | --- |
| `status` | `phase`, `text` | Dòng trạng thái một dòng |
| `retrieval` | `{docId, title, page, clause}[]` · Nhánh `case_lookup` thêm `params: [{key, value, unit, source, confirmed}]` (AD-16) | Danh sách nguồn bấm được; với `case_lookup` là chip tham số |
| `token` | `text` | Nối vào bong bóng trả lời |
| `tool_call` | `toolId`, `version`, `inputs` | Thẻ "Đang tính…" kèm tham số |
| `tool_result` | `toolRunId`, `outputs`, `units`, `standard` | **Dựng thẻ kết quả từ JSON** |
| `approval_required` | `toolRunId`, `summary` | Nút Duyệt / Bỏ qua |
| `citation` | `[{n, docId, page, clause, quote}]` | `[n]` bấm được, mở đúng trang |
| `refusal` | `reason`, `suggestion` | Thẻ từ chối kèm gợi ý |
| `warning` | `code` | Banner trên câu trả lời |
| `error` | `code`, `retryable`, `partial`, `requestId` | Giữ phần đã có, nút Thử lại |
| `done` | `messageId`, `usage` | Mở khóa ô nhập, nút chấm tốt/xấu |

### Citation phải mở được

`citation` mang `docId`, `page`, `clause` và — với chunk có `bbox` — vùng trên trang. Bấm `[1]` mở tài liệu đúng trang và **highlight vùng**. Citation không mở được thì người dùng không có cách kiểm, và nhãn "có citation" trở thành trang trí.

### Thẻ case và nhãn bắt buộc (AD-28)

Không còn nút Duyệt: case tự ghi khi engine tính đạt ([12](12-tra-case.md)). Code xử lý `approval_required` giữ nguyên, vì event vẫn nằm trong hợp đồng, nhưng không giả định nó xuất hiện.

Thẻ case khi tra cứu hiện `params`, `result`, `verdict`, **số lần dùng** (`use_count`), lần gần nhất, tiêu chuẩn đã dùng, và **bắt buộc** mang nhãn:

> **Cấu hình đã từng tính đạt trong công ty, không phải khuyến nghị**

Và case tính trước phiên bản tiêu chuẩn hiện hành mang thêm cảnh báo **"có thể theo tiêu chuẩn cũ"**. Thiếu cảnh báo này thì case trở thành đường lan truyền một cách làm đã lỗi thời.

### Rủi ro

**FE-6 · Parse số từ văn bản mô hình viết làm vô hiệu toàn bộ bước 5.**

**R37 · Nhãn "đã qua engine" dễ bị hiểu thành "đã được thẩm định".** Engine chỉ kiểm những điều đã lập trình, không thay đánh giá tổng thể của kỹ sư. Giao diện phải nói rõ engine đã kiểm những gì. Và hệ thống đo xem có ai đang bấm Duyệt quá nhanh không — tốc độ duyệt bất thường là tín hiệu người dùng đang tin máy quá mức.

---

## Ngôn ngữ giao diện

Giao diện **chỉ có tiếng Anh và tiếng Pháp** (GĐ-1). Không có tiếng Việt trong sản phẩm, kể cả khi đội phát triển ở Việt Nam.

Hệ quả kỹ thuật: `locale` của câu hỏi được gửi lên và quyết định ngôn ngữ trả lời. Nó không còn điều khiển cấu hình full-text-search trong PostgreSQL (kho chunk đã chuyển sang MKB từ AD-17); tìm kiếm hybrid trên nội dung tài liệu nay nằm trong `Retrieve` của MKB, không lộ tham số theo ngôn ngữ ra ngoài. Gửi sai `locale` vẫn có hại: câu trả lời có thể lệch ngôn ngữ, và Haiku dịch `search_query` sang ngôn ngữ khác ngôn ngữ gốc của câu hỏi có thể làm MKB khớp kém hơn — chưa đo được mức độ (R42).

---

## Bảng tra nhanh: cái gì không bao giờ được làm

| Không bao giờ | Vì sao |
| --- | --- |
| Dùng `EventSource` | Không gửi được Bearer token |
| Parse số từ văn bản mô hình viết | Vô hiệu toàn bộ post-validation |
| Giả định lượt nào cũng có `token` | Từ chối không có chữ nào, giao diện treo |
| Giả định `warning` đến trước chữ | Banner không chèn được |
| Có ô nhập tay cho `projectId` hoặc `elementId` | Ngữ cảnh phải đọc từ trạng thái app |
| Hiện mã lỗi thô cho người dùng | Lỗi phải có hướng xử lý |
| Bỏ nhãn "kinh nghiệm nội bộ" trên thẻ case | Case bị hiểu nhầm là căn cứ tiêu chuẩn |
| Xóa chữ đã hiện khi có cảnh báo | Mất tin, và hệ thống đã chọn cách khác |
| Lấy nhãn đạt/không đạt từ văn bản `token` | Mô hình có thể viết ngược kết quả engine |
| BFF không truyền `req.signal`, hoặc tự retry `/v1/chat` | Lượt chạy tiếp khi không ai đọc, hoặc chạy hai lần |
| Bỏ qua mã `warning` không biết | Mất cảnh báo khi backend thêm mã mới |

---

## Liên quan

| Cần gì | Đọc |
| --- | --- |
| Hợp đồng SSE đầy đủ, payload từng sự kiện, mã lỗi | [02-hop-dong.md](02-hop-dong.md) |
| Thiết kế đầy đủ, state machine, quyết định | [01-kien-truc.md](01-kien-truc.md) |
| Backend đang làm gì ở bốn bước giữa | [03-backend.md](03-backend.md) |
| Hồ sơ đề xuất cho lãnh đạo/CTO | [kien-truc-day-du.md](../kien-truc-day-du.md) |
