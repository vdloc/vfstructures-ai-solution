# 00 · Thuật ngữ và nguồn

File này có hai việc.

**Một — giải thích mọi thuật ngữ** xuất hiện trong bộ tài liệu, viết cho người chưa từng làm với AI. Mỗi mục trả lời ba câu: *nó là gì*, *vì sao hệ thống này cần nó*, *đọc thêm ở đâu*.

**Hai — giữ nguồn tham chiếu** cho mọi quyết định kỹ thuật. Bốn file thi công không lặp lại citation; chúng trỏ về đây.

> **Luật về nguồn trong bộ tài liệu này.** Một dòng **Nguồn** chỉ xuất hiện khi thứ đó **đã được kiểm chứng thật** — đọc tài liệu AWS bằng `WebFetch`, hoặc đọc chương sách trong repo skill. Không có nguồn thì ghi thẳng là **chưa kiểm chứng**. Một citation không truy ngược được thì tệ hơn không có citation, vì đó đúng là kiểu lỗi mà cả hệ thống này tồn tại để chặn.

**Mục lục**

- Phần A · Khái niệm nền về AI
- Phần B · Truy xuất tài liệu
- Phần C · Gọi hàm tính toán
- Phần D · An toàn và kiểm soát
- Phần E · Vận hành
- Phần F · Danh mục nguồn
- Đọc tiếp

---

## Phần A · Khái niệm nền về AI

### LLM — Large Language Model

**Là gì.** Mô hình ngôn ngữ lớn. Cách nó hoạt động đơn giản đến bất ngờ: đưa vào một đoạn chữ, nó đoán mẩu chữ tiếp theo, rồi đoán tiếp mẩu sau nữa, cứ thế thành câu.

Nó học từ một lượng văn bản khổng lồ nên đoán rất hợp lý, đọc như người viết. Nhưng bản chất vẫn là **đoán**.

**Vì sao quan trọng ở đây.** Hỏi nó 17 × 23 thì nó không nhân — nó đoán xem chuỗi ký tự nào hay đứng sau câu hỏi đó. Thường đúng, vì phép nhân đó xuất hiện nhiều trong dữ liệu huấn luyện. Nhưng với một phép tính lạ, nó vẫn trả về một con số trông rất tự tin, và con số đó có thể sai.

Toàn bộ kiến trúc này xây quanh đúng một sự thật đó. Nguyên tắc **P2 — mô hình không bao giờ tự tính số** là hệ quả trực tiếp.

### Hallucination

**Là gì.** Mô hình bịa ra thông tin nghe rất thật. Vì nó đoán, nên khi không biết nó **vẫn đoán**, và vì đoán giỏi nên cái nó bịa nghe hợp lý.

**Vì sao quan trọng ở đây.** Trong ngành kết cấu, nó có thể bịa một điều khoản không tồn tại, hoặc bịa một hệ số đúng dạng. Vấn đề không nằm ở chỗ nó sai — mọi phần mềm đều có lỗi. Vấn đề ở chỗ **nó sai mà trông không giống đang sai**.

Nguyên tắc **P3 — không có dẫn chứng thì không có câu trả lời** và ba `validator` ở [03](03-backend.md) tồn tại chỉ để chặn chuyện này.

**Nguồn.** *Hands-On RAG for Production* (Ofer Mendelevitch, Forrest Sheng Bao) — chương về đánh giá RAG và phát hiện hallucination.

### Prompt

**Là gì.** Toàn bộ đoạn chữ đưa cho mô hình: câu hỏi của người dùng, cộng mọi thứ mình muốn nó biết trước khi trả lời — quy tắc, tài liệu tham khảo, lịch sử hội thoại.

**Vì sao quan trọng ở đây.** Có một cám dỗ lớn: viết trong prompt câu *"đừng bịa, chỉ trả lời dựa trên tài liệu tôi đưa"*. Câu đó **có tác dụng**, nhưng **không phải một biện pháp kiểm soát** — nó là lời khuyên, và lời khuyên thì lách được. Người dùng viết câu hỏi khiến mô hình bỏ qua nó; hoặc chính tài liệu nạp vào chứa chỉ dẫn ngược lại (xem `prompt injection`).

Đây là nguyên tắc **P4 — hàng rào nằm ngoài mô hình**, và nó lặp lại ở mọi phần của bộ tài liệu.

### Token

**Là gì.** Đơn vị mô hình đọc và viết. Không phải ký tự, cũng không hẳn là từ — một token cỡ ba phần tư một từ tiếng Anh.

**Vì sao quan trọng ở đây.** **Tiền tính theo token**, cả token đưa vào lẫn token trả ra. Nên mỗi quyết định nhét thêm thứ gì vào prompt là một quyết định **có giá**, không phải lựa chọn miễn phí. Đó là lý do cửa sổ lịch sử hội thoại bị giới hạn (AD-22) chứ không gửi cả hội thoại.

**Cơ chế trừ quota — đã fetch và xác minh.** AWS trừ quota theo ba giai đoạn:

| Giai đoạn | Trừ bao nhiêu |
| --- | --- |
| Lúc bắt đầu request | `tổng input token + max_tokens` — vượt quota là bị throttle **ngay tại đây** |
| Trong khi xử lý | Điều chỉnh dần theo số output token thật |
| Kết thúc | `InputTokenCount + CacheWriteInputTokenCount + (OutputTokenCount × burndown)`, phần thừa **được hoàn lại** |

Nguyên văn: *"The `max_tokens` value is deducted from your quota at the beginning of each request. If you're hitting TPM quotas earlier than expected, try reducing `max_tokens` to better approximate the size of your completions."*

Nên bỏ trống `max_tokens` là lấy trần của mô hình và **giữ chỗ quota theo trần đó ngay từ đầu request**. Đây là nguyên nhân phổ biến nhất của `ThrottlingException` khi lưu lượng còn rất thấp.

**Burndown rate — con số phải biết để tính chi phí.** Không phải 1 output token ăn 1 token quota:

| Mô hình | Burndown cho output token |
| --- | --- |
| Claude Sonnet 5, Opus 5, Fable 5.1 | **10×** |
| Claude 4.8 | 15× |
| Claude 4.7 trở xuống | 5× |
| Các mô hình khác | 1× |

Nghĩa là một câu trả lời 1 000 token của Sonnet 5 ăn **10 000 token** khỏi quota TPM. Tiền thì chỉ tính theo token thật (*"You're only billed for your actual token usage"*), nhưng **hạn mức tốc độ thì tính theo burndown**. Đây là lý do một hệ thống lưu lượng thấp vẫn có thể chạm trần TPM.

**Token đọc từ cache không tính vào quota.** `CacheReadInputTokenCount` không nằm trong công thức trừ quota, và tài liệu ghi rõ *"cache hits are not deducted against your rate limit"*.

**Nguồn — đã fetch.** [How tokens are counted in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-token-burndown.html) · [Quotas for Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas.html)

### Structured output

**Là gì.** Chế độ ép mô hình trả về JSON đúng một khuôn định sẵn.

**Vì sao quan trọng ở đây — và giới hạn của nó.** Nó bảo đảm **hình dạng**, **không** bảo đảm **nghĩa**. Nó chặn được giá trị rác kiểu `intent: "banana"`. Nó **không** chặn được việc mô hình trả `intent: "case_lookup"` trong khi lẽ ra phải là `doc_qa` — hình dạng đúng, nghĩa sai.

Đây là lý do `validator` tất định phải chạy sau, chứ không tin vào schema.

### Region — vùng dữ liệu của AWS

**Là gì.** AWS chạy dịch vụ từ nhiều cụm trung tâm dữ liệu đặt ở các vị trí địa lý khác nhau trên thế giới. Mỗi cụm gọi là một **region**, có một mã ngắn (ví dụ `eu-central-1`) và một tên địa danh đi kèm (ví dụ **Frankfurt** — một thành phố ở Đức). Chọn region nào quyết định dữ liệu và việc tính toán chạy vật lý ở đâu, và region nào có dịch vụ nào không giống nhau.

**Vì sao quan trọng ở đây.** Dự án này chọn `eu-central-1` — tên đầy đủ **Europe (Frankfurt)** — làm region chính. Lý do: đây là region duy nhất ở châu Âu có đủ cả ba thứ dự án cần — Managed Knowledge Base, mô hình rerank, và các mô hình embedding ứng viên (xem mục *Vector store* và *Rerank* bên dưới). Bộ tài liệu này dùng "Frankfurt" và "`eu-central-1`" thay cho nhau — cả hai chỉ cùng một region.

**Nguồn — đã fetch.** [Bedrock endpoints and quotas](https://docs.aws.amazon.com/general/latest/gr/bedrock.html) liệt kê `eu-central-1` với tên "Europe (Frankfurt)".

---

## Phần B · Truy xuất tài liệu

### RAG — Retrieval-Augmented Generation

**Là gì.** Thay vì bắt mô hình nhớ tiêu chuẩn, mình đi tìm vài đoạn tài liệu liên quan nhất, dán vào prompt, rồi bảo nó *"chỉ trả lời dựa trên mấy đoạn này, và ghi rõ lấy từ đoạn nào"*.

**Vì sao chọn cách này.** Hai lý do. Sửa tài liệu là sửa kho, không phải huấn luyện lại mô hình. Và quan trọng hơn: câu trả lời **kiểm tra được**, vì mỗi khẳng định có đường dẫn về đoạn gốc.

**Nguồn.** *Hands-On RAG for Production* — kiến trúc RAG, chunking, embedding, hybrid search, rerank · *AI Agents in Action* (Micheal Lanham) ch8 — RAG là cơ chế chung cho cả "kiến thức" lẫn "trí nhớ" của agent.

### Embedding và vector

**Là gì.** Máy không hiểu nghĩa của chữ. Nên có kỹ thuật biến mỗi đoạn văn thành một dãy số — thường một nghìn tới một nghìn rưỡi con số. Dãy số đó gọi là **vector**; việc biến chữ thành vector gọi là **embedding**.

Điều đặc biệt: dãy số đó **mang nghĩa**. Hai đoạn nói cùng chuyện thì hai dãy số nằm gần nhau, kể cả khi dùng từ khác hẳn. *"Cốt thép tối thiểu"*, *"hàm lượng cốt thép nhỏ nhất"* và *"armature minimale"* — ba cách nói, ba dãy số sát nhau.

Hình dung như tấm bản đồ: mỗi đoạn văn là một điểm, đoạn cùng chủ đề đứng gần nhau. Tìm kiếm = thả câu hỏi xuống bản đồ rồi nhặt điểm quanh chỗ nó rơi.

**Ràng buộc phải nhớ.** Mô hình embedding **không đổi được sau khi tạo Knowledge Base**. Đổi ý là tạo kho mới và nạp lại toàn bộ. Đây là lý do AD-06 bắt chốt mô hình bằng đo đạc **trước** khi tạo kho.

**Nguồn.** *Vector Databases: A Practical Introduction* (Nitin Borwankar) — embedding, cosine similarity, chỉ mục · *AI Agents in Action* ch8 — so sánh TF-IDF và embedding.

### Chunk và sidecar

**Là gì.** Tài liệu quá dài để đưa cả vào prompt, nên nó bị cắt thành mảnh. Mỗi mảnh gọi là **chunk**. Đi kèm mỗi chunk là một file mô tả nhỏ gọi là **sidecar** (`.metadata.json`), mang tiêu chuẩn nào, ấn bản năm nào, điều khoản số mấy, trang bao nhiêu, ai được đọc, trạng thái ra sao.

**Ấn bản và ngày hiệu lực (AD-26).** Sidecar còn mang `family_key` (gom các ấn bản của cùng một tiêu chuẩn, kèm phụ lục quốc gia), `effective_from` và `effective_to` (khoảng ngày có hiệu lực, dạng số `yyyymmdd` vì filter chỉ so lớn/nhỏ trên số). Similarity score không biết bản nào còn hiệu lực; hai ấn bản có thể khác nhau đúng một hệ số. Vì vậy chọn ấn bản là việc của filter, không phải của score.

**Vì sao mình tự cắt thay vì để AWS cắt.** Managed Knowledge Base nhận PDF thô và tự cắt được — nhưng nó cắt theo số ký tự. Cắt kiểu đó thì mất `clause_path` và `page`, mà thiếu hai trường đó là **không dựng được citation**. Không có citation thì theo P3, không có câu trả lời.

Đây là một ví dụ của nguyên tắc chung: **quyết định tự làm hay mua phải cân theo từng thành phần**, không phải một lựa chọn nhị phân cho cả hệ thống. Cắt tài liệu theo cấu trúc điều khoản là chỗ tạo khác biệt — tự làm. Lưu và tìm vector thì ai cũng cần như nhau — mua.

**Nguồn.** Khung "đánh giá build-vs-buy theo từng thành phần của pipeline RAG (embedding, vector DB, retrieval, prompt, LLM, hallucination detection), không phải một lựa chọn nhị phân" là của *Hands-On RAG for Production* (Ofer Mendelevitch, Forrest Sheng Bao) — cũng là nguồn cho chunking và overlap. *Building AI-Powered Products* (Dr. Marily Nika) có khung build-vs-buy riêng (ma trận 7 yếu tố, ch5) nhưng ở mức sản phẩm, không phải theo từng thành phần kỹ thuật; hai khung này dễ bị lẫn với nhau.

### Vector store

**Là gì.** Kho chứa và tìm các vector.

**Quyết định ở đây (AD-17).** Mình **không tự dựng**. Dùng **Bedrock Managed Knowledge Base**, để AWS lo embedding, lưu trữ và tìm kiếm.

**Đã xác minh: MKB có ở Frankfurt.** Trang region của MKB liệt kê `eu-central-1` — Europe (Frankfurt). Đây là **V-K2, nay đã trả lời**, không còn là kiểm chứng chặn.

Danh sách đầy đủ: `us-east-1`, `us-west-2`, `eu-west-1`, `eu-west-2`, **`eu-central-1`**, `ap-northeast-1`, `ap-southeast-2`, `us-gov-west-1`.

**Ba thứ MKB có sẵn mà thiết kế ban đầu định tự làm:**

| MKB có sẵn | Thiết kế ban đầu | Phải xem lại |
| --- | --- | --- |
| **Reranker quản lý sẵn, không tính thêm tiền** — *"Comes with built-in managed semantic reranker optimized for accuracy and performance at no extra cost"* | Gọi Cohere Rerank 3.5 riêng, trả tiền riêng | Có. Đo hai bên trước khi quyết (V-K6). **Chỉ dùng được khi KB dùng embedding do AWS quản**, xem đoạn dưới |
| **Hybrid retrieval sẵn và luôn bật** — trang truy vấn ghi *"Retrieval always uses hybrid search, which combines keyword and semantic search. Semantic-only search is not available for fully managed knowledge bases."* | Chờ V-K5 xem `overrideSearchType: HYBRID` có dùng được không | **V-K5 đã trả lời, bỏ.** `ManagedSearchConfiguration` không có `overrideSearchType` |
| **Parser đa định dạng sẵn** — *"Built-in parser for multimodal file types"*, chunking chọn giữa built-in hoặc fixed-size | Worker tự parse và cắt theo điều khoản | **Không đổi.** Parser dù tốt vẫn không sinh ra `clause_path`, mà thiếu trường đó là không dựng được citation |

**Ràng buộc cứng cho embedding tự chọn.** Nhánh B của AD-06 không tự do: MKB chỉ nhận *"any Bedrock embedding model with float32 and 1024 dimensions"*. Danh sách hỗ trợ trên trang tạo KB: Titan Text Embeddings V2, Cohere Embed English v3, Cohere Embed Multilingual v3, Cohere Embed v4, Amazon Nova Multimodal Embeddings. Hệ quả: Titan V2 phải cấu hình **1024 chiều** (nó hỗ trợ 256/512/1024), và Cohere Embed v4 cũng phải chọn **1024** trong các cỡ 256/512/1024/1536. Loại embedding **không đổi được sau khi tạo KB**: *"You cannot change the embedding model type after creating the knowledge base."*

**Ràng buộc chéo giữa embedding và reranker.** Trang tạo KB ghi: *"If you create a knowledge base with a custom embedding model, the managed reranker is not available for that knowledge base."* Nghĩa là chọn nhánh B của AD-06 (embedding riêng) thì **mất reranker quản lý sẵn**, chỉ còn hai đường: dùng mô hình rerank riêng (`rerankingModelType: CUSTOM`) hoặc không chấm lại (`NONE`). Hai quyết định này phải chốt cùng nhau, trước khi tạo KB.

Titan V2, Cohere English và Cohere Multilingual có ở `eu-central-1` theo trang models-supported (fetch 18–19/09/2026). Vùng của Cohere Embed v4 và Nova Multimodal Embeddings **chưa kiểm**.

**Nguồn — đã fetch.** [Build a managed knowledge base](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-build-managed.html) · [Supported AWS Regions cho managed KB](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-regions.html) · [Supported models and Regions cho Knowledge Bases](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-supported.html) · [Retrieve data and generate AI responses](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)

### Retrieval

**Là gì.** Việc đi tìm chunk liên quan tới câu hỏi. Ở đây là lời gọi API tên `Retrieve`.

**Cấu hình truy vấn của MKB nằm ở `retrievalConfiguration.managedSearchConfiguration`, không phải `vectorSearchConfiguration`.** Trang truy vấn ghi: *"Use `managedSearchConfiguration` in the `retrievalConfiguration` instead of `vectorSearchConfiguration`. The `vectorSearchConfiguration` field is used for custom knowledge bases only."* Mã .NET copy từ ví dụ của custom KB sẽ đặt sai chỗ.

`ManagedSearchConfiguration` có đúng bốn field: `filter`, `numberOfResults` (1 đến 100), `rerankingModelType` (`MANAGED` mặc định, `CUSTOM`, `NONE`) và `rerankingConfiguration`. Không có `overrideSearchType`, không có tham số ngưỡng điểm.

**Hai tham số API phải đặt tay, một quy tắc phía ứng dụng:**

| Thành phần | Mặc định | Đặt thành | Vì sao |
| --- | --- | --- | --- |
| `numberOfResults` | Tài liệu chung ghi **5**. Trang managed không nêu mặc định | 40 | 5 quá ít cho câu hỏi kỹ thuật, và phía sau còn một chặng chấm lại. Đặt tường minh để khỏi phụ thuộc vào mặc định |
| `filter` | không có | luôn có `scope_key` + `status` | **Đây là hàng rào phân quyền.** Xem mục *Scope* |
| Ngưỡng điểm (**mã của mình, không phải API**) | không có | bắt đầu 0.5, hiệu chỉnh bằng golden set | Retrieval **luôn trả về một cái gì đó**, nên ngưỡng là hàng rào thật. Mỗi kết quả có `score`; mã của mình so `score` với ngưỡng. Con số 0.7 hay gặp là thang cosine của `pgvector`, **không chuyển sang thang của MKB được** |

**Nguồn — đã fetch.** [Query a knowledge base and retrieve data](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-retrieve.html) · [ManagedSearchConfiguration](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_ManagedSearchConfiguration.html) · [Configure and customize queries](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-config.html): *"Amazon Bedrock returns up to five results in the response by default"* (trang chung). Ngưỡng 0.5: skill `amazon-bedrock`, *"Start with 0.5, tune based on evaluation"*.

### Metadata filter và ba đường có thể hỏng im lặng

**Là gì.** Điều kiện lọc gắn vào `filter` trong `managedSearchConfiguration` của lời gọi `Retrieve`, dựa trên các thuộc tính trong sidecar.

**Toán tử dùng được:** `equals`, `notEquals`, `in`, `notIn`, `greaterThan(OrEquals)`, `lessThan(OrEquals)`, ghép bằng `andAll` / `orAll`. Trang cấu hình truy vấn khuyên đúng nhóm này cho managed KB: *"Use `equals`, `greaterThan`, `lessThan`, `in`, or `notIn` operators instead."*

**Toán tử không được hỗ trợ trên managed KB:** `startsWith`, `stringContains`. Nguyên văn: *"The `startsWith` and `stringContains` metadata filters are not supported for managed knowledge bases."* `listContains` không nằm trong câu đó, nhưng thiết kế này vẫn cấm nó theo hướng thận trọng.

**Tên thuộc tính:** managed KB dành riêng tên bắt đầu bằng dấu gạch dưới (ví dụ `_source_uri`, `_data_source_id`). Không đặt thuộc tính của mình bắt đầu bằng `_`.

**Ba đường có thể hỏng.** Trạng thái kiểm chứng của từng đường ghi rõ ở cột cuối:

| # | Tình huống | Kết quả có thể xảy ra | Trạng thái |
| --- | --- | --- | --- |
| 1 | Lọc trên thuộc tính **không có trong sidecar** của tài liệu đã nạp | Trả về **rỗng** — nhìn như kho không có gì khớp | Tài liệu managed: thuộc tính *"must have been present on the ingested documents"*. Khi thiếu thì rỗng hay lỗi: **chưa kiểm chứng**. Với custom KB, tài liệu ghi là trả rỗng |
| 2 | Dùng `startsWith` hoặc `stringContains` | Báo lỗi, **hoặc** toán tử bị bỏ qua → chạy như không có filter → trả về **tất cả** | Không hỗ trợ: **đã xác nhận**. Báo lỗi hay bỏ qua: **chưa kiểm chứng cho MKB**. "Bị bỏ qua im lặng" là câu của tài liệu custom KB trên vector store không hỗ trợ |
| 3 | Quên `numberOfResults` | Lấy mặc định | Tài liệu chung ghi 5; trang managed không nêu mặc định. Đặt tường minh 40 |

Nếu đường 2 hóa ra là "bị bỏ qua" thì đây là đường nguy hiểm nhất, vì nó phá đúng hàng rào phân quyền mà không có lỗi. Cách chặn không phụ thuộc vào kết quả kiểm chứng: **chỉ dùng `equals`, `in`, `notIn` và toán tử số**, và V-K4 thử cả ba đường trên KB thật.

**Nguồn — đã fetch.** [Configure and customize queries](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-config.html), mục *Manual metadata filtering / Managed knowledge base considerations* · [Managed KB S3 connector](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-ds-s3.html). Câu *"the filter is silently ignored"* và *"filtering on undeclared attributes silently returns no results"* chỉ có trong tài liệu skill `amazon-bedrock` cho custom KB, không có trong trang managed.

### Rerank

**Là gì.** Chấm điểm lại kết quả tìm được.

**Khác gì tìm bằng vector.** Tìm bằng vector là so hai dãy số đã tính sẵn từ trước — nhanh nhưng thô. Rerank **đọc cả câu hỏi lẫn từng chunk cùng lúc** rồi chấm lại. Chính xác hơn nhiều, nhưng chậm và tốn hơn, nên chỉ chạy trên 40 chunk đã lọc chứ không chạy trên cả kho.

**Hai lựa chọn ở Frankfurt, và một lựa chọn thứ ba miễn phí.** Trong toàn bộ châu Âu, `eu-central-1` là region duy nhất có mô hình rerank:

| Mô hình | Model ID | Region có |
| --- | --- | --- |
| Cohere Rerank 3.5 | `cohere.rerank-v3-5:0` | `ap-northeast-1`, `ca-central-1`, **`eu-central-1`**, `us-east-1`, `us-west-2` |
| Amazon Rerank 1.0 | `amazon.rerank-v1:0` | `ap-northeast-1`, `ca-central-1`, **`eu-central-1`**, `us-west-2` |

Đây là một trong những lý do chọn Frankfurt làm region chính.

Lựa chọn thứ ba: **MKB đã có reranker quản lý sẵn, không tính thêm tiền**, và nó **bật mặc định** (`rerankingModelType: MANAGED`). Trước khi trả tiền cho một mô hình rerank riêng, phải đo xem reranker sẵn có đủ không.

Chọn mô hình rerank riêng thì đặt `rerankingModelType: CUSTOM` kèm `rerankingConfiguration` (model ARN) **ngay trong lời gọi `Retrieve`**, không cần gọi API `Rerank` riêng. Tắt chấm lại thì `NONE`. Reranker sẵn có chỉ dùng được khi KB dùng embedding do AWS quản, xem mục *Vector store* ở trên.

**Nguồn — đã fetch.** [Supported Regions and models for reranking](https://docs.aws.amazon.com/bedrock/latest/userguide/rerank-supported.html) · *Hands-On RAG for Production* — hybrid search và reranking.

### `pg_trgm` và stage 1

**Là gì.** Một extension của PostgreSQL so chuỗi theo mức giống nhau, hoạt động giống tính năng gợi ý khi gõ sai chính tả.

**Vì sao cần nó dù đã có vector.** Tìm bằng vector rất giỏi so nghĩa nhưng **rất dở tra số hiệu chính xác**. Người dùng gõ `6.22` mà ý là `6.2.2` thì cả tìm theo nghĩa lẫn tìm theo từ khóa đều trượt. Nên PostgreSQL giữ một bảng nhỏ `clause_ref`, phân giải mã gõ gần đúng thành mã chuẩn, rồi đưa vào filter.

Hệ quả kiến trúc: **PostgreSQL vẫn nằm trong đường retrieval**, dù vector store đã sang AWS.

---

## Phần C · Gọi hàm tính toán

### Tool calling

**Là gì.** Mô hình không tính. Nhưng nó có thể **nói ra rằng nó muốn gọi hàm nào, với tham số nào**.

Cách làm: mình mô tả cho mô hình một danh sách hàm có sẵn — tên, tham số, đơn vị, khoảng giá trị hợp lệ. Mô hình đọc câu hỏi rồi trả về đại ý *"gọi hàm kiểm tra cắt, b = 300 mm, h = 600 mm, bê tông C30/37"*. Mã của mình nhận, **kiểm tra**, rồi mới gọi engine .NET thật. Engine trả JSON; mình đưa JSON đó lại cho mô hình để diễn giải thành câu.

**Tóm lại: mô hình chọn hàm và điền tham số. Engine tính.** Con số ra màn hình là con số của engine.

**Nguồn.** *Engineering Generative AI-Based Software* (Miroslaw Staron) — kiến trúc phần mềm cho hệ xác suất · skill `amazon-bedrock`, *Converse API*.

### ToolGate

**Là gì.** Sáu lớp kiểm chạy giữa mô hình và engine, nằm trong một service riêng tên `Tool facade`. Bảng sáu lớp và điều kiện trượt của từng lớp ở [01](01-kien-truc.md) §8.5.

Hai lớp đáng giải thích kỹ ở đây, vì cả hai là chỗ hệ thống **sai mà vẫn trông như đúng**:

**Lớp 04 — đơn vị bắt buộc.** Mô hình thấy `b = 0.3` có thể hiểu là 0,3 mét, cũng có thể hiểu 0,3 milimét. Đoán sai **một nghìn lần**, mà kết quả tính ra vẫn là con số trông hợp lý. Quy tắc tuyệt đối: thiếu đơn vị thì **từ chối**, không bao giờ suy diễn.

**Lớp 06 — đọc mã kết quả thật.** Hệ thống hiện tại trả lỗi `Forbidden` **bên trong** một phản hồi HTTP 200. Về mặt giao thức mạng là "thành công", phải mở phần thân ra đọc mã mới biết bị từ chối. Hậu quả: mọi lớp bảo mật tầng ngoài **không nhìn thấy**. Chỉ mã của mình đọc được. Không bắt ở đây thì một lỗi quyền trôi vào câu trả lời như dữ liệu hợp lệ.

Đây là lý do `Tool facade` bắt buộc tồn tại, không phải lựa chọn cho đẹp.

### AgentCore Harness

**Là gì.** Dịch vụ của AWS quản vòng lặp *"mô hình đòi gọi hàm → gọi → trả kết quả → mô hình xem xét rồi gọi tiếp hoặc trả lời"*.

**Cái giá.** Harness **không có điểm móc** để nhét ToolGate vào giữa vòng lặp. Nên ToolGate phải đứng ở service riêng mà Gateway gọi tới.

**Sáu mặc định phải ghi đè** — mô hình, số vòng, thời gian chạy, hai tool `shell`/`file_operations` bật sẵn, memory, và cách xác thực. Mặc định đều sai với dự án này, và **hệ thống vẫn chạy** nếu không đụng vào, chỉ là chạy sai mà không báo lỗi nào.

**Bảng đầy đủ (giá trị mặc định, giá trị phải đặt, hệ quả nếu bỏ qua) ở [01](01-kien-truc.md) §8.4** — giữ một bản duy nhất ở đó để hai bản không lệch nhau.

**Nguồn.** [AgentCore Harness](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness.html) · [CreateHarness API](https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_CreateHarness.html) · [Harness security](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-security.html) · *AI Agents on AWS* (Bunny Kaushik, Mona M) ch6 — triển khai AgentCore ở production.

### `toolUseId` và chạy lại an toàn

**Là gì.** Mã của một lần mô hình yêu cầu gọi tool. Facade dùng nó làm khóa idempotency: cùng `toolUseId` đến lần hai (Gateway retry sau timeout) thì trả lại kết quả đã có, không gọi engine lần nữa (AD-27).

**Vì sao cần dù hiện chưa có tool ghi.** Với tool chỉ đọc, chạy hai lần chỉ tốn tiền. Nhưng luật phải có từ bây giờ: tool ghi thêm sau này mà thiếu khóa idempotency thì một lần retry là một bản ghi trùng.

### Cedar

**Là gì.** Ngôn ngữ chính sách phân quyền của AWS, chạy ở Gateway để quy định ai gọi được tool nào với dự án nào.

**Nguồn.** [AgentCore Policy](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html)

---

## Phần D · An toàn và kiểm soát

### Guardrails

**Là gì.** Bộ lọc nội dung có sẵn của Bedrock: chặn chủ đề cấm, chặn tấn công prompt, che dữ liệu cá nhân.

**Hai cái bẫy phải biết:**

**Bẫy một — che PII chỉ áp dụng cho response.** Nội dung gốc **chưa che, gồm cả PII, vẫn được ghi nguyên văn vào CloudWatch Logs**. Với yêu cầu GDPR, đây là chỗ bắt buộc mã hóa log bằng KMS và giới hạn quyền đọc.

**Bẫy hai — thiếu `GuardrailVersion` thì guardrail không chạy và không báo lỗi.** Hỏng im lặng. Chỉ phát hiện được bằng test chủ động.

**Nguồn.** Skill `amazon-bedrock`, *Critical Warnings*: *"Guardrails PII masking only applies to the API response. Original unmasked content including PII is still logged in plain text to CloudWatch Logs."* · [Guardrails permissions](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-permissions-id.html) · [Mã hóa CloudWatch Logs bằng KMS](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html)

### Prompt injection

**Là gì.** Chỉ dẫn độc hại giấu trong dữ liệu mà mô hình đọc. Ở đây, chunk tài liệu đến từ tiêu chuẩn của bên thứ ba, hoàn toàn có thể chứa một câu kiểu *"bỏ qua mọi chỉ dẫn trước đó"* chèn giữa trang PDF.

**Chặn thế nào.** Nội dung chunk phải qua `ApplyGuardrail` **trước khi** vào ngữ cảnh, bằng một lời gọi riêng — vì guardrail **không tự soi** nội dung đi qua tool.

### Scope

**Là gì.** Phạm vi dữ liệu một người dùng được đọc, dạng `public`, `org:42`, `project:7`.

**Chỗ nguy hiểm nhất của cả kiến trúc.** Trước đây lọc quyền là một mệnh đề trong câu lệnh SQL:

```sql
SELECT chunk_id, content
FROM chunk
WHERE scope_key = ANY(@scopes) -- ← lọc quyền
ORDER BY embedding <=> @q
LIMIT 40;
```

Phần tìm kiếm và phần lọc quyền nằm **cùng một câu lệnh**. Hơn nữa PostgreSQL có **Row-Level Security** — bật lên thì chính sách nằm **trong database**, mọi truy vấn đều bị lọc, kể cả truy vấn viết sai. Điều kiện: role của ứng dụng không phải superuser, không có `BYPASSRLS`, và không phải owner của table (owner bỏ qua RLS trừ khi table chạy `FORCE ROW LEVEL SECURITY`). Nguồn: [PostgreSQL, Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

Bây giờ nó là **một tham số của lời gọi API**:

```csharp
RetrievalConfiguration = new {
 ManagedSearchConfiguration = new {   // không phải VectorSearchConfiguration: field đó chỉ dành cho custom KB
 NumberOfResults = 40,
 Filter = BuildScopeFilter(scopes) // ← lọc quyền, ở đây
 }
}
```

Tên property chính xác trong AWS SDK for .NET **chưa kiểm** (V-K3). Đoạn trên minh họa cấu trúc theo tài liệu API, không phải mã chạy được.

Bỏ dòng `Filter` đi: đoạn code vẫn **hợp lệ**, compile qua, type check qua, chạy được, trả về 40 chunk đúng định dạng. Chỉ là 40 chunk đó lấy từ tài liệu của **mọi organization**.

> **Ở SQL, bỏ sót là chuyện không làm được. Ở API, bỏ sót chỉ là chuyện khó.**

**Ba lớp chặn thay thế:**

1. **Một class duy nhất** được phép gọi `Retrieve` — `ScopedKnowledgeBaseClient`. Scope là tham số khởi tạo bắt buộc, rỗng là ném lỗi ngay ở constructor. Không có overload nào nhận filter từ ngoài.
2. **Architecture test trong CI** cấm mọi type khác tham chiếu client `bedrock-agent-runtime`. Vi phạm là build đỏ, không phải review bắt.
3. **Test tích hợp đa organization** — nạp hai chunk khác `scope_key`, gọi qua đường thật, khẳng định chỉ trả về một.

#### Sách nói gì về cách ly dữ liệu giữa các tenant

Đối chiếu với các ghi chú chương trong repo `ai-books-skills`, đọc trực tiếp. Sách ủng hộ hướng đang dùng, và nêu thêm một hướng cấu trúc khác:

| Nguồn | Nội dung | Áp dụng |
| --- | --- | --- |
| *Hands-On RAG for Production* ch1 | *"Access control is a first-class RAG benefit, not an afterthought — implement it via metadata filtering at retrieval time."* | Khớp với `filter` theo `scope_key` ở AD-17 |
| *Build AI-Enhanced Web Apps*, pattern *Namespaced Shared Vector Store* | *"one shared vector store with strict namespacing/metadata filtering (user ID + knowledge-base ID) enforced on every query and write."* Mặc định dùng kho chung; sách ghi cách ly này là **logic, không phải vật lý** — *"insufficient for strict regulatory/compliance requirements demanding physical separation"* | Khớp AD-17. Chữ **"every query and write"** là lý do R46 cần `ScopedKnowledgeBaseClient`: một lời gọi thiếu filter là hỏng |
| *Enterprise Guide for Implementing Generative AI and Agentic AI* ch3, *Zero Trust Pattern* | *"default-deny access control, permissions granted strictly on a need basis"* | Cùng tinh thần với hướng hỏng-đóng của ACL-aware retrieval và với default-deny của PostgreSQL RLS |
| *AI Agents on AWS* ch7 | Chính sách Cedar phải kiểm thuộc tính đã xác thực (`principal.orgId`), *"never values a prompt-injected conversation could have influenced"* | Khớp mục 8 của [06](06-bao-mat.md): `org_id` lấy từ Payment API |
| *Using Amazon Bedrock* ch6 | RAG giảm chứ không loại bỏ hallucination; cần kiểm soát quyền **ghi** vào vector database để chống đầu độc dữ liệu | Áp cho bucket S3 nguồn và vai `Assistant.Curate`: ai ghi được chunk hoặc sidecar là người quyết định `scope_key` |

**Một hướng cấu trúc khác, theo sách: một KB riêng cho mỗi organization.** Sách dành hướng này cho yêu cầu pháp lý hoặc tuân thủ chặt. Ưu điểm: quên `filter` không còn làm rò dữ liệu chéo organization, vì mỗi KB chỉ chứa dữ liệu của một organization. Cái phải trả: quản nhiều KB, và tài liệu `public` phải nạp vào từng KB hoặc truy vấn thêm một KB chung rồi gộp kết quả. Hướng này **chưa được đánh giá** trong bộ tài liệu, chưa có số đo chi phí hay giới hạn số KB. Ghi lại để quyết khi Q1 (residency) và R46 được đưa lại lên bàn.

#### Một lựa chọn khác vừa tìm ra: ACL-aware retrieval

MKB có một cơ chế phân quyền **khác hẳn** metadata filter, và điểm khác quan trọng nhất là **hướng hỏng**:

| | Metadata filter (thiết kế hiện tại) | ACL-aware retrieval |
| --- | --- | --- |
| Quyền khai ở đâu | Trong sidecar của từng chunk | Trong file ACL global trên S3, hoặc trong `accessControlList` của sidecar. Chỉ nhận kiểu `USER` (email) |
| Truyền lúc truy vấn | `filter` trong `retrievalConfiguration.managedSearchConfiguration` | `userContext.userId` mang email người dùng |
| **Quên truyền thì sao** | **Trả về tất cả** — hỏng mở | **Không trả gì** — hỏng đóng |
| Lỗi giữa chừng | Không có khái niệm | *"ACL-aware retrieval fails closed"* — lỗi thì không trả tài liệu liên quan |
| S3 connector | Có | Có, nhưng **không có xác minh thời gian thực** vì file ACL do mình cung cấp |

Hướng hỏng là khác biệt quyết định. Với một ranh giới đa khách hàng, **hỏng đóng tốt hơn hỏng mở** một cách tuyệt đối.

**Nhưng AWS nói thẳng đây không phải authorization:**

> *"Bedrock Managed Knowledge Base provides ACL-aware filtering, not a security boundary. Bedrock Managed Knowledge Base does not authenticate end users — your application is responsible for authenticating users and passing verified identity context."*

Và định danh là **email**, không có ánh xạ chéo: *"The user is always identified by their universal email — the email you pass in the user context must exactly match the email associated with the user in each connected data source."* Sai email thì **khớp hụt trong im lặng** và người dùng không nhận được gì.

**Đánh giá cho kiến trúc này.** Mô hình phân quyền ở đây theo tổ chức và dự án (`org:42`, `project:7`), không theo email cá nhân. Điều dễ giả định nhầm là ACL của S3 hỗ trợ nhóm, ánh xạ thẳng được sang `allowed_groups`. **Không có kiểu nhóm.** Trang ACL của S3 ghi mỗi entry gồm `Name` (email), `Type` (*"Must be `USER`"*) và `Access` (`ALLOW` hoặc `DENY`).

Hệ quả:

- Muốn cho một organization đọc một tài liệu thì file ACL phải liệt kê **từng email** của mọi thành viên. Danh sách thành viên đổi thì file ACL đổi, và *"Global ACL file changes require reindexing of the affected prefix"*.
- Tài liệu không có ACL entry thì **không được nạp**: *"documents without an associated ACL entry are not ingested"*. Tài liệu `public` cũng phải có entry.
- `aclEnabled` **không đổi được sau khi tạo data source**.
- Trong cùng một KB, data source không bật ACL trả kết quả cho mọi user, bất kể `userContext`.

Cái được vẫn nguyên: quên `userContext` thì **không trả gì** (*"ACL-enabled data sources return zero results"*), lỗi thì **không trả tài liệu**. Hướng hỏng-đóng vẫn tốt hơn hỏng-mở.

Nhưng chi phí vận hành cao hơn nhiều so với một `filter` theo `scope_key`, và AWS nói thẳng đây không phải authorization. Vì vậy ACL-aware retrieval xếp ở vai **hướng phòng thủ thêm** đáng thử ở V-K4, không phải ứng viên thay thế AD-17. Quyết định chưa chốt.

**Nguồn — đã fetch.** [Access Control Lists awareness enablement](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-acl.html)

### Quyền IAM của service role cho Knowledge Base

**Là gì.** MKB không tự đọc được S3. Nó cần một IAM role mà Bedrock *đóng vai* để đi lấy dữ liệu. Role này gọi là **service role**.

**Trust policy — chống confused deputy.** "Confused deputy" là tình huống một dịch vụ có quyền bị lừa dùng quyền đó thay cho kẻ tấn công. Hai điều kiện dưới đây khóa lại: Bedrock chỉ được đóng vai role này khi **request đến từ đúng tài khoản của mình** và **đúng loại tài nguyên knowledge base**.

```json
{
  "Effect": "Allow",
  "Principal": { "Service": "bedrock.amazonaws.com" },
  "Action": "sts:AssumeRole",
  "Condition": {
    "StringEquals": { "aws:SourceAccount": "123456789012" },
    "ArnLike": { "AWS:SourceArn": "arn:aws:bedrock:eu-central-1:123456789012:knowledge-base/*" }
  }
}
```

Tài liệu ghi rõ nên siết sau khi tạo: *"As a best practice for security purposes, replace the `*` with specific knowledge base IDs after you have created them."*

**Quyền đọc S3 — có một điều kiện dễ sót.** Ngoài `s3:ListBucket` và `s3:GetObject` giới hạn đúng ARN, policy mẫu của AWS còn kèm điều kiện `aws:ResourceAccount`:

```json
{
  "Sid": "S3GetObjectStatement",
  "Effect": "Allow",
  "Action": ["s3:GetObject"],
  "Resource": ["arn:aws:s3:::<bucket>/*"],
  "Condition": { "StringEquals": { "aws:ResourceAccount": "123456789012" } }
}
```

Điều kiện này chặn role bị dùng để đọc một bucket trùng tên ở tài khoản khác.

**Một ràng buộc vận hành.** *"A policy cannot be shared between multiple roles when the service role is used."* — không dùng chung một policy cho nhiều role.

**Nguồn — đã fetch.** [Create a service role for Amazon Bedrock Knowledge Bases](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-permissions.html)

### Mã hóa Knowledge Base bằng KMS

**Mặc định.** Bedrock mã hóa dữ liệu knowledge base bằng **khóa do AWS sở hữu**. Đủ cho phần lớn trường hợp.

**Dùng khóa của công ty.** Với managed KB, khóa **chỉ định lúc tạo knowledge base**, và **một khóa duy nhất** phủ cả hai giai đoạn:

> *"The KMS key is specified during knowledge base creation and applies to both transient data storage during ingestion and permanent data storage for indexing."*

Bedrock tạo một **grant** trên khóa lúc tạo KB, và **thu hồi grant khi xóa KB**.

> **Chỗ dễ suy luận sai.** Giả định tự nhiên là service role của KB cần quyền KMS. **Không đúng với khóa của knowledge base.** Nguyên văn AWS:
>
> *"You provide these permissions in the key policy of your AWS KMS key for the IAM identity that creates the knowledge base... **The IAM service role that is associated with the knowledge base (the role that Amazon Bedrock uses to read your data sources) does not require any permissions on the KMS key.**"*
>
> Quyền KMS nằm ở **key policy**, cấp cho **danh tính tạo KB**, không cấp cho service role.
>
> Service role **chỉ** cần quyền KMS khi **bucket S3 nguồn** được mã hóa bằng khóa KMS riêng — đó là một khóa khác, một lý do khác, và điều kiện là `kms:ViaService: s3.<region>.amazonaws.com`.

Hai chỗ dễ nhầm này khác nhau:

| Khóa nào | Ai cần quyền | Điều kiện |
| --- | --- | --- |
| Khóa của **knowledge base** | Danh tính **tạo** KB, qua key policy | `kms:ViaService: bedrock.<region>.amazonaws.com`, kèm `kms:GrantOperations` |
| Khóa của **bucket S3 nguồn** | **Service role** của KB | `kms:ViaService: s3.<region>.amazonaws.com` |

**Nguồn — đã fetch.** [Encryption of knowledge base resources](https://docs.aws.amazon.com/bedrock/latest/userguide/encryption-kb.html)

### CloudTrail data event

**Là gì.** AWS chia log thành hai loại. **Management event** (tạo tài nguyên, sửa cấu hình) được ghi tự động. **Data event** (đọc/ghi dữ liệu) **không được ghi mặc định**.

**Vì sao phải biết.** Lời gọi `Retrieve` thuộc loại **data event**. Không bật thì có rò rỉ cũng không truy ngược được ai đã tìm gì.

Cùng trang này ghi thêm: lời gọi `ApplyGuardrail` cũng là data event, nằm ở resource type `AWS::Bedrock::Guardrail`. Còn Harness thì CloudTrail dùng resource type `AWS::BedrockAgentCore::Runtime`, với `InvokeAgentRuntime` và `InvokeAgentRuntimeCommand` là data event. Muốn truy ai đã gọi Harness thì bật selector cho loại đó, không phải loại "harness".

Bật bằng advanced event selector cho resource type `AWS::Bedrock::KnowledgeBase`:

```bash
aws cloudtrail put-event-selectors --trail-name <trail> \
--advanced-event-selectors '[{
 "Name": "Log all data events on a knowledge base in Amazon Bedrock.",
 "FieldSelectors": [
 { "Field": "eventCategory", "Equals": ["Data"] },
 { "Field": "resources.type", "Equals": ["AWS::Bedrock::KnowledgeBase"] }
 ]
}]'
```

**Nguồn — đã fetch và xác minh.** [Monitor Amazon Bedrock API calls using CloudTrail](https://docs.aws.amazon.com/bedrock/latest/userguide/logging-using-cloudtrail.html), nguyên văn: *"Data events are often high-volume activities that CloudTrail doesn't log by default"* và *"To log Retrieve and RetrieveAndGenerate calls, configure advanced event selectors to record data events for the `AWS::Bedrock::KnowledgeBase` resource type."* Trang cũng ghi rõ **có phụ phí** cho data event.

### Validator

**Là gì.** Mã kiểm tất định chạy **sau khi câu trả lời đã hiện xong**. Ba cái:

| Validator | Kiểm gì |
| --- | --- |
| `NumberValidator` | Mỗi số khớp `tool_run` (sai số làm tròn 0.005) **hoặc** nằm nguyên văn trong chunk mà chính câu đó trích |
| `CitationValidator` | Mỗi `[n]` trỏ về chunk **đã thật sự lấy ra ở lượt này** |
| `VerificationValidator` | Nhãn kết luận đạt/không đạt trong văn bản phải khớp **verdict** của `tool_run` được tham chiếu, không chỉ khớp tham số (AD-24) |

**Verdict.** Là kết luận đạt/không đạt do engine trả, ở trường mà `tools.manifest.yaml` khai báo cho từng tool (ví dụ `utilization`). **Vì sao cần:** kiểm số đúng chưa đủ. Engine trả `M = 125 kNm` và báo không đạt, mô hình vẫn có thể viết "dầm đạt" với đúng con số đó. Thẻ kết quả vì vậy hiện nhãn từ verdict, không từ chữ mô hình viết.

**Vì sao tất định chứ không dùng mô hình làm giám khảo.** Dùng mô hình chấm mô hình thì lại rơi vào cùng bài toán: không biết khi nào giám khảo sai. Mã tất định thì kiểm thử được.

**Vì sao `NumberValidator` có hai nguồn hợp lệ chứ không một.** Bản đầu chỉ chấp nhận số từ `tool_run`. Sai — câu trả lời còn nêu giá trị giới hạn lấy từ tiêu chuẩn, và những số đó đến từ chunk.

**Trượt thì gắn cờ, không xóa chữ đã hiện.** Xóa chữ giữa chừng làm người dùng mất niềm tin vào **cả những lượt đúng**.

**Nguồn.** *Interpretable and Trustworthy AI: Techniques and Frameworks* — khung audit và kiểm chứng · *Enterprise Guide for Implementing Generative AI and Agentic AI* — đánh giá đầu ra LLM.

---

## Phần E · Vận hành

### Rate limit, quota, và ba tầng chống lạm dụng

**Là gì.** Ba tầng khác nhau, không thay thế nhau được:

| Tầng | Chặn gì | Ngưỡng |
| --- | --- | --- |
| Burst theo IP, **trước xác thực** | Dò quét, bot | 5 request / 10 giây |
| Sliding window theo user | Spam | 20 lượt / phút |
| **Một lượt đang chạy trên mỗi user** | Mở nhiều tab | 1 |
| Quota token ngày (user + org) | Tổng chi phí | Chốt sau khi đo |

**Thứ tự không đổi được.** Đặt quota trước rate limit thì một request đã bị chặn vì gửi quá nhanh **vẫn bị trừ quota** — người dùng mất hạn mức cho lượt chưa bao giờ được phục vụ. Lỗi rất khó thấy vì mọi thứ khác vẫn chạy đúng.

**Mọi bộ đếm nằm trong PostgreSQL, không nằm trong bộ nhớ tiến trình.** Bộ giới hạn mặc định của ASP.NET Core đếm theo từng instance; chạy N task là nhân giới hạn lên N lần. Đó là đường denial-of-wallet, không phải chuyện công bằng.

**Giới hạn một lượt đồng thời là lớp mới và là lớp chặn spam thật sự.** Khóa ô nhập ở giao diện chỉ khóa **trong một tab**; mở mười tab là mười lượt song song, mà mười request trong một giây vẫn nằm dưới ngưỡng tính theo phút.

**Hạn mức ngày tính theo token, không theo số lượt** — một lượt có gọi tool tốn gấp nhiều lần lượt hỏi thường.

**Nguồn.** *Build AI-Enhanced Web Apps* (Theo Despoudis) — pattern *Defense-in-Depth Abuse Control*: `rate limiting (burst, sliding window) → message quota (daily cap per user, shared store, checked after rate limiting) → registration friction`, kèm nhận định *"a rate limiter alone doesn't stop determined abuse"*. Pattern *Security Middleware Pipeline*: *"cheap rejects (CORS, rate limit) should run before expensive ones (auth, LLM calls)"*.

**Ma sát đăng ký không áp dụng** ở đây: danh tính đến từ Keycloak của khách hàng doanh nghiệp, người dùng không tự đăng ký được, nên đường lách bằng tài khoản dùng một lần không tồn tại.

### Cửa sổ lịch sử hội thoại

**Là gì.** Bao nhiêu lượt hội thoại cũ được gửi kèm mỗi lần gọi mô hình.

**Quyết định (AD-22).** Đếm theo **lượt**, không theo message. Router đọc 3 lượt gần nhất; đường trả lời quá 6 lượt thì giữ 4 lượt gần nhất cộng một bản tóm tắt các lượt cũ.

**Vì sao không gửi cả hội thoại.** Lịch sử ở đây chỉ phục vụ **một việc**: hiểu người dùng đang nói về cái gì. Việc đó hiếm khi cần nhìn xa hơn vài lượt. Và lịch sử gần nhất nằm **sau mọi điểm cache**, nên trả đủ giá mỗi lượt — thêm một lượt vào cửa sổ là thêm chi phí cho mọi lượt còn lại của phiên.

**Vì sao đếm theo lượt chứ không theo message.** Một lượt có gọi tool mang thêm `tool_call` và `tool_result`, nên đếm theo message làm cửa sổ co giãn theo loại lượt.

**Nguồn.** *AI Agents on AWS* ch3 — xếp "nhồi toàn bộ lịch sử vào ngữ cảnh" vào nhóm anti-pattern (*"fine for a demo, wrong for production"*, gây *context rot*), và chốt rằng production dùng **hỗn hợp**: sliding window giữ mạch hội thoại, retrieval lo tri thức dài hạn, compaction lo mạch dài · *AI Agents in Action* ch8 — bộ đệm hội thoại là bộ nhớ ngắn hạn, tri thức lâu dài đi qua kho truy xuất.

### SSE — Server-Sent Events

**Là gì.** Một kết nối mở sẵn, server đẩy dần từng mẩu dữ liệu xuống trình duyệt.

**Vì sao không chờ xong rồi trả một cục.** Một lượt có gọi engine có thể mất chục giây. Màn hình trắng mười giây thì người dùng nghĩ hệ thống hỏng.

**Ba cái bẫy.** `EventSource` của trình duyệt **không gửi được header tùy ý**, nên không mang được `Authorization: Bearer` — phải dùng `fetch` rồi đọc `res.body`. Và proxy mặc định hay gom response rồi trả một lần, làm chữ không hiện dần **mà không có lỗi nào trong log**. Và **ngắt kết nối không tự lan xuống backend**: người dùng đóng tab, nhưng nếu BFF không truyền tín hiệu hủy xuống `fetch` upstream thì lượt vẫn chạy tới hết và vẫn tính tiền.

**`Aborted`.** Trạng thái kết thúc của một lượt khi client ngắt kết nối (bấm Dừng, đóng tab, rớt mạng). Backend hủy mọi lời gọi đang chạy, giữ phần chữ đã sinh, không chạy validator. v1 không nối lại được stream đang chạy (AD-25).

**Nguồn.** *Designing AI Interfaces* (Louise Macfadyen) — thiết kế trạng thái chờ và tiến trình cho tính toán AI.

### Prompt caching

**Là gì.** Bedrock cho phép đánh dấu một phần prompt là "tĩnh" để lần gọi sau không tính lại tiền phần đó.

**Ngưỡng token tối thiểu — đây là chỗ thiết kế này vướng.** Mỗi mô hình có một ngưỡng riêng, và ngưỡng tính **cộng dồn toàn bộ phần prompt đứng trước điểm cache**, gồm cả `tools`, `system` và `messages`:

| Mô hình | Tối thiểu mỗi cache checkpoint | Số checkpoint tối đa | TTL |
| --- | --- | --- | --- |
| Claude Sonnet 5 | **1 024 token** | 4 | 5 phút hoặc 1 giờ |
| Claude Haiku 4.5 | **4 096 token** | 4 | 5 phút hoặc 1 giờ |
| Claude Opus 5 | **512 token** | 4 | 5 phút hoặc 1 giờ |

> **Hệ quả trực tiếp cho kiến trúc này: đường IntentRouter gần như không cache được.** Router chạy Claude Haiku 4.5 với prompt ngắn — system prompt cộng danh sách `similarity_keys` sinh từ manifest. Ngưỡng của Haiku 4.5 là **4 096 token**, cao gấp bốn lần Sonnet 5. Prompt router nhiều khả năng không chạm ngưỡng đó, nên **mọi lượt hỏi trả đủ giá cho phần tĩnh của router**.
>
> Tài liệu AWS ghi rõ hành vi khi không đạt ngưỡng: *"If you add a cache checkpoint before the total prompt prefix meets the minimum number of tokens, your inference still succeeds, but your prefix isn't cached."* Inference vẫn chạy, cache không có, **không có lỗi nào**. Phải đo `cacheReadInputTokens` mới biết.
>
> Việc phải làm khi đo: đếm token thật của prompt router. Dưới 4 096 thì hoặc chấp nhận không cache đường này, hoặc đổi mô hình router sang loại có ngưỡng thấp hơn.

**Thứ tự và tính dây chuyền.** Checkpoint xử lý theo thứ tự `tools` → `system` → `messages`, và **đổi nội dung ở phần trước làm mất cache của phần sau**: *"modifying `tools` invalidates the `system` and `messages` caches"*. Nên đặt nội dung ổn định (`tools`, `system`) trước nội dung thay đổi (`messages`).

**Một bẫy đếm token.** Khi bật prompt caching, trường `inputTokens` **chỉ còn là số token không nằm trong cache**. Tổng thật phải tính:

```
total input tokens = inputTokens + cacheReadInputTokens + cacheWriteInputTokens
```

Đây là chỗ counter quota ở AD-23 dễ sai: lấy thẳng `inputTokens` là **đếm thiếu**.

**Không dùng được với batch inference.** *"Prompt caching is only supported for on-demand inference endpoints. It is not supported with the batch inference API."* — liên quan tới AD-21, vốn dùng batch inference cho eval.

**Nguồn — đã fetch.** [Prompt caching for faster model inference](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html)

### Golden set

**Là gì.** Bộ câu hỏi có đáp án đúng, để trong repo, có version, **chạy trong CI như một cổng chặn** chứ không phải một báo cáo đọc cho vui.

**Vì sao cần.** Hệ thống xác suất không có khái niệm "pass/fail" như unit test. Không có bộ đề thì không có cách nào biết một thay đổi prompt làm tốt lên hay xấu đi.

**Nhóm câu đáng chú ý.** Có hẳn một nhóm mà **đáp án đúng là "phải từ chối"** — hệ thống cố trả lời những câu đó là trượt bài kiểm tra.

**Nguồn.** *Enterprise Guide for Implementing Generative AI and Agentic AI* — đánh giá đầu ra LLM · *Hands-On RAG for Production* — đánh giá RAG.

---

## Phần F · Danh mục nguồn

### Tài liệu AWS — đã fetch trực tiếp và xác minh

Mỗi dòng dưới đây đã được đọc bằng `WebFetch`; câu trích trong tài liệu này lấy nguyên văn từ trang đó.

| Chủ đề | Xác minh được gì | Link | Ngày fetch |
| --- | --- | --- | --- |
| CloudTrail data event cho Knowledge Base | `Retrieve` là data event, **không ghi mặc định**; selector `AWS::Bedrock::KnowledgeBase`; `ApplyGuardrail` cũng là data event (`AWS::Bedrock::Guardrail`); có phụ phí | https://docs.aws.amazon.com/bedrock/latest/userguide/logging-using-cloudtrail.html | 21/09/2026 |
| Cách đếm token và burndown | `max_tokens` trừ quota **ngay đầu request**; burndown **10×** cho output của Sonnet 5, Opus 5, Fable 5.1; 15× cho 4.8; 5× cho ≤4.7; token đọc cache không tính quota | https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-token-burndown.html | 21/09/2026 |
| Đếm token trước khi gọi (`CountTokens`) | API tồn tại chung trên `bedrock-runtime`, miễn phí; một số model Claude **CRIS-only** không hỗ trợ trên `bedrock-runtime`, dùng `bedrock-mantle` (`/anthropic/v1/messages/count_tokens`) thay thế; Sonnet 5 cụ thể **chưa xác nhận** thuộc nhóm nào | https://docs.aws.amazon.com/bedrock/latest/userguide/count-tokens.html · https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_CountTokens.html | 21/09/2026 |
| Quotas tổng quan | Hai endpoint `bedrock-runtime` và `bedrock-mantle` có quota **tách riêng** cho cùng một mô hình | https://docs.aws.amazon.com/bedrock/latest/userguide/quotas.html | 18–19/09/2026 |
| Prompt caching | Ngưỡng tối thiểu **Opus 5 = 512**, **Sonnet 5 = 1 024**, **Haiku 4.5 = 4 096**; tối đa 4 checkpoint; TTL 5 phút hoặc 1 giờ; thứ tự `tools → system → messages`; `inputTokens` chỉ là phần không cache; không dùng được với batch inference | https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html | 21/09/2026 |
| Knowledge Bases tổng quan | AWS khuyến nghị MKB; MKB có nhiều connector gốc, ACL filtering, parser đa định dạng, agentic retrieval | https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html | 18–19/09/2026 |
| Build a managed knowledge base | Reranker quản lý sẵn **không tính thêm tiền**; search luôn *agentic and semantic hybrid*; embedding tự chọn phải **float32, 1024 chiều** | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-build-managed.html | 21/09/2026 |
| **Region của managed KB** | **`eu-central-1` có trong danh sách** — V-K2 đã trả lời | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-regions.html | 21/09/2026 |
| Mô hình embedding và region | Titan V2, Cohere Embed English và Multilingual đều có ở `eu-central-1` | https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-supported.html | 18–19/09/2026 (chưa kiểm Cohere Embed v4 và Nova Multimodal Embeddings) |
| Mô hình rerank và region | Cohere Rerank 3.5 và Amazon Rerank 1.0 đều có ở `eu-central-1`; đây là region EU duy nhất | https://docs.aws.amazon.com/bedrock/latest/userguide/rerank-supported.html | 21/09/2026 |
| ACL-aware retrieval | **Hỏng đóng**; S3 hỗ trợ qua file cấu hình ACL, chỉ nhận `USER` (email), không có kiểu nhóm; AWS ghi rõ **không phải authorization** | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-acl.html | 21/09/2026 |
| Service role của Knowledge Base | Trust policy chống confused deputy; policy S3 kèm điều kiện `aws:ResourceAccount`; không dùng chung policy giữa nhiều role | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-permissions.html | 18–19/09/2026 |
| Mã hóa Knowledge Base | Khóa chỉ định **lúc tạo**, phủ cả transient lẫn permanent; **service role KHÔNG cần quyền trên khóa của KB** | https://docs.aws.amazon.com/bedrock/latest/userguide/encryption-kb.html | 21/09/2026 |
| Truy vấn managed KB | Dùng `managedSearchConfiguration`, **không** dùng `vectorSearchConfiguration`; **luôn hybrid**; reranker `MANAGED` mặc định; `startsWith`/`stringContains` không hỗ trợ; guardrail không áp cho reference đã retrieve | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-retrieve.html | 21/09/2026 |
| `ManagedSearchConfiguration` / `KnowledgeBaseRetrievalConfiguration` | Bốn field: `filter`, `numberOfResults` (1–100), `rerankingModelType`, `rerankingConfiguration`. Không có `overrideSearchType` hay ngưỡng điểm. `managedSearchConfiguration` và `vectorSearchConfiguration` là union, chọn đúng một | https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_ManagedSearchConfiguration.html · .../API_agent-runtime_KnowledgeBaseRetrievalConfiguration.html | 21/09/2026 |
| Cấu hình truy vấn và metadata filter | Mặc định 5 kết quả (trang chung); danh sách toán tử; ghi chú riêng cho managed KB; tiền tố `_` dành riêng | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-config.html | 21/09/2026 |
| Tạo managed KB | Custom embedding: 1024 chiều float32; **mất managed reranker** khi dùng embedding riêng; không đổi được loại embedding sau khi tạo; danh sách connector | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-create.html | 21/09/2026 |
| Managed KB với S3 | Sidecar `{file}.metadata.json` ≤ 10 KB, thuộc tính có kiểu (`type`, `stringValue`, `numberValue`); `metadataFilesPrefix`; `aclEnabled` | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-ds-s3.html | 21/09/2026 |
| ACL của S3 | `Type` chỉ nhận `USER` (email); tài liệu không có ACL thì không được nạp; đổi file global phải reindex; `aclEnabled` không đổi sau khi tạo | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-ds-s3-acl.html | 21/09/2026 |
| ACL-aware retrieval — truy vấn | Thiếu `userContext` thì data source bật ACL trả **0 kết quả**; tài liệu thiếu ACL bị coi là bị hạn chế | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-retrieve-acl.html | 21/09/2026 |
| Quan sát managed KB | Metric `AWS/Bedrock/KnowledgeBases` (Invocations, ClientErrors, ServerErrors, Throttles, RawDataSize); ingestion log; trace X-Ray cho `Retrieve` | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-observability.html | 21/09/2026 |
| AgentCore Harness — mạng và IAM | Chế độ VPC kéo image từ **ECR riêng**, **không cần NAT gateway**; cần endpoint `ecr.dkr`, `ecr.api`, `s3` (gateway), `bedrock-runtime`; execution role cần quyền pull `harness-*`; SigV4 không mang danh tính người dùng xuống tool | https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-security.html | 21/09/2026 |
| `CreateHarness` API | `maxIterations`, `timeoutSeconds`, `maxTokens` đều `Required: No`, không ghi giá trị mặc định trong API reference (mặc định ghi ở trang harness-operations) | https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_CreateHarness.html | 21/09/2026 |
| AgentCore Harness — giới hạn, tool, model, memory | `maxIterations` mặc định 75; `timeoutSeconds` 3600; `shell` và `file_operations` mở sẵn (~900 token/request); model mặc định `global.anthropic.claude-sonnet-4-6`; memory: API bỏ trống thì có managed memory, CLI mặc định tắt; CloudTrail dùng `AWS::BedrockAgentCore::Runtime` | https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-operations.html · .../harness-tools.html · .../harness-models.html · .../harness-memory.html | 21/09/2026 |
| JWT authorizer của AgentCore | Bắt buộc **ít nhất một** trong: audience, client, scope, custom claim; đặt nhiều thì kiểm đủ | https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/inbound-jwt-authorizer.html | 21/09/2026 |
| Bedrock Agents Classic — maintenance mode | Ngừng nhận khách hàng mới từ **30/07/2026**; agent cũ (account đã dùng trong 12 tháng) không bị ảnh hưởng; AWS khuyến nghị chuyển sang AgentCore, harness là *"closest analog to the Bedrock Agents managed experience"* | https://docs.aws.amazon.com/bedrock/latest/userguide/agents-classic-maintenance-mode.html | 21/09/2026 |
| Guardrail trong Converse API — phạm vi đánh giá | *"a guardrail specified in `guardrailConfig` does not evaluate every field"*: `toolResult` và `toolUse.input` **không** được đánh giá; chỉ `text`/`guardContent` được đánh giá | https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-use-converse-api.html | 21/09/2026 |
| Aurora DSQL — khác biệt so với PostgreSQL | Không có PL/pgSQL (chỉ SQL function); **một transaction sửa tối đa 3 000 dòng**; DDL và DML phải tách transaction; một database `postgres` cho mỗi cluster; optimistic concurrency control (xung đột trả lỗi serialization, không chờ lock); kết nối hết hạn sau 1 giờ | https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-unsupported-features.html | 21/09/2026 |
| Bedrock Prompt Management | Tạo, lưu version, so sánh variant; dùng lại lúc gọi inference hoặc qua Bedrock Flows | https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-management.html | 21/09/2026 |
| Batch inference — model hỗ trợ | Bảng model có **Claude Opus 5** nhưng **không có Claude Sonnet 5** ở thời điểm fetch — chưa xác nhận Sonnet 5 dùng được batch inference. **Xác minh lại 22/09/2026: vẫn không có Sonnet 5** (chỉ Sonnet 4/4.5/4.6) | https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference-supported.html | 21/09/2026, xác minh lại 22/09/2026 |
| `bedrock:GuardrailIdentifier` — ép guardrail bằng IAM | Áp dụng cho `Converse`, `ConverseStream`, `InvokeModel`, `InvokeModelWithResponseStream`; cơ chế chuẩn là cặp Allow + Deny (`StringNotEquals`); role có điều kiện này **không được** dùng chung để gọi `RetrieveAndGenerate`/`InvokeAgent`/`InvokeInlineAgent` (các API đó tự gọi `InvokeModel` nội bộ, có lần thiếu guardrail, gây AccessDenied); guardrail input tag lách được ở prompt nhưng **response luôn bị áp guardrail** | https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-permissions-id.html | 21/09/2026, đọc trực tiếp bằng Playwright (WebFetch không rút được nội dung) |
| Amazon Bedrock evaluations | Tên chính thức của dịch vụ (không phải "model-evaluation.html" — URL đó không tồn tại, redirect về trang chủ). Có "Model evaluation jobs that use a judge model", đánh giá tự động theo dataset, và "RAG evaluations that use LLMs" theo ground truth | https://docs.aws.amazon.com/bedrock/latest/userguide/evaluation.html | 21/09/2026, đọc trực tiếp bằng Playwright (WebFetch không rút được nội dung) |
| S3 Event Notification → EventBridge (AD-20) | Bật EventBridge thì S3 gửi mọi event (gồm *Object Created*) tới EventBridge; đích trực tiếp của S3 Event Notification chỉ gồm **SNS, SQS, Lambda, EventBridge** — **không** có Step Functions trực tiếp | https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventBridge.html | 22/09/2026 |
| EventBridge target — Step Functions (AD-20) | Danh sách target của EventBridge rule có **"Step Functions state machine (ASYNC)"** → đường đúng là **S3 → EventBridge → Step Functions**; mỗi rule tối đa 5 target | https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-targets.html | 22/09/2026 |
| Inference profile — region hỗ trợ (AD-03, AD-05) | `eu-central-1` nằm trong danh sách region tạo application inference profile; profile geo (US/EU/APAC) có danh sách destination Region **cố định** | https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html | 22/09/2026 |
| Inference profile theo model — Claude chat (AD-03, AD-05) | Model card từng model (đọc bằng Playwright): Geo inference ID `eu.anthropic.claude-sonnet-5`, `eu.anthropic.claude-haiku-4-5-20251001-v1:0`, `eu.anthropic.claude-sonnet-4-6`; `eu-central-1` = **supported** (icon `icon-yes.png`, alt="supported") ở cả ba; EU geo phủ **8 region**: eu-central-1 (Frankfurt), eu-central-2 (Zurich), eu-north-1 (Stockholm), eu-south-1 (Milan), eu-south-2 (Spain), eu-west-1 (Ireland), eu-west-2 (London), eu-west-3 (Paris) — **không phải 6 như bản cũ ghi** | https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5.html · https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html · https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html | 22/09/2026 (Playwright) |

### Tài liệu PostgreSQL — đã fetch trực tiếp

| Chủ đề | Xác minh được gì | Link | Ngày fetch |
| --- | --- | --- | --- |
| Row Security Policies | Owner, superuser và `BYPASSRLS` bỏ qua RLS trừ khi có `FORCE ROW LEVEL SECURITY`; không có policy thì mặc định từ chối hết | https://www.postgresql.org/docs/current/ddl-rowsecurity.html | 21/09/2026 |
| System Administration Functions | `current_setting(name, missing_ok)` ném lỗi nếu chưa gán và `missing_ok` không phải `true`; `set_config(name, value, is_local)` — `is_local = true` chỉ có hiệu lực trong transaction hiện tại | https://www.postgresql.org/docs/current/functions-admin.html | 21/09/2026 |
| SELECT — `FOR UPDATE ... SKIP LOCKED` (AD-11) | Nguyên văn: *"With `SKIP LOCKED`, any selected rows that cannot be immediately locked are skipped"*; tài liệu nêu đúng dùng để tránh tranh khóa với nhiều consumer trên một **"queue-like table"** | https://www.postgresql.org/docs/current/sql-select.html | 22/09/2026 |

### Tài liệu AWS — trích từ skill `amazon-bedrock`, chưa fetch trực tiếp

| Chủ đề | Link |
| --- | --- |
| Endpoints và quotas | https://docs.aws.amazon.com/general/latest/gr/bedrock.html |
| Guardrails — quyền | https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-permissions-id.html |
| Guardrails — dùng với Converse | https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-use-converse-api.html |
| Inference profile — điều kiện | https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-prereq.html |
| Cross-region inference | https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference-support.html |
| Security best practices | https://docs.aws.amazon.com/bedrock/latest/userguide/security-best-practices.html |
| `InvokeHarness` API | https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_InvokeHarness.html |
| AgentCore Policy (Cedar) | https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html |
| IAM — độ trễ lan truyền | https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot_general.html#troubleshoot_general_eventual-consistency |
| Mã hóa CloudWatch Logs bằng KMS | https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html |
| S3 security best practices | https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html |

### Sách

| Sách | Tác giả | Dùng cho quyết định nào |
| --- | --- | --- |
| *Hands-On RAG for Production* | Ofer Mendelevitch, Forrest Sheng Bao | Kiến trúc RAG, chunking, rerank, đánh giá |
| *Vector Databases: A Practical Introduction* | Nitin Borwankar | Embedding, cosine, chỉ mục vector |
| *AI Agents on AWS* | Bunny Kaushik, Mona M | Bộ nhớ agent (AD-22), AgentCore ở production |
| *AI Agents in Action* | Micheal Lanham | Bộ nhớ ngắn hạn và dài hạn, RAG là cơ chế chung |
| *Build AI-Enhanced Web Apps* | Theo Despoudis | Chống lạm dụng ba tầng (AD-23), middleware pipeline |
| *Building AI-Powered Products* | Dr. Marily Nika | Build-vs-buy ở mức sản phẩm (ma trận 7 yếu tố, ch5) |
| *Engineering Generative AI-Based Software* | Miroslaw Staron | Kiến trúc phần mềm cho hệ xác suất |
| *Enterprise Guide for Implementing Generative AI and Agentic AI* | Shakuntala Gupta Edward, Rahul Bhattacharya, Vikas Sinha | Đánh giá đầu ra, Responsible AI |
| *Designing AI Interfaces* | Louise Macfadyen | Trạng thái chờ, tiến trình, lỗi trên giao diện AI |
| *Using Amazon Bedrock* | Renaldi Gondosubroto | Bảo mật và tối ưu trên Bedrock |
| *Building Gen AI Applications with Amazon Bedrock* | Syed Kadar Ansari Syed Ahamed | Chịu lỗi, fallback, chi phí |
| *Interpretable and Trustworthy AI* | Pethuru Raj và cộng sự (chủ biên) | Khung audit, kiểm chứng, công bằng |

### Chưa kiểm chứng được

Những mục dưới đây **chưa có nguồn xác minh**, và tài liệu ghi rõ như vậy ở chỗ dùng:

- AWS SDK for .NET có hỗ trợ `type: MANAGED` và `MANAGED_KNOWLEDGE_BASE_CONNECTOR` không — tài liệu AWS chỉ nêu mốc phiên bản cho `boto3`/`botocore`, **không nói gì về .NET**. Chỉ gọi thử bằng mã .NET mới biết.
- Managed S3 connector đọc được sidecar và lọc được theo thuộc tính trong đó qua `managedSearchConfiguration.filter` từ mã .NET không. Cụ thể ba điều: lọc trên thuộc tính không có trong sidecar thì trả rỗng hay lỗi; `startsWith` / `stringContains` thì báo lỗi hay bị bỏ qua; `listContains` có chạy không.
- Chi phí vận hành ACL-aware retrieval cho S3, khi mỗi organization phải được liệt kê thành danh sách email trong file ACL.
- Reranker quản lý sẵn của MKB đủ tốt so với Cohere Rerank 3.5 hay không, và mất bao nhiêu khi chọn embedding riêng mà không còn reranker sẵn.
- Mặc định của `numberOfResults` trên managed KB. Trang managed không nêu.
- `eu.anthropic.claude-sonnet-5` có hỗ trợ **batch inference** (`CreateModelInvocationJob`) không — bảng model hỗ trợ (fetch 21/09/2026) không liệt kê Sonnet 5, chỉ có Opus 5. Ảnh hưởng AD-21: nếu không hỗ trợ, phần sinh câu trả lời golden set phải chạy `Converse` vòng lặp thay vì batch. Đã xác nhận thêm (batch-inference.html, fetch 21/09/2026): batch **không hỗ trợ tool calling và structured output**, nên các nhóm golden set cần gọi tool không chạy qua batch được. Mức giảm 50% xác nhận ở trang giá AWS (fetch 21/09/2026), ghi là chỉ áp cho một số model.
- `eu.anthropic.claude-sonnet-5` có hỗ trợ `CountTokens` trên `bedrock-runtime` không. Tài liệu AWS chỉ nói một số model Claude **CRIS-only** không hỗ trợ, không nêu đích danh Sonnet 5 — gọi thử một lần mới biết; nếu không, chuyển sang `bedrock-mantle`.
- Harness ở chế độ VPC có cần đường ra internet vì lý do nào khác ngoài kéo image không (ví dụ discovery URL của Keycloak). Tài liệu AWS chỉ xác nhận kéo image không cần NAT.
- Prompt của IntentRouter có chạm ngưỡng 4 096 token của Haiku 4.5 để cache được không.
- Đơn giá thật của từng mô hình, và độ trễ thật của mỗi lời gọi.

**Đã có câu trả lời bằng tài liệu AWS đọc trực tiếp**, nên không nằm trong danh sách trên: Managed Knowledge Base **có** ở `eu-central-1`; mô hình rerank **có** ở `eu-central-1`; ba mô hình embedding ứng viên **đều có** ở `eu-central-1`; managed KB **luôn dùng hybrid** và không có `overrideSearchType` (V-K5); Harness ở chế độ VPC **không cần NAT gateway** để kéo image (V-A10); ACL của S3 **không có kiểu nhóm**.

---

## Đọc tiếp

| Cần gì | File |
| --- | --- |
| Kiến trúc tổng thể, điểm vào của bộ | [01-kien-truc.md](01-kien-truc.md) |
| Cùng khái niệm, kể bằng lời thường | [11-thuyet-minh.md](11-thuyet-minh.md) |
| Mục lục cả bộ | [README.md](README.md) |
