# Mock `Assistant.Api` cho Frontend

Server giả lập các đường dẫn `/v1` theo hợp đồng ở `ship/02-hop-dong.md`. Frontend dựng toàn bộ panel AI trên server này trước khi Backend có endpoint nào chạy: đủ 11 sự kiện SSE, các mã lỗi HTTP đến trước luồng, lịch sử hội thoại, trình xem nguồn và trạng thái kill switch.

## Chạy

```bash
cd mock-server
pnpm install
pnpm start                      # http://localhost:8787, độ trễ thật
MOCK_DELAY_SCALE=0.2 pnpm dev   # nhanh gấp 5, tự nạp lại khi sửa mã
pnpm test                       # vitest, độ trễ 0
```

`MOCK_DELAY_SCALE=1` giữ đúng ba mốc của hợp đồng: `status` đầu tiên ≲ 300 ms, `retrieval` ≲ 1,5 s, `token` đầu tiên ≲ 3 s. Lỗi bố cục chỉ lộ ra khi chữ dài dần, nên khi soát giao diện thì giữ nguyên độ trễ thật.

## Nối vào BFF

Route BFF của Next.js trỏ `ASSISTANT_URL=http://localhost:8787`. Mock không kiểm JWT: giá trị sau `Bearer` được dùng làm mã người dùng. Có hai giá trị dành riêng:

| Token | Kết quả |
| --- | --- |
| `expired` | `401 token_expired`, để thử luồng refresh rồi gọi lại |
| `no-assistant` | `403 forbidden`, để thử việc ẩn panel |

Hai hành vi của mock cũng là hai điều route BFF phải làm đúng ở production. Đóng kết nối thì lượt bị hủy và lưu với trạng thái `aborted`. Hai lượt cùng lúc của một người dùng thì lượt sau nhận `429 concurrent_turn`. BFF không truyền `req.signal` xuống upstream thì lượt vẫn chạy tới hết sau khi tab đã đóng, và `scripts/acceptance.sh` sẽ báo lỗi.

## Chọn kịch bản

Viết `/mock:<tên>` ở bất kỳ đâu trong `message`. Chuỗi này đi nguyên trong body qua BFF. Header `x-mock-scenario: <tên>` chỉ được xét khi message không có chuỗi này. Không chỉ định gì thì mock chạy `doc-qa`.

| Tên | Chuỗi sự kiện, trạng thái cần dựng |
| --- | --- |
| `doc-qa` | `status → retrieval → token×n → citation → done`, có công thức KaTeX, citation có `bbox` |
| `app-help` | Hỏi cách dùng ứng dụng, trích từ tài liệu hướng dẫn |
| `long` | Câu trả lời dài, để thử tự cuộn và nút "Xuống câu mới nhất" |
| `refusal` | `status → refusal → done`, không có `token` nào |
| `refusal-no-basis` | Hiện nguồn gần nhất rồi từ chối |
| `error-mid-stream` | `token×3 → error` có `retryable: true` và `partial: true` |
| `error-fatal` | `status → error` có `retryable: false` |
| `warning-citation`, `warning-standard` | Banner `unverified_citation` và `standard_version_mismatch` đến sau chữ |
| `warning-unknown` | Mã `future_check_failed`, FE phải hiện banner chung |
| `degraded-routing` | Banner chế độ giảm |
| `degraded-retrieval-only` | Chỉ có danh sách nguồn, không có chữ |
| `truncated` | Chữ dở dang rồi đến `warning truncated` |
| `unknown-fields` | Mọi payload mang thêm field lạ, FE phải bỏ qua |
| `calc`, `calc-fail`, `calc-no-verdict` | Thẻ kết quả có nhãn đạt, không đạt, hoặc không có nhãn |
| `risk` | Cờ `mismatch` và `unverified` trong dòng, rồi `unverified_number` |
| `unverified-verdict` | Engine không đạt nhưng chữ viết là đạt |
| `slow-tool` | Tool chạy quá 10 giây, `status` báo tiến trình |
| `mixed` | Dòng kế hoạch trước khi tính rồi tra |
| `approval` | `approval_required`, v1.2 không phát sự kiện này nên chỉ có khi chủ động gọi |
| `case-lookup` | Chip tham số, có chip `case_hints` sửa được, dừng chờ bấm **Tra** |
| `case-lookup-insufficient` | Dưới 2 tham số |
| `case-results` | Năm case, có `use_count` và một case theo tiêu chuẩn cũ. Tự chạy khi request mang `context.caseParams` |
| `http-400`, `http-401`, `http-403`, `http-500`, `http-503` | Lỗi HTTP đến trước luồng |
| `http-429-rate` | `429` kèm `Retry-After: 30` |
| `http-429-concurrent` | `429 concurrent_turn` |
| `http-429-quota` | `429` kèm `resetAt` trong body |

## Endpoint khác

| Đường dẫn | Mock trả gì |
| --- | --- |
| `GET /v1/conversations/{id}` | Lịch sử của chủ hội thoại, message cuối `aborted` nếu lượt bị ngắt |
| `POST /v1/feedback` | `204` |
| `POST /v1/approvals/{toolRunId}` | `{ caseId }`, idempotent |
| `GET /v1/sources/{docId}?page=N` | URL có hạn 5 phút, trang và vùng tô sáng. `restricted-internal-note` trả `403` |
| `GET /v1/capabilities` | Mô hình, mô hình dự phòng, tool, phiên bản kho, kill switch |
| `/v1/admin/corpus/*` | `501 not_mocked`, trang quản trị nằm ngoài phạm vi mock |
| `POST /__mock/state` | Bật tắt `killSwitch` và `fallbackActive`, chỉ có ở mock |
| `POST /__mock/reset` | Xóa toàn bộ trạng thái, chỉ có ở mock |

## Câu hỏi mở cần hai đội ký

Hợp đồng chưa nói tới những điểm dưới đây. Mock tạm chọn một cách và đánh dấu `MOCK-ONLY` trong `src/contract.ts`. Không coi chúng là hợp đồng cho tới khi Backend và Frontend ký lại.

1. Tên field của `ApiResponse<T>`: mock dùng `success, code, message, data, requestId`.
2. Giá trị của `status.phase`: mock dùng `routing, planning, retrieving, calculating, writing`.
3. Dạng `bbox`: mock dùng `[x0, y0, x1, y1]` theo tỉ lệ trang, gốc ở góc trên bên trái.
4. Gửi lại tham số đã xác nhận khi bấm **Tra**: mock nhận `context.caseParams`.
5. Kết quả tra case: mock trả qua `tool_call find_similar_cases` rồi `tool_result.outputs.cases`. FE ghép `tool_result` với `tool_call` đứng trước nó.
6. Dưới 2 tham số: mock trả `retrieval` có một tham số rồi `done`.
7. Cờ case theo tiêu chuẩn cũ: mock thêm `isCurrentStandard`.
8. Dạng body của `GET /v1/conversations/{id}`, `POST /v1/feedback`, `GET /v1/capabilities` và `GET /v1/sources/{docId}`.
9. `/v1/admin/corpus/*`: chưa có schema, mock trả `501`.

## Nghiệm thu

```bash
MOCK_DELAY_SCALE=1 pnpm start &
./scripts/acceptance.sh
```

Script kiểm ba điều giống nghiệm thu ở §7 của hợp đồng: sự kiện đến rời rạc theo thời gian, ngắt kết nối giữa luồng thì hội thoại ghi `aborted`, và từ chối không có `token` nào. Khi chạy qua BFF, đổi `BASE` sang địa chỉ của BFF.
