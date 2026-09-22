# 11 · Thuyết minh kiến trúc

**Nội dung:** chỉ kiến trúc và luồng xử lý.
**Người đọc:** không cần biết gì về AI từ trước. Mọi thuật ngữ được giải thích ngay lần đầu gặp, và giữ nguyên tên tiếng Anh để sau này đọc tài liệu kỹ thuật không bị lạc.

**Mục lục**

0. Ba thứ cần hiểu trước
1. Hệ thống gồm những khối nào
2. Ba loại dữ liệu, ba cách xử lý khác nhau
3. Một lượt hỏi đi qua những gì
4. Nhánh tài liệu
5. Nhánh gọi hàm
6. Nhánh kinh nghiệm
7. Kiểm lại sau khi trả lời
8. Một lượt có thể kết thúc theo bao nhiêu đường
9. Giao diện nhận dữ liệu thế nào
9b. Tiền chảy đi đâu, và vì sao có hai lớp giới hạn tốc độ khác nhau
9c. Vì sao cần một tầng riêng canh chất lượng, tách khỏi tầng chạy sản phẩm
10. Ai được đọc cái gì
11. Vì sao dùng nhiều mô hình chứ không một
11b. Những gì đã tra được và những gì chưa
12. Bảng thuật ngữ

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

Giao diện chat, **nằm bên trong ứng dụng tính toán hiện tại**, không phải một trang riêng. Đây là lựa chọn có chủ ý: kỹ sư đang mở trang tính một dầm thì panel nằm ngay cạnh, và nó **biết** người dùng đang nhìn dầm nào — dữ liệu đó đi vào `pageContext`, quyết định intent `explain_result` ở Phần 3.

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

Giải thích kỹ ở Phần 3: **mình không tự dựng và không tự vận hành cái kho đó**.

### PostgreSQL

Cơ sở dữ liệu quan hệ thông thường. Nó giữ những thứ có cấu trúc rõ ràng: nội dung hội thoại, bản ghi mỗi lần chạy engine tính toán, kho kinh nghiệm engine đã tính đạt, nhật ký kiểm toán, và một bảng nhỏ để tra mã điều khoản.

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

Nói ngắn gọn: **ở SQL, RLS khiến bỏ sót gần như không thể, miễn role ứng dụng bị RLS ràng buộc. Ở API chỉ có thể khiến việc bỏ sót trở nên khó hơn.**

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
           có → tra bảng clause_ref trong tài liệu được đọc
                phân giải "6.22" thành "6.2.2"
                không ra đúng một điều → hỏi lại kèm gợi ý

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

**Vì sao có stage 1?** Tìm bằng vector rất giỏi so nghĩa, nhưng **rất dở tra số hiệu chính xác**. Người dùng gõ `6.22` mà ý là `6.2.2` thì cả tìm theo nghĩa lẫn tìm theo từ khóa đều trượt. Nên PostgreSQL giữ một bảng nhỏ tên `clause_ref` chứa mọi mã chuẩn. Hệ thống so mã người dùng gõ với bảng này theo dãy chữ số, bỏ qua dấu chấm, nên `6.22` vẫn ra `6.2.2`. Ra đúng một điều thì đưa vào bộ lọc; ra nhiều điều hoặc không ra điều nào thì hỏi lại người dùng kèm vài mã gợi ý, giống cách trình soát chính tả gợi ý chữ sửa.

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

Bước 1 ── Lọc cứng bằng SQL: đúng công ty, đã tính đạt, đúng loại cấu kiện
          → còn khoảng 200 ứng viên

Bước 2 ── Chấm điểm theo khoảng cách tham số, chuẩn hóa rồi chia cho độ phủ
          → lấy 5 cái đầu

Bước 3 ── Hòa điểm thì ưu tiên cấu hình được dùng nhiều lần hơn, rồi cấu hình dùng gần đây hơn

Bước 4 ── Đưa 5 tình huống đó cho Sonnet để so sánh và diễn giải
```

Thứ tự ưu tiên ở bước 0: con số từ một lần chạy engine thật luôn thắng con số mô hình bóc ra từ câu chữ. Và những giá trị chỉ do mô hình bóc ra thì giao diện hiện thành **chip sửa được**, để kỹ sư xác nhận hoặc sửa trước khi tra.

Lý do bắt buộc phải có chip: nếu mô hình bóc sai một tham số, câu trả lời vẫn trôi chảy, vẫn có căn cứ, chỉ là dựa trên con số sai — và **không có dấu hiệu gì trên màn hình**. Chip là chỗ duy nhất kỹ sư bắt được.

### Case sinh ra từ đâu

Chỉ một nguồn duy nhất: **engine tính một cấu kiện và kết luận đạt**. Không có nút Duyệt. Case là bộ thông số JSON của cấu kiện đó, không có đoạn tóm tắt nào, nên không có gì để mô hình bịa.

Có một khóa chống trùng, băm từ tên hàm, phiên bản hàm và bộ thông số đã chuẩn hóa. Tính lại một cấu hình giống hệt thì tăng **số lần dùng**, không tạo bản ghi mới. Cấu hình được tính đạt nhiều lần là cấu hình công ty đang thật sự dùng.

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

**`VerificationValidator`** — không cho phép chữ "đạt", "thỏa mãn" gắn với một phương án nếu bản ghi chạy engine phía sau không báo đạt. Có bản ghi khớp tham số chưa đủ: engine có thể đã báo "không đạt", và mô hình vẫn viết ngược lại. Nhãn trên thẻ kết quả lấy thẳng từ kết luận của engine, không lấy từ chữ mô hình viết.

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
| `approval_required` | Dành cho thao tác cần duyệt sau này; không còn dùng cho case |
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

## Phần 9b · Tiền chảy đi đâu, và vì sao có hai lớp giới hạn tốc độ khác nhau

Phần 0 đã nói: tiền tính theo token dùng thật, còn hạn mức tốc độ tính theo burndown — một token viết ra ăn mười token khỏi hạn mức. Phần này đi sâu hơn, vào chỗ hay gây nhầm nhất: hệ thống có **hai lớp giới hạn tốc độ**, không phải một, và chúng bảo vệ hai thứ khác nhau.

### Hai lớp, hai chỗ hỏng khác nhau

**Lớp AWS** nằm ở phía nhà cung cấp mô hình. AWS đặt hạn mức theo từng mô hình cho tài khoản, tính bằng token: **TPM** (tokens per minute — tổng token vào và ra được dùng trong một phút) và **TPD** (tokens per day — tổng trong một ngày). Mặc định TPD bằng TPM × 24 × 60, nhưng tài khoản AWS mới bị giảm hạn mức. Hạn mức này tính chung cho cả tài khoản — không phân biệt user hay organization nào đang gọi. Chạm trần thì AWS từ chối request ngay ở tầng hạ tầng, chưa kịp tới mã của Assistant. Hai endpoint `bedrock-runtime` và `bedrock-mantle` tính hạn mức riêng, dù gọi cùng một mô hình.

**Lớp Assistant** là hạn mức token theo ngày, tính theo user và theo organization, đã nói ở Phần 0 và Phần 3 (mục ba cổng chặn). Nó reset mỗi ngày. Chạm trần thì mã của mình chủ động trả `429 quota_exceeded`.

Vì sao cần cả hai chứ không dùng một? Vì chúng chặn hai kiểu lạm dụng khác nhau. Lớp AWS chặn tốc độ dội dập lên hạ tầng dùng chung — dù chỉ một user gửi hàng nghìn request dồn dập, AWS vẫn phải tự bảo vệ năng lực xử lý của mình. Lớp Assistant chặn chi phí phình lên vì một khách hàng cụ thể dùng quá tay — nhịp gửi chậm rãi, đúng luật AWS, nhưng ngày nào cũng gọi hàng nghìn lượt thì hóa đơn cuối tháng vẫn nổ. Thiếu lớp nào cũng hở nửa bài toán còn lại.

### Vì sao khai báo `maxTokens` tường minh quan trọng đến vậy

AWS không trừ hạn mức theo số token **thực sự** trả lời ngay từ đầu. Lúc nhận request, nó trừ trước: tổng token đầu vào cộng `maxTokens`. Trong lúc xử lý, số trừ được chỉnh dần theo số token sinh ra thật. Xong request, AWS tính lại: token vào, cộng token ghi cache, cộng token sinh ra nhân hệ số burndown — phần trừ dư được hoàn lại. Tiền thì chỉ tính theo token dùng thật.

`maxTokens` bỏ trống thì mặc định là trần tối đa của mô hình. Nghĩa là request nào cũng bị trừ trước một khoản rất lớn, dù câu trả lời chỉ dài vài trăm chữ, và khoản đó chiếm chỗ của các request khác trong lúc chờ hoàn lại.

Ví dụ ngay trong tài liệu AWS (mô hình có burndown 5x; 3.000 token vào, 1.000 token ghi cache, 1.000 token sinh ra thật): đặt `maxTokens` = 32.000 thì lúc bắt đầu bị trừ 36.000 token; đặt `maxTokens` = 1.250 thì chỉ bị trừ 5.250. Cuối cùng cả hai trường hợp đều chốt ở 9.000 token (3.000 + 1.000 + 1.000 × 5). Cùng một kết quả, nhưng trường hợp đầu chiếm hạn mức gấp gần bảy lần trong lúc chạy, nên chạy đồng thời được ít request hơn nhiều. Số này chỉ để thấy tỉ lệ, không phải hạn mức thật của VF Structures. Đây là lý do một hệ thống ít người dùng vẫn bị AWS từ chối, đã nhắc ở Phần 0.

Một điều ngược trực giác: token **đọc** từ cache (prompt caching — tái dùng phần prompt đã xử lý trước đó) không tính vào hạn mức, cả lúc trừ trước lẫn lúc chốt. Token **ghi** vào cache thì có tính. Vậy cache không chỉ rẻ hơn, nó còn nới thêm hạn mức tốc độ dùng được. Tỉ lệ cache hit được theo dõi ở bảng cảnh báo của [08].

### Chạm hạn mức rồi thì còn đường nào

Chạm trần lớp AWS không phải hết cách, nhưng mỗi cách giải quyết một chuyện khác nhau:

- **Xin AWS nâng hạn mức** — hợp khi nhu cầu ổn định đã vượt hạn mức mặc định. AWS xét từng yêu cầu, không tự động.
- **Reserved tier** — đặt trước công suất TPM riêng, tách khỏi hạn mức on-demand. Cam kết 1 hoặc 3 tháng, trả giá cố định theo tháng, tối thiểu 100.000 TPM vào và 10.000 TPM ra, phải liên hệ đội tài khoản AWS. Phần vượt công suất đã đặt tự tràn sang Standard.
- **Priority tier** — được ưu tiên xử lý, trả thêm phí so với giá thường. Không cần đặt trước.
- **Cross-region inference** — AWS tự chọn một vùng dữ liệu trong nhóm vùng để xử lý request. Với dữ liệu phải ở châu Âu, chọn profile theo **địa lý EU**: request chỉ chạy trong EU, giá chuẩn. Profile **global** rẻ hơn khoảng 10% nhưng có thể chạy ở bất kỳ vùng nào trên thế giới, nên không hợp ràng buộc vị trí dữ liệu của dự án.
- **Flex tier** — chỉ giảm **giá**, không thêm hạn mức: hạn mức on-demand dùng chung cho Priority, Standard và Flex. Đổi lại thời gian xử lý lâu hơn, nên hợp việc chạy nền không ai chờ như đánh giá mô hình (golden set ban đêm, xem Phần 9c).

### Chi phí đi đâu, và ai canh nó

Chi phí của lời gọi mô hình tính theo token vào và token ra, giá mỗi mô hình một khác. Còn chi phí của các phần khác (AgentCore Harness, Managed Knowledge Base, log) thì bộ tài liệu này chưa có số đã kiểm chứng. Trước khi lập ngân sách phải tra trang giá của AWS, không suy từ chi phí token.

Sách *Building Gen AI Applications with Amazon Bedrock* nói thẳng một điều đáng nhớ: Bedrock không nằm trong gói miễn phí của AWS, token tính tiền từ lần gọi đầu tiên. Vì vậy theo dõi chi phí phải bật từ ngày đầu triển khai, không để dành tới khi hóa đơn đầu tiên gây bất ngờ. Để tách chi phí Assistant khỏi phần còn lại của tài khoản AWS, tài liệu AWS mô tả **application inference profile**: một profile tạo riêng cho một mô hình, tài liệu ghi là dùng để theo dõi usage và chi phí, và cho gắn tag. Kích hoạt tag đó làm cost allocation tag thì có thể lọc chi phí theo tag trong Cost Explorer. Lời gọi `Converse` dùng ARN của profile thay cho model ID.

Cảnh báo chi phí đặt ở ba mốc: 50%, 80%, 100% ngân sách tháng — khớp cơ chế cảnh báo có sẵn của AWS Budgets, và trùng đúng ba mốc hạn mức token ngày đã chọn ở [06]. Một cuốn sách khác, viết về đưa RAG lên production, gọi thẳng tên kiểu tấn công này: **denial-of-wallet** — không đánh sập hệ thống, chỉ âm thầm đẩy hóa đơn tăng vọt qua một user hoặc một vòng lặp lỗi không ai để ý. Rate limit và quota ngày (Phần 3) là tuyến phòng đầu; cảnh báo ngân sách là tuyến phòng sau, bắt phần lọt qua tuyến đầu.

Một lưu ý khi đọc số ước tính chi phí ở giai đoạn thiết kế. Sách *Hands-On RAG for Production* ghi rằng tổng chi phí sở hữu (TCO) của một hệ thống RAG tự dựng thường vượt ước tính ban đầu 3 đến 5 lần, và khuyên đặt giám sát chi phí chi tiết cùng cảnh báo ngay từ đầu. Con số đó nói về RAG tự dựng nói chung, không phải phép đo riêng cho VF Structures. Nó chỉ là lý do để canh chi phí bằng số đo thật (CloudWatch, Budgets), không dừng ở bảng tính lúc thiết kế.

---

## Phần 9c · Vì sao cần một tầng riêng canh chất lượng, tách khỏi tầng chạy sản phẩm

Đây là chức năng F7 trong phạm vi hệ thống — chi tiết đầy đủ ở [08], phần này gom lại thành một mạch dễ đọc trong một lượt.

### Vấn đề: mô hình không tự báo khi nó tệ đi

Một mô hình ngôn ngữ không báo lỗi khi trả lời sai. Nó trả lời trôi chảy, đúng ngữ pháp, nghe rất tự tin, dù sai. Một bản cập nhật prompt hay một thay đổi nhỏ ở retrieval đều có thể làm chất lượng lùi mà không ai nhận ra cho tới khi khách hàng phàn nàn. Đổi phiên bản mô hình cũng vậy. Ngoài ra chất lượng có thể trôi dạt dần theo thời gian, nên [08] cho chạy eval theo lịch hằng đêm để bắt trôi dạt của cả mô hình lẫn giám khảo. Vì vậy hệ thống cần một cơ chế đo chất lượng chủ động, chạy trước khi tới tay người dùng, không chỉ trông chờ phản hồi sau đó.

### Cơ chế: golden set chạy như cổng chặn CI, không phải báo cáo

**Golden set** là bộ câu hỏi có sẵn đáp án đúng, lưu trong repo, có version như code. Nó chạy tự động mỗi lần có thay đổi liên quan (prompt, retrieval, phiên bản mô hình), và nếu điểm rớt dưới ngưỡng, thay đổi đó không được merge. Cùng cơ chế như unit test cho code, chỉ khác một chỗ: đáp án đúng ở đây không so khớp một giá trị cố định, mà chấm bằng một mô hình khác, mạnh hơn, giữ vai giám khảo — gọi là **LLM-as-judge**.

Hai tầng canh, hai việc khác nhau: cổng chặn CI đo trước khi lên production (golden set, LLM-as-judge), quan sát vận hành đo sau khi đã lên production (trace, log, phản hồi người dùng thật). Thiếu tầng nào cũng hở — chỉ có cổng CI thì không biết chất lượng có trôi dạt theo thời gian; chỉ có quan sát vận hành thì lỗi đã lọt tới người dùng thật rồi mới biết.

### Quan sát khi đang chạy: trace nối theo từng lượt hỏi

Mỗi lượt hỏi gắn một **trace** — một sợi dây nối lại mọi bước nó đi qua: tìm tài liệu, gọi mô hình, gọi tool, kiểm validator. Mỗi bước là một **span** riêng, có thời điểm bắt đầu và kết thúc. Cơ chế đứng sau là **OpenTelemetry**, một chuẩn mở không khóa vào một công cụ quan sát cụ thể — đích hiện tại là CloudWatch, đổi đích khác sau này không phải viết lại mã đo.

Nhờ trace, khi một lượt trả lời chậm hoặc sai, không cần đoán — nhìn thẳng vào span nào tốn thời gian, hoặc bước nào trả kết quả bất thường.

### Vòng phản hồi: lỗi thật biến thành câu hỏi mới trong golden set

Khi kỹ sư bấm "Xấu" trên một câu trả lời, phản hồi đó vào hàng đợi phân loại hằng tuần. Sau khi xác định nguyên nhân (tìm thiếu tài liệu đúng, kho lỗi thời hoặc thiếu, mô hình sai dù có đủ dữ liệu, hay tool sai), câu hỏi đó, kèm đáp án đúng kỹ sư xác nhận, được thêm vào golden set. Lần sau có thay đổi làm lỗi này tái diễn, cổng CI tự chặn lại. Đây là cách hệ thống học từ lỗi thật mà không cần huấn luyện lại mô hình.

### Một chỗ chưa chắc, cần thử trước khi dựng

Phần chạy golden set hàng loạt (sinh câu trả lời bằng Sonnet 5, chấm điểm bằng Opus 5) định dùng **batch inference** của AWS: nộp cả lô prompt một lần, nhận kết quả ở S3. Trang giá AWS (fetch 21/09/2026) ghi batch rẻ hơn 50% so với on-demand, chỉ áp cho một số mô hình. Nó chỉ hợp với tác vụ chạy nền, không ai ngồi chờ, tuyệt đối không dùng trên đường phục vụ người dùng thật.

Có hai giới hạn phải biết trước khi dựng, cả hai đều lấy từ tài liệu AWS fetch ngày 21/09/2026:

- Bảng mô hình hỗ trợ batch inference có Opus 5 nhưng chưa liệt kê Sonnet 5. Nửa sinh câu trả lời của quy trình có thể phải chạy vòng lặp `Converse` thường.
- Trang batch inference ghi rõ: batch **không hỗ trợ tool calling và structured output**, vì mỗi bản ghi được xử lý độc lập, không có trao đổi nhiều lượt. Các nhóm golden set cần gọi tool (nhóm C, D, I, J ở [08]) vì vậy không chạy qua batch được. Batch chỉ hợp với các nhóm hỏi đáp thuần văn bản và bước chấm điểm, mà bước chấm cũng phải kiểm tra xem có đang dùng structured output không.

Chi tiết và bước kiểm ở [08].

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

### Một chỗ dễ tin nhầm, đã tra tận nguồn

Phân quyền mã hóa của kho tài liệu là chỗ dễ suy luận sai: nghe hợp lý nhất là vai trò dịch vụ của kho cần quyền trên khóa mã hóa. Tài liệu nhà cung cấp nói **ngược lại** — quyền đó cấp cho danh tính *tạo* kho, không cấp cho vai trò dịch vụ. Vai trò dịch vụ chỉ cần quyền khóa khi bucket nguồn dùng khóa riêng, và đó là một khóa khác.

Chỗ này đáng nêu vì nó minh họa đúng thứ cả hệ thống đang chống: **một khẳng định nghe hợp lý, lặp lại nhiều lần, vẫn có thể sai**. Cách duy nhất biết là đi tra tận nguồn.

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
| **Case** | Bộ thông số của một cấu kiện đã được engine tính đạt, tra lại được khi gặp bài toán tương tự |
| **TPM / RPM** | Hạn mức của AWS: token mỗi phút / request mỗi phút, tính chung cho tài khoản |
| **Burndown** | Hệ số AWS quy đổi token viết ra thành token trừ khỏi hạn mức tốc độ |
| **Application inference profile** | Nhãn AWS gắn vào lời gọi mô hình để tách chi phí theo sản phẩm trong Cost Explorer |
| **Denial-of-wallet** | Kiểu tấn công hoặc lỗi làm hóa đơn tăng vọt, không đánh sập hệ thống |
| **Golden set** | Bộ câu hỏi có sẵn đáp án đúng, chạy như cổng chặn CI |
| **LLM-as-judge** | Dùng một mô hình khác, mạnh hơn, để chấm điểm câu trả lời |
| **Trace / Span** | Sợi dây nối các bước của một lượt hỏi / một bước riêng trong sợi dây đó |
| **OpenTelemetry** | Chuẩn mở để ghi trace, không khóa vào một công cụ quan sát cụ thể |

---

## Đọc sâu

[01](01-kien-truc.md) kiến trúc đầy đủ · [02](02-hop-dong.md) hợp đồng API và SSE · [03](03-backend.md) thi công Backend · [04](04-frontend.md) thi công Frontend · [05](05-devops.md) thi công DevOps · [06](06-bao-mat.md) bảo mật và phân quyền · [08](08-eval-quan-sat.md) đánh giá chất lượng và quan sát vận hành · [09](09-trien-khai.md) triển khai · [10](10-rui-ro.md) rủi ro và câu hỏi mở · [00](00-thuat-ngu-va-nguon.md) thuật ngữ và nguồn

Bản trình bày cho lãnh đạo/CTO (hồ sơ đề xuất đầu tư, không thay thế tài liệu này): [kien-truc-day-du.md](kien-truc-day-du.md).
