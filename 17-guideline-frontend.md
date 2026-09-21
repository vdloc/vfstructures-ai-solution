# 17 · Hướng dẫn triển khai — đội Frontend

Tài liệu thi công, viết theo sáu bước của một lượt hỏi. Frontend chỉ xuất hiện ở bước 1 và bước 6, nhưng bốn bước ở giữa quyết định giao diện phải xử lý những trạng thái nào.

Thiết kế gốc ở [02](02-assistant-service.md) §6 (hợp đồng SSE) và [08](08-ux.md). Giải thích bằng lời thường ở [15](15-hoi-dap-tung-buoc.md).

Ký hiệu: **[T1]** việc tuần 1 · **[CHỜ]** đang chờ đội khác · **[CHỜ CHỐT]** phụ thuộc quyết định chưa chốt.

---

## Điều quan trọng nhất: Frontend không phải chờ Backend

Hợp đồng 11 sự kiện SSE **đóng băng từ tuần 1** và có version cùng đường dẫn `/v1`. Nghĩa là FE dựng một luồng giả bắn đúng các sự kiện đó và hoàn thiện toàn bộ giao diện **trước khi BE có tool nào chạy được**.

Bốn kịch bản luồng giả là đủ:

| Kịch bản | Chuỗi sự kiện |
| --- | --- |
| Hỏi tài liệu | `status` → `retrieval` → `token`×n → `citation` → `done` |
| Có tính toán | `status` → `status` → `tool_call` → `tool_result` → `approval_required` → `token`×n → `citation` → `done` |
| Bị từ chối | `status` → `refusal` → `done` — **không có `token` nào** |
| Lỗi giữa chừng | `status` → `retrieval` → `token`×3 → `error` |

Phát lại **với độ trễ thật**, không phát một lúc. Lỗi bố cục chỉ lộ ra khi chữ dài dần.

---

## Bước 1 — Gửi câu hỏi, mở ống SSE

### Phải làm

- [T1] Panel chat: ô nhập, danh sách tin nhắn, trạng thái đang xử lý.
- [T1] `readPageContext()` đọc từ store của app. **Không có ô nhập tay nào** cho `projectId` hay `elementId`.
- Bộ đọc SSE tách khung theo dòng trống. **Không dùng `EventSource`.**
- Dựng lại kết nối khi rớt mạng: giữ `conversationId`, hiện lại phần đã nhận.
- [T1] Bốn kịch bản luồng giả.

### Vì sao không dùng `EventSource`

`EventSource` của trình duyệt **không gửi được header tùy ý**, nên không mang được `Authorization: Bearer`. Phải dùng `fetch` rồi đọc `res.body` thủ công.

```ts
const res = await fetch("/api/assistant/chat", { method: "POST", body, headers });
if (!res.ok) throw await toApiError(res);        // 4xx/5xx đến TRƯỚC luồng
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

### Rủi ro

**FE-3 · Trạng thái "xong mà rỗng" là ca dễ bỏ sót nhất.** Phải có trong kịch bản luồng giả ngay từ tuần 1, không vá sau.

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

### Chip "tra theo" — đã chốt (AD-16, 20/09/2026)

Với lượt `case_lookup`, backend phát sự kiện `retrieval` mang danh sách tham số đã gom, mỗi tham số có `key`, `value`, `unit`, `source` (`tool_run` | `pageContext` | `case_hints`) và `confirmed`.

FE bắt buộc:

- Hiện chip cho mọi tham số. Chip có `source = case_hints` và `confirmed = false` thì **sửa được và xóa được**; các chip khác hiện tĩnh.
- Dưới 2 tham số: không hiện kết quả, hiện ô nhập tham số còn thiếu.
- Chỉ gọi lại backend khi người dùng bấm **Tra**. Sửa chip không tự gọi lại.
- Không tự điền giá trị mặc định cho tham số thiếu.

Lý do bắt buộc: bóc sai tham số không để lại dấu vết trong câu trả lời (R45). Chip là chỗ duy nhất kỹ sư bắt được.

### Rủi ro

**FE-4 · Thay đổi hợp đồng sau tuần 1 làm hỏng toàn bộ lợi ích của luồng giả.** Nếu quyết định `case_hints` trôi sang tuần 3, FE đã dựng xong giao diện theo hợp đồng cũ.

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
| `unverified_number` | Một con số không truy được về engine hoặc trích dẫn | "Một số giá trị chưa đối chiếu được với bộ tính" |
| `unverified_citation` | Một `[n]` không ứng với chunk nào | "Một trích dẫn chưa xác minh được" |
| `standard_version_mismatch` | Engine và tài liệu khác phiên bản tiêu chuẩn | "Bộ tính dùng EC2:2004, trích dẫn từ bản 2023" |
| `degraded_retrieval_only` | Mô hình không dùng được | "Chưa tạo được câu trả lời. Đây là các tài liệu liên quan." |

### Rủi ro

**FE-5 · Giao diện giả định cảnh báo đến trước chữ sẽ không chèn được banner.** Kịch bản luồng giả phải có ca này.

---

## Bước 6 — Dựng giao diện từ 11 sự kiện

### Quy tắc quan trọng nhất của cả tài liệu này

> **Thẻ kết quả tính toán dựng từ JSON của `tool_result`, không parse từ văn bản mô hình viết.**

Hai luồng tách biệt:

- Mô hình viết **văn xuôi diễn giải** → vào bong bóng chữ
- Engine trả **JSON có cấu trúc** → vào thẻ kết quả

Con số, đơn vị và tiêu chuẩn trong thẻ **luôn** lấy từ `outputs`, `units`, `standard` của `tool_result`.

Nếu FE parse số từ chữ, toàn bộ công sức hậu kiểm ở bước 5 thành vô nghĩa — vì cái được kiểm là chữ, còn cái hiển thị là thứ FE tự đọc ra từ chữ đó.

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

### Trích dẫn phải mở được

`citation` mang `docId`, `page`, `clause` và — với chunk có `bbox` — vùng trên trang. Bấm `[1]` mở tài liệu đúng trang và **tô sáng vùng**. Trích dẫn không mở được thì người dùng không có cách kiểm, và nhãn "có trích dẫn" trở thành trang trí.

### Nút Duyệt và nhãn bắt buộc

`approval_required` xuất hiện khi kết quả có thể vào kho kinh nghiệm. Bấm Duyệt → `POST /v1/approvals/{toolRunId}`.

Thẻ case khi tra cứu **bắt buộc** mang nhãn:

> **Kinh nghiệm nội bộ, không phải căn cứ tiêu chuẩn**

Và case duyệt trước phiên bản tiêu chuẩn hiện hành mang thêm cảnh báo **"có thể theo tiêu chuẩn cũ"**. Thiếu cảnh báo này thì case trở thành đường lan truyền một cách làm đã lỗi thời.

### Rủi ro

**FE-6 · Parse số từ văn bản mô hình viết làm vô hiệu toàn bộ bước 5.**

**R37 · Nhãn "đã qua engine" dễ bị hiểu thành "đã được thẩm định".** Engine chỉ kiểm những điều đã lập trình, không thay đánh giá tổng thể của kỹ sư. Giao diện phải nói rõ engine đã kiểm những gì. Và hệ thống đo xem có ai đang bấm Duyệt quá nhanh không — tốc độ duyệt bất thường là tín hiệu người dùng đang tin máy quá mức.

---

## Ngôn ngữ giao diện

Giao diện **chỉ có tiếng Anh và tiếng Pháp** (GĐ-1). Không có tiếng Việt trong sản phẩm, kể cả khi đội phát triển ở Việt Nam.

Hệ quả kỹ thuật: `locale` của câu hỏi được gửi lên và quyết định cấu hình full-text search ở bước 4. Gửi sai `locale` làm nhánh từ khóa yếu đi mà không có lỗi nào xuất hiện.

---

## Bảng tra nhanh: cái gì không bao giờ được làm

| Không bao giờ | Vì sao |
| --- | --- |
| Dùng `EventSource` | Không gửi được Bearer token |
| Parse số từ văn bản mô hình viết | Vô hiệu toàn bộ hậu kiểm |
| Giả định lượt nào cũng có `token` | Từ chối không có chữ nào, giao diện treo |
| Giả định `warning` đến trước chữ | Banner không chèn được |
| Có ô nhập tay cho `projectId` hoặc `elementId` | Ngữ cảnh phải đọc từ trạng thái app |
| Hiện mã lỗi thô cho người dùng | Lỗi phải có hướng xử lý |
| Bỏ nhãn "kinh nghiệm nội bộ" trên thẻ case | Case bị hiểu nhầm là căn cứ tiêu chuẩn |
| Xóa chữ đã hiện khi có cảnh báo | Mất tin, và hệ thống đã chọn cách khác |

---

## Liên quan

- [02-assistant-service.md](02-assistant-service.md) §6 — hợp đồng SSE đầy đủ
- [08-ux.md](08-ux.md) — nguyên tắc giao diện, thẻ kết quả, trạng thái
- [12-rui-ro.md](12-rui-ro.md) — R37
- [15-hoi-dap-tung-buoc.md](15-hoi-dap-tung-buoc.md) — giải thích cùng nội dung bằng lời thường
- [16-guideline-backend.md](16-guideline-backend.md) · [18-guideline-devops.md](18-guideline-devops.md)
