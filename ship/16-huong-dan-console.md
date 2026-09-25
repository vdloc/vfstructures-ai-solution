# 16 · Hướng dẫn cấu hình trên console AWS

**Ai đọc:** người thực thi trên giao diện, không dùng CLI. Ngoài ra, mỗi phần mở đầu bằng một khung **"Giải thích cho người không chuyên"** viết bằng ngôn ngữ thường ngày, để quản lý và người không rành kỹ thuật nắm được phần đó làm gì và vì sao quan trọng trước khi đọc chi tiết thao tác.

Tài liệu này đi theo thứ tự của [05-devops.md](05-devops.md). Mỗi mục có link console, ảnh chụp từng bước, và giá trị phải điền. Mọi giá trị đều lấy từ [05](05-devops.md) §2A, [09](09-trien-khai.md), [15](15-chi-tiet-devops.md); chỗ nào thiết kế chưa chốt thì ghi rõ là chưa chốt, không tự đặt.

**Vùng: `eu-central-1` (Europe — Frankfurt).** Kiểm góc trên bên phải trước mỗi thao tác. Link không kèm vùng sẽ mở đúng vùng đang chọn của phiên, và tài nguyên của dự án không nằm ở vùng khác.

Ảnh chụp đã che tên và số tài khoản. Số trong khung đỏ là thứ tự thao tác; chữ bên cạnh nói trường đó dùng làm gì.

---

## A · Bedrock Guardrails

> **Giải thích cho người không chuyên**
> Guardrails là lớp lọc an toàn của trợ lý: nó kiểm cả câu hỏi người dùng gửi vào lẫn câu trả lời gửi ra, nhằm chặn nội dung ngoài phạm vi kết cấu, ngăn yêu cầu nguy hiểm và che thông tin cá nhân. Điểm cần nhớ xuyên suốt phần này: AWS không bật sẵn bất kỳ bộ lọc nào, và nhiều công tắc để mặc định ở trạng thái tắt. Nếu không chủ động bật đúng, hệ thống vẫn chạy bình thường nhưng thực chất không có rào chắn nào, và cũng không có thông báo lỗi để cảnh báo.

Link: `https://eu-central-1.console.aws.amazon.com/bedrock/home?region=eu-central-1#/guardrails`

### A.1 Mở trình tạo

![Danh sách guardrail](huong-dan-console/anh/guardrail-01-danh-sach.png)

Danh sách trống nghĩa là **chưa có guardrail nào được áp**. AWS không bật sẵn cái nào ([05](05-devops.md) §2A.1).

### A.2 Bước 1 — Guardrail details

![Bước chi tiết guardrail](huong-dan-console/anh/guardrail-02-chi-tiet.png)

| Ô | Điền gì | Vì sao |
| --- | --- | --- |
| **Name** | `vf-assistant-guardrail` | Tên dùng lại trong IAM policy chặn gọi model thiếu guardrail |
| **Description** | `Garde-fou de l'assistant VF Structures` | Mô tả tối đa 200 ký tự |
| **Messaging for blocked prompts** | `Je ne traite que les questions de calcul de structure et de consultation de normes.` | Người dùng gõ tiếng Pháp; giữ chung chung, không nêu bộ lọc nào kích hoạt |
| **Apply the same blocked message for responses** | Bật sẵn — bỏ chọn nếu muốn thông điệp chiều ra khác | Tương ứng `--blocked-outputs-messaging` |
| **KMS key selection → Customize encryption settings** | Chọn khóa customer-managed của công ty | Cấu hình chứa chủ đề cấm và mẫu nhận dạng tự viết ([06](06-bao-mat.md) §13) |

Trình tạo có 8 bước: details → content filters → denied topics → word filters → sensitive information → contextual grounding → automated reasoning → review and create.

### A.3 Bước 2 — Content filters

> **Giải thích cho người không chuyên**
> Bước này bật các bộ lọc chặn nội dung có hại. Điều đáng lưu ý là cả hai công tắc đều mặc định tắt, nên bỏ qua bước này đồng nghĩa với không lọc gì cả. Riêng loại "bạo lực" được cố ý đặt ở mức thấp, vì ngành kết cấu dùng các từ như "phá hoại", "sập đổ" làm thuật ngữ kỹ thuật bình thường; đặt mức cao sẽ chặn nhầm chính những câu hỏi chuyên môn hợp lệ.

![Bộ lọc nội dung](huong-dan-console/anh/guardrail-03-content-filter.png)

Hai công tắc và một lựa chọn tier. Cả hai công tắc **mặc định tắt**: không bật thì bước này không áp gì.

| Ô | Đặt gì | Vì sao |
| --- | --- | --- |
| **Configure harmful categories filters** | Bật, rồi đặt từng loại: `MISCONDUCT`, `HATE`, `INSULTS`, `SEXUAL` ở Medium; **`VIOLENCE` ở Low** | Ngành kết cấu dùng "rupture par cisaillement", "effondrement" làm thuật ngữ. Đặt cao sẽ chặn nhầm câu hỏi kỹ thuật hợp lệ |
| **Configure prompt attacks filter** | Bật. Chiều vào High, chiều ra tắt hẳn | Loại này chỉ có nghĩa ở chiều vào. Tắt hẳn chiều ra thì không bị tính phí phần đó |
| **Content filters tier** | **Classic** | Hỗ trợ tiếng Pháp và không đòi cross-Region inference — giữ dữ liệu trong EU (Q1) |

### A.4 Bước 3 — Denied topics

![Chủ đề cấm](huong-dan-console/anh/guardrail-04-denied-topics.png)

Thêm hai chủ đề, **mô tả và ví dụ viết bằng tiếng Pháp** vì người dùng gõ tiếng Pháp:

| Tên | Chặn cái gì |
| --- | --- |
| `Contournement-verification` | Hỏi cách làm sai lệch dữ liệu đầu vào, khai thiếu tải, hạ hệ số an toàn, né quy trình kiểm định |
| `Conseil-juridique-ou-assurance` | Hỏi về trách nhiệm dân sự, bảo hiểm, bảo hành mười năm, hậu quả tranh chấp |

Giới hạn cứng: tối đa 30 chủ đề, `definition` 200 ký tự, tối đa 5 ví dụ, mỗi ví dụ 100 ký tự. Chỉ có chiều `DENY`, không có chiều "chỉ cho phép chủ đề này".

### A.5 Bước 5 — Sensitive information

![Bộ lọc PII](huong-dan-console/anh/guardrail-05-pii.png)

| Nhóm | Đặt gì |
| --- | --- |
| **PII types → Mask** | `NAME`, `EMAIL`, `PHONE`, `ADDRESS` — xuất hiện thường xuyên và vô hại trong ngữ cảnh công việc |
| **PII types → Block** | `PASSWORD`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `CREDIT_DEBIT_CARD_NUMBER`, `INTERNATIONAL_BANK_ACCOUNT_NUMBER` |
| **Regex patterns** | Tự viết cho NIR Pháp, SIRET, căn cước công dân Việt Nam |

AWS có sẵn 31 loại PII nhưng **không có loại nào cho Pháp và Việt Nam**, nên ba mẫu regex trên là việc thật phải làm, không phải chi tiết vặt. Giới hạn: tối đa 10 mẫu, mỗi mẫu 500 ký tự.

### A.6 Bước 6 — Contextual grounding

> **Giải thích cho người không chuyên**
> Đây là lớp chống bịa: hệ thống chấm xem câu trả lời có thực sự bám vào tài liệu nguồn hay không. Ngưỡng khởi đầu 0.7 chỉ là điểm xuất phát theo khuyến nghị, còn phải hiệu chỉnh bằng thử nghiệm thực tế. Một điều kiện dễ quên là mỗi lời gọi phải gắn nhãn cho biết đâu là nguồn, đâu là câu hỏi; thiếu nhãn thì lớp kiểm tra này im lặng không làm gì, nên cần có kiểm thử tự động bắt lỗi đó.

![Chống bịa](huong-dan-console/anh/guardrail-06-grounding.png)

Grounding và Relevance, ngưỡng khởi đầu **0.7** cho cả hai. Đây là **điểm khởi đầu theo khuyến nghị, không phải số đo** — hiệu chỉnh bằng eval.

Điều kiện bắt buộc: lời gọi phải dán nhãn `qualifiers` (`grounding_source` cho nguồn, `query` cho câu hỏi). **Không dán nhãn thì chính sách này im lặng không làm gì** — phải có test bắt.

### A.7 Hai việc console không làm thay

**Tạo xong là bản `DRAFT`.** Phải chốt thành bản đánh số bằng một thao tác thứ hai; `DRAFT` đổi được bất cứ lúc nào và hệ thống đang chạy sẽ đổi hành vi ngay mà không ai biết.

**Guardrail chỉ chạy khi lời gọi khai nó.** Bỏ trường khai ra khỏi mã là mọi bộ lọc biến mất, không có lỗi nào báo. Chặn bằng IAM policy `Deny` có điều kiện `bedrock:GuardrailIdentifier` — chi tiết ở [05](05-devops.md) §2A.7.

**Ghi chú về độ ổn định của console.** Lần dựng đầu, các bước 2–8 trả "Unable to load content" do gói giao diện bị HTTP 403 ở `a.b.cdn.console.awsstatic.com`; thử lại sau ít phút thì hết. Nếu lặp lại, runbook CLI ở [05](05-devops.md) §2A.4 chạy được ngay, không phụ thuộc giao diện.

---

## B · Knowledge Base — nạp chunk tự cắt, bỏ parse/chunk mặc định

> **Giải thích cho người không chuyên**
> Knowledge Base là kho tài liệu để trợ lý tra cứu rồi trả lời có nguồn (cơ chế RAG). "Chunk" là các đoạn nhỏ mà tài liệu gốc được cắt ra, để máy tìm kiếm theo ý nghĩa. Phần này quan trọng nhất và cũng khó nhất, vì nhiều lựa chọn ở đây không sửa được sau khi tạo: chọn sai thì phải xoá kho và nạp lại toàn bộ tài liệu từ đầu. Dự án chọn tự cắt đoạn theo cách riêng thay vì để AWS cắt tự động, nên phải chấp nhận một số thứ AWS vốn cho sẵn thì nay phải tự làm và tự trả tiền.

Đây là phần cần đọc kỹ nhất, vì **lựa chọn loại KB quyết định có được tự cắt chunk hay không**, và chọn xong thì không đổi được.

### B.1 Hai loại KB, chỉ một loại cho tự cắt chunk

> **Giải thích cho người không chuyên**
> AWS có hai kiểu kho tài liệu. Kiểu "quản lý sẵn" (Managed) tiện nhưng không cho tự quyết định cách cắt đoạn. Kiểu "tự quản" (customer-managed) cho toàn quyền, kể cả lựa chọn "không cắt thêm" mà dự án cần. Vì mục tiêu là tự kiểm soát cách cắt đoạn, dự án chọn kiểu tự quản. Đánh đổi là phải tự chọn mô hình xử lý văn bản, tự trả tiền cho bước sắp xếp lại kết quả, và tự vận hành thêm một kho dữ liệu — những thứ kiểu quản lý sẵn vốn cho không.

Console có hai đường tạo khác nhau:

| Đường | Link | Có chọn chunking không |
| --- | --- | --- |
| **Managed KB** | `#/knowledge-bases` → **Create Managed KB** | **Không.** Parsing strategy hiển thị cố định *Managed parser*, Text chunking strategy cố định *Default chunking*. Hai dòng đó là chú thích, không phải hộp chọn |
| **KB with vector store** (customer-managed) | `#/knowledge-bases/create-knowledge-base` | **Có.** Chọn được cả parser lẫn chunking, gồm **No chunking** |

![Managed KB — parser và chunking cố định](huong-dan-console/anh/kb-02-managed-co-dinh.png)

Ảnh trên là trình tạo Managed KB. Bấm vào *Managed parser* hay *Default chunking* chỉ mở ra một ô chú thích, không có danh sách lựa chọn. Kể cả khi đổi data source type sang **Custom**, hai dòng đó vẫn y nguyên.

**Console giấu, nhưng API thì chưa chắc.** `CreateDataSource` nhận `vectorIngestionConfiguration.chunkingConfiguration.chunkingStrategy` như một trường ở cấp ngoài cùng, không gắn với loại KB nào, và tài liệu API **không** nói trường này bị loại với `MANAGED_KNOWLEDGE_BASE_CONNECTOR` — trong khi chỗ khác của chính trang đó lại nói rõ giới hạn theo loại KB (*"For managed knowledge bases, the only supported option is `DELETE`"* cho `dataDeletionPolicy`). Không suy ra được câu trả lời từ tài liệu: chỉ một lệnh `create-data-source` thật trên MKB mới cho biết AWS nhận hay từ chối `NONE`. Lệnh đó tạo tài nguyên thật nên **chưa chạy**.

Ghi chú của Managed KB về *Default chunking*: *"Automatically splits text into smaller chunks by default. If a document is already small enough, it's not split any further."* Câu này mở ra một đường thứ ba — **nạp file đã cắt sẵn, mỗi file đủ nhỏ** thì MKB không cắt thêm — nhưng AWS không nói "đủ nhỏ" là bao nhiêu ở đường managed, nên đường này chỉ dùng được sau khi đo trên KB thật.

**Đã chốt: tự parse, tự cắt chunk, không dùng parser lẫn chunker của AWS.** Quyết định này loại Managed KB, vì bảng so sánh của AWS ghi rõ MKB dùng *"Built-in parser for multimodal file types"* và chunking chỉ có *"built-in (default) or fixed-size"* — không có `NONE`. AD-17 đã cập nhật theo: retrieval chạy trên **customer-managed KB** với `chunkingStrategy: NONE`, data source loại **Custom**.

**Bốn hệ quả phải nuốt cùng quyết định này**, vì customer-managed không có những thứ MKB cho không:

| Mất gì | Phải làm gì thay |
| --- | --- |
| Embedding quản lý sẵn (AWS ghi "None") | AD-06 chỉ còn một nhánh: chọn mô hình embedding riêng, đo trước khi tạo KB |
| Reranker miễn phí (AWS ghi "None") | Trả tiền rerank (Cohere Rerank 3.5 khoảng 0,002 $/truy vấn) hoặc bỏ rerank |
| Agentic retrieval | Chỉ còn `Retrieve` một nhịp — đúng với thiết kế hiện tại, không mất gì thật |
| Không phải nuôi vector store | Thêm một kho phải tự vận hành và trả tiền theo giờ (xem B.4) |

**Ba ràng buộc kỹ thuật của `NONE`:**

- **Số trang phải do Worker tự ghi.** `NONE` bỏ citation theo trang và bộ lọc `x-amz-bedrock-kb-document-page-number`. Thiết kế đang cần số trang cho `CitationValidator`, nên số trang phải nằm trong metadata do Worker sinh, không trông vào Bedrock.
- **Trần kích thước chunk = trần token đầu vào của mô hình embedding.** Mỗi chunk được nhúng nguyên khối. Worker phải ép trần này lúc cắt, và trần đó chỉ biết sau khi AD-06 chốt mô hình.
- **"Không dùng parser của AWS" chỉ đúng nếu nạp vào là văn bản.** Nạp PDF gốc là Bedrock lại parse. Worker phải nạp text — inline `TEXT` hoặc tệp `.txt`.

### B.2 Tạo KB có chọn chunking

Ở trang **Knowledge Bases (KB)**, đừng bấm thẳng nút *Create Managed KB* — bấm mũi tên bên phải nút đó. Menu đổ xuống chia hai nhóm: *Bedrock-managed KB* và *Self-managed KB*.

![Menu chọn loại KB](huong-dan-console/anh/kbs3v-01-chon-loai.png)

Chọn **Unstructured Vector Store KB** — đây là tên console đặt cho đường customer-managed, và là chỗ duy nhất tắt được chunking của AWS. Đường tắt: `https://eu-central-1.console.aws.amazon.com/bedrock/home?region=eu-central-1#/knowledge-bases/create-knowledge-base`

![Bước 1 — chi tiết KB](huong-dan-console/anh/kbcm-01-chi-tiet.png)

| Ô | Điền gì |
| --- | --- |
| **KB name** | `vf-assistant-kb` |
| **Runtime role** | *Create and use a new service role* cho lần dựng đầu; production dùng role đã siết quyền theo bảng 4A của [05](05-devops.md) |
| **Choose data source type** | **Custom** — nạp thẳng tài liệu vào KB bằng API, không qua thư mục S3 |

![Chọn data source type Custom](huong-dan-console/anh/kbcm-02-chon-custom.png)

Chọn **Custom** là mấu chốt: mô tả của AWS ngay trong ô đó — *"A custom data source allows the flexibility to automatically ingest documents into your vector database directly"*.

### B.3 Bước 2 — chọn No chunking

> **Giải thích cho người không chuyên**
> "No chunking" nghĩa là mỗi tài liệu nạp vào được giữ nguyên thành một đoạn, đúng như đã cắt sẵn từ trước, thay vì để AWS cắt lại. Lựa chọn này không sửa được sau khi tạo — chọn sai buộc phải làm lại từ đầu. Một hệ quả cần biết: khi chọn cách này, số trang của tài liệu không còn được AWS tự gắn, nên phần mềm của dự án phải tự ghi số trang vào dữ liệu để phần kiểm tra trích dẫn còn hoạt động.

Mở **Advanced settings** → **Content parsing and chunking**.

![Chọn No chunking](huong-dan-console/anh/kbcm-03-no-chunking.png)

Năm lựa chọn: Default, Fixed-size, Hierarchical, Semantic, **No chunking**. Mô tả của AWS cho No chunking: *"Suitable for documents that are already pre-processed or text split into separate files without any further chunking necessary."*

![Sau khi chọn](huong-dan-console/anh/kbcm-04-chon-xong.png)

| Ô | Đặt gì | Ghi chú |
| --- | --- | --- |
| **Parsing strategy** | *Amazon Bedrock default parser* | Với chunk đã là văn bản thuần thì parser không có việc gì để làm |
| **Chunking strategy** | **No chunking** | Mỗi tài liệu nạp vào là **một chunk**, đúng như đã cắt |
| **Select Lambda function** | Để trống | Chỉ cần khi muốn Bedrock gọi hàm của mình để cắt lại và sinh metadata trong lúc nạp. Chunk đã cắt sẵn thì không cần |

**Hai cái mất khi chọn No chunking**, theo tài liệu AWS: không xem được số trang trong citation, và không lọc được theo `x-amz-bedrock-kb-document-page-number`. Cái thứ nhất **có đụng tới thiết kế**: chunk của dự án có số trang và `CitationValidator` dùng nó, nên số trang phải do Worker ghi vào metadata của chính nó. Bộ lọc `scope_key` và `clause_path` không bị ảnh hưởng.

**Chunking strategy không sửa được sau khi tạo data source.** Chọn sai thì phải tạo data source mới và nạp lại toàn bộ.

### B.4 Bước 3 — vector store

![Bước 3 — embeddings và vector store](huong-dan-console/anh/kbs3v-08-embedding-va-s3vectors.png)

Đường này bắt buộc có vector store riêng. Màn hình hỏi hai thứ theo đúng thứ tự đó: **embeddings model** trước, **vector store** sau — và thứ tự này quan trọng, vì danh sách kho phụ thuộc vào mô hình đã chọn.

**Chọn embeddings model.** Bấm *Select model*, hộp thoại mở ra hai nhà cung cấp serverless ở Frankfurt là Amazon và Cohere.

![Hộp thoại chọn embeddings model](huong-dan-console/anh/kbs3v-06-chon-embedding.png)

| Ô | Đặt gì | Vì sao |
| --- | --- | --- |
| **Model** | `Titan Embeddings G2 - Text v2.0` | 8k token đầu vào — trần này chính là trần độ dài chunk |
| **Embeddings type** | *Floating-point vector embeddings* | S3 Vectors chỉ nhận float32 |
| **Vector dimensions** | `1024` | Chọn được 256 / 512 / 1024; cao hơn thì chính xác hơn và tốn kho hơn |

**Rồi mới mở danh sách vector store.** *Quick create* dựng kho hộ trong chính tài khoản này; *Use an existing vector store* đấu vào kho có sẵn.

![Danh sách kho ở nhánh Quick create](huong-dan-console/anh/kbs3v-07-vector-store-types.png)

Nhánh **Quick create** cho bốn kho: OpenSearch Serverless, **S3 Vectors**, Aurora PostgreSQL Serverless (đang bị khoá), Neptune Analytics.

![Danh sách kho ở nhánh Use an existing vector store](huong-dan-console/anh/kbs3v-11-existing-store.png)

Nhánh *Use an existing vector store* cho sáu kho khác hẳn: Aurora PostgreSQL Serverless, Neptune Analytics, OpenSearch Serverless, OpenSearch Managed Cluster, Pinecone, Redis Enterprise Cloud — **không có S3 Vectors**, kể cả khi đã chọn xong mô hình embedding (kiểm trên console 24/09/2026).

Nên nhớ hai điều: **trên console, S3 Vectors chỉ dựng được qua Quick create**, và nó chỉ hiện ra sau khi đã chọn mô hình embedding. Lần dò trước không thấy nó là vì chưa chọn mô hình.

Cả embeddings model lẫn vector store **không đổi được sau khi tạo KB**.

**OpenSearch Managed Cluster loại luôn:** tài liệu AWS ghi *"For Network, you must choose Public access. OpenSearch domains that are behind a VPC are not supported for your Knowledge Base"* — trái với thiết kế chạy trong VPC.

Ba ứng viên còn lại, cơ cấu giá khác nhau về bản chất (chi tiết ở [13](13-chi-phi.md) §3a):

| Kho | Cơ cấu giá | Khi rảnh |
| --- | --- | --- |
| OpenSearch Serverless | 0,339 $/OCU-giờ | Vẫn tính tiền, trừ khi đặt sàn 0 OCU và chịu cold start |
| Aurora PostgreSQL Serverless v2 | 0,14 $/ACU-giờ | Co xuống ACU tối thiểu |
| S3 Vectors | 0,064 $/GB-tháng + 0,214 $/GB nạp + 0,0000027 $/truy vấn | Gần bằng 0, không có sàn theo giờ |

Chọn kho nào là V-K7, chưa chốt.

**Embeddings model: chưa chốt.** AD-06 nói chốt bằng đo trên bộ 50 câu trước khi tạo KB. Đừng chọn đại ở màn hình này.

### B.4a Quick create dựng index S3 Vectors bằng tham số gì

Bấm *Create Knowledge Base* thì console gọi `CreateVectorBucket` rồi `CreateIndex` trước, sau đó mới tạo IAM role và KB. Thân lời gọi `CreateIndex` mà console gửi đi:

```json
{
  "vectorBucketName": "bedrock-knowledge-base-<hậu tố ngẫu nhiên>",
  "indexName": "bedrock-knowledge-base-default-index",
  "dimension": 1024,
  "distanceMetric": "euclidean",
  "dataType": "float32",
  "metadataConfiguration": {
    "nonFilterableMetadataKeys": ["AMAZON_BEDROCK_TEXT", "AMAZON_BEDROCK_METADATA"]
  }
}
```

Bốn điều đọc ra được từ đây:

- **`distanceMetric` là `euclidean`**, không phải cosine, và console không cho đổi. Cosine vẫn lấy được nhưng phải đi đường API: `S3VectorsConfiguration` của `CreateKnowledgeBase` nhận `vectorBucketArn` và `indexArn`, nên CDK dựng index cosine trước rồi trỏ KB vào đó. Chỉ riêng console là không được.
- **Hai khoá metadata bị đánh dấu non-filterable**: `AMAZON_BEDROCK_TEXT` giữ nguyên văn chunk, `AMAZON_BEDROCK_METADATA` giữ metadata hệ thống. Non-filterable nghĩa là không lọc được theo chúng, nhưng vẫn đọc ra được khi truy vấn. Một index được tối đa 10 khoá non-filterable, nên còn tám chỗ trống.
- **Nguyên văn chunk nằm trong metadata của vector.** Bản thân S3 Vectors cho 40 KB metadata và 50 khoá mỗi vector, nhưng tài liệu Bedrock ghi trần chặt hơn khi dùng chung: *"you can attach up to **1 KB of custom metadata** (including both filterable and non-filterable metadata) and **35 metadata keys per vector**"*. Vượt trần thì **ingestion job ném lỗi**, không bỏ qua âm thầm. Mười hai khoá lọc ở [01](01-kien-truc.md) §8.2 vẫn lọt, nhưng không dư nhiều.
- **Tên bucket và index do console đặt**, không sửa được ở màn hình này.

Không đổi được sau khi index đã tạo: `dimension`, `distanceMetric`, `dataType`, và danh sách khoá non-filterable.

![Review trước khi tạo](huong-dan-console/anh/kbs3v-10-review-vector-store.png)

### B.4b Lỗi quyền đầu tiên gặp phải

Thử dựng thật ngày 24/09/2026 bằng một IAM user thường: hai lời gọi S3 Vectors đi qua, rồi dừng ở IAM.

```
AccessDeniedException: User: arn:aws:iam::<account>:user/<iam-user> is not authorized to
perform: iam:CreateRole on resource:
arn:aws:iam::<account>:role/service-role/AmazonBedrockExecutionRoleForKnowledgeBase_<hậu tố>
because no identity-based policy allows the iam:CreateRole action
```

Console báo gọn lỏn *"Knowledge Base: … was failed to create"*, không nói vì sao — muốn biết phải mở tab Network của DevTools đọc phản hồi của `iam.amazonaws.com`.

Hai hệ quả phải xử lý:

- **Vector bucket và index vẫn còn lại** sau khi KB tạo hỏng. Console không dọn hộ. Phải vào console S3 → *Vector buckets* xoá tay, nếu không sẽ tích dần mỗi lần thử.
- **Chọn *Create and use a new service role* đòi người bấm có `iam:CreateRole`** trên tiền tố `role/service-role/AmazonBedrockExecutionRoleForKnowledgeBase_*`. Đây là quyền duy nhất đã kiểm chứng; console gọi `CreateServiceRole` kèm một policy template, và lời gọi tạo KB phía sau gần như chắc chắn còn cần `iam:PassRole` — **chưa kiểm được**, vì dừng ở lỗi đầu tiên. Không cấp được thì dựng sẵn role bằng CDK rồi chọn *Use an existing service role*.

Lời gọi `lambda:ListFunctions` ở bước 2 cũng bị từ chối, nhưng vô hại: nó chỉ để đổ danh sách vào ô *Select Lambda function*, mà ô đó để trống.

### B.5 Nạp chunk lên: hai cách

> **Giải thích cho người không chuyên**
> Đây là bước đưa các đoạn tài liệu đã cắt lên kho. Một rủi ro cần nhớ: nếu hai tài liệu trùng mã định danh, tài liệu mới sẽ ghi đè tài liệu cũ mà không hề báo trước. Đây vừa là cách cập nhật một đoạn, vừa là cách mất dữ liệu nếu sinh mã định danh cẩu thả — nên quy tắc đặt mã phải chặt chẽ.

Sau khi KB có data source loại Custom, chunk được đẩy thẳng bằng `IngestKnowledgeBaseDocuments` — không có bước sync, không cần file nằm trên S3.

**Cách 1 — nội dung nằm ngay trong lời gọi**, kèm metadata inline:

```json
{
  "documents": [
    {
      "content": {
        "dataSourceType": "CUSTOM",
        "custom": {
          "customDocumentIdentifier": { "id": "EN1993-1-1_6.2.2_c01" },
          "inlineContent": {
            "textContent": { "data": "<nội dung chunk đã cắt sẵn>" },
            "type": "TEXT"
          },
          "sourceType": "IN_LINE"
        }
      },
      "metadata": {
        "inlineAttributes": [
          { "key": "scope_key",   "value": { "stringValue": "org-42/EN1993", "type": "STRING" } },
          { "key": "clause_path", "value": { "stringValue": "6.2.2",         "type": "STRING" } }
        ],
        "type": "IN_LINE_ATTRIBUTE"
      }
    }
  ]
}
```

**Cách 2 — chunk nằm trên S3**, `sourceType: "S3"`, metadata lấy từ file `.metadata.json` đi kèm (`type: "S3_LOCATION"`).

Bốn ràng buộc của AWS phải nhớ:

- **Nội dung inline thì metadata cũng phải inline.** Trộn hai kiểu sẽ bị từ chối.
- **Tối đa 25 tài liệu một lời gọi** qua API; qua console chỉ 10.
- **Trùng `id` là ghi đè**, không báo trước. Đây vừa là cách cập nhật một chunk, vừa là cách mất dữ liệu nếu sinh `id` ẩu.
- **Đừng chạy `IngestKnowledgeBaseDocuments` và `StartIngestionJob` cùng lúc.**

Với data source loại Custom thì không có `StartIngestionJob`: nạp xong là tài liệu thuộc cả data source lẫn KB.

Nạp thử vài chunk qua console để xem hình dạng trước khi viết mã: vào KB → chọn data source → **Documents** → **Add documents** → *Add documents directly*.

Sáu chunk demo dựng sẵn cho việc này nằm ở [`cong-cu/demo-chunks/`](../cong-cu/demo-chunks/README.md): chạy `build-ingest-payload.py` là ra thân lời gọi `IngestKnowledgeBaseDocuments` và bộ file `.txt` kèm sidecar để kéo thả. Sáu chunk đó cố tình có một bản đã thay thế, một chunk khác `scope_key` và một tài liệu hướng dẫn phần mềm, để thấy ngay bộ lọc có chặn đúng không.

---

## C · Cổng truy cập và hạn mức

> **Giải thích cho người không chuyên**
> Phần này lo hai việc: mở quyền để tài khoản được dùng các mô hình AI, và xin nâng hạn mức số lượt gọi mô hình cho phép mỗi phút. Cả hai nên chuẩn bị sớm, vì đều có thời gian chờ và thủ tục hành chính.

### C.1 Model access — trang này đã bị gỡ

![Trang Model access đã bị gỡ](huong-dan-console/anh/model-access-01.png)

Thao tác "vào Model access, tick model, Save" trong mọi hướng dẫn cũ **không còn**. AWS ghi trên chính trang đó: model serverless nay **tự bật khi gọi lần đầu** trong tài khoản.

Ba điều còn lại đúng, và là thứ phải chuẩn bị:

- Người dùng lần đầu gọi model Anthropic **vẫn có thể phải nộp use case details**.
- Model bán qua Marketplace cần một người **có quyền Marketplace** gọi một lần để bật cho cả tài khoản.
- Quản trị vẫn siết được bằng IAM policy và Service Control Policy.

Hệ quả cho [05](05-devops.md): ba loại cổng ở đầu tài liệu đó vẫn đúng, nhưng **cổng Marketplace đổi hình dạng** — không còn là thao tác bật model trong console mà là một người có quyền Marketplace gọi model một lần. Hai cổng còn lại, biểu mẫu use case và hạn mức, giữ nguyên.

### C.2 Service Quotas

> **Giải thích cho người không chuyên**
> "Quota" là hạn mức số lượt gọi mô hình được phép trong mỗi phút. Tài khoản mới có thể bị đặt hạn mức bằng 0, tức chưa gọi được gì cho tới khi xin nâng; AWS duyệt trong 1–3 ngày làm việc. Vì vậy phải nộp đơn xin nâng ngay từ đầu, đừng đợi tới lúc cần dùng mới xin.

![Quota Bedrock](huong-dan-console/anh/quota-01-bedrock.png)

`https://eu-central-1.console.aws.amazon.com/servicequotas/home/services/bedrock/quotas?region=eu-central-1`

Lọc theo tên model ở ô **Find**, mở đúng dòng quota rồi **Request increase**. Nộp sớm: AWS duyệt 1–3 ngày làm việc, và quota mặc định của tài khoản mới có thể bằng 0.

Quota của Sonnet 5 ở vùng này nằm dưới dạng **cross-region inference**: lọc `Sonnet 5` trả về `Cross-region model inference tokens per minute for Anthropic Claude Sonnet 5` và bản `Global cross-region...`. Xin tăng đúng dòng **cross-region không phải Global**, vì bản Global route ra ngoài EU.

---

## D · Khoá, kho và sổ ghi

> **Giải thích cho người không chuyên**
> Phần này gom bốn nền tảng bảo vệ dữ liệu: khoá mã hoá của công ty (KMS), kho tệp tài liệu gốc (S3), sổ ghi nhật ký hoạt động (CloudWatch Logs và CloudTrail), và một công tắc dừng khẩn cấp (Parameter Store). Điểm chung của cả phần: nhiều giá trị mặc định ở đây không phù hợp với yêu cầu bảo mật và tuân thủ, nên phải chủ động sửa.

### D.1 KMS — khoá customer-managed

> **Giải thích cho người không chuyên**
> KMS tạo khoá mã hoá do chính công ty quản lý để bảo vệ dữ liệu lưu trữ; ai không có quyền dùng khoá thì không đọc được dữ liệu, kể cả khi lấy được tệp. Một điểm dễ nhầm: khoá bảo vệ kho tài liệu và khoá bảo vệ kho tệp nguồn là hai vai trò khác nhau, cấp quyền ở hai nơi khác nhau, không nên gộp làm một.

![Danh sách khoá](huong-dan-console/anh/kms-01-danh-sach.png)

`https://eu-central-1.console.aws.amazon.com/kms/home?region=eu-central-1#/kms/keys`

![Bước 1 — cấu hình khoá](huong-dan-console/anh/kms-02-tao-khoa.png)

Key type **Symmetric**, Key usage **Encrypt and decrypt**. Đây là mặc định và cũng là thứ cần cho guardrail, log group, S3 và KB.

![Bước 2 — alias](huong-dan-console/anh/kms-03-alias.png)

Một khoá dùng lại cho nhiều dịch vụ được, nhưng **khoá mã hoá KB và khoá mã hoá bucket nguồn là hai vai trò khác nhau** ([05](05-devops.md) §4A): quyền của khoá KB nằm ở key policy cấp cho danh tính **tạo KB**, còn quyền đọc bucket SSE-KMS phải cấp `kms:Decrypt` cho **service role**. Hai chỗ này hay bị gộp làm một.

### D.2 S3 — bucket nguồn

> **Giải thích cho người không chuyên**
> S3 là kho cất các tệp tài liệu gốc. Ba thiết lập cốt lõi: bật mã hoá, chặn hoàn toàn truy cập công khai, và giữ lại bản cũ mỗi khi một tệp bị ghi đè. Để lộ công khai thì tài liệu nội bộ ai trên internet cũng đọc được; không giữ bản cũ thì một lần ghi đè nhầm là mất bản gốc.

![Danh sách bucket](huong-dan-console/anh/s3-01-danh-sach.png)

![Tên bucket](huong-dan-console/anh/s3-02-ten-bucket.png)

![Mã hoá mặc định](huong-dan-console/anh/s3-03-ma-hoa.png)

| Ô | Đặt gì |
| --- | --- |
| **Bucket name** | Ví dụ `vf-assistant-corpus` |
| **Default encryption** | **SSE-KMS**, trỏ vào khoá vừa tạo ở D.1 |
| **Bucket Key** | Enable — giảm số lời gọi KMS, giảm tiền |
| **Block Public Access** | Giữ bật toàn bộ |
| **Bucket Versioning** | Enable — chunk là dữ liệu dẫn xuất, tệp gốc là nguồn sự thật |

Bucket policy phải kèm điều kiện `aws:SourceAccount`; phần này không có ô trên giao diện tạo bucket, làm ở tab **Permissions** sau khi tạo.

### D.3 CloudWatch Logs

> **Giải thích cho người không chuyên**
> Đây là sổ ghi nhật ký hoạt động của hệ thống. Cả ba thiết lập quan trọng đều mặc định sai với dự án: nhật ký mặc định giữ vô thời hạn (vi phạm yêu cầu tối thiểu hoá dữ liệu của GDPR), mặc định chưa mã hoá (trong khi nhật ký có thể chứa thông tin cá nhân chưa được che), và mặc định chưa bật chống xoá. Cả ba đều phải chủ động sửa.

![Danh sách log group](huong-dan-console/anh/logs-01-danh-sach.png)

![Tạo log group](huong-dan-console/anh/logs-02-tao-log-group.png)

Ba ô quyết định, và cả ba đều **mặc định sai với dự án này**:

| Ô | Mặc định | Đặt gì |
| --- | --- | --- |
| **Retention setting** | `Never expire` | Đặt hạn theo chính sách lưu trữ đã chốt — GDPR đòi tối thiểu hoá, giữ vô thời hạn là vi phạm |
| **KMS key ARN** | trống | Khoá customer-managed. Che PII của Guardrails **chỉ áp cho response API**; bản gốc chưa che vẫn vào log nguyên văn |
| **Deletion protection** | tắt | Bật cho log group phục vụ tuân thủ |

Log group tên bắt đầu bằng `/aws/vendedlogs/` được tạo tự động khi cấu hình log delivery; các tên khác **phải tạo trước** rồi mới trỏ tới được.

### D.4 Parameter Store — kill switch

> **Giải thích cho người không chuyên**
> "Kill switch" là công tắc dừng khẩn cấp: khi có sự cố, người vận hành gạt công tắc này để tắt nhanh một chức năng mà không phải triển khai lại phần mềm. Vì đây là công tắc quyền lực, phải giới hạn thật chặt ai được phép gạt.

![Tạo tham số](huong-dan-console/anh/ssm-01-tao-tham-so.png)

`https://eu-central-1.console.aws.amazon.com/systems-manager/parameters?region=eu-central-1`

Dùng dấu `/` để phân cấp, ví dụ `/vf-assistant/kill-switch`. Type `String` cho cờ bật/tắt. Siết ai gạt được bằng IAM trên đúng đường dẫn tham số đó, không cấp `ssm:PutParameter` rộng.

### D.5 CloudTrail — data event

> **Giải thích cho người không chuyên**
> CloudTrail ghi lại ai đã làm gì trên hệ thống, phục vụ kiểm toán. Một số hoạt động quan trọng — như việc tra cứu tài liệu hay gọi bộ điều phối — mặc định không được ghi, phải chủ động bật. Không bật thì khi cần điều tra sẽ không có dấu vết, mà lúc đó thì đã muộn.

![Bước 1 — tên trail](huong-dan-console/anh/ct-01-tao-trail.png)

![Lưu trữ và mã hoá](huong-dan-console/anh/ct-02-luu-tru.png)

`Log file SSE-KMS encryption` bật sẵn và **đòi một alias KMS**; không điền thì không sang bước sau được.

![Chọn loại sự kiện](huong-dan-console/anh/ct-03-data-event.png)

![Chọn resource type](huong-dan-console/anh/ct-04-resource-type.png)

Tick **Data events**, rồi thêm một *Data event type* cho mỗi loại tài nguyên cần truy vết. Ba loại có thật trong danh sách và là ba loại dự án cần:

- `AWS::Bedrock::KnowledgeBase` — `Retrieve` là data event, **mặc định không ghi**
- `AWS::Bedrock::Guardrail`
- `AWS::BedrockAgentCore::Runtime` — truy ai đã gọi Harness

Không bật thì không truy được ai đã truy vấn cái gì, và khi cần thì đã muộn.

### D.6 Bedrock — Model invocation logging

> **Giải thích cho người không chuyên**
> Đây là công tắc bật ghi nhật ký mọi lời gọi mô hình. Ở production chỉ nên ghi metadata, vì bản gốc chưa che thông tin cá nhân sẽ vào log nguyên văn. Thiết lập này tính theo cả tài khoản và region, nên dự án dùng một tài khoản AWS riêng cho trợ lý.

![Bedrock model invocation logging](huong-dan-console/anh/bedrock-logging-01-settings.png)

`https://eu-central-1.console.aws.amazon.com/bedrock/home?region=eu-central-1#/settings`

Bật **Model invocation logging** rồi chọn đích **CloudWatch Logs** (và/hoặc S3).

| Ô | Đặt gì | Vì sao |
| --- | --- | --- |
| **Model invocation logging** | Bật, đích CloudWatch Logs | Không bật thì không có log lời gọi mô hình để điều tra |
| Phạm vi ghi | **Chỉ metadata** ở production | Bản gốc chưa che PII sẽ vào log nguyên văn (OPS-3) |
| Log group | Trỏ vào log group đã mã hoá KMS + retention (D.3) | GDPR đòi tối thiểu hoá và mã hoá |

Thiết lập theo **cả tài khoản và region**; **không** áp cho Knowledge Bases (bật CloudWatch cho từng KB riêng). Che PII của Guardrails chỉ áp cho response API — log gốc vẫn nguyên văn.

---

## E · AgentCore

> **Giải thích cho người không chuyên**
> AgentCore là bộ máy điều phối vòng lặp "hỏi mô hình — gọi công cụ — trả lời" (gọi là Harness), cùng cổng để mô hình gọi công cụ bên ngoài một cách an toàn (Gateway). Đây là nơi tập trung loại lỗi nguy hiểm nhất của cả tài liệu: nhiều giá trị mặc định đều không phù hợp dự án, nhưng để nguyên thì hệ thống vẫn chạy bình thường nên không ai phát hiện. Chẳng hạn mô hình mặc định định tuyến dữ liệu ra ngoài châu Âu, bộ nhớ hội thoại bị bật sẵn gây trùng lặp, và các công cụ nguy hiểm được mở sẵn.

`https://eu-central-1.console.aws.amazon.com/bedrock-agentcore/home?region=eu-central-1` — thanh bên có Harness, Runtime, Gateways, Memory, Policy, Identity, Payments.

Hai đường tạo Harness: **Quick create** và **Advanced create**. Dùng Advanced, vì sáu giá trị phải sửa nằm ở đó.

![Tạo Harness](huong-dan-console/anh/agentcore-03-tao-harness.png)

Hai thứ nhìn thấy ngay trên ảnh, đúng như [05](05-devops.md) §4B cảnh báo:

- **Memory hiện `(1)`** — service gắn sẵn một memory. Thiết kế yêu cầu `disabled`, nếu không sẽ có hai kho hội thoại song song, tốn phí và phát sinh rủi ro dữ liệu (Q3).
- **Tools `(0)`** trên giao diện, nhưng mặc định của API bật sẵn `shell` và `file_operations`. Khai `allowedTools` loại cả hai.

![Model mặc định](huong-dan-console/anh/agentcore-04-model.png)

Model mặc định là **`global.anthropic.claude-sonnet-4-6`** — đúng nguyên văn giá trị mà [05](05-devops.md) cảnh báo. Tiền tố `global.*` route ra ngoài EU, vi phạm yêu cầu cư trú dữ liệu (Q1). Đổi sang bản `eu.*`.

### E.1 Advanced configurations — số vòng và thời gian chờ

> **Giải thích cho người không chuyên**
> Hai con số ở đây giới hạn trợ lý được lặp bao nhiêu vòng và chờ tối đa bao lâu cho mỗi câu hỏi. Mặc định của AWS quá rộng (tối đa 75 vòng, chờ tới 60 phút), dễ khiến một câu hỏi chạy lan man và tốn kém; dự án siết xuống mức vừa đủ. Đồng thời loại bỏ các công cụ cho phép chạy lệnh hệ thống và thao tác tệp — vốn được bật sẵn nhưng trợ lý không cần đến.

Mở **Advanced configurations** → **Invocation limits** và **Allowed tools**.

![Giới hạn thực thi](huong-dan-console/anh/agentcore-05-advanced.png)

Hai con số mặc định trên màn hình đúng bằng hai con số [05](05-devops.md) §4B cảnh báo:

| Ô | Mặc định | Đặt gì |
| --- | --- | --- |
| **Max Iterations** | **75** | 5 cho lượt thường, 7 cho `optimize` |
| **Timeout duration** | **60 phút** (trần 480) | 60 giây thường, 90 giây cho `optimize` |
| **Allowed tools** | — | Loại `shell` và `file_operations` |

### E.2 Inbound Auth — danh tính gọi vào

> **Giải thích cho người không chuyên**
> Đây là bước kiểm tra "vé điện tử" (token) của bên gọi vào để xác nhận danh tính. Mặc định chỉ ràng buộc một điều kiện; nếu chỉ đặt một, token hợp lệ của một ứng dụng khác trên cùng hệ thống đăng nhập vẫn có thể gọi vào. Vì vậy đặt cả hai ràng buộc để chỉ đúng ứng dụng của dự án mới gọi được.

![Inbound Auth của Harness](huong-dan-console/anh/agentcore-06-inbound-auth.png)

Chọn **Use JSON Web Tokens (JWT)** → **Use existing Identity provider configurations** (không dùng Quick create Cognito), rồi điền Discovery URL của Keycloak.

Phần **JWT Authorization Configuration** có bốn ô, mặc định chỉ **Allowed clients** được tick:

- Tick và điền **cả Allowed audiences lẫn Allowed clients**. AWS chỉ đòi ít nhất một ràng buộc, nhưng đặt một cái thì token hợp lệ của client khác trên cùng Keycloak vẫn gọi được.
- `Allowed scopes` và `Custom claims` là hai ràng buộc bổ sung, chưa chốt trong thiết kế.

### E.3 Gateway

![Tạo Gateway](huong-dan-console/anh/agentcore-07-gateway.png)

Inbound Auth type có bốn lựa chọn. **Không bao giờ chọn `No authorization`** — gateway thành công khai, không kiểm soát truy cập. `Use IAM permissions` là SigV4: xác thực được nhưng **không mang danh tính người dùng xuống Gateway**, nên Cedar không có gì để xét.

Trang tạo Gateway còn có **Policy - optional** (nơi gắn Cedar) và **KMS key - optional**. DevOps **không tạo được Gateway target** nếu Backend chưa phát hành schema OpenAPI của facade — đây là điểm đồng bộ cứng giữa hai đội.

Keycloak token exchange (V-A6) không có trang console AWS: làm bên Keycloak.

**Cấu hình Harness phải là mã trong repo**, kèm test tự động đọc lại sau mỗi lần triển khai — console chỉ dùng để nhìn cho hiểu, không phải nơi giữ cấu hình production.

---

## F · Mạng, container, mạng biên

> **Giải thích cho người không chuyên**
> Phần này dựng hạ tầng mạng để hệ thống chạy khép kín trong mạng riêng của công ty, không phơi ra internet. Gồm các "cửa nội bộ" để các dịch vụ nói chuyện với nhau (VPC endpoint), kho chứa phần mềm đóng gói (ECR), nơi chạy ứng dụng (ECS), và các thiết lập ở mạng biên để dữ liệu trả về theo luồng liên tục, hiển thị mượt cho người dùng.

### F.1 VPC endpoint

> **Giải thích cho người không chuyên**
> Mỗi "endpoint" là một cửa nội bộ để hệ thống truy cập một dịch vụ AWS mà không cần đi ra internet. Phải tạo đủ cả năm cửa; thiếu một cửa là bộ điều phối không khởi động được vì không tải nổi phần mềm cần chạy. Cửa dễ sót nhất là cửa dành cho việc tra cứu tài liệu.

![Danh sách endpoint](huong-dan-console/anh/vpce-01-danh-sach.png)

![Tạo endpoint](huong-dan-console/anh/vpce-02-tao.png)

Lặp lại năm lần, **thiếu một cái là phiên Harness không khởi động** vì image-pull timeout:

| Tên dịch vụ | Loại |
| --- | --- |
| `com.amazonaws.eu-central-1.ecr.dkr` | Interface |
| `com.amazonaws.eu-central-1.ecr.api` | Interface |
| `com.amazonaws.eu-central-1.bedrock-runtime` | Interface |
| `com.amazonaws.eu-central-1.bedrock-agent-runtime` | Interface |
| `com.amazonaws.eu-central-1.s3` | Gateway |

`bedrock-agent-runtime` là cái dễ sót nhất: mọi tài liệu đều chỉ nhắc `bedrock-runtime`, nhưng `Retrieve` chạy trên endpoint kia.

### F.2 ECR

![ECR](huong-dan-console/anh/ecr-01.png)

Console ECR đã tách **Private registry** và **Public registry** thành hai mục riêng. Repo của dự án nằm ở Private. Harness ở chế độ VPC kéo image từ repo ECR **riêng** của AWS (`harness-<region>`) qua endpoint, không qua ECR Public và không cần NAT gateway.

### F.3 ECS

![ECS](huong-dan-console/anh/ecs-01.png)

Nơi chạy `Assistant.Api` và Worker trên Fargate — mặc định đề xuất ở [09](09-trien-khai.md) §8, còn chờ Q4 chốt.

### F.4 ALB — cho SSE đi qua

![Load balancer](huong-dan-console/anh/alb-01.png)

Với ALB đã có: chọn nó → tab **Attributes** → **Edit** → **Idle timeout** đặt **≥ 120 giây**. Lượt `optimize` có trần 90 giây; timeout 60 giây sẽ cắt ngang và frontend nhận luồng đứt không có sự kiện `done`.

### F.5 CloudFront

![CloudFront](huong-dan-console/anh/cf-01.png)

CloudFront là dịch vụ toàn cục, link tự chuyển về `us-east-1` — đúng, không phải nhầm vùng.

Với phân phối đã có: mở nó → tab **Behaviors** → thêm behavior cho `/v1/chat` với cache policy **CachingDisabled**. Bật cache trên đường này là SSE bị gom, chữ không hiện dần và người dùng nhìn màn hình trắng.

---

## G · Chi phí

> **Giải thích cho người không chuyên**
> Phần này đặt phanh chi phí: ngân sách có cảnh báo, và cơ chế phát hiện chi tiêu bất thường. Nguyên tắc là dựng trước khi tăng lưu lượng, không phải sau — vì không có hai thứ này thì chi phí có thể tăng vọt mà không ai hay cho tới khi nhận hoá đơn.

![Budgets](huong-dan-console/anh/budget-01.png)

Budgets và Cost Anomaly Detection là dịch vụ toàn cục; URL vùng sẽ tự chuyển về `us-east-1`.

**Dựng trước khi tăng lưu lượng, không phải sau.** Không có hai thứ này thì không có phanh chi phí.

### G.1 Cost Explorer — đã bật, đang chờ dữ liệu

> **Giải thích cho người không chuyên**
> Cost Explorer là công cụ xem chi phí. Chỉ riêng việc mở nó lần đầu đã là thao tác bật; sau đó AWS cần tới 24 giờ để dựng dữ liệu, trong thời gian này chưa xem được gì. Vì công cụ phát hiện bất thường đọc dữ liệu từ đây, nó cũng phải chờ cùng khoảng thời gian đó.

![Cost Explorer vừa bật](huong-dan-console/anh/ce-01-bat.png)

Mở Cost Explorer lần đầu **chính là thao tác bật** nó cho cả tài khoản; không có nút "Enable" riêng. Ngay sau khi bật, console chuyển sang mã `_CE_Not_Ready_` và gọi `ce.us-east-1.amazonaws.com` trả về 400: AWS đang dựng dữ liệu lịch sử, mất tới **24 giờ**. Trong thời gian đó cả Cost Explorer lẫn Cost Anomaly Detection đều chưa xem được, vì Anomaly Detection đọc dữ liệu của Cost Explorer.

### G.2 Cost Anomaly Detection — còn một việc phải làm

Sau khi Cost Explorer sẵn sàng, vào **Cost Anomaly Detection**, kiểm xem AWS đã tự tạo monitor mặc định chưa rồi mới tạo thêm. Một monitor chỉ hữu ích khi có **alert subscription**, và subscription cần địa chỉ người nhận — chưa chốt, phải hỏi chủ tài khoản trước khi tạo.

### G.3 Kích hoạt cost allocation tags

> **Giải thích cho người không chuyên**
> Đây là bước bật nhãn chi phí để theo dõi mỗi dự án, mỗi đội tiêu tốn bao nhiêu. Tạo nhãn là việc làm bằng CLI (mục §4 của tài liệu 05); còn kích hoạt nhãn để nó hiện trong báo cáo chi phí là thao tác trên Console tại đây.

![Kích hoạt cost allocation tags](huong-dan-console/anh/costtag-01-activate.png)

`https://us-east-1.console.aws.amazon.com/costmanagement/home#/tags` (Billing là dịch vụ toàn cục, URL tự về `us-east-1`)

Sau khi tạo application inference profile và gắn tag `CostCenter`/`Project` bằng CLI, hai tag đó xuất hiện trong danh sách **User-defined cost allocation tags**. Tick chúng rồi bấm **Activate**.

- Tag **không hồi tố**: chỉ chi phí phát sinh **sau** khi kích hoạt mới được gắn.
- Chờ **~24 giờ** tag mới hiện trong Cost Explorer.
- Tạo inference profile là **[CLI/API]**, không làm được trên Console — xem [05](05-devops.md) §4.

---

## H · IAM — role và policy least-privilege

> **Giải thích cho người không chuyên**
> IAM cấp cho mỗi thành phần đúng quyền tối thiểu cần dùng, không hơn — nguyên tắc "chìa khoá nào chỉ mở đúng cửa nấy". Cấp quá rộng thì một tài khoản bị lộ chạm được nhiều dữ liệu hơn mức cần; cấp thiếu thì thành phần không chạy. Ngoài quyền, mỗi role còn có một "trust policy" quy định ai được phép đóng vai role đó, kèm điều kiện chống bị lợi dụng nhầm (confused deputy).

Bốn role tách biệt: `assistant-runtime` (Assistant.Api), `assistant-ingest` (Worker), service role của KB, và execution role của Harness. Giá trị policy đầy đủ ở [05](05-devops.md) §2A.7 và [15](15-chi-tiet-devops.md).

![Danh sách role IAM](huong-dan-console/anh/iam-01-danh-sach.png)

### H.1 Chọn loại thực thể tin cậy

![Chọn trusted entity](huong-dan-console/anh/iam-02-trusted-entity.png)

`https://us-east-1.console.aws.amazon.com/iam/home#/roles` → **Create role** (IAM là dịch vụ toàn cục).

| Role | Trusted entity | Ghi chú |
| --- | --- | --- |
| `assistant-runtime`, `assistant-ingest` | **AWS service** → Use case nơi chạy (ECS Task) | Role gắn vào task chạy ứng dụng |
| Service role KB | **Custom trust policy**, trust `bedrock.amazonaws.com` | Tự dán trust để thêm điều kiện chống confused-deputy |
| Execution role Harness | **Custom trust policy**, trust `bedrock-agentcore.amazonaws.com` | Cần thêm `iam:PassRole` khi `CreateHarness` |

### H.2 Dán policy least-privilege (tab JSON)

![Tab JSON của policy](huong-dan-console/anh/iam-03-json-policy.png)

`#/policies/create` → tab **JSON**.

| Nguyên tắc | Vì sao |
| --- | --- |
| Liệt kê **ARN từng model** (Sonnet 5, Haiku 4.5, Sonnet 4.6) | Không dùng `bedrock:*` / `AmazonBedrockFullAccess` |
| **Deny khi thiếu `bedrock:GuardrailIdentifier`**, chỉ áp ARN model chat | Lập trình viên không bỏ được guardrail; không áp cho embedding |
| `bedrock:Rerank` để statement `Resource: "*"` riêng | Rerank không nhận ARN cụ thể |
| `assistant-ingest`: chỉ đọc/ghi S3 nguồn, **không** Rerank/Guardrails | Worker không gọi model chat |

### H.3 Trust policy chống confused-deputy

![Custom trust policy](huong-dan-console/anh/iam-04-trust-policy.png)

Với role của KB và Harness, dán trust policy tự viết kèm điều kiện:

| Điều kiện | Cho role nào | Chặn gì |
| --- | --- | --- |
| `aws:SourceAccount` + `aws:SourceArn` | KB (`knowledge-base/*`, siết về KB ID sau khi tạo), Harness (`harness/*`) | Dịch vụ bị bên khác mượn để đóng vai role |
| `aws:ResourceAccount` | S3 của service role KB | Đọc nhầm bucket trùng tên ở tài khoản khác |
| `kms:ViaService` | Giải mã bucket nguồn SSE-KMS | Chỉ dùng khoá qua đúng dịch vụ S3 |

`iam:PassRole` cần cho `CreateHarness` — thiếu là lỗi `AccessDenied` phổ biến khi tạo Harness. IAM có độ trễ lan truyền: lỗi "unable to assume role" ngay sau khi tạo role thì đợi ~10 giây rồi thử lại.

---

## I · Cơ sở dữ liệu — RDS/Aurora PostgreSQL

> **Giải thích cho người không chuyên**
> Đây là cơ sở dữ liệu lưu hồ sơ tài liệu, hồ sơ vụ việc, lịch sử hội thoại và nhật ký kiểm toán. Dữ liệu mã hoá khi lưu; một cơ chế cách ly bảo đảm mỗi công ty chỉ đọc được dữ liệu của mình, do chính cơ sở dữ liệu ép buộc chứ không phó mặc ứng dụng.

> **Ghi chú AD-17:** không còn cần `pgvector` (vector store nằm ở KB), nên bỏ ràng buộc phiên bản vốn sinh ra vì pgvector. Extension thật sự cần là **`fuzzystrmatch`** (cho `levenshtein()` gợi ý mã điều khoản, AD-29). **Không** dùng Aurora DSQL vì không hỗ trợ extension.

### I.1 Engine và template

![Chọn engine PostgreSQL](huong-dan-console/anh/rds-01-engine.png)

`https://eu-central-1.console.aws.amazon.com/rds/home?region=eu-central-1#launch-dbinstance:` → **Create database** → **Standard create**.

| Ô | Đặt gì |
| --- | --- |
| **Engine** | **PostgreSQL** hoặc **Aurora PostgreSQL-Compatible** (cả hai đều dùng được) |
| **Templates** | **Production** |
| Master credentials | Nên chọn **Manage master credentials in AWS Secrets Manager** |

### I.2 Connectivity — trong VPC, không public

![Connectivity](huong-dan-console/anh/rds-02-connectivity.png)

| Ô | Đặt gì | Vì sao |
| --- | --- | --- |
| **Public access** | **No** | Database không phơi ra internet |
| **VPC / Security group** | Trong VPC; security group chỉ mở cổng 5432 từ SG của Assistant.Api/Worker/facade | Không mở `0.0.0.0/0` |
| (Tuỳ) **RDS Proxy** | Cân nhắc khi chạy nhiều instance | Pool kết nối |

### I.3 Encryption at-rest

![Encryption KMS](huong-dan-console/anh/rds-03-encryption.png)

Bật **Enable encryption** → chọn **AWS KMS key** = khoá customer-managed của công ty (§D.1). **Không đổi được khoá sau khi tạo database.**

### I.4 Row-Level Security và extension — [SQL], không có trên Console

RLS và extension **không cấu hình được trên Console**, chỉ bằng SQL sau khi kết nối:

```sql
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- App kết nối bằng role KHÔNG phải owner và KHÔNG có BYPASSRLS
ALTER TABLE "case" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case" FORCE ROW LEVEL SECURITY;
CREATE POLICY case_org_isolation ON "case"
  USING (org_id = current_setting('app.current_org', true));
```

`org_id` đặt vào session phải lấy từ thuộc tính đã xác thực (Payment API), không từ giá trị client gửi lên. Ràng buộc: role ứng dụng không được là owner của bảng và không có `BYPASSRLS`, nếu không RLS bị bỏ qua.

---

## Nguồn

- [How content chunking works for knowledge bases](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-chunking-parsing.html) — năm chiến lược chunking và hệ quả của No chunking
- [Ingest changes directly into a knowledge base](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-direct-ingestion.html) — khác biệt giữa nạp trực tiếp và sync
- [Ingest documents directly into a knowledge base](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-direct-ingestion-add.html) — hình dạng request, metadata inline, hạn mức 25 tài liệu
- [CreateDataSource](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_CreateDataSource.html) — `vectorIngestionConfiguration` là trường cấp ngoài cùng; `chunkingConfiguration` không sửa được sau khi tạo

Những gì không có dòng nguồn ở trên là **đọc trực tiếp từ console tài khoản công ty ngày 23/09/2026**: trang Model access đã bị gỡ, model mặc định của Harness là `global.anthropic.claude-sonnet-4-6`, Harness gắn sẵn một memory, Managed KB không cho chọn chunking, và danh sách resource type của CloudTrail có `AWS::Bedrock::KnowledgeBase`, `AWS::Bedrock::Guardrail`, `AWS::BedrockAgentCore::Runtime`. Ảnh mục **H · IAM**, **I · Cơ sở dữ liệu**, **D.6 (Model invocation logging)** và **G.3 (cost allocation tags)** chụp trực tiếp trên console ngày **24/09/2026**, đã che tên và số tài khoản. Giao diện AWS đổi liên tục; kiểm lại trước khi dựa vào.
