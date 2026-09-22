# 02 · Hợp đồng API — Backend ↔ Frontend

**Phiên bản v1.1 · chưa ký lại.** Đổi breaking đi vào `/v2`, đường dẫn đã công bố không đổi nghĩa. Thêm field hoặc thêm mã mới là thay đổi cộng thêm, được phép trong `/v1`; đổi nghĩa hoặc bỏ field đã công bố thì không.

**Thay đổi v1.2 (không phá hợp đồng):** AD-28 tự ghi case, nên backend **không phát** `approval_required` và FE **không gọi** `/v1/approvals` cho case. 11 event và mọi đường dẫn giữ nguyên nghĩa; chỉ tần suất phát của một event đổi về 0. Chi tiết ở [12](12-tra-case.md).

**Thay đổi so với v1 (đều là cộng thêm):** endpoint `/v1/admin/corpus/*` (§1); mã `warning` mới `unverified_verdict` và luật xử lý mã lạ (§5); khối `outputs.verdict` trong `tool_result` (§5); `/v1/approvals` idempotent (§1); message có `status: "aborted"` khi đọc lại conversation, và luật ngắt kết nối cho BFF (§7). Hai đội ký lại trước khi FE dựng các trạng thái này.

Đây là file **hai đội cùng ký**. Frontend dựng mock stream theo đúng file này và hoàn thiện toàn bộ UI trước khi Backend có endpoint nào chạy — nên Backend phát hành bản nháp ngay khi ký được, không đợi bản hoàn chỉnh.

Thiết kế đằng sau hợp đồng ở [01](01-kien-truc.md).

**Mục lục**

1. Endpoint
2. Request
3. `pageContext` — dữ liệu untrusted
4. SSE — 11 event
5. Mã `warning`
6. Mã HTTP và mã `error`
7. Transport — ba cái bẫy
8. Output của IntentRouter — hợp đồng nội bộ
9. Ai chặn ai
10. Luật không bao giờ vi phạm

---

## 1. Endpoint

| Đường dẫn | Method | Việc | Trả |
| --- | --- | --- | --- |
| `/v1/chat` | POST | Gửi một lượt, mở SSE stream | `text/event-stream` |
| `/v1/conversations/{id}` | GET | Đọc lại lịch sử một conversation | JSON |
| `/v1/approvals/{toolRunId}` | POST | **v1.2: không còn được gọi cho case** — AD-28 tự ghi case khi engine tính đạt ([12](12-tra-case.md)). Đường dẫn giữ nguyên nghĩa đã công bố, dành cho tool nhóm C sau này. Nghĩa cũ: approve một `tool_run` thành case. **Idempotent**: gọi lại cùng `toolRunId`, hoặc duyệt một `tool_run` khác có cùng `dedupe_key`, trả `caseId` đã có với `200` | `{ caseId }` |
| `/v1/feedback` | POST | Chấm tốt/xấu một message | `204` |
| `/v1/sources/{docId}` | GET | Presigned URL + trang cần highlight cho source viewer. **Kiểm lại scope** | JSON |
| `/v1/capabilities` | GET | Model đang dùng, tool khả dụng, version corpus, trạng thái kill switch | JSON |
| `/v1/admin/corpus/*` | POST / GET | Nạp tài liệu, xem trạng thái ingestion, phát hành và chuyển ấn bản (AD-26). Chỉ vai trò `Assistant.Curate`. Không thuộc panel chat, FE của trang quản trị dùng | JSON |
| `/health/live`, `/health/ready` | GET | Liveness / readiness. **Không gọi Bedrock trong health check** | `200` / `503` |

Response JSON theo `ApiResponse<T>` của Payment API.

---

## 2. Request

```jsonc
// POST /v1/chat
{
 "conversationId": "c-8f3a...", // uuid, client sinh cho lượt đầu
 "message": "Cốt đai tối thiểu cho dầm này?",
 "locale": "fr", // "fr" | "en" — quyết định ngôn ngữ trả lời và ngôn ngữ giữ nguyên của search_query gửi cho MKB
 "context": { // pageContext, xem §3
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
 "inputs": { "b": 300, "h": 600, "unit": "mm" },
 "outputs": { "VRd": 184.2, "unit": "kN" }
 }
}
```

**Header:** `Authorization: Bearer <JWT Keycloak>`, `Content-Type: application/json`.

**Response header:** `Content-Type: text/event-stream`, `X-Accel-Buffering: no`.

---

## 3. `pageContext` — dữ liệu untrusted

`context` là **gợi ý của client, không phải căn cứ phân quyền**. Backend lấy quyền từ JWT qua `AccessScopeResolver`, không bao giờ từ `context`.

| Trường | Nguồn ở FE | Backend dùng làm gì |
| --- | --- | --- |
| `projectId`, `memberId` | store dự án | **Định danh** để đọc lại kết quả đã lưu qua Main API bằng token người dùng. Main API kiểm quyền |
| `selectedElementIds` | selection trong viewport | "Dầm này" là dầm nào — không để model đoán |
| `activeView` | trạng thái UI | Phân biệt câu hỏi giải thích kết quả với câu hỏi tra cứu |
| `unitSystem` | cài đặt người dùng | Ảnh hưởng mọi con số |
| `codeStandard` | cài đặt dự án | EC2, EC3, DTU… |
| `hasResult`, `resultKind`, `calcAt` | bảng kết quả đã tính | **Bắt buộc từ AD-15.** IntentRouter dựa vào đây để ra intent `explain_result`; thiếu thì intent đó không bao giờ xuất hiện |
| `inputs`, `outputs` | bảng kết quả đã tính | **Chỉ để phát hiện lệch** với bản đã lưu ở server. Không dùng làm input cho engine |

FE **không có ô nhập tay** cho `projectId` hay `memberId`. Đọc từ store của app.

---

## 4. SSE — 11 event

Khung SSE tách bằng dòng trống. Backend flush sau mỗi event.

| Event | Payload | Phát khi | FE làm gì |
| --- | --- | --- | --- |
| `status` | `{ phase, text }` | Đổi trạng thái | Dòng status một dòng |
| `retrieval` | `{ chunks: [{docId,title,page,clause}], scores }`<br/>nhánh `case_lookup` thêm `params: [{key,value,unit,source,confirmed}]` | Sau retrieval, hoặc sau khi gom tham số | Danh sách source bấm được; với `case_lookup` là chip tham số |
| `token` | `{ text }` | Mỗi delta chữ | Nối vào bubble |
| `tool_call` | `{ toolId, version, inputs }` | Trước khi chạy tool | Thẻ "Đang tính B12…" kèm input. Không phải spinner câm |
| `tool_result` | `{ toolRunId, outputs, units, standard }` | Sau khi tool xong | **Dựng thẻ kết quả từ JSON này** |
| `approval_required` | `{ toolRunId, summary }` | **v1.2: không phát cho case** (AD-28). Giữ trong hợp đồng cho tool nhóm C | Nút Approve / Bỏ qua. FE giữ code xử lý, không giả định event này có mặt |
| `citation` | `[{ n, docId, page, clause, quote, bbox? }]` | Sau `CitationValidator` | `[n]` bấm được, mở đúng trang, highlight `bbox` |
| `refusal` | `{ reason, suggestion }` | Không đủ căn cứ, hoặc `out_of_scope` | Thẻ refusal kèm suggestion. Không hiện mã lỗi thô |
| `warning` | `{ code }` | Validator trượt | Banner chèn lên câu trả lời **đã hiện xong** |
| `error` | `{ code, retryable, partial, requestId }` | Lỗi giữa stream | Giữ phần đã có, nút Retry, nút copy `requestId` |
| `done` | `{ messageId, usage }` | Kết thúc | Mở khóa input, nút chấm tốt/xấu |

`usage` = `{ inputTokens, outputTokens, totalTokens, cacheReadInputTokens, cacheWriteInputTokens, latencyMs }`.

### Bốn chuỗi event hợp lệ

```
doc_qa : status → retrieval → token×n → citation → done
calc : status → status → tool_call → tool_result
 → approval_required → token×n → citation → done
refusal : status → refusal → done ← KHÔNG có token nào
error : status → retrieval → token×3 → error
```

Ba luật FE phải cài ngay từ bản đầu:

1. **Lượt có thể kết thúc mà không có `token` nào.** UI giả định "luôn có token" sẽ treo ở trạng thái đang gõ vĩnh viễn.
2. **`warning` đến SAU chữ**, không đến trước. Banner phải chèn được lên câu trả lời đã đầy đủ.
3. **Không xóa chữ đã hiện.** Hệ thống chọn gắn cờ thay vì xóa — UI thực hiện đúng lựa chọn đó.

Mock stream phải phát lại **với độ trễ thật**, không phát một lúc. Lỗi layout chỉ lộ khi chữ dài dần.

---

## 5. Mã `warning`

| Code | Nghĩa | UI hiện |
| --- | --- | --- |
| `unverified_number` | Một số không truy được về `tool_run` hoặc citation | "Một số giá trị chưa đối chiếu được với bộ tính" |
| `unverified_citation` | Một `[n]` không ứng với chunk nào | "Một citation chưa xác minh được" |
| `standard_version_mismatch` | Engine và tài liệu khác version tiêu chuẩn | "Bộ tính dùng EC2:2004, citation từ bản 2023" |
| `degraded_retrieval_only` | Model không dùng được | "Chưa tạo được câu trả lời. Đây là các tài liệu liên quan." |
| `degraded_routing` | IntentRouter lỗi, lượt chạy bằng luật fallback | "Lượt này chạy ở chế độ giảm" |
| `truncated` | Chạm trần `max_iterations`, `max_output_tokens` hoặc `timeout` | "Chưa trả lời xong trong giới hạn". **Không** trình bày kết quả dở dang như câu trả lời hoàn chỉnh |
| `unverified_verdict` | Văn bản kết luận đạt/không đạt trái với verdict của engine, hoặc kết luận cho tool chưa khai báo verdict (AD-24) | "Kết luận trong câu trả lời chưa khớp kết quả bộ tính. Xem thẻ kết quả." |

**Bổ sung v1.1, cần hai đội ký lại:** mã `unverified_verdict` là mã mới. Thêm mã `warning` là thay đổi cộng thêm, không breaking, nhưng chỉ an toàn khi FE xử lý mã lạ. Luật từ bản này: **FE gặp mã `warning` không biết thì hiện banner chung** "Một phần câu trả lời chưa đối chiếu được", không bỏ qua và không làm hỏng giao diện.

Thẻ kết quả hiện nhãn đạt/không đạt từ `tool_result.outputs.verdict`, dạng `{ "pass": true, "field": "utilization", "value": 0.87 }`. Backend dựng khối này từ trường mà manifest khai báo là verdict. Tool chưa khai báo verdict thì không có khối này, và thẻ không hiện nhãn. FE không lấy nhãn từ văn bản `token`.

---

## 6. Mã HTTP và mã `error`

Hai loại lỗi **khác nhau về bản chất**, xử lý ở hai chỗ khác nhau:

- **Trước stream** — HTTP status. Body là `ApiResponse<T>` có `code`.
- **Trong stream** — HTTP đã là `200`, lỗi đến dưới dạng event `error`.

| HTTP | Khi nào | FE làm gì |
| --- | --- | --- |
| `400` | Request sai schema | Lỗi dev, không hiện cho người dùng |
| `401` | JWT thiếu hoặc hết hạn | Refresh token, thử lại một lần |
| `403` | Không có module `Assistant.Use` | Ẩn panel |
| `429 rate_limited` | Vượt sliding window | Khóa input, đếm ngược theo `Retry-After` |
| `429 concurrent_turn` | Đang có một lượt chạy dở của cùng user (AD-23) | "Đang có một câu hỏi chạy dở ở nơi khác". **Không** hiện lỗi chung |
| `429 quota_exceeded` | Hết quota token ngày | Hiện thời điểm reset kèm trong body |
| `503` | Kill switch bật, hoặc chưa ready | "Trợ lý đang tạm dừng" |
| `500` | Lỗi nội bộ | Nút Retry, nút copy `requestId` |

`error.code` trong stream: `internalServerException`, `runtimeClientError`, `validationException`, `throttled`, `quotaExceeded`. Cả `retryable` lẫn `requestId` **luôn** có mặt.

**Mọi lỗi kèm `requestId`.** Id này truy được toàn bộ lượt trong trace; người dùng copy gửi cho hỗ trợ.

---

## 7. Transport — ba cái bẫy

**Không dùng `EventSource`.** Nó không gửi được header tùy ý, nên không mang được `Authorization: Bearer`. Dùng `fetch` rồi đọc `res.body`:

```ts
const res = await fetch("/api/assistant/chat", { method: "POST", body, headers });
if (!res.ok) throw await toApiError(res); // 4xx/5xx đến TRƯỚC stream
const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
```

**BFF route phải forward stream không buffer.** nginx production cần `proxy_buffering off` cho đường này; ALB `idle_timeout` ≥ 120 giây; CloudFront không cache `/v1/chat`. Chi tiết ở [05](05-devops.md) bước 1.

Nghiệm thu chung cho cả ba đội:

```bash
curl -N -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
 -d '{"conversationId":"c-1","message":"ping","context":{}}' \
 https://<đúng tuyến production>/v1/chat
```

Event phải đến **rời rạc theo thời gian**, không dồn một cục ở cuối. Chạy qua đúng tuyến production, không chỉ localhost.

### Ngắt kết nối (AD-25)

Cái bẫy thứ ba: **ngắt kết nối không tự lan xuống backend**. Người dùng đóng tab, trình duyệt đóng kết nối tới BFF. Nhưng nếu route BFF không truyền tín hiệu hủy vào `fetch` upstream, BFF vẫn giữ kết nối tới `Assistant.Api`, và lượt chạy tới hết, tính tiền đầy đủ.

```ts
// Route BFF: truyền signal của request vào fetch upstream
const upstream = await fetch(`${ASSISTANT_URL}/v1/chat`, {
  method: "POST", body, headers, signal: req.signal,
});
```

| Ai | Phải làm |
| --- | --- |
| FE | Nút Dừng gọi `AbortController.abort()`. Hook stream nằm ở store của app, không nằm trong panel, nên đóng panel không hủy lượt |
| BFF | Truyền `req.signal` vào `fetch` upstream. **Không** tự retry `POST /v1/chat` khi lỗi mạng: mỗi lần retry là một lượt mới, tốn tiền, và có thể đụng `429 concurrent_turn` |
| Backend | Hủy lượt khi kết nối đóng, ghi message trạng thái `aborted` kèm phần chữ đã sinh ([01](01-kien-truc.md) §6.7) |

Lượt bị ngắt không phát event nào nữa, vì không còn ai nhận. FE tải lại trang thì đọc `GET /v1/conversations/{id}`: message cuối có `status: "aborted"` và phần chữ đã sinh, hiện kèm nhãn "chưa hoàn tất". **v1 không hỗ trợ nối lại stream đang chạy.**

Nghiệm thu: mở stream bằng `curl -N` qua đúng tuyến production, `Ctrl+C` sau vài event. Trace của lượt phải kết thúc trong ≤ 2 giây với trạng thái `aborted`, và không có lời gọi Bedrock nào sau thời điểm đó.

---

## 8. Output của IntentRouter — hợp đồng nội bộ

Không phơi ra FE, nhưng cả hai đội cần biết vì nó quyết định `retrieval.params`.

```jsonc
{
 "intent": "doc_qa|app_help|calc|explain_result|mixed|optimize|case_lookup|out_of_scope",
 "search_query": "string ≤ 300", // giữ NGUYÊN ngôn ngữ gốc, không dịch
 "instruction": "string ≤ 200",
 "needs_clarification": false,
 "case_hints": { // AD-16
 "tool_id": "enum sinh từ tools.manifest.yaml | null",
 "params": [{ "key": "enum similarity_keys", "value": 0.0, "unit": "enum đơn vị" }]
 }
}
```

Structured output, `temperature = 0`, `MaxTokens = 400`. Backend assert `stopReason != "max_tokens"` sau mỗi lần gọi.

Thứ tự ưu tiên nguồn tham số, cố định: **`tool_run` > `pageContext` > `case_hints`**. Ghi đè theo từng key, không theo cả khối. Key chỉ có nguồn `case_hints` mang `confirmed: false` và FE **bắt buộc** hiện thành chip sửa được.

---

## 9. Ai chặn ai

| # | Việc | Của ai | Ai đang chờ | Mức |
| --- | --- | --- | --- | --- |
| 1 | File này ở trạng thái ký được | Backend | Frontend — không dựng mock stream nếu thiếu | **Chặn** |
| 2 | OpenAPI schema của tool facade | Backend | DevOps — không tạo Gateway target nếu thiếu | **Chặn** |
| 3 | `pageContext` có `hasResult`, `resultKind`, `calcAt` | Frontend | Backend — thiếu thì intent `explain_result` không bao giờ ra | **Chặn** |
| 4 | SSE qua đúng tuyến production không bị buffer | DevOps | Cả hai đội — không nghiệm thu được gì nếu thiếu | **Chặn** |

Điểm 2 là **điểm đồng bộ cứng**: DevOps và Backend không làm song song được ở chỗ đó.

---

## 10. Luật không bao giờ vi phạm

| Không bao giờ | Vì sao |
| --- | --- |
| FE parse số từ văn bản model viết | Vô hiệu toàn bộ validator ở backend. Số luôn lấy từ `tool_result.outputs` |
| Dùng `EventSource` | Không gửi được Bearer token |
| Dùng `context` làm căn cứ phân quyền | Rò rỉ dữ liệu. Quyền chỉ đến từ JWT |
| Đổi nghĩa hoặc bỏ field của một event mà không lên `/v2` | Phá hợp đồng. Thêm field mới thì được, và FE phải bỏ qua field không biết |
| Hiện mã lỗi thô cho người dùng | Lỗi phải kèm hướng xử lý |
| Giả định lượt nào cũng có `token` | Refusal không có chữ nào, UI treo |
| Giả định `warning` đến trước chữ | Banner không chèn được |
| Lấy nhãn đạt/không đạt từ văn bản `token` | Nhãn phải đến từ verdict trong `tool_result`, vì mô hình có thể viết ngược kết quả engine |
| BFF không truyền `req.signal` xuống upstream | Người dùng đóng tab mà lượt vẫn chạy và vẫn tính tiền |
| BFF tự retry `POST /v1/chat` | Mỗi retry là một lượt mới tốn tiền |
| Bỏ qua mã `warning` không biết | Mã mới được thêm theo kiểu cộng thêm; FE phải hiện banner chung |

---

## Liên quan

| Cần gì | Đọc |
| --- | --- |
| Thiết kế đằng sau hợp đồng, state machine, quyết định | [01-kien-truc.md](01-kien-truc.md) |
| Cài phía Backend | [03-backend.md](03-backend.md) |
| Cài phía Frontend | [04-frontend.md](04-frontend.md) |
| Tầng mạng phải cho stream đi qua | [05-devops.md](05-devops.md) |
| Hồ sơ đề xuất cho lãnh đạo/CTO | [kien-truc-day-du.md](kien-truc-day-du.md) |
