# 22 · Thuyết minh kiến trúc

> **Đã cập nhật trong `ship/`.** File này có bản đã sửa nguồn và ngày fetch: xem `ship/11-thuyet-minh.md` (bản chính thức, giống nội dung file này sau lượt rà soát 21/09/2026) và `ship/00-thuat-ngu-va-nguon.md` (bảng nguồn đầy đủ).

**Nội dung:** chỉ kiến trúc và luồng xử lý.
**Người đọc:** không cần biết gì về AI từ trước. Mọi thuật ngữ được giải thích ngay lần đầu gặp, và giữ nguyên tên tiếng Anh để sau này đọc tài liệu kỹ thuật không bị lạc.

---

## Phần 0 · Ba thứ cần hiểu trước

Ba khái niệm này quay đi quay lại trong toàn bộ tài liệu. Hiểu ba cái này rồi thì phần còn lại đọc trôi.

### LLM — bộ máy đoán chữ

**LLM** (large language model, mô hình ngôn ngữ lớn) là thứ mọi người gọi chung là "AI". Cách nó hoạt động đơn giản đến bất ngờ: đưa vào một đoạn chữ, nó đoán chữ tiếp theo là gì, rồi đoán tiếp chữ sau nữa, cứ thế thành câu, thành đoạn.

Nó học từ một lượng văn bản khổng lồ nên đoán rất hợp lý, đến mức đọc như người viết. Nhưng bản chất vẫn là **đoán**.

Điều quan trọng nhất phải nhớ: **nó đoán, nó không tra cứu và nó không tính toán**. Hỏi nó 17 × 23 thì nó không nhân — nó đoán xem chuỗi chữ nào hay đứng sau câu hỏi đó. Thường đoán đúng, vì phép nhân đó xuất hiện nhiều trong dữ liệu nó học. Nhưng nếu hỏi một phép tính lạ, nó vẫn trả về một con số trông rất tự tin, và con số đó có thể sai.

Toàn bộ kiến trúc này xây quanh đúng một sự thật đó.

### Hallucination — bịa ra một cách trôi chảy

Vì LLM đoán, nên khi nó không biết, nó **vẫn đoán**. Và vì nó đoán giỏi, cái nó bịa ra nghe rất thật. Hiện tượng này gọi là **hallucination** (ảo giác).

Trong ngữ cảnh kết cấu, nó có thể bịa ra một điều khoản không tồn tại trong tiêu chuẩn, hoặc bịa ra một hệ số trông đúng dạng. Vấn đề không phải ở chỗ nó sai — mọi phần mềm đều có lỗi. Vấn đề ở chỗ nó sai **mà trông không giống đang sai**.

Phần lớn những thứ phức tạp trong kiến trúc dưới đây tồn tại chỉ để chặn chuyện này.

### Prompt và token — cách nói chuyện với LLM và cách tính tiền

**Prompt** là toàn bộ đoạn chữ mình đưa cho LLM: câu hỏi của người dùng, cộng với mọi thứ mình muốn nó biết trước khi trả lời — quy tắc, tài liệu tham khảo, lịch sử hội thoại.

Có một cám dỗ rất lớn: viết trong prompt câu "đừng bịa nhé, chỉ trả lời dựa trên tài liệu tôi đưa". Câu đó **có tác dụng**, nhưng nó không phải một biện pháp kiểm soát. Nó là một lời khuyên, và lời khuyên thì lách được — người dùng có thể viết câu hỏi khiến mô hình bỏ qua nó, hoặc chính tài liệu đưa vào có thể chứa chỉ dẫn ngược lại.

Biện pháp kiểm soát thật phải nằm ở **mã mình viết, bên ngoài mô hình**. Nguyên tắc này sẽ xuất hiện lại nhiều lần.

**Token** là đơn vị LLM đọc và viết. Nó không đọc theo chữ cái, cũng không hẳn theo từ, mà theo mẩu nhỏ — một token cỡ ba phần tư một từ. Chi tiết này quan trọng vì **tiền tính theo token**, cả token đưa vào lẫn token trả ra. Nên mỗi lần quyết định nhét thêm gì vào prompt là một quyết định có giá, không phải một lựa chọn miễn phí.

Có một chỗ dễ hiểu nhầm, và nó ảnh hưởng thật tới thiết kế. **Tiền** và **hạn mức tốc độ** là hai thứ khác nhau. Tiền tính theo số token dùng thật. Hạn mức tốc độ thì AWS tính theo một hệ số gọi là *burndown* — với mô hình trả lời mình chọn, **một token viết ra ăn mười token khỏi hạn mức**. Nghĩa là một câu trả lời nghìn chữ tốn tiền bằng nghìn token nhưng ăn mười nghìn token hạn mức.

Hệ quả thực tế: một hệ thống ít người dùng vẫn có thể chạm trần tốc độ và bị AWS từ chối, trong khi hóa đơn vẫn nhỏ. Đây là lý do tài liệu kỹ thuật bắt đặt tường minh giới hạn độ dài câu trả lời cho **mọi** lời gọi — bỏ trống thì AWS giữ chỗ hạn mức theo trần tối đa của mô hình ngay từ lúc bắt đầu request.

---

## Phần 1 · Hệ thống gồm những khối nào

Sáu khối. Bốn khối là phần mềm mình viết hoặc đã có, hai khối là dịch vụ thuê của Amazon.

```
        ┌──────────────┐
        │  Panel AI    │  giao diện, nằm trong vfstructures-app
        └──────┬───────┘
               │
        ┌──────▼─────────────────────┐
        │     Assistant.Api          │  ← trung tâm, điều phối mọi thứ
        └──┬────────┬─────────┬──────┘
           │        │         │
    ┌──────▼──┐  ┌──▼──────┐ │      ┌──────────────────┐
    │PostgreSQL│ │ Bedrock │ └─────▶│    AgentCore     │
    │          │ │ Runtime │        │  (vòng gọi hàm)  │
    └──────────┘ └─────────┘        └────────┬─────────┘
                                             │
                 ┌──────────────┐   ┌────────▼─────────┐
                 │ Bedrock MKB  │   │  Tool facade     │
                 │ (kho tài liệu)│  └────────┬─────────┘
                 └──────▲───────┘            │
                        │            ┌───────▼────────┐
                 ┌──────┴───────┐    │   Main API     │
                 │      S3      │    │  + engine .NET │
                 └──────▲───────┘    └────────────────┘
                        │
              ┌─────────┴────────┐
              │ Assistant.Worker │  chạy nền, không liên quan lượt hỏi
              └──────────────────┘
```

### Panel AI

Giao diện chat, **nằm bên trong ứng dụng tính toán hiện tại**, không phải một trang riêng. Đây là lựa chọn có chủ ý: kỹ sư đang mở trang tính một dầm thì panel nằm ngay cạnh, và nó **biết** người dùng đang nhìn dầm nào. Chi tiết đó về sau hóa ra rất quan trọng.

### `Assistant.Api`

Service .NET 8 mới, là trung tâm của kiến trúc. Nó không tự làm việc gì đặc biệt — việc của nó là **điều phối**: nhận câu hỏi, kiểm tra người hỏi có quyền gì, quyết định câu hỏi này thuộc loại nào, đi tìm căn cứ, gọi mô hình, kiểm lại kết quả, rồi đẩy chữ ra màn hình.

Hình dung nó như một thư ký: không phải chuyên gia về thứ gì, nhưng biết ai làm việc gì và đi hỏi đúng người.

### `Assistant.Worker`

Một tiến trình chạy nền, **hoàn toàn tách khỏi lượt hỏi đáp**. Việc của nó là chuẩn bị kho tài liệu: đọc file PDF tiêu chuẩn, cắt thành từng mảnh, gắn nhãn cho từng mảnh, rồi đẩy lên kho.

Lúc kỹ sư hỏi thì Worker không chạy. Lúc Worker chạy thì không ai đang chờ. Hai việc này tách ra để cái chậm không làm chậm cái nhanh.

### Bedrock Runtime

**Amazon Bedrock** là dịch vụ của AWS cho phép gọi nhiều loại mô hình AI qua một cổng chung. Không phải mua máy chủ, không phải cài mô hình — gọi API, trả tiền theo token.

Mình dùng các mô hình Claude của Anthropic chạy trên đó, đặt tại Frankfurt.

### Bedrock Managed Knowledge Base

Viết tắt **MKB**. Đây là phần của Bedrock lo trọn gói kho tài liệu: nhận file, tự biến thành dạng máy tìm được, tự lưu, và tự tìm khi mình gọi.

Giải thích kỹ ở Phần 3. Điều cần nhớ bây giờ: **mình không tự dựng và không tự vận hành cái kho đó**.

### PostgreSQL

Cơ sở dữ liệu quan hệ thông thường. Nó giữ những thứ có cấu trúc rõ ràng: nội dung hội thoại, bản ghi mỗi lần chạy engine tính toán, kho kinh nghiệm đã được duyệt, nhật ký kiểm toán, và một bảng nhỏ để tra mã điều khoản.

Nó **không** giữ phần tìm kiếm ngữ nghĩa — phần đó ở MKB.

### Tool facade và Main API

`Main API` là hệ thống hiện tại, chứa engine tính toán .NET đã chạy nhiều năm. **Kiến trúc này không sửa một dòng nào trong đó.**

`Tool facade` là một service nhỏ đứng giữa, làm nhiệm vụ gác cổng — sẽ nói ở Phần 4.

---

## Phần 2 · Ba loại dữ liệu, ba cách xử lý khác nhau

Hệ thống làm việc với ba loại dữ liệu. Mỗi loại có đặc tính khác nhau, nên được xử lý bằng cơ chế khác nhau. Đây là cấu trúc nền của cả kiến trúc.

| Loại | Ví dụ | Đặc tính | Cơ chế |
| --- | --- | --- | --- |
| **Tài liệu tiêu chuẩn** | NF EN, DTU, hướng dẫn nội bộ | Chữ, không cấu trúc, rất nhiều | `retrieval` — tìm theo nghĩa |
| **Kết quả tính toán** | Sức kháng cắt của dầm B12 | Con số, có cấu trúc, phải chính xác tuyệt đối | `tool calling` — gọi engine |
| **Kinh nghiệm nội bộ** | Bài toán tương tự đã xử lý | Tham số số học có cấu trúc | Lọc SQL + chấm điểm khoảng cách |

Ba nhánh này tách nhau hoàn toàn. Một câu hỏi rơi vào nhánh nào thì đi theo đường đó.

Lý do tách: nếu gộp lại và bảo LLM tự xoay xở thì nó sẽ tự xoay xở — và khi nó xoay xở sai, không có chỗ nào để bắt lỗi.

---

## Phần 3 · Một lượt hỏi đi qua những gì

Bám theo một câu hỏi thật. Kỹ sư đang mở trang tính một dầm bê tông, gõ vào panel:

> *"Cốt đai tối thiểu cho dầm này theo tiêu chuẩn nào?"*

### Bước 1 — Vào cửa

Câu hỏi đi từ trình duyệt qua một lớp trung gian của Next.js gọi là **BFF** (backend for frontend), rồi mới tới `Assistant.Api`.

BFF là một proxy đứng giữa. Nó tồn tại để **trình duyệt không phải cầm khóa bí mật nào** — mọi thông tin xác thực nằm ở server, trình duyệt chỉ có một cookie không đọc được bằng JavaScript.

Tới `Assistant.Api`, ba cổng kiểm chạy theo đúng thứ tự này:

```
rate limit  →  xác thực  →  quota ngày
 (rẻ nhất)                   (đắt nhất)
```

- **Rate limit** — người này có đang gửi quá nhanh không.
- **Xác thực** — thẻ đăng nhập (JWT) còn hạn và đúng người không.
- **Quota** — hôm nay đã dùng hết hạn mức chưa.

Thứ tự này **không đổi được**, và lý do đáng để dừng lại một chút. Nếu đặt quota trước rate limit, thì một request đã bị chặn vì gửi quá nhanh **vẫn bị trừ quota**. Người dùng mất hạn mức cho một lượt chưa bao giờ được phục vụ. Lỗi này rất khó phát hiện vì mọi thứ khác vẫn chạy đúng.

Ba cổng này tốn gần như không đồng nào, nên đặt trước để câu hỏi rác không bao giờ chạm tới Bedrock — chỗ tính tiền.

Còn một cổng nữa: **giới hạn một lượt đang chạy trên mỗi người dùng**. Khóa ô nhập trên giao diện chỉ khóa trong một tab; mở mười tab là mười lượt song song. Nên server giữ một bản ghi "user này đang có lượt chạy dở", và lượt thứ hai bị từ chối thẳng.

### Bước 2 — Ba việc chạy song song

Ba việc dưới đây không phụ thuộc nhau, nên chạy cùng lúc thay vì xếp hàng. Tổng thời gian bằng việc chậm nhất, khoảng ba phần mười giây, thay vì bằng tổng ba việc.

**Việc một — lấy phạm vi đọc.** Hệ thống hỏi: người này được đọc những tài liệu nào? Kết quả là một danh sách kiểu `public`, `org:42`, `project:7` — nghĩa là tài liệu công khai, tài liệu thuộc công ty khách hàng số 42, và tài liệu thuộc dự án số 7. Danh sách này giữ tạm trong bộ nhớ 60 giây để không phải hỏi lại mỗi lượt.

**Việc hai — lọc nội dung đầu vào.** Câu hỏi đi qua **Guardrails**, bộ lọc nội dung có sẵn của Bedrock. Nó bắt những thứ như người dùng cố dụ mô hình phá luật, hoặc hỏi chuyện hoàn toàn ngoài phạm vi.

**Việc ba — đọc lịch sử.** Lấy ba lượt hội thoại gần nhất. Không lấy toàn bộ, vì lịch sử ở đây chỉ phục vụ đúng một việc — hiểu người dùng đang nói về cái gì — và việc đó hiếm khi cần nhìn xa hơn vài lượt. Lịch sử dài hơn thì tốn tiền mỗi lượt mà không giúp gì thêm.

### Bước 3 — Phân loại ý định

Đây là bước đáng nói nhất, và là bước nhiều người sẽ hỏi "sao phải phức tạp thế".

Câu hỏi được đưa cho một mô hình **nhỏ, nhanh, rẻ** — Claude Haiku. Việc của nó không phải trả lời, mà là **hiểu câu hỏi thuộc loại nào** và trả về một khối JSON có cấu trúc chặt:

```json
{
  "intent": "doc_qa",
  "search_query": "hàm lượng cốt đai tối thiểu dầm bê tông",
  "case_hints": { "tool_id": null, "params": [] }
}
```

Thành phần gọi là **IntentRouter**. Nó làm ba việc trong một lần gọi.

**Một — phân loại.** Câu hỏi rơi vào một trong tám nhóm: hỏi tài liệu, hỏi cách dùng phần mềm, yêu cầu tính, giải thích kết quả đang hiện trên màn hình, câu hỏi hỗn hợp, xin gợi ý phương án, tra tình huống tương tự, hoặc ngoài phạm vi.

**Hai — giải đại từ.** Người dùng hỏi *"nó có đạt không?"*. Chữ "nó" là gì? Nếu đem nguyên câu đó đi tìm tài liệu thì tìm ra rác. IntentRouter nhìn ba lượt trước và viết lại thành *"dầm B12 tiết diện 300×600 có đạt điều kiện cắt không"*. **Câu viết lại mới là câu đi tìm.**

**Ba — bóc tham số.** Câu *"dầm nhịp 8 mét, bê tông C30/37, có case tương tự không?"* thì nó bóc ra: nhịp = 8 mét, mác bê tông = C30/37. Khối này gọi là `case_hints`, dùng cho nhánh kinh nghiệm.

Có một lựa chọn kiến trúc ở đây đáng giải thích. Ban đầu thiết kế có một bộ **luật cứng** chạy trước: hễ câu hỏi chứa một dãy số dạng điều khoản thì đi thẳng nhánh tài liệu, khỏi gọi mô hình. Nhanh hơn, rẻ hơn.

Luật đó đã bị **bỏ khỏi đường chính**. Lý do: nó phân loại sai đúng loại câu hỏi hay gặp nhất. Câu *"6.2.2 tôi tính rồi, dầm B12 có đạt không?"* có số hiệu điều khoản nên luật ép nó thành câu hỏi tra tài liệu, trong khi ý người dùng là hỏi về kết quả. Và giữ cả hai bộ phân loại song song thì thành hai thứ phải kiểm thử, có thể mâu thuẫn nhau.

Luật cứng vẫn còn, nhưng chỉ làm **fallback** — đường dự phòng khi IntentRouter lỗi. Lượt chạy bằng fallback được đánh dấu bằng một cờ, để giao diện hiện rõ là lượt này chạy ở chế độ giảm.

### Bước 4 — Rẽ nhánh

```
doc_qa, app_help                     →  Phần 4: nhánh tài liệu
calc, mixed, optimize, explain_result →  Phần 5: nhánh gọi hàm
case_lookup                          →  Phần 6: nhánh kinh nghiệm
out_of_scope                         →  từ chối ngay, không gọi mô hình nào
```

---

## Phần 4 · Nhánh tài liệu

Ý định là hỏi tài liệu. Giờ phải tìm đúng đoạn trong hàng nghìn trang PDF tiếng Pháp.

### RAG — ý tưởng nền

**RAG** viết tắt của *retrieval-augmented generation*, tạm hiểu là "sinh câu trả lời có kèm truy xuất". Ý tưởng đơn giản: **đừng bắt mô hình nhớ tiêu chuẩn**.

Thay vào đó, khi có câu hỏi thì đi tìm vài đoạn tài liệu liên quan nhất, dán chúng vào prompt, rồi bảo mô hình: *"chỉ được trả lời dựa trên mấy đoạn này, và phải ghi rõ lấy từ đoạn nào"*.

Hai lợi ích lớn. Thứ nhất, sửa tài liệu là sửa kho — không phải huấn luyện lại mô hình. Thứ hai, và quan trọng hơn: câu trả lời **kiểm tra được**, vì mỗi khẳng định có một đường dẫn về đoạn tài liệu gốc.

### Vector và embedding — giải thích không dùng toán

Máy không hiểu nghĩa của chữ. Nên có một kỹ thuật biến mỗi đoạn văn thành một dãy số — thường một nghìn hoặc một nghìn rưỡi con số. Dãy số đó gọi là **vector**, và việc biến chữ thành vector gọi là **embedding**.

Điều đặc biệt: dãy số đó **mang nghĩa**. Hai đoạn văn nói cùng một chuyện thì hai dãy số nằm gần nhau, kể cả khi dùng từ hoàn toàn khác nhau. *"Cốt thép tối thiểu"*, *"hàm lượng cốt thép nhỏ nhất"* và *"armature minimale"* — ba cách nói, ba dãy số sát nhau.

Hình dung như một tấm bản đồ khổng lồ: mỗi đoạn văn là một điểm, đoạn nào nói cùng chủ đề thì đứng gần nhau. Tìm kiếm trở thành: biến câu hỏi thành một điểm trên bản đồ đó, rồi nhặt những điểm quanh chỗ nó rơi.

Chỗ chứa và tìm những điểm đó gọi là **vector store**.

### Quyết định: không tự dựng vector store

Mình dùng **Bedrock Managed Knowledge Base**. Nó lo trọn: nhận tài liệu, tự sinh embedding, tự lưu, tự tìm. Không dựng, không chỉnh tham số, không vận hành.

Cái được: bỏ hẳn một mảng việc vận hành khỏi vai đội hạ tầng. Và khi tra tài liệu AWS trực tiếp thì được nhiều hơn dự tính — dịch vụ này còn kèm sẵn một bước **chấm lại kết quả tìm**, không tính thêm tiền, và cách tìm của nó **luôn là hybrid**: kết hợp cả tìm theo nghĩa lẫn tìm theo từ khóa, không có tùy chọn chỉ tìm theo nghĩa. Hai thứ đó thiết kế ban đầu định tự làm và định trả tiền riêng. Bước chấm lại có sẵn chỉ dùng được khi Knowledge Base dùng embedding do AWS quản (xem Phần 11). Còn phải đo xem nó có đủ tốt không.

Cái trả giá, và đây là điểm quan trọng nhất trong cả kiến trúc này:

> **Lọc quyền chuyển từ một mệnh đề trong câu lệnh SQL thành một tham số của lời gọi API.**

Cần giải thích kỹ. Trước đây, câu lệnh tìm kiếm viết bằng SQL và có một mệnh đề `WHERE scope_key = ANY(...)` nằm **chung một câu** với phần tìm kiếm. Quên viết mệnh đề đó là chuyện gần như không làm được — quên thì câu lệnh sai và lỗi hiện ngay.

Bây giờ nó là một tham số truyền vào hàm `Retrieve`. Gọi hàm mà **quên truyền tham số lọc** thì hàm vẫn chạy, vẫn trả về kết quả đúng định dạng, không có lỗi nào — chỉ là nó trả về tài liệu của **mọi công ty khách hàng**. Lỗi không kêu một tiếng.

#### Vì sao SQL an toàn hơn: Row-Level Security

Trong SQL, có thêm một lớp bảo vệ nằm **ngay trong database**, gọi là **Row-Level Security** (RLS). RLS là tính năng có sẵn của PostgreSQL. Ta bật RLS trên table, rồi khai một **policy** nói dòng nào user được thấy:

```sql
ALTER TABLE chunk ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunk FORCE ROW LEVEL SECURITY;

CREATE POLICY scope_isolation ON chunk
  USING (scope_key = ANY (string_to_array(current_setting('app.scopes'), ',')));
```

Trong mỗi transaction, ứng dụng gán danh sách scope của user:

```sql
SELECT set_config('app.scopes', 'public,org:42,project:7', true);  -- true = chỉ có hiệu lực trong transaction này
```

Từ đó database tự thêm điều kiện của policy vào **mọi** query tới table này. `SELECT * FROM chunk` không có `WHERE` vẫn chỉ trả về dòng nằm trong scope của user. Code ứng dụng có quên lọc thì database vẫn lọc thay.

Có bốn điều kiện để RLS giữ đúng lời hứa đó. Cả bốn đều lấy từ tài liệu PostgreSQL:

- **Superuser và role có `BYPASSRLS` luôn bỏ qua RLS.** Role của ứng dụng không được thuộc hai loại này.
- **Owner của table cũng bỏ qua RLS**, trừ khi chạy `ALTER TABLE ... FORCE ROW LEVEL SECURITY`. Vì vậy ví dụ trên có dòng `FORCE`, và role của ứng dụng nên khác role tạo table.
- **Đã bật RLS mà chưa có policy thì mặc định từ chối hết.** Không rò, chỉ là không thấy dòng nào.
- **`current_setting('app.scopes')` ném lỗi nếu chưa gán** (trừ khi truyền `missing_ok = true`). Đây là tính chất tốt: quên gán scope thì query lỗi, không trả thừa dòng. Đừng truyền `missing_ok = true`.

Về connection pooling: `set_config(..., true)` chỉ sống trong transaction. Chạy qua PgBouncer ở chế độ transaction thì phải gán ở đầu **mỗi** transaction, không gán một lần cho cả session.

`Retrieve` của Bedrock không có cơ chế tương đương. Filter chỉ là một field trong request, do code truyền. Không có tầng nào bên dưới ép lại.

| | SQL + RLS | `Retrieve` của Bedrock |
|---|---|---|
| Filter nằm ở đâu | policy trong database | tham số trong request |
| Ép được ở tầng dưới không | **Có**, nếu role ứng dụng không phải owner và không có `BYPASSRLS` | **Không** |
| Quên filter thì thấy gì | database vẫn chặn (hoặc query lỗi) | trả về tất cả, không lỗi |
| Bỏ sót nhìn như thế nào | thiếu một dòng gán scope, query lỗi ngay | một object khởi tạo thiếu một property, nhìn như code bình thường |
| Ai còn chặn được | database | **không ai** |

Nói ngắn gọn: **ở SQL, RLS làm cho việc bỏ sót thành không thể, miễn là role ứng dụng bị RLS ràng buộc. Ở API chỉ có thể làm cho nó khó.**

Thiết kế hiện tại không còn giữ chunk trong PostgreSQL, nên ví dụ trên là bản so sánh với thiết kế cũ. RLS vẫn dùng được cho các bảng còn lại, ví dụ `case` lọc theo `org_id`. Đây là đề xuất bổ sung, chưa phải quyết định kiến trúc.

#### Ba đường có thể hỏng mà không báo lỗi

Không chỉ có chuyện quên. Ngay cả khi nhớ truyền filter, vẫn có ba đường đáng lo. Với Managed Knowledge Base, tài liệu AWS xác nhận đường 3 và chỉ xác nhận một phần đường 2. Đường 1 và hành vi cụ thể của đường 2 **chưa kiểm chứng**, nên nằm trong danh sách phải thử ở Phần 11b.

| # | Tình huống | Điều đã biết | Điều chưa biết |
|---|---|---|---|
| 1 | Lọc trên thuộc tính **không có trong sidecar** của tài liệu đã nạp | Tài liệu AWS: thuộc tính phải có trên tài liệu đã nạp thì mới lọc được | Khi thiếu thì trả **rỗng** hay báo lỗi. Với custom Knowledge Base, tài liệu ghi là trả rỗng |
| 2 | Dùng `startsWith` hoặc `stringContains` | Tài liệu AWS: hai toán tử này **không được hỗ trợ** trên managed Knowledge Base. Nên dùng `equals`, `in`, `notIn` và các toán tử số | Khi gọi thì lỗi hay **bị bỏ qua**. Với custom Knowledge Base trên vector store không hỗ trợ, tài liệu ghi là bị bỏ qua im lặng, tức trả về tất cả. `listContains` không nằm trong danh sách không hỗ trợ của managed, nhưng vẫn nên tránh |
| 3 | Quên đặt `numberOfResults` | Tham số này nhận từ 1 đến 100. Tài liệu chung ghi mặc định là **5** | Trang managed không nêu mặc định. Cứ đặt tường minh 40 |

Đường 2 đáng lo nhất, vì nếu toán tử bị bỏ qua thì nó phá đúng hàng rào phân quyền mà không có lỗi nào. Cách chặn không phụ thuộc vào câu trả lời: **chỉ dùng `equals`, `in`, `notIn` và toán tử số**, và test tích hợp phải thử cả ba đường trên chính Knowledge Base thật.

#### Chặn bằng cấu trúc

Quy ước không đủ. Kiến trúc chặn bằng ba lớp cấu trúc, cộng một lớp để truy vết:

1. **Một class duy nhất.** Trong toàn bộ mã nguồn, chỉ có đúng một class được phép gọi `Retrieve`. Tên nó là `ScopedKnowledgeBaseClient`. Danh sách scope là tham số bắt buộc của constructor, và truyền rỗng là ném lỗi ngay ở constructor, không đợi tới lúc gọi. Không có overload nào nhận filter từ bên ngoài. Không có constructor nào không nhận scope.
2. **Architecture test trong CI.** Test này cấm mọi type khác tham chiếu tới client `bedrock-agent-runtime`. Vi phạm là build đỏ, không phải chờ reviewer bắt.
3. **Integration test đa organization.** Nạp hai chunk có `scope_key` khác nhau, gọi qua đường thật, khẳng định chỉ một chunk được trả về. Chạy trước mỗi lần release.
4. **CloudTrail data event** cho `AWS::Bedrock::KnowledgeBase`. Mặc định `Retrieve` **không** được ghi log. Không bật thì có rò cũng không truy ngược được ai đã tìm gì.

```csharp
public sealed class ScopedKnowledgeBaseClient
{
    private readonly IReadOnlyList<string> _scopes;

    public ScopedKnowledgeBaseClient(IReadOnlyList<string> scopes, ...)
    {
        if (scopes is null || scopes.Count == 0)
            throw new ArgumentException("Scope rỗng: không được phép gọi Retrieve.");
        _scopes = scopes;
    }

    public Task<RetrieveResponse> RetrieveAsync(string query, string? clausePath, CancellationToken ct)
    {
        // filter dựng ở đây, không nhận từ bên ngoài
    }
}
```

### Ingestion pipeline — chuẩn bị kho, chạy nền

Đây là việc của `Assistant.Worker`, hoàn toàn tách khỏi lượt hỏi.

```
PDF tiêu chuẩn trên S3
   │
   ├─ đọc từng trang, không nạp cả file vào bộ nhớ
   ├─ cắt theo cấu trúc điều khoản, không cắt theo số ký tự
   ├─ gặp bảng thì giữ nguyên bảng, và LẶP LẠI tiêu đề cột trong mỗi mảnh
   │
   └─ ghi ra: mỗi mảnh = 1 file trên S3 + 1 file mô tả đi kèm
                                          ("sidecar", đuôi .metadata.json)
```

Mỗi mảnh gọi là một **chunk**. File mô tả đi kèm gọi là **sidecar**. Tên sidecar là tên file chunk cộng `.metadata.json`, và mỗi thuộc tính có khai báo kiểu:

```json
{
  "metadataAttributes": {
    "standard":    { "value": { "type": "STRING", "stringValue": "EN 1992-1-1" } },
    "edition":     { "value": { "type": "STRING", "stringValue": "2004" } },
    "clause_path": { "value": { "type": "STRING", "stringValue": "6.2.2" } },
    "page":        { "value": { "type": "NUMBER", "numberValue": 84 } },
    "scope_key":   { "value": { "type": "STRING", "stringValue": "public" } },
    "status":      { "value": { "type": "STRING", "stringValue": "active" } }
  }
}
```

Hai giới hạn từ tài liệu AWS: mỗi sidecar không quá **10 KB**, và không đặt tên thuộc tính bắt đầu bằng dấu gạch dưới, vì managed Knowledge Base dành tiền tố đó cho thuộc tính hệ thống như `_source_uri`.

Managed Knowledge Base đọc thẳng từ S3, sinh vector cho từng chunk, cất vào kho của nó. Phần sidecar chính là thứ dùng để lọc lúc tìm kiếm.

**Vì sao Worker tự cắt chứ không để MKB tự cắt?** MKB nhận được PDF thô và tự cắt — nhưng nó cắt máy móc theo số ký tự. Cắt kiểu đó thì mất `clause_path` và `page`, mà thiếu hai trường đó là **không dựng được trích dẫn**. Mà không có trích dẫn thì theo nguyên tắc của hệ thống, không có câu trả lời.

Đây là một ví dụ của nguyên tắc chung: **quyết định tự làm hay mua phải cân theo từng thành phần, không phải một lựa chọn nhị phân cho cả hệ thống.** Phần cắt tài liệu theo cấu trúc điều khoản là chỗ tạo ra khác biệt — tự làm. Phần lưu và tìm vector thì ai cũng cần như nhau — mua.

### Query pipeline — hai stage

Khi có câu hỏi thật, đường tìm kiếm chạy như sau:

```
Stage 1 ── Câu hỏi có mã điều khoản không?  (regex)
           có → pg_trgm trên bảng clause_ref
                phân giải "6.22" thành "6.2.2"

Stage 2 ── Retrieve của Managed Knowledge Base
             retrievalConfiguration.managedSearchConfiguration:
               filter: scope_key thuộc phạm vi của user
                       status = "active"
                       [+ clause_path nếu stage 1 tìm ra]
               numberOfResults = 40

Stage 3 ── Rerank 40 chunk xuống còn 8
             (do Knowledge Base làm sẵn, hoặc gọi mô hình rerank riêng)

Stage 4 ── Áp ngưỡng điểm
             dưới ngưỡng → TỪ CHỐI, không gọi mô hình trả lời

Stage 5 ── Lấy thêm chunk liền kề (trước và sau, cùng tài liệu)

Stage 6 ── Gửi tất cả cho Claude Sonnet, chữ bắt đầu chảy ra
```

**Vì sao có stage 1?** Tìm bằng vector rất giỏi so nghĩa, nhưng **rất dở tra số hiệu chính xác**. Người dùng gõ `6.22` mà ý là `6.2.2` thì cả tìm theo nghĩa lẫn tìm theo từ khóa đều trượt. Nên PostgreSQL giữ một bảng nhỏ tên `clause_ref`, dùng `pg_trgm` — một tiện ích so chuỗi theo mức giống nhau, hoạt động giống tính năng gợi ý khi gõ sai chính tả. Nó phân giải mã gõ gần đúng thành mã chuẩn, rồi đưa vào bộ lọc.

Nên **PostgreSQL vẫn nằm trong đường tìm kiếm**, dù vector store đã chuyển sang AWS.

**Rerank là gì?** Tìm bằng vector là so hai dãy số đã tính sẵn từ trước — nhanh, nhưng thô. **Rerank** thì đọc **cả câu hỏi lẫn từng chunk cùng một lúc** rồi chấm điểm lại. Chính xác hơn nhiều, nhưng chậm và tốn hơn, nên chỉ chạy trên 40 chunk đã lọc chứ không chạy trên cả kho.

**Ngưỡng điểm** là hàng rào cuối. Điểm cao nhất mà vẫn dưới ngưỡng thì hệ thống **từ chối ngay, không gọi mô hình trả lời**. Từ chối ở đây là hành vi đúng chứ không phải lỗi — và nó còn tiết kiệm tiền, vì câu không trả lời được thì đừng trả tiền để bịa ra một câu.

**Vì sao lấy chunk liền kề?** Điều khoản hay bị cắt ngang giữa hai chunk. Lấy thêm mảnh trước và mảnh sau để câu trả lời không bị mất nửa câu.

### Một chi tiết tưởng nhỏ mà không nhỏ

Tài liệu AWS ghi rằng một lần truy vấn Knowledge Base trả về **tối đa 5 kết quả theo mặc định**. Năm. Mình cần bốn mươi. Trang riêng của managed Knowledge Base thì chỉ nói tham số `numberOfResults` nhận từ 1 đến 100 và không nêu mặc định. Vì vậy quy tắc là: **đặt tay 40 ở mọi lời gọi**, không dựa vào mặc định. Bỏ trống thì có thể hệ thống vẫn chạy, vẫn trả lời, chỉ là chất lượng tụt — và không ai biết vì sao.

Loại bẫy này lặp lại vài lần trong hệ thống: **giá trị mặc định hợp lý cho người khác, sai với mình, và không báo lỗi khi sai**. Nên tài liệu thi công có hẳn bảng liệt kê từng giá trị phải đặt tay.

Ngưỡng điểm thì khác: **API không có tham số ngưỡng**. Mỗi kết quả trả về kèm một `score`, và việc so `score` với ngưỡng là logic trong mã của mình.

---

## Phần 5 · Nhánh gọi hàm

Ý định là "tính giúp tôi" hoặc "giải thích kết quả này". Đây là nhánh mà nguyên tắc **mô hình không tự tính số** sống hay chết.

### Tool calling — cơ chế

Mô hình không tính. Nhưng nó có thể **nói ra rằng nó muốn gọi hàm nào, với tham số nào**.

Cách làm: mình mô tả cho mô hình một danh sách hàm có sẵn — tên hàm, các tham số, đơn vị của từng tham số, khoảng giá trị hợp lệ. Mô hình đọc câu hỏi rồi trả về đại ý *"gọi hàm kiểm tra cắt, với b = 300 milimét, h = 600 milimét, bê tông C30/37"*.

Mã của mình nhận yêu cầu đó, **kiểm tra nó**, rồi mới gọi engine .NET thật. Engine tính, trả về JSON. Mình đưa JSON đó lại cho mô hình để nó diễn giải thành câu văn.

Tóm lại: **mô hình chọn hàm và điền tham số. Engine tính.** Con số đi ra màn hình là con số của engine, không phải của mô hình.

### ToolGate — sáu lớp kiểm

Giữa mô hình và engine có một cổng gọi là **ToolGate**, gồm sáu lớp chạy tuần tự. Cổng này nằm trong `Tool facade`, không nằm trong engine — engine không bị sửa.

| Lớp | Kiểm gì | Trượt thì |
| --- | --- | --- |
| 01 | Tham số có đúng kiểu dữ liệu không | Trả lỗi kèm mô tả schema |
| 02 | Người dùng này có quyền gọi hàm này không | Từ chối |
| 03 | Giá trị có nằm trong khoảng hợp lệ không | Trả lỗi kèm khoảng hợp lệ |
| 04 | **Có đơn vị không** | Từ chối, không suy diễn |
| 05 | Có đang lặp lại không | Dừng sau hai lần trùng |
| 06 | Đọc mã kết quả thật bên trong phản hồi | Đổi thành lỗi đúng |

Hai lớp đáng dừng lại giải thích.

**Lớp 04 — đơn vị.** Đây là lớp dễ bị coi nhẹ nhất và nguy hiểm nhất. Mô hình thấy `b = 0.3` có thể hiểu là 0,3 mét, cũng có thể hiểu là 0,3 milimét. Đoán sai **một nghìn lần**, mà kết quả tính ra vẫn là một con số trông hợp lý. Nên quy tắc tuyệt đối: thiếu đơn vị thì **từ chối**, không bao giờ suy diễn.

**Lớp 06 — đọc mã kết quả thật.** Hệ thống hiện tại có một đặc điểm: nó trả lỗi `Forbidden` (không có quyền) **nằm bên trong** một phản hồi HTTP 200. Nghĩa là về mặt giao thức mạng thì "thành công", phải mở phần thân phản hồi ra đọc mã bên trong mới biết bị từ chối.

Hậu quả: mọi lớp bảo mật ở tầng ngoài đều **không nhìn thấy** chuyện đó. Chỉ mã của mình đọc được. Không bắt ở đây thì một lỗi quyền sẽ trôi vào câu trả lời như dữ liệu hợp lệ.

Đây là lý do `Tool facade` bắt buộc phải tồn tại chứ không phải một lựa chọn kiến trúc cho đẹp.

### AgentCore — vòng lặp gọi hàm

Cái vòng "mô hình đòi gọi hàm → mình gọi → trả kết quả → mô hình xem xét rồi đòi gọi tiếp hoặc trả lời" có thể tự viết bằng C#. Nhưng công ty ưu tiên dùng dịch vụ có sẵn, nên mình dùng **AgentCore Harness** của AWS để quản vòng lặp đó, kèm một cổng gọi là **Gateway** biến REST API thành công cụ mà mô hình gọi được, và một ngôn ngữ chính sách tên **Cedar** để quy định ai gọi được gì.

Cái giá: Harness **không có điểm móc** để nhét ToolGate vào giữa vòng lặp. Nên ToolGate phải đứng ở một service riêng mà Gateway gọi tới — đó chính là lý do `Tool facade` tồn tại như một thành phần riêng.

Kiến trúc giữ sẵn một đường thoát: nếu hai kiểm chứng đầu tiên về AgentCore không đạt thì bỏ nó, quay về vòng lặp C# tự viết. Đường thoát đó đã được thiết kế đầy đủ chứ không phải một dòng ghi chú.

---

## Phần 6 · Nhánh kinh nghiệm

Ý định là "có ai làm bài giống thế này chưa".

Chỗ này nhiều người phản xạ ngay: dùng vector đi, tìm cái tương tự mà. **Sai**, và lý do đáng nghe.

Hai câu này:

```
"nhịp 8,0 m, bê tông C30/37"
"nhịp 12,0 m, bê tông C30/37"
```

Về mặt ngôn ngữ chúng gần như giống hệt nhau, nên hai vector của chúng nằm sát nhau đến mức không phân biệt được. Nhưng **độ lớn chính là thứ duy nhất nhánh này cần phân biệt**. Embedding không xếp hạng được theo độ lớn — nó xếp theo nghĩa, mà về nghĩa thì hai câu đó là một.

Dùng vector ở đây là dùng sai công cụ. Nên nhánh này chạy bằng số học thuần:

```
Bước 0 ── Gom tham số từ ba nguồn, theo thứ tự ưu tiên cố định:
             tool_run  >  pageContext  >  case_hints
          (kết quả engine thật > trang đang mở > mô hình bóc từ câu hỏi)

          Ghi đè theo TỪNG khóa, không theo cả khối.
          Khóa nào chỉ có nguồn case_hints → đánh dấu "chưa xác nhận"
          Gom chưa đủ 2 khóa → hỏi lại người dùng, dừng

Bước 1 ── Lọc cứng bằng SQL: đúng công ty, đã duyệt, đúng loại cấu kiện
          → còn khoảng 200 ứng viên

Bước 2 ── Chấm điểm theo khoảng cách tham số, chuẩn hóa rồi chia cho độ phủ
          → lấy 5 cái đầu

Bước 3 ── Hòa điểm thì mới dùng vector, và chỉ khi câu hỏi có phần diễn đạt tự do

Bước 4 ── Đưa 5 tình huống đó cho Sonnet để so sánh và diễn giải
```

**Thứ tự ưu tiên ở bước 0 rất quan trọng.** Con số từ một lần chạy engine thật luôn thắng con số mô hình bóc ra từ câu chữ. Và những giá trị chỉ do mô hình bóc ra thì giao diện hiện thành **chip sửa được**, để kỹ sư xác nhận hoặc sửa trước khi tra.

Lý do bắt buộc phải có chip: nếu mô hình bóc sai một tham số, câu trả lời vẫn trôi chảy, vẫn có căn cứ, chỉ là dựa trên con số sai — và **không có dấu hiệu gì trên màn hình**. Chip là chỗ duy nhất kỹ sư bắt được.

### Case sinh ra từ đâu

Chỉ một nguồn duy nhất: **kỹ sư bấm nút Duyệt** trên một kết quả tính có thật.

Phần tóm tắt của case sinh bằng **khuôn mẫu ghép các trường có cấu trúc, không bao giờ bằng mô hình**. Khuôn mẫu thì không thể bịa, và không lộ thêm gì ngoài đúng những tham số đã có. Đây là một ràng buộc bảo mật chứ không phải lựa chọn phong cách — case được người khác trong tổ chức đọc lại.

Có một khóa chống trùng, băm từ tên hàm, phiên bản hàm và bộ tham số đã chuẩn hóa. Duyệt lại một bài giống hệt thì tăng số lần duyệt, không tạo bản ghi mới.

Và một ranh giới tuyệt đối: **case không bao giờ đi qua biên giới công ty khách hàng**. Không có case công khai. Mã công ty lấy từ hệ thống thanh toán của mình, **không bao giờ tin mã do trình duyệt gửi lên**.

---

## Phần 7 · Kiểm lại sau khi trả lời

Đến đây câu trả lời đã hiện xong trên màn hình. Nhưng chưa xong.

### Vì sao cần kiểm lại

Mô hình là một bộ phân loại có xác suất sai. Có một cơ chế gọi là **structured output** ép nó trả về JSON đúng khuôn định sẵn — nhưng nó chỉ bảo đảm **hình dạng**, không bảo đảm **nghĩa**.

Nó chặn được giá trị rác kiểu `intent: "banana"`. Nó **không** chặn được việc mô hình trả về `intent: "case_lookup"` trong khi lẽ ra phải là `doc_qa`. Hình dạng đúng, nghĩa sai.

Nên mọi ràng buộc thật phải nằm ở lớp bao quanh mô hình.

### Ba validator

Chạy trong `Assistant.Api`, **sau khi chữ đã chảy xong**. Cả ba đều là mã tất định — **không dùng mô hình làm giám khảo**.

**`NumberValidator`** — mọi con số trong câu trả lời phải khớp kết quả engine (cho phép sai số làm tròn), **hoặc** là trích nguyên văn từ một chunk tài liệu. Hai nguồn hợp lệ, không phải một: câu trả lời còn nêu giá trị giới hạn lấy từ tiêu chuẩn, và những số đó đến từ tài liệu chứ không từ engine.

**`CitationValidator`** — mỗi dấu `[1]`, `[2]` phải trỏ về một chunk **đã thật sự được lấy ra ở lượt này**. Không phải một chunk có tồn tại đâu đó trong kho — mà là chunk đã thật sự dùng.

**`VerificationValidator`** — không cho phép chữ "đạt", "thỏa mãn" gắn với một phương án mà không có bản ghi chạy engine khớp tham số phía sau.

### Trượt thì làm gì

**Gắn cờ, không xóa chữ đã hiện.** Lượt chuyển sang trạng thái `CompletedUnverified` — hoàn thành nhưng chưa kiểm chứng được — và giao diện thêm một dải cảnh báo lên trên câu trả lời.

Vì sao không xóa? Xóa chữ giữa chừng làm người dùng mất niềm tin vào **cả những lượt đúng**. Hệ thống chọn nói rõ "cái này chưa kiểm được" thay vì giả vờ như chưa từng nói.

---

## Phần 8 · Một lượt có thể kết thúc theo bao nhiêu đường

Đây là phần dễ bị bỏ sót nhất khi thiết kế, vì ai cũng nghĩ về đường thành công.

```
Received ─┬─→ Rejected              chặn ở cổng: quá nhanh / thẻ hỏng / hết quota
          │
          └─→ Routing ─┬─→ Retrieving ─┬─→ Refused     không đủ căn cứ
                       │               └─→ Generating
                       │
                       ├─→ ToolLoop ───┬─→ Degraded    quá vòng / tool lỗi hai lần
                       │               ├─→ AwaitingApproval ─→ Generating
                       │               └─→ Generating
                       │
                       ├─→ CaseLookup ─┬─→ AskBack     chưa đủ 2 tham số
                       │               └─→ Generating
                       │
                       └─→ Refused                     ngoài phạm vi

Generating ─┬─→ Completed
            └─→ CompletedUnverified                    validator trượt
```

Tám đường kết thúc, chỉ **một** trong số đó là đường thành công hoàn toàn. Giao diện phải xử lý cả tám.

Ba trạng thái hay bị quên:

- **`Refused`** — không có một chữ nào từ mô hình. Giao diện giả định "lượt nào cũng có chữ" sẽ treo ở trạng thái đang gõ vĩnh viễn.
- **`CompletedUnverified`** — chữ đầy đủ, kèm cảnh báo. Giao diện phải chèn được dải cảnh báo lên một câu trả lời **đã hiện xong**.
- **`Degraded`** — lượt chạy ở chế độ giảm. Phải nói rõ với người dùng, không giả vờ bình thường.

**Mọi đường kết thúc đều ghi bản ghi hội thoại và bản ghi kiểm toán**, kể cả đường lỗi. Không có đường nào đi qua mà không để lại vết.

---

## Phần 9 · Giao diện nhận dữ liệu thế nào

### Streaming

Backend và Frontend nói chuyện qua **SSE** (server-sent events). Cơ chế: một kết nối mở sẵn, server đẩy dần từng mẩu xuống trình duyệt.

Vì sao không chờ xong rồi trả một cục? Vì một lượt có gọi engine có thể mất chục giây. Màn hình trắng mười giây thì người dùng nghĩ hệ thống hỏng. Đẩy dần thì họ thấy nó đang làm việc.

Hợp đồng gồm **11 loại sự kiện**, đóng băng ngay từ bản đầu:

| Sự kiện | Nghĩa |
| --- | --- |
| `status` | Đổi trạng thái: "đang tìm trong kho tài liệu" |
| `retrieval` | Danh sách nguồn đã tìm được — **gửi trước cả chữ** |
| `token` | Một mẩu chữ |
| `tool_call` | Sắp gọi hàm nào, với tham số gì |
| `tool_result` | Kết quả engine trả về, dạng JSON |
| `approval_required` | Kết quả này có thể vào kho kinh nghiệm |
| `citation` | Danh sách trích dẫn đã kiểm |
| `refusal` | Từ chối, kèm gợi ý phạm vi |
| `warning` | Validator trượt |
| `error` | Lỗi giữa chừng |
| `done` | Kết thúc |

Gửi danh sách nguồn **trước** chữ là một lựa chọn có chủ ý: nó làm lượt hỏi **có vẻ** nhanh hơn, vì người dùng có thứ để đọc trong lúc chờ.

### Một luật với Frontend

> **Dựng thẻ kết quả từ JSON, tuyệt đối không tự bóc số ra từ chữ mô hình viết.**

Hai luồng tách biệt hẳn: mô hình viết **văn xuôi diễn giải** → vào bong bóng chữ. Engine trả **JSON có cấu trúc** → vào thẻ kết quả.

Nếu Frontend tự đọc số ra từ văn xuôi thì toàn bộ công sức của ba validator ở Phần 7 thành vô nghĩa — vì cái được kiểm là văn xuôi, còn cái hiển thị là thứ Frontend tự diễn giải ra từ văn xuôi đó.

---

## Phần 10 · Ai được đọc cái gì

Nguyên tắc: **dùng lại nguyên cơ chế phân quyền đang có, không viết lại**.

Hệ thống hiện tại dùng Keycloak quản danh tính, và quyền gắn bằng attribute trong Main API. Trợ lý **không đụng vào đó**. Nó **chuyển tiếp nguyên thẻ đăng nhập của người dùng** xuống Main API, nên mọi quyền đang có tự áp dụng y nguyên.

Vì sao không tự viết lại cho gọn? Vì hai bản logic phân quyền thì sớm muộn cũng lệch nhau, và lúc lệch thì không ai biết bản nào đúng.

Chuỗi khóa đi từ ngoài vào:

| Chặng | Cơ chế |
| --- | --- |
| Trình duyệt → BFF | Cookie không đọc được bằng JavaScript |
| BFF → `Assistant.Api` | Thẻ Bearer của Keycloak |
| `Assistant.Api` → Main API | **Chuyển tiếp thẻ người dùng**, quyền cũ áp dụng nguyên |
| `Assistant.Api` → AgentCore | Xác thực bằng JWT, khóa cả client lẫn audience |
| Gateway → facade | Đổi thẻ theo chuẩn RFC 8693 |
| Gateway → tool | Chính sách Cedar |
| → Bedrock | Điều kiện IAM **bắt buộc kèm bộ lọc nội dung** |

Dòng cuối đáng chú ý: ở tầng quyền của AWS có một điều kiện bắt buộc mọi lời gọi mô hình chat phải kèm guardrail. Không kèm thì AWS từ chối. **Ép ở tầng quyền, không ép bằng lời dặn** — đúng nguyên tắc ở Phần 0.

Hai đường lọc dữ liệu khác nhau:

- **Tài liệu** lọc bằng `scope_key` trong tham số của `Retrieve`.
- **Case** lọc bằng mã công ty trong câu lệnh SQL.

Mã công ty lấy từ hệ thống thanh toán, không tin giá trị trình duyệt gửi lên.

---

## Phần 11 · Vì sao dùng nhiều mô hình chứ không một

| Việc | Mô hình | Vì sao |
| --- | --- | --- |
| Phân loại ý định, viết lại câu hỏi, bóc tham số | Claude Haiku | Việc nhỏ, chạy mọi lượt, cần nhanh và rẻ |
| Trả lời, chạy vòng gọi hàm | Claude Sonnet | Việc cần hiểu sâu, chạy ít hơn |
| Dự phòng | Sonnet bản trước | Khi bản chính không dùng được |
| Sinh vector cho tài liệu | MKB lo, hoặc chỉ định riêng | Chạy nền, không ai chờ |
| Chấm lại kết quả tìm | Bộ chấm lại có sẵn của MKB, hoặc Cohere Rerank | Chuyên một việc, làm tốt hơn mô hình chung |

Hai dòng cuối có một ràng buộc chéo. Bộ chấm lại có sẵn của MKB **chỉ dùng được khi Knowledge Base dùng embedding do AWS quản**. Nếu chọn embedding riêng (Titan V2, Cohere Embed v4...) thì mất bộ chấm lại có sẵn, và chỉ còn hai lựa chọn: dùng mô hình rerank riêng hoặc không chấm lại. Nên chọn embedding và chọn cách chấm lại phải quyết cùng nhau, trước khi tạo Knowledge Base, vì embedding không đổi được sau khi tạo.

Dùng mô hình mạnh nhất cho mọi việc thì vừa chậm vừa đắt mà không tốt hơn — phân loại ý định không cần một mô hình biết viết luận.

Và một chi tiết kiến trúc quan trọng: **đổi mô hình là đổi một dòng cấu hình, không phải sửa mã.** Làm được vì trong mã có ba interface tách riêng: một để sinh chữ, một để sinh vector, một để chấm lại. Phần gọi Bedrock nằm sau ba interface đó.

Điều này quan trọng vì mô hình AI có vòng đời ngắn. Nhà cung cấp công bố ngừng hỗ trợ một mô hình là chuyện bình thường, và khi đó hệ thống phải đổi được mà không phải viết lại.

---

## Phần 11b · Những gì đã tra được và những gì chưa

Một phần của việc thiết kế là biết rõ **cái gì mình chắc và cái gì mình đoán**. Mục này liệt kê thẳng.

### Đã tra tài liệu nhà cung cấp và xác nhận

| Điều | Kết quả |
| --- | --- |
| Dịch vụ kho tài liệu quản lý sẵn có ở Frankfurt không | **Có.** Frankfurt nằm trong danh sách region chính thức |
| Mô hình chấm lại kết quả tìm có ở Frankfurt không | **Có**, hai mô hình. Và trong cả châu Âu, Frankfurt là nơi duy nhất có |
| Ba mô hình biến chữ thành số đang cân nhắc có ở Frankfurt không | **Cả ba đều có** |
| Lời gọi tìm kiếm có được ghi nhật ký mặc định không | **Không.** Phải bật tay, và có phụ phí |
| Kho tài liệu quản lý sẵn có tìm kiểu hybrid không | **Có, và luôn luôn.** Không có tùy chọn chỉ tìm theo nghĩa |
| Bước chấm lại có sẵn có dùng được với embedding riêng không | **Không.** Chỉ dùng được với embedding do AWS quản |
| Cấu hình truy vấn của managed Knowledge Base nằm ở đâu | `managedSearchConfiguration`, gồm `filter`, `numberOfResults` và cấu hình chấm lại. `vectorSearchConfiguration` chỉ dành cho custom Knowledge Base |
| Lọc theo nhóm trong ACL của S3 có được không | **Không.** ACL của S3 chỉ nhận từng user, định danh bằng email |
| Mô hình nhỏ dùng cho bước phân loại có tận dụng được bộ nhớ đệm không | **Nhiều khả năng là không** — ngưỡng của nó cao gấp bốn lần mô hình trả lời, mà prompt phân loại thì ngắn |

### Đã tra và phát hiện tài liệu này từng ghi sai

Một chỗ về phân quyền mã hóa: bộ tài liệu trước đây ghi rằng vai trò dịch vụ của kho tài liệu cần quyền trên khóa mã hóa. Tra thẳng tài liệu nhà cung cấp thì **không phải** — quyền đó cấp cho danh tính *tạo* kho, không cấp cho vai trò dịch vụ. Đã sửa.

Chuyện này đáng kể ra vì nó minh họa đúng thứ cả hệ thống đang chống: **một khẳng định nghe hợp lý, lặp lại nhiều lần, vẫn có thể sai**. Cách duy nhất biết là đi tra tận nguồn.

### Chưa tra được, và phải gọi thử mới biết

- Bộ thư viện .NET mà đội Backend dùng có gọi được kiểu kho tài liệu mới không. Tài liệu nhà cung cấp chỉ nói về Python, **không nói gì về .NET**.
- Bộ lọc quyền có chạy đúng như mô tả không. Cụ thể ba điều: lọc trên thuộc tính không có trong sidecar thì trả rỗng hay báo lỗi; dùng `startsWith` hoặc `stringContains` thì báo lỗi hay bị bỏ qua; và `listContains` có chạy không.
- Bước chấm lại kèm sẵn có đủ tốt để bỏ mô hình trả tiền riêng không.
- Đơn giá thật và tốc độ thật của từng lời gọi.

Ba thứ đầu là lý do có một danh sách kiểm chứng phải chạy **trước** khi viết phần còn lại.

---

## Phần 12 · Bảng thuật ngữ

| Thuật ngữ | Nghĩa trong hệ thống này |
| --- | --- |
| **LLM** | Mô hình ngôn ngữ lớn. Bộ máy đoán chữ tiếp theo |
| **Hallucination** | Mô hình bịa ra thông tin nghe rất thật |
| **Prompt** | Đoạn chữ đưa cho mô hình, gồm câu hỏi và mọi ngữ cảnh kèm theo |
| **Token** | Đơn vị mô hình đọc và viết. Tiền tính theo token |
| **RAG** | Tìm tài liệu liên quan rồi dán vào prompt, thay vì bắt mô hình nhớ |
| **Embedding** | Biến một đoạn văn thành một dãy số mang nghĩa |
| **Vector** | Chính dãy số đó |
| **Vector store** | Kho chứa và tìm các vector. Ở đây do AWS quản |
| **Chunk** | Một mảnh tài liệu đã cắt, có mã điều khoản và số trang |
| **Sidecar** | File mô tả đi kèm mỗi chunk, dùng để lọc |
| **Retrieval** | Việc đi tìm chunk liên quan tới câu hỏi |
| **Rerank** | Chấm điểm lại kết quả tìm, chính xác hơn nhưng chậm hơn |
| **Tool calling** | Mô hình nói ra muốn gọi hàm nào; mã của mình gọi thật |
| **ToolGate** | Sáu lớp kiểm chạy trước khi engine chạy |
| **Guardrails** | Bộ lọc nội dung của Bedrock |
| **SSE** | Cơ chế server đẩy dần dữ liệu xuống trình duyệt |
| **BFF** | Lớp proxy giữa trình duyệt và backend |
| **Structured output** | Ép mô hình trả JSON đúng khuôn. Bảo đảm hình dạng, không bảo đảm nghĩa |
| **Validator** | Mã tất định kiểm lại câu trả lời sau khi mô hình viết xong |
| **Fallback** | Đường dự phòng khi thành phần chính hỏng |
| **Scope** | Phạm vi dữ liệu một người dùng được đọc |
| **Case** | Một kết quả tính toán đã được kỹ sư duyệt, thành kinh nghiệm dùng lại |

---

## Đọc sâu

[01](01-kien-truc-tong-the.md) sơ đồ tổng thể · [02](02-assistant-service.md) một lượt hỏi đáp · [03](03-rag.md) nhánh tài liệu · [04](04-tool-calling.md) nhánh gọi hàm · [05](05-case-memory.md) kho kinh nghiệm · [07](07-auth-bao-mat.md) phân quyền · [19](19-dac-ta-kien-truc.md) đặc tả đầy đủ
