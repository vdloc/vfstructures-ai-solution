# Implementation Plan: Gộp IntentRouter vào AgentCore Harness

## Tổng quan

Bỏ lời gọi Haiku 4.5 riêng ở đầu mỗi lượt. Sonnet 5 trong AgentCore Harness làm cả ba việc của router — phân loại ý định, giải đại từ, bóc `case_hints` — rồi đi thẳng vào tool loop trong cùng một lượt. Đường đi hiện tại là `ApplyGuardrail → Haiku → nhánh theo intent → Sonnet`; đường mới là `ApplyGuardrail → Harness`.

Đây là thay đổi tài liệu, không phải thay đổi mã. Mã của `Assistant.Api` chưa tồn tại, nên các task dưới đây sửa thiết kế trong `ship/` để đội backend dựng theo bản mới ngay từ đầu.

**Quyết định đã chốt bởi chủ dự án ngày 26/09/2026.** Plan này ghi lại hệ quả và các chỗ phải sửa, không mở lại quyết định.

**Chốt bổ sung cùng ngày:** không có chế độ giảm. Harness lỗi thì lượt kết thúc bằng sự kiện `error`, mã `degraded_routing` bị gỡ khỏi hợp đồng.

**Trạng thái: Task 1–5 và 7 đã thực hiện xong ngày 26/09/2026.** Task 6 còn lại, vì prompt và golden set nằm ở worktree `fe-mock-server` chưa merge.

**Spec:** `ship/01-kien-truc.md` §6.2 (sơ đồ routing), §6.4 (tool loop), §8.4 (sáu mặc định Harness), §10 (AD-15, AD-16), §11 (R44). Hợp đồng với Frontend ở `ship/02-hop-dong.md` §7–8. Chi phí ở `ship/13-chi-phi.md` §3, §5.

## Ràng buộc chung

- `ship/02-hop-dong.md` là hợp đồng hai phía và **không sửa một phía**. Mọi thay đổi ở §7 và §8 phải qua vòng ký lại với Frontend trước khi vào file.
- Bốn dãy sự kiện SSE ở §4 không đổi. Frontend không nhìn thấy router, nên việc gộp không được làm đổi thứ tự hay tên sự kiện nào.
- Mọi lệnh shell mở đầu bằng `rtk` (AGENTS.md của repo).
- Mỗi commit kết thúc bằng trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Không sửa `ship/16-huong-dan-console.md` mục J trong plan này. J mô tả bản tự dựng on-prem và không phụ thuộc quyết định này.

## Chi phí: thay đổi này làm hoá đơn tăng

Tính bằng `ship/cong-cu/cost_model.py` với đơn giá `prices-eu-central-1.json`, kịch bản Một công ty (19 800 lượt/tháng).

| Khoản | USD/tháng |
| --- | --- |
| Bỏ lời gọi Haiku riêng | −64,76 |
| Sonnet 5 gánh phần phân loại | +129,53 |
| Harness dựng phiên cho mọi lượt thay vì 33% | +4,38 |
| **Chênh** | **+69,14** |

Biến đổi 971,29 → 1 040,42 $/tháng; tổng 1 326,31 → 1 395,44 $/tháng, tức +7,1% chi phí biến đổi.

Nguyên nhân là cùng khoảng 2 380 token phân loại đó, Sonnet 5 đắt gấp đôi Haiku 4.5 (2,20 so với 1,10 $/M input), và 67% số lượt hiện không chạm Harness (`doc_qa`, `app_help`, `case_lookup`, `out_of_scope`) nay đều phải dựng phiên. Khoản tăng được đổi lấy việc bỏ 300–500 ms khỏi thời gian tới chữ đầu tiên và bớt một thành phần phải vận hành.

## Quyết định kiến trúc

- **AD-15 viết lại chứ không xoá.** Tinh thần cũ là "mọi lượt qua một lần phân loại bằng mô hình, luật chỉ là fallback". Tinh thần đó giữ nguyên; chỗ đổi là lần phân loại ấy nằm trong Harness và do Sonnet 5 làm.
- **Mất đường lùi, và đây là cái giá lớn nhất.** Hiện router hỏng thì luật nhanh gánh, lượt vẫn chạy, cờ `degraded_routing` báo cho người dùng. Gộp rồi thì phân loại và trả lời cùng nằm trên Harness: Harness hỏng là hỏng cả lượt, không còn chế độ giảm. R44 không biến mất mà đổi bản chất, từ "một mô hình nhỏ là điểm chết đơn" thành "một dịch vụ là điểm chết đơn".
- **`maxIterations` không đặt theo intent được nữa.** §8.4 hiện đặt 5 vòng cho `explain_result` và 7 cho `calc`, `mixed`; nhưng intent chỉ biết được sau khi vòng lặp đã bắt đầu. Plan này chọn **một trần chung là 7**, vì 7 là trần cao nhất đang dùng và hạ trần giữa chừng không có đường làm trên Harness. Hệ quả: lượt `explain_result` mất phanh 5 vòng.
- **`timeoutSeconds` chọn 90 giây cho mọi lượt**, cùng lý do.
- **Prompt router thành một phần của system prompt Harness.** `prompts/intent-router.v1.txt` không bị xoá; nội dung của nó chuyển vào prompt Harness và giữ nguyên cách đánh version.
- **Đo lại từ đầu.** Số 96,7% đo ngày 26/09/2026 là của Sonnet 5 chạy prompt router đứng một mình, không có tool. Cấu hình mới có tool trong ngữ cảnh, nên con số đó không mang sang được.

## Cái phải giữ nguyên

Ba thứ dễ mất khi gộp, và mất thì không có lỗi nào báo ra:

- **Thứ tự nguồn tham số `tool_run` > `pageContext` > `case_hints`**, ghi đè theo từng key chứ không theo cả khối (AD-16). Đây là mã của `ChatOrchestrator`, không phải việc của mô hình.
- **Chip xác nhận cho key chỉ đến từ `case_hints`.** R45 xếp V/C: bóc sai tham số thì kỹ sư nhận tiền lệ sai mà câu trả lời không để lại dấu vết nào. Chip là hàng rào duy nhất ở chỗ đó, và nó không phụ thuộc router nằm ở đâu.
- **Regex bóc mã điều khoản** ở bước 3 của `ship/03-backend.md`. Nó phục vụ ClauseResolver ở bước 4, không phục vụ routing, nên việc gộp không đụng tới nó.
- **`ApplyGuardrail` trên câu hỏi chạy trước Harness.** Lượt bị chặn ở đây (5% theo MIX) không được dựng phiên Harness và không gọi mô hình nào.

## ✅ Task 1 — Sơ đồ và quyết định trong `01-kien-truc.md`

**Mô tả:** Đây là file gốc; mọi file khác trích từ đây, nên sửa trước.

- [x] §6.2: vẽ lại sơ đồ routing. Nhánh `Haiku → intent → bốn đường` thay bằng một khối Harness làm cả phân loại lẫn thực thi. Nhánh `FB` (fallback luật nhanh) bỏ khỏi sơ đồ.
- [x] §6.2: khối "Hợp đồng đầu ra của router" giữ lại nguyên hình dạng JSON, nhưng đổi nhãn thành cấu trúc nội bộ của vòng đầu Harness.
- [x] §6.4: sơ đồ tool loop thêm bước phân loại vào đầu, trước `Sonnet 5 phát toolUse`.
- [x] §8.4: dòng `maxIterations` đổi thành một trần chung 7; dòng `timeoutSeconds` đổi thành 90. Ghi rõ lý do là intent chưa biết lúc đặt trần.
- [x] §10 AD-15: viết lại phần "Quyết định" và "Đánh đổi". Đánh đổi mới gồm: mất `degraded_routing`, mất trần theo intent, +69,14 $/tháng, bớt 300–500 ms.
- [x] §10 AD-16: giữ nguyên thứ tự ưu tiên tham số; đổi chủ ngữ từ IntentRouter sang vòng đầu của Harness.
- [x] §11 R44: viết lại theo hướng "một dịch vụ là điểm chết đơn", bỏ câu về mốc EOL của Haiku, thêm việc phải có cho trường hợp Harness hỏng.
- [x] Bảng §5 dòng `Routing` (dòng 224): đổi mô tả.

**File:** `ship/01-kien-truc.md`

**Quy mô:** L

## 🟡 Task 2 — Hợp đồng với Frontend

**Mô tả:** Hai chỗ trong `02-hop-dong.md` nói về router. File này **không sửa một phía**, nên task này dừng ở bản đề xuất cho tới khi Frontend ký.

- [x] §8: đổi tiêu đề và phần mở. Hình dạng JSON giữ nguyên vì `retrieval.params` vẫn phụ thuộc nó.
- [x] §8: câu "Structured output, `temperature = 0`, `MaxTokens = 400`" không còn đúng khi phần này nằm trong tool loop của Sonnet. Viết lại theo cấu hình thật.
- [x] §7 bảng mã cảnh báo: `degraded_routing` **bỏ hẳn**, đã gỡ khỏi bảng và thay bằng ghi chú "Gỡ ở v1.2". Frontend phải gỡ nhánh xử lý; mock server ở `plans/2026-09-25-fe-mock-server.md` phải bỏ mã này khỏi danh sách mã `warning`.
- [x] §9 bảng "Ai chặn ai" dòng 3: `pageContext` nay phải tới được Harness chứ không tới router. Kiểm lại câu chữ.
- [ ] Đưa bản đã sửa vào vòng ký lại với Frontend. **Đã ghi vào `02` theo chỉ đạo của chủ dự án, nhưng Frontend chưa xác nhận** — đây là thay đổi breaking với bên đang đọc mã `degraded_routing`.

**File:** `ship/02-hop-dong.md` (chờ ký)

**Quy mô:** M

### Checkpoint: Frontend đã ký
- [ ] `degraded_routing` đã chốt: bỏ hay đổi nghĩa
- [ ] Mock server có cần sửa không, và nếu có thì sửa gì

## ✅ Task 3 — Backend

**Mô tả:** `03-backend.md` bước 3 hiện là một bước riêng. Bước này nhập vào bước tool loop.

- [x] §Bước 3 — Routing: viết lại thành một mục con của bước gọi Harness, hoặc gộp thẳng vào bước đó.
- [x] Dòng 141 (fallback khi Haiku lỗi) và dòng 147 (`MaxTokens` 300–400, assert `stopReason`): hai câu này không còn đối tượng. Thay bằng cách xử lý khi Harness lỗi.
- [x] Dòng 142 và 158: **giữ nguyên**, vì regex bóc mã điều khoản phục vụ ClauseResolver.
- [x] Bảng thuật ngữ dòng 52: đổi định nghĩa `IntentRouter`, hoặc bỏ mục này và thêm mục mô tả vòng đầu của Harness.
- [x] `ship/14-chi-tiet-backend.md` dòng 35: cây thư mục bỏ `IntentRouter` khỏi `Chat/`.
- [x] `ship/14-chi-tiet-backend.md` dòng 253: đoạn mã mẫu `_router.RouteAsync(...)` viết lại theo đường mới.

**File:** `ship/03-backend.md`, `ship/14-chi-tiet-backend.md`

**Quy mô:** M

## ✅ Task 4 — Chi phí

**Mô tả:** `cost_model.py` đang mô hình hoá router là một khoản riêng. Sửa mô hình trước, rồi mới sửa số trong tài liệu.

- [x] `cost_model.py`: `router_cost()` chuyển sang giá Sonnet 5, hoặc gộp vào `tool_loop`.
- [x] `cost_model.py`: `turn_cost()` cho `doc_qa`, `app_help`, `case_lookup`, `out_of_scope` nay có chi phí runtime AgentCore.
- [x] `ship/13-chi-phi.md` dòng 40: bảng token, dòng "Router (bước 5) | Haiku 4.5" đổi model và đổi ghi chú về cache.
- [x] `ship/13-chi-phi.md` §5: chạy lại mô hình, thay ba bảng kịch bản.
- [x] `ship/13-chi-phi.md` §6 độ nhạy: thêm dòng so sánh hai phương án router, để quyết định này có số đứng cạnh.
- [x] `ship/13-chi-phi.md` mục "Chưa rõ": thêm dòng **cách tính phiên AgentCore Runtime** — tính theo đồng hồ treo tường của phiên hay chỉ lúc chạy thật. `05-devops.md` §2A nói Runtime v2 chỉ tính theo mức tiêu thụ thật; `16` §E.4 lại tính đủ 20 giây mỗi lượt và ra 11,92 $/tháng, còn `cost_model.py` ra 2,33 $. Lệch khoảng 5 lần, và câu trả lời quyết định con số của chính thay đổi này.
- [x] `ship/16-huong-dan-console.md` §E.4: đồng bộ với `cost_model.py` sau khi chốt cách tính phiên.

**File:** `ship/cong-cu/cost_model.py`, `ship/13-chi-phi.md`, `ship/16-huong-dan-console.md`

**Quy mô:** M

## ✅ Task 5 — Console và vận hành

- [x] `ship/16-huong-dan-console.md` §E.1: bảng Advanced configurations đổi **Max Iterations** thành một trần chung 7 và **Timeout duration** thành 90 giây, kèm lý do.
- [x] `ship/05-devops.md` §4B: hai con số cảnh báo đổi theo.
- [x] `ship/05-devops.md`: cảnh báo CloudWatch trên tỉ lệ `degraded_routing` (việc phải làm của R44) đổi sang chỉ số mới.

**File:** `ship/16-huong-dan-console.md`, `ship/05-devops.md`

**Quy mô:** S

## ⬜ Task 6 — Prompt và đo lại

Prompt và golden set hiện chỉ có ở worktree `fe-mock-server` và chưa vào `master`. Task này chạy được ở đó, hoặc sau khi nhánh ấy merge.

- [ ] `prompts/intent-router.v1.txt`: chuyển nội dung vào prompt hệ thống của Harness. Giữ ba thẻ `<history>`, `<page_context>`, `<question>` vì chúng là lớp chống chèn lệnh.
- [ ] `prompts/intent-router.v1.notes.md`: bảng "Backend phải làm khớp" viết lại; mục "Kiểm đã chạy" ghi rõ số cũ đo trên cấu hình nào và vì sao không mang sang được.
- [ ] Chạy lại golden set trên cấu hình mới, có tool trong ngữ cảnh. So với đường cơ sở 96,7% (Sonnet 5, không tool) và 91,9% (Haiku 4.5, không tool), đo ngày 26/09/2026 trên 123 câu `review_status: draft`.
- [ ] `ship/08-eval-quan-sat.md` dòng 219: span `router.classify (Haiku)` đổi tên và đổi vị trí trong cây span.

**File:** `prompts/` và `eval/golden/` (hiện nằm ở worktree `fe-mock-server`, chưa commit vào `master`), `ship/08-eval-quan-sat.md`

**Quy mô:** M

## ✅ Task 7 — Các chỗ nhắc tên còn lại

- [x] `ship/11-thuyet-minh.md` §"Thành phần gọi là IntentRouter" (khoảng dòng 208–220): viết lại cho người không chuyên. Đoạn này giải thích ba việc của router và nói luật cứng là fallback; cả hai ý đều đổi.
- [x] `ship/12-tra-case.md` §4: sơ đồ "Bước 5 · IntentRouter (Haiku)" đổi nhãn.
- [x] `ship/07-giao-dien.md` dòng 207: câu "`case_hints` do router bóc ra" đổi chủ ngữ. **Hành vi chip không đổi.**
- [x] `ship/00-thuat-ngu-va-nguon.md`: mục thuật ngữ và câu hỏi mở về ngưỡng cache 4 096 token của Haiku. Câu hỏi này **đóng lại** vì không còn lời gọi Haiku; nhưng câu hỏi tương ứng cho Sonnet trong Harness thì mở ra, và nó đã nằm sẵn trong mục "Chưa rõ" của `13`.
- [x] `ship/audit-nguon-quyet-dinh.md` dòng 28: dòng AD-15 đổi mô tả.
- [x] `ship/10-rui-ro.md` R44: đồng bộ với `01` §11. R45 **không đổi**.

**File:** sáu file trên

**Quy mô:** M

### Checkpoint: Hoàn tất
- [x] `rtk grep -rn "IntentRouter" ship/ prompts/` chỉ còn các chỗ cố ý giữ lại
- [x] `rtk grep -rn "degraded_routing" ship/` khớp với quyết định ở Task 2
- [x] `cost_model.py` chạy được, số trong `13` khớp với output
- [x] Sẵn sàng review

## Rủi ro và cách giảm

| Rủi ro | Mức | Cách giảm |
| --- | --- | --- |
| Mất `degraded_routing` mà không có gì thay thế: Harness hỏng là hỏng cả lượt | Cao | Task 1 phải ghi việc phải làm cho trường hợp Harness hỏng trước khi đóng R44. Một đường lùi tối thiểu là trả lời bằng đường RAG cố định, bỏ tool |
| Trần chung 7 vòng làm lượt `explain_result` chạy quá số vòng cần | Trung bình | Đo số vòng thật theo intent trong `audit_event`; nếu `explain_result` thường xuyên chạm 6–7 thì xem lại |
| Sửa `02-hop-dong.md` một phía | Cao | Task 2 dừng ở bản đề xuất; có chữ ký Frontend mới commit |
| Chi phí tăng 69 $/tháng bị quên khi trình bày | Trung bình | Số nằm ngay đầu plan và trong `13` §6; không để rải rác |
| Bóc `case_hints` kém đi khi phần này nằm chung ngữ cảnh với tool | Trung bình | Golden set có nhóm đo riêng độ chính xác bóc tham số (R45); chạy trước khi chốt |
| Prompt Harness phình lên vì gánh thêm ~2 100 token của router | Trung bình | Đo `cacheReadInputTokens`; phần tĩnh của Harness vốn đã là khoản caching lớn nhất (−185 $/tháng nếu bật được) |

## Câu hỏi mở

- Có chấp nhận chạy hẳn không có đường lùi, hay dựng một đường tối thiểu (trả lời bằng RAG cố định, bỏ tool)? Hiện chốt là không có đường lùi; R44 ghi nhận đây là câu còn mở.
- Trần 7 vòng chung có đủ cho `optimize` khi vòng đầu nay tiêu một phần vào việc phân loại?
- AgentCore Runtime tính tiền theo đồng hồ treo tường của phiên hay chỉ lúc chạy thật? Ba nguồn trong repo đang nói lệch nhau (Task 4).
- Số 96,7% đo được có phải đường cơ sở hợp lệ để so không, khi bộ golden set còn ở `review_status: draft` toàn bộ?
