# 16 · Hướng dẫn cấu hình trên console AWS

**Đối tượng đọc:** tài liệu này dành cho người thực thi trực tiếp trên giao diện console, không sử dụng CLI.

Tài liệu này được trình bày theo đúng thứ tự của [05-devops.md](05-devops.md). Mỗi mục bao gồm một link console, ảnh chụp từng bước và giá trị cần điền. Mọi giá trị trong tài liệu đều được lấy từ [05](05-devops.md) §2A, [09](09-trien-khai.md) và [15](15-chi-tiet-devops.md); những chỗ mà thiết kế chưa chốt đều được ghi rõ là chưa chốt và không được tự đặt.

**Vùng làm việc là `eu-central-1` (Europe — Frankfurt).** Vùng này cần được kiểm ở góc trên bên phải trước mỗi thao tác. Một link không kèm tham số vùng sẽ mở ở đúng vùng đang chọn của phiên, và tài nguyên của dự án không nằm ở vùng nào khác.

Ảnh chụp trong tài liệu đã được che tên và số tài khoản. Con số trong khung đỏ là thứ tự thao tác, còn dòng chữ bên cạnh giải thích trường đó dùng để làm gì.

---

## Mục lục

- [A · Bedrock Guardrails](#a--bedrock-guardrails)
  - [A.1 Mở trình tạo](#a1-mở-trình-tạo)
  - [A.2 Bước 1 — Guardrail details](#a2-bước-1--guardrail-details)
  - [A.3 Bước 2 — Content filters](#a3-bước-2--content-filters)
  - [A.4 Bước 3 — Denied topics](#a4-bước-3--denied-topics)
  - [A.5 Bước 5 — Sensitive information](#a5-bước-5--sensitive-information)
  - [A.6 Bước 6 — Contextual grounding](#a6-bước-6--contextual-grounding)
  - [A.7 Hai việc console không làm thay](#a7-hai-việc-console-không-làm-thay)
- [B · Knowledge Base — nạp chunk tự cắt, bỏ parse/chunk mặc định](#b--knowledge-base--nạp-chunk-tự-cắt-bỏ-parsechunk-mặc-định)
  - [B.1 Hai loại KB, chỉ một loại cho tự cắt chunk](#b1-hai-loại-kb-chỉ-một-loại-cho-tự-cắt-chunk)
  - [B.2 Tạo KB có chọn chunking](#b2-tạo-kb-có-chọn-chunking)
  - [B.3 Bước 2 — chọn No chunking](#b3-bước-2--chọn-no-chunking)
  - [B.4 Bước 3 — vector store](#b4-bước-3--vector-store)
  - [B.4a Quick create dựng index S3 Vectors bằng tham số gì](#b4a-quick-create-dựng-index-s3-vectors-bằng-tham-số-gì)
  - [B.4b Lỗi quyền đầu tiên gặp phải](#b4b-lỗi-quyền-đầu-tiên-gặp-phải)
  - [B.5 Nạp chunk lên: hai cách](#b5-nạp-chunk-lên-hai-cách)
- [C · Cổng truy cập và hạn mức](#c--cổng-truy-cập-và-hạn-mức)
  - [C.1 Model access — trang này đã bị gỡ](#c1-model-access--trang-này-đã-bị-gỡ)
  - [C.2 Service Quotas](#c2-service-quotas)
- [D · Khoá, kho và sổ ghi](#d--khoá-kho-và-sổ-ghi)
  - [D.1 KMS — khoá customer-managed](#d1-kms--khoá-customer-managed)
  - [D.2 S3 — bucket nguồn](#d2-s3--bucket-nguồn)
  - [D.3 CloudWatch Logs](#d3-cloudwatch-logs)
  - [D.4 Parameter Store — kill switch](#d4-parameter-store--kill-switch)
  - [D.5 CloudTrail — data event](#d5-cloudtrail--data-event)
  - [D.6 Bedrock — Model invocation logging](#d6-bedrock--model-invocation-logging)
- [E · AgentCore](#e--agentcore)
  - [E.1 Advanced configurations — số vòng và thời gian chờ](#e1-advanced-configurations--số-vòng-và-thời-gian-chờ)
  - [E.2 Inbound Auth — danh tính gọi vào](#e2-inbound-auth--danh-tính-gọi-vào)
  - [E.3 Gateway](#e3-gateway)
- [F · Mạng, container, mạng biên](#f--mạng-container-mạng-biên)
  - [F.1 VPC endpoint](#f1-vpc-endpoint)
  - [F.2 ECR](#f2-ecr)
  - [F.3 ECS](#f3-ecs)
  - [F.4 ALB — cho SSE đi qua](#f4-alb--cho-sse-đi-qua)
  - [F.5 CloudFront](#f5-cloudfront)
- [G · Chi phí](#g--chi-phí)
  - [G.1 Cost Explorer — đã bật, đang chờ dữ liệu](#g1-cost-explorer--đã-bật-đang-chờ-dữ-liệu)
  - [G.2 Cost Anomaly Detection — còn một việc phải làm](#g2-cost-anomaly-detection--còn-một-việc-phải-làm)
  - [G.3 Kích hoạt cost allocation tags](#g3-kích-hoạt-cost-allocation-tags)
- [H · IAM — role và policy least-privilege](#h--iam--role-và-policy-least-privilege)
  - [H.1 Chọn loại thực thể tin cậy](#h1-chọn-loại-thực-thể-tin-cậy)
  - [H.2 Dán policy least-privilege (tab JSON)](#h2-dán-policy-least-privilege-tab-json)
  - [H.3 Trust policy chống confused-deputy](#h3-trust-policy-chống-confused-deputy)
- [I · Cơ sở dữ liệu — RDS/Aurora PostgreSQL](#i--cơ-sở-dữ-liệu--rdsaurora-postgresql)
  - [I.1 Engine và template](#i1-engine-và-template)
  - [I.2 Connectivity — trong VPC, không public](#i2-connectivity--trong-vpc-không-public)
  - [I.3 Encryption at-rest](#i3-encryption-at-rest)
  - [I.4 Row-Level Security và extension — [SQL], không có trên Console](#i4-row-level-security-và-extension--sql-không-có-trên-console)
- [Nguồn](#nguồn)

---

## A · Bedrock Guardrails

Link: `https://eu-central-1.console.aws.amazon.com/bedrock/home?region=eu-central-1#/guardrails`

### A.1 Mở trình tạo

![Danh sách guardrail](huong-dan-console/anh/guardrail-01-danh-sach.png)

Danh sách trống có nghĩa là **chưa có guardrail nào được áp dụng**. AWS không bật sẵn guardrail nào cho tài khoản ([05](05-devops.md) §2A.1).

### A.2 Bước 1 — Guardrail details

![Bước chi tiết guardrail](huong-dan-console/anh/guardrail-02-chi-tiet.png)

| Ô | Giá trị | Vì sao |
| --- | --- | --- |
| **Name** | `vf-assistant-guardrail` | Tên này được dùng lại trong IAM policy để chặn các lời gọi model thiếu guardrail |
| **Description** | `Garde-fou de l'assistant VF Structures` | Phần mô tả có độ dài tối đa 200 ký tự |
| **Messaging for blocked prompts** | `Je ne traite que les questions de calcul de structure et de consultation de normes.` | Người dùng gõ tiếng Pháp nên thông điệp được giữ ở mức chung chung và không nêu bộ lọc nào đã kích hoạt |
| **Apply the same blocked message for responses** | Được bật sẵn, và có thể bỏ chọn khi cần một thông điệp riêng cho chiều ra | Ô này tương ứng với tham số `--blocked-outputs-messaging` |
| **KMS key selection → Customize encryption settings** | Khoá customer-managed của công ty | Cấu hình chứa các chủ đề cấm và mẫu nhận dạng tự viết nên cần được mã hoá bằng khoá riêng ([06](06-bao-mat.md) §13) |

Trình tạo gồm 8 bước theo thứ tự: details → content filters → denied topics → word filters → sensitive information → contextual grounding → automated reasoning → review and create.

### A.3 Bước 2 — Content filters

![Bộ lọc nội dung](huong-dan-console/anh/guardrail-03-content-filter.png)

Bước này gồm hai công tắc và một lựa chọn tier. Cả hai công tắc đều **mặc định tắt**, nên nếu không được bật thì bước này không áp dụng bộ lọc nào.

| Ô | Giá trị | Vì sao |
| --- | --- | --- |
| **Configure harmful categories filters** | Được bật, với từng loại được đặt như sau: `MISCONDUCT`, `HATE`, `INSULTS`, `SEXUAL` ở mức Medium, và **`VIOLENCE` ở mức Low** | Ngành kết cấu dùng "rupture par cisaillement" và "effondrement" làm thuật ngữ, nên nếu đặt ở mức cao thì bộ lọc sẽ chặn nhầm các câu hỏi kỹ thuật hợp lệ |
| **Configure prompt attacks filter** | Được bật, với chiều vào ở mức High và chiều ra tắt hẳn | Loại bộ lọc này chỉ có ý nghĩa ở chiều vào, và việc tắt hẳn chiều ra giúp phần đó không bị tính phí |
| **Content filters tier** | **Classic** | Tier này hỗ trợ tiếng Pháp và không đòi hỏi cross-Region inference, nhờ đó dữ liệu được giữ trong EU (Q1) |

### A.4 Bước 3 — Denied topics

![Chủ đề cấm](huong-dan-console/anh/guardrail-04-denied-topics.png)

Hai chủ đề được thêm vào, với **phần mô tả và ví dụ được viết bằng tiếng Pháp** vì người dùng gõ tiếng Pháp:

| Tên | Chặn cái gì |
| --- | --- |
| `Contournement-verification` | Các câu hỏi về cách làm sai lệch dữ liệu đầu vào, khai thiếu tải, hạ hệ số an toàn hoặc né quy trình kiểm định |
| `Conseil-juridique-ou-assurance` | Các câu hỏi về trách nhiệm dân sự, bảo hiểm, bảo hành mười năm hoặc hậu quả tranh chấp |

Các giới hạn cứng của bước này gồm: tối đa 30 chủ đề, trường `definition` tối đa 200 ký tự, tối đa 5 ví dụ và mỗi ví dụ tối đa 100 ký tự. Bước này chỉ có chiều `DENY` và không có chiều "chỉ cho phép chủ đề này".

### A.5 Bước 5 — Sensitive information

![Bộ lọc PII](huong-dan-console/anh/guardrail-05-pii.png)

| Nhóm | Giá trị |
| --- | --- |
| **PII types → Mask** | `NAME`, `EMAIL`, `PHONE`, `ADDRESS`, là những loại xuất hiện thường xuyên và vô hại trong ngữ cảnh công việc |
| **PII types → Block** | `PASSWORD`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `CREDIT_DEBIT_CARD_NUMBER`, `INTERNATIONAL_BANK_ACCOUNT_NUMBER` |
| **Regex patterns** | Các mẫu tự viết cho NIR Pháp, SIRET và căn cước công dân Việt Nam |

AWS có sẵn 31 loại PII nhưng **không có loại nào dành cho Pháp và Việt Nam**, do đó ba mẫu regex ở trên là phần việc thật sự cần làm chứ không phải chi tiết vặt. Giới hạn áp dụng cho phần này là tối đa 10 mẫu và mỗi mẫu tối đa 500 ký tự.

### A.6 Bước 6 — Contextual grounding

![Chống bịa](huong-dan-console/anh/guardrail-06-grounding.png)

Bước này gồm hai tham số là Grounding và Relevance, cả hai đều có ngưỡng khởi đầu là **0.7**. Đây là **điểm khởi đầu theo khuyến nghị chứ không phải số đo**, và cần được hiệu chỉnh bằng eval.

Điều kiện bắt buộc là mỗi lời gọi phải dán nhãn `qualifiers`, trong đó `grounding_source` dùng cho nguồn và `query` dùng cho câu hỏi. **Nếu không dán nhãn thì chính sách này sẽ im lặng và không làm gì**, nên cần có test để bắt trường hợp này.

### A.7 Hai việc console không làm thay

**Ngay sau khi tạo, guardrail ở trạng thái bản `DRAFT`.** Bản này cần được chốt thành một bản đánh số qua một thao tác thứ hai, bởi vì `DRAFT` có thể bị đổi bất cứ lúc nào và khi đó hệ thống đang chạy sẽ đổi hành vi ngay lập tức mà không ai biết.

**Guardrail chỉ chạy khi lời gọi có khai báo nó.** Nếu trường khai báo bị bỏ ra khỏi mã thì mọi bộ lọc sẽ biến mất mà không có lỗi nào được báo. Trường hợp này được chặn bằng một IAM policy `Deny` có điều kiện `bedrock:GuardrailIdentifier`, với chi tiết ở [05](05-devops.md) §2A.7.

**Ghi chú về độ ổn định của console.** Trong lần dựng đầu tiên, các bước 2–8 trả về thông báo "Unable to load content" do gói giao diện bị HTTP 403 ở `a.b.cdn.console.awsstatic.com`, và tình trạng này thường hết khi thử lại sau ít phút. Nếu lỗi lặp lại, runbook CLI ở [05](05-devops.md) §2A.4 vẫn chạy được ngay vì không phụ thuộc vào giao diện.

---

## B · Knowledge Base — nạp chunk tự cắt, bỏ parse/chunk mặc định

Đây là phần cần đọc kỹ nhất, bởi vì **việc lựa chọn loại KB quyết định có được tự cắt chunk hay không**, và một khi đã chọn thì không đổi lại được.

Trên Bedrock có ba hướng dựng knowledge base cho truy xuất và RAG, và mỗi hướng có ưu nhược riêng nên cần cân nhắc kỹ trước khi chọn (theo tài liệu Knowledge Base của Amazon Bedrock):

| Loại KB | Ưu điểm | Nhược điểm | Khi nào phù hợp |
| --- | --- | --- | --- |
| **Bedrock-managed KB** | AWS quản lý trọn gói việc lưu trữ, parse, cắt chunk và truy xuất, nên không phải dựng hay vận hành hạ tầng; ngoài ra còn có sẵn embedding, reranker và agentic retrieval được quản lý | Không chọn được chiến lược chunking (do đó không có No chunking), không kiểm soát được vector store và ít khả năng tuỳ biến | Phù hợp với phần lớn nhu cầu RAG thông thường, khi ưu tiên sự đơn giản và không muốn tự vận hành hạ tầng |
| **Customer-managed KB (unstructured vector store)** | Cho phép chọn cả parser lẫn chunking, bao gồm cả No chunking, và tự chọn được vector store phù hợp | Phải tự dựng, tự vận hành và trả tiền cho vector store, đồng thời mất các thành phần embedding, reranker và agentic retrieval quản lý sẵn | Phù hợp khi cần kiểm soát chunking hoặc parser, hoặc bắt buộc dùng No chunking như dự án này |
| **KB trên kho dữ liệu có cấu trúc (structured data store)** | Truy vấn trực tiếp dữ liệu quan hệ có cấu trúc mà không cần bước nhúng vector | Chỉ hợp với dữ liệu có cấu trúc và không dùng được cho một corpus tài liệu văn bản | Phù hợp khi nguồn dữ liệu là bảng hoặc SQL chứ không phải tài liệu, và không áp dụng cho dự án này. Hướng này không nằm trong hai nhóm mà console của tài khoản hiển thị ngày 23/09/2026, được nêu ở đây chỉ để so sánh |

Dự án chọn hướng **Customer-managed KB với unstructured vector store**, bởi vì chỉ hướng này mới tắt được chunking của AWS, với chi tiết ở B.1.

### B.1 Hai loại KB, chỉ một loại cho tự cắt chunk

Console có hai đường tạo khác nhau:

| Đường | Link | Có chọn chunking không |
| --- | --- | --- |
| **Managed KB** | `#/knowledge-bases` → **Create Managed KB** | **Không có.** Parsing strategy hiển thị cố định là *Managed parser*, còn Text chunking strategy cố định là *Default chunking*; hai dòng này chỉ là chú thích chứ không phải hộp chọn |
| **KB with vector store** (customer-managed) | `#/knowledge-bases/create-knowledge-base` | **Có.** Đường này cho phép chọn cả parser lẫn chunking, bao gồm cả **No chunking** |

![Managed KB — parser và chunking cố định](huong-dan-console/anh/kb-02-managed-co-dinh.png)

Ảnh trên là trình tạo Managed KB. Việc bấm vào *Managed parser* hay *Default chunking* chỉ mở ra một ô chú thích chứ không có danh sách lựa chọn nào. Ngay cả khi đổi data source type sang **Custom**, hai dòng đó vẫn giữ nguyên.

**Console giấu, nhưng API thì chưa chắc.** `CreateDataSource` nhận `vectorIngestionConfiguration.chunkingConfiguration.chunkingStrategy` như một trường ở cấp ngoài cùng, không gắn với loại KB nào, và tài liệu API **không** nói trường này bị loại với `MANAGED_KNOWLEDGE_BASE_CONNECTOR` — trong khi chỗ khác của chính trang đó lại nói rõ giới hạn theo loại KB (*"For managed knowledge bases, the only supported option is `DELETE`"* cho `dataDeletionPolicy`). Không thể suy ra câu trả lời từ tài liệu, bởi vì chỉ một lệnh `create-data-source` thật trên MKB mới cho biết AWS chấp nhận hay từ chối `NONE`. Lệnh đó tạo tài nguyên thật nên **chưa được chạy**.

Ghi chú của Managed KB về *Default chunking*: *"Automatically splits text into smaller chunks by default. If a document is already small enough, it's not split any further."* Câu này mở ra một đường thứ ba — **nạp file đã cắt sẵn, mỗi file đủ nhỏ** thì MKB không cắt thêm — nhưng AWS không nói "đủ nhỏ" là bao nhiêu ở đường managed, nên đường này chỉ có thể dùng được sau khi đo trên KB thật.

**Đã chốt: tự parse, tự cắt chunk, không dùng parser lẫn chunker của AWS.** Quyết định này loại Managed KB, vì bảng so sánh của AWS ghi rõ MKB dùng *"Built-in parser for multimodal file types"* và chunking chỉ có *"built-in (default) or fixed-size"* — không có `NONE`. AD-17 đã cập nhật theo: retrieval chạy trên **customer-managed KB** với `chunkingStrategy: NONE`, data source loại **Custom**.

**Quyết định này kéo theo bốn hệ quả cần chấp nhận**, bởi vì customer-managed không có sẵn những thứ mà MKB cung cấp miễn phí:

| Mất gì | Phải làm gì thay |
| --- | --- |
| Embedding quản lý sẵn (AWS ghi "None") | AD-06 chỉ còn một nhánh, đó là chọn một mô hình embedding riêng và đo trước khi tạo KB |
| Reranker miễn phí (AWS ghi "None") | Phải trả tiền cho rerank (Cohere Rerank 3.5 khoảng 0,002 $/truy vấn) hoặc bỏ hẳn rerank |
| Agentic retrieval | Chỉ còn `Retrieve` một nhịp, vốn đúng với thiết kế hiện tại nên thực chất không mất gì |
| Không phải nuôi vector store | Phải thêm một kho tự vận hành và trả tiền theo giờ (xem B.4) |

**Ba ràng buộc kỹ thuật của `NONE`:**

- **Số trang phải do Worker tự ghi.** Chế độ `NONE` bỏ đi citation theo trang cùng bộ lọc `x-amz-bedrock-kb-document-page-number`. Thiết kế đang cần số trang cho `CitationValidator`, nên số trang phải nằm trong metadata do Worker sinh ra chứ không trông vào Bedrock.
- **Trần kích thước chunk chính là trần token đầu vào của mô hình embedding.** Mỗi chunk được nhúng nguyên khối, nên Worker phải ép trần này ngay lúc cắt, và trần đó chỉ xác định được sau khi AD-06 chốt mô hình.
- **Điều "không dùng parser của AWS" chỉ đúng khi nội dung nạp vào là văn bản.** Nếu nạp PDF gốc thì Bedrock sẽ lại parse, vì vậy Worker phải nạp dưới dạng text, tức là inline `TEXT` hoặc tệp `.txt`.

### B.2 Tạo KB có chọn chunking

Ở trang **Knowledge Bases (KB)**, thao tác đúng không phải là bấm thẳng vào nút *Create Managed KB* mà là bấm vào mũi tên bên phải nút đó. Khi đó menu đổ xuống chia thành hai nhóm là *Bedrock-managed KB* và *Self-managed KB*.

![Menu chọn loại KB](huong-dan-console/anh/kbs3v-01-chon-loai.png)

Lựa chọn cần dùng là **Unstructured Vector Store KB**, đây là tên console đặt cho đường customer-managed và là chỗ duy nhất tắt được chunking của AWS. Đường tắt để mở thẳng trang này là: `https://eu-central-1.console.aws.amazon.com/bedrock/home?region=eu-central-1#/knowledge-bases/create-knowledge-base`

![Bước 1 — chi tiết KB](huong-dan-console/anh/kbcm-01-chi-tiet.png)

| Ô | Giá trị |
| --- | --- |
| **KB name** | `vf-assistant-kb` |
| **Runtime role** | *Create and use a new service role* cho lần dựng đầu, còn ở production thì dùng role đã được siết quyền theo bảng 4A của [05](05-devops.md) |
| **Choose data source type** | **Custom**, cho phép nạp thẳng tài liệu vào KB bằng API mà không qua thư mục S3 |

![Chọn data source type Custom](huong-dan-console/anh/kbcm-02-chon-custom.png)

Việc chọn **Custom** là mấu chốt, và mô tả của AWS ngay trong ô đó cũng nói rõ điều này: *"A custom data source allows the flexibility to automatically ingest documents into your vector database directly"*.

### B.3 Bước 2 — chọn No chunking

Phần cấu hình này nằm ở **Advanced settings** → **Content parsing and chunking**.

![Chọn No chunking](huong-dan-console/anh/kbcm-03-no-chunking.png)

Có năm lựa chọn là Default, Fixed-size, Hierarchical, Semantic và **No chunking**. Mô tả của AWS cho No chunking như sau: *"Suitable for documents that are already pre-processed or text split into separate files without any further chunking necessary."*

![Sau khi chọn](huong-dan-console/anh/kbcm-04-chon-xong.png)

| Ô | Giá trị | Ghi chú |
| --- | --- | --- |
| **Parsing strategy** | *Amazon Bedrock default parser* | Với chunk đã là văn bản thuần thì parser không có việc gì để làm |
| **Chunking strategy** | **No chunking** | Mỗi tài liệu nạp vào trở thành **một chunk**, đúng như đã cắt sẵn |
| **Select Lambda function** | Để trống | Ô này chỉ cần đến khi muốn Bedrock gọi hàm của mình để cắt lại và sinh metadata trong lúc nạp; với chunk đã cắt sẵn thì không cần |

**Việc chọn No chunking khiến mất đi hai thứ**, theo tài liệu AWS: không xem được số trang trong citation, và không lọc được theo `x-amz-bedrock-kb-document-page-number`. Thứ nhất trong hai điều này **có ảnh hưởng tới thiết kế**, bởi vì chunk của dự án có số trang và `CitationValidator` dùng đến nó, nên số trang phải do Worker ghi vào metadata của chính nó. Riêng bộ lọc `scope_key` và `clause_path` thì không bị ảnh hưởng.

**Chunking strategy không sửa được sau khi tạo data source.** Nếu chọn sai thì phải tạo một data source mới và nạp lại toàn bộ.

### B.4 Bước 3 — vector store

![Bước 3 — embeddings và vector store](huong-dan-console/anh/kbs3v-08-embedding-va-s3vectors.png)

Đường này bắt buộc phải có một vector store riêng. Màn hình hỏi hai thứ theo đúng thứ tự sau: **embeddings model** trước rồi **vector store** sau, và thứ tự này quan trọng vì danh sách kho phụ thuộc vào mô hình đã chọn.

**Bước chọn embeddings model.** Khi bấm *Select model*, hộp thoại mở ra hai nhà cung cấp serverless ở Frankfurt là Amazon và Cohere.

![Hộp thoại chọn embeddings model](huong-dan-console/anh/kbs3v-06-chon-embedding.png)

| Ô | Giá trị | Vì sao |
| --- | --- | --- |
| **Model** | `Titan Embeddings G2 - Text v2.0` | Mô hình này nhận tối đa 8k token đầu vào, và trần đó chính là trần độ dài chunk |
| **Embeddings type** | *Floating-point vector embeddings* | S3 Vectors chỉ nhận float32 |
| **Vector dimensions** | `1024` | Có thể chọn 256, 512 hoặc 1024; số chiều càng cao thì càng chính xác nhưng càng tốn kho |

**Sau đó mới đến danh sách vector store.** Tuỳ chọn *Quick create* dựng kho hộ ngay trong tài khoản này, còn *Use an existing vector store* đấu vào một kho có sẵn.

![Danh sách kho ở nhánh Quick create](huong-dan-console/anh/kbs3v-07-vector-store-types.png)

Nhánh **Quick create** cho bốn kho, gồm OpenSearch Serverless, **S3 Vectors**, Aurora PostgreSQL Serverless (đang bị khoá) và Neptune Analytics.

![Danh sách kho ở nhánh Use an existing vector store](huong-dan-console/anh/kbs3v-11-existing-store.png)

Nhánh *Use an existing vector store* cho sáu kho khác hẳn, gồm Aurora PostgreSQL Serverless, Neptune Analytics, OpenSearch Serverless, OpenSearch Managed Cluster, Pinecone và Redis Enterprise Cloud; trong danh sách này **không có S3 Vectors**, kể cả khi đã chọn xong mô hình embedding (kiểm trên console 24/09/2026).

Có hai điều cần nhớ. Thứ nhất, **trên console, S3 Vectors chỉ dựng được qua Quick create**. Thứ hai, nó chỉ hiện ra sau khi đã chọn mô hình embedding, nên lần dò trước không thấy nó là vì chưa chọn mô hình.

Cả embeddings model lẫn vector store đều **không đổi được sau khi tạo KB**.

**OpenSearch Managed Cluster bị loại hẳn**, bởi vì tài liệu AWS ghi *"For Network, you must choose Public access. OpenSearch domains that are behind a VPC are not supported for your Knowledge Base"*, điều này trái với thiết kế chạy trong VPC.

Ba ứng viên còn lại có cơ cấu giá khác nhau về bản chất, với chi tiết ở [13](13-chi-phi.md) §3a:

| Kho | Cơ cấu giá | Khi rảnh |
| --- | --- | --- |
| OpenSearch Serverless | 0,339 $/OCU-giờ | Vẫn tính tiền, trừ khi đặt sàn 0 OCU và chấp nhận cold start |
| Aurora PostgreSQL Serverless v2 | 0,14 $/ACU-giờ | Co xuống mức ACU tối thiểu |
| S3 Vectors | 0,064 $/GB-tháng + 0,214 $/GB nạp + 0,0000027 $/truy vấn | Gần bằng 0 vì không có sàn theo giờ |

Bảy kho mà console của tài khoản này hiển thị còn khác nhau về chi phí, ưu điểm và các hạn chế mang tính "chỉ hỗ trợ kiểu này, không hỗ trợ kiểu kia", theo ma trận lựa chọn vector store trong tài liệu thiết lập Knowledge Base của AWS:

| Kho | Chi phí | Ưu điểm | Hạn chế và pitfall cần lưu ý |
| --- | --- | --- | --- |
| **S3 Vectors** | 0,064 $/GB-tháng + 0,214 $/GB nạp + 0,0000027 $/truy vấn, gần như bằng 0 khi rảnh vì không có sàn theo giờ | Cách dựng đơn giản nhất trong các kho, do AWS quản lý và Bedrock có thể tự tạo | Là dịch vụ còn mới; trên console chỉ dựng được qua Quick create; chỉ nhận vector `float32` và trên console chỉ hỗ trợ khoảng cách `euclidean`, muốn `cosine` thì phải đi đường API; trần metadata chặt hơn khi dùng chung với Bedrock |
| **OpenSearch Serverless** | 0,339 $/OCU-giờ | Hợp với phần lớn trường hợp và hỗ trợ lọc nâng cao mạnh | Vẫn tính tiền theo OCU-giờ ngay cả khi rảnh, trừ khi đặt sàn 0 OCU và chấp nhận cold start |
| **Aurora PostgreSQL Serverless v2** | 0,14 $/ACU-giờ, co về mức ACU tối thiểu khi rảnh | Tận dụng được khi đội đã dùng Aurora và có chi phí hợp lý | Phải bật extension `pgvector`, tự vận hành cơ sở dữ liệu và lưu credential trong Secrets Manager |
| **OpenSearch Managed Cluster** | Theo cụm tự vận hành (tài liệu này không nêu số cụ thể) | Tận dụng được cụm OpenSearch tự quản đã có sẵn | Chỉ hỗ trợ **Public access** và không hỗ trợ VPC, nên đã bị loại khỏi thiết kế vốn chạy trong VPC |
| **Pinecone** | Theo gói của Pinecone (dịch vụ bên thứ ba) | Dựng nhanh khi đội đã dùng Pinecone | Là dịch vụ bên thứ ba, phải lưu API key trong Secrets Manager, và số chiều index bắt buộc phải khớp với số chiều của mô hình embedding |
| **Redis Enterprise Cloud** | Theo gói Redis Enterprise Cloud (dịch vụ bên thứ ba) | Cho độ trễ thấp nhất trong các kho | Phải dựng cụm có bật module vector search và tự vận hành |
| **Neptune Analytics** | Theo Neptune Analytics (tài liệu này không nêu số cụ thể) | Hợp với các bài toán RAG dựa trên đồ thị (graph) | Phải tạo và cấu hình graph, đồng thời phạm vi sử dụng hẹp hơn các kho còn lại |

Việc chọn kho nào là V-K7 và hiện chưa chốt.

**Embeddings model hiện chưa chốt.** AD-06 quy định việc chốt phải dựa trên đo đạc trên bộ 50 câu trước khi tạo KB, nên không được chọn tuỳ tiện ở màn hình này.

### B.4a Quick create dựng index S3 Vectors bằng tham số gì

Khi bấm *Create Knowledge Base*, console gọi `CreateVectorBucket` rồi `CreateIndex` trước, sau đó mới tạo IAM role và KB. Thân lời gọi `CreateIndex` mà console gửi đi có dạng sau:

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

Có bốn điều đọc ra được từ thân lời gọi này:

- **`distanceMetric` là `euclidean`** chứ không phải cosine, và console không cho đổi. Cosine vẫn có thể lấy được nhưng phải đi qua đường API, vì `S3VectorsConfiguration` của `CreateKnowledgeBase` nhận `vectorBucketArn` và `indexArn`, nên CDK dựng index cosine trước rồi trỏ KB vào đó; chỉ riêng console thì không làm được.
- **Hai khoá metadata bị đánh dấu non-filterable**, trong đó `AMAZON_BEDROCK_TEXT` giữ nguyên văn chunk và `AMAZON_BEDROCK_METADATA` giữ metadata hệ thống. Non-filterable có nghĩa là không lọc được theo chúng, nhưng vẫn đọc ra được khi truy vấn. Một index được phép có tối đa 10 khoá non-filterable, nên vẫn còn tám chỗ trống.
- **Nguyên văn chunk nằm trong metadata của vector.** Bản thân S3 Vectors cho phép 40 KB metadata và 50 khoá mỗi vector, nhưng tài liệu Bedrock ghi một trần chặt hơn khi dùng chung: *"you can attach up to **1 KB of custom metadata** (including both filterable and non-filterable metadata) and **35 metadata keys per vector**"*. Nếu vượt trần thì **ingestion job sẽ ném lỗi** chứ không bỏ qua âm thầm. Mười hai khoá lọc ở [01](01-kien-truc.md) §8.2 vẫn lọt, nhưng không dư nhiều.
- **Tên bucket và index do console tự đặt**, và không sửa được ở màn hình này.

Sau khi index đã tạo, các giá trị sau không đổi được nữa: `dimension`, `distanceMetric`, `dataType` và danh sách khoá non-filterable.

![Review trước khi tạo](huong-dan-console/anh/kbs3v-10-review-vector-store.png)

### B.4b Lỗi quyền đầu tiên gặp phải

Trong lần thử dựng thật ngày 24/09/2026 bằng một IAM user thường, hai lời gọi S3 Vectors đi qua được, rồi quá trình dừng lại ở IAM.

```
AccessDeniedException: User: arn:aws:iam::<account>:user/<iam-user> is not authorized to
perform: iam:CreateRole on resource:
arn:aws:iam::<account>:role/service-role/AmazonBedrockExecutionRoleForKnowledgeBase_<hậu tố>
because no identity-based policy allows the iam:CreateRole action
```

Console chỉ báo gọn *"Knowledge Base: … was failed to create"* mà không nói lý do, nên để biết nguyên nhân thì phải mở tab Network của DevTools và đọc phản hồi của `iam.amazonaws.com`.

Có hai hệ quả cần xử lý:

- **Vector bucket và index vẫn còn lại** sau khi KB tạo hỏng, và console không dọn chúng hộ. Vì vậy phải vào console S3 → *Vector buckets* để xoá tay, nếu không chúng sẽ tích dần sau mỗi lần thử.
- **Việc chọn *Create and use a new service role* đòi hỏi người bấm phải có `iam:CreateRole`** trên tiền tố `role/service-role/AmazonBedrockExecutionRoleForKnowledgeBase_*`. Đây là quyền duy nhất đã được kiểm chứng, bởi vì console gọi `CreateServiceRole` kèm một policy template, và lời gọi tạo KB phía sau gần như chắc chắn còn cần thêm `iam:PassRole`, nhưng điều này **chưa kiểm được** vì quá trình dừng ở lỗi đầu tiên. Nếu không cấp được các quyền này thì có thể dựng sẵn role bằng CDK rồi chọn *Use an existing service role*.

Lời gọi `lambda:ListFunctions` ở bước 2 cũng bị từ chối, nhưng điều này vô hại, bởi vì nó chỉ để đổ danh sách vào ô *Select Lambda function*, mà ô đó vốn để trống.

### B.5 Nạp chunk lên: hai cách

Sau khi KB đã có data source loại Custom, chunk được đẩy thẳng bằng `IngestKnowledgeBaseDocuments`, không có bước sync và không cần file nằm trên S3.

**Cách 1: nội dung nằm ngay trong lời gọi**, kèm metadata inline:

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

**Cách 2: chunk nằm trên S3**, với `sourceType: "S3"` và metadata lấy từ file `.metadata.json` đi kèm (`type: "S3_LOCATION"`).

Có bốn ràng buộc của AWS cần nhớ:

- **Nếu nội dung ở dạng inline thì metadata cũng phải ở dạng inline.** Việc trộn hai kiểu sẽ bị từ chối.
- **Mỗi lời gọi qua API nhận tối đa 25 tài liệu**, còn qua console thì chỉ 10.
- **Trùng `id` sẽ dẫn đến ghi đè** mà không báo trước. Đây vừa là cách cập nhật một chunk, vừa là nguyên nhân gây mất dữ liệu nếu sinh `id` một cách cẩu thả.
- **Không được chạy `IngestKnowledgeBaseDocuments` và `StartIngestionJob` cùng một lúc.**

Với data source loại Custom thì không có `StartIngestionJob`, bởi vì nạp xong là tài liệu đã thuộc cả data source lẫn KB.

Có thể nạp thử vài chunk qua console để xem hình dạng trước khi viết mã, theo đường dẫn: vào KB → chọn data source → **Documents** → **Add documents** → *Add documents directly*.

Sáu chunk demo dựng sẵn cho việc này nằm ở [`cong-cu/demo-chunks/`](../cong-cu/demo-chunks/README.md); khi chạy `build-ingest-payload.py` sẽ ra thân lời gọi `IngestKnowledgeBaseDocuments` cùng bộ file `.txt` kèm sidecar để kéo thả. Sáu chunk đó cố tình chứa một bản đã thay thế, một chunk khác `scope_key` và một tài liệu hướng dẫn phần mềm, nhằm thấy ngay bộ lọc có chặn đúng hay không.

---

## C · Cổng truy cập và hạn mức

### C.1 Model access — trang này đã bị gỡ

![Trang Model access đã bị gỡ](huong-dan-console/anh/model-access-01.png)

Thao tác "vào Model access, tick model, Save" trong mọi hướng dẫn cũ **không còn nữa**. AWS ghi ngay trên trang đó rằng model serverless nay **tự bật khi được gọi lần đầu** trong tài khoản.

Có ba điều vẫn còn đúng và là những thứ cần chuẩn bị:

- Người dùng lần đầu gọi model Anthropic **vẫn có thể phải nộp use case details**.
- Model bán qua Marketplace cần một người **có quyền Marketplace** gọi một lần để bật cho cả tài khoản.
- Việc quản trị vẫn có thể siết được bằng IAM policy và Service Control Policy.

Hệ quả cho [05](05-devops.md) là: ba loại cổng ở đầu tài liệu đó vẫn đúng, nhưng **cổng Marketplace đã đổi hình dạng**, bởi vì nó không còn là thao tác bật model trong console mà là việc một người có quyền Marketplace gọi model một lần. Hai cổng còn lại, gồm biểu mẫu use case và hạn mức, thì vẫn giữ nguyên.

### C.2 Service Quotas

![Quota Bedrock](huong-dan-console/anh/quota-01-bedrock.png)

`https://eu-central-1.console.aws.amazon.com/servicequotas/home/services/bedrock/quotas?region=eu-central-1`

Việc tìm quota được thực hiện bằng cách lọc theo tên model ở ô **Find**, mở đúng dòng quota rồi bấm **Request increase**. Đơn xin tăng quota nên được nộp sớm, bởi vì AWS duyệt trong 1–3 ngày làm việc và quota mặc định của một tài khoản mới có thể bằng 0.

Quota của Sonnet 5 ở vùng này nằm dưới dạng **cross-region inference**, và khi lọc `Sonnet 5` sẽ trả về `Cross-region model inference tokens per minute for Anthropic Claude Sonnet 5` cùng bản `Global cross-region...`. Đơn xin tăng cần nhắm đúng dòng **cross-region chứ không phải bản Global**, bởi vì bản Global route ra ngoài EU.

---

## D · Khoá, kho và sổ ghi

### D.1 KMS — khoá customer-managed

![Danh sách khoá](huong-dan-console/anh/kms-01-danh-sach.png)

`https://eu-central-1.console.aws.amazon.com/kms/home?region=eu-central-1#/kms/keys`

![Bước 1 — cấu hình khoá](huong-dan-console/anh/kms-02-tao-khoa.png)

Key type là **Symmetric** và Key usage là **Encrypt and decrypt**. Đây là giá trị mặc định và cũng chính là cấu hình cần cho guardrail, log group, S3 và KB.

![Bước 2 — alias](huong-dan-console/anh/kms-03-alias.png)

Một khoá có thể được dùng lại cho nhiều dịch vụ, nhưng **khoá mã hoá KB và khoá mã hoá bucket nguồn là hai vai trò khác nhau** ([05](05-devops.md) §4A). Quyền của khoá KB nằm ở key policy cấp cho danh tính **tạo KB**, còn quyền đọc bucket SSE-KMS phải cấp `kms:Decrypt` cho **service role**. Hai chỗ này thường bị gộp nhầm làm một.

### D.2 S3 — bucket nguồn

![Danh sách bucket](huong-dan-console/anh/s3-01-danh-sach.png)

![Tên bucket](huong-dan-console/anh/s3-02-ten-bucket.png)

![Mã hoá mặc định](huong-dan-console/anh/s3-03-ma-hoa.png)

| Ô | Giá trị |
| --- | --- |
| **Bucket name** | Ví dụ `vf-assistant-corpus` |
| **Default encryption** | **SSE-KMS**, trỏ vào khoá đã tạo ở D.1 |
| **Bucket Key** | Enable, giúp giảm số lời gọi KMS và giảm chi phí |
| **Block Public Access** | Được giữ bật toàn bộ |
| **Bucket Versioning** | Enable, vì chunk là dữ liệu dẫn xuất còn tệp gốc mới là nguồn sự thật |

Bucket policy phải kèm điều kiện `aws:SourceAccount`; phần này không có ô riêng trên giao diện tạo bucket mà được làm ở tab **Permissions** sau khi tạo.

### D.3 CloudWatch Logs

![Danh sách log group](huong-dan-console/anh/logs-01-danh-sach.png)

![Tạo log group](huong-dan-console/anh/logs-02-tao-log-group.png)

Có ba ô mang tính quyết định, và cả ba đều có **giá trị mặc định sai với dự án này**:

| Ô | Mặc định | Giá trị |
| --- | --- | --- |
| **Retention setting** | `Never expire` | Thời hạn được đặt theo chính sách lưu trữ đã chốt, bởi vì GDPR đòi tối thiểu hoá và việc giữ vô thời hạn là vi phạm |
| **KMS key ARN** | trống | Là khoá customer-managed, bởi vì việc che PII của Guardrails **chỉ áp cho response API** nên bản gốc chưa che vẫn vào log nguyên văn |
| **Deletion protection** | tắt | Được bật cho các log group phục vụ tuân thủ |

Log group có tên bắt đầu bằng `/aws/vendedlogs/` được tạo tự động khi cấu hình log delivery, còn các tên khác **phải được tạo trước** thì mới trỏ tới được.

### D.4 Parameter Store — kill switch

![Tạo tham số](huong-dan-console/anh/ssm-01-tao-tham-so.png)

`https://eu-central-1.console.aws.amazon.com/systems-manager/parameters?region=eu-central-1`

Dấu `/` được dùng để phân cấp, ví dụ `/vf-assistant/kill-switch`. Type là `String` cho một cờ bật/tắt. Việc siết ai được gạt cờ được thực hiện bằng IAM trên đúng đường dẫn tham số đó, và không cấp `ssm:PutParameter` một cách rộng rãi.

### D.5 CloudTrail — data event

![Bước 1 — tên trail](huong-dan-console/anh/ct-01-tao-trail.png)

![Lưu trữ và mã hoá](huong-dan-console/anh/ct-02-luu-tru.png)

`Log file SSE-KMS encryption` được bật sẵn và **đòi một alias KMS**, nên nếu không điền thì không sang được bước sau.

![Chọn loại sự kiện](huong-dan-console/anh/ct-03-data-event.png)

![Chọn resource type](huong-dan-console/anh/ct-04-resource-type.png)

Ô **Data events** được tick, rồi thêm một *Data event type* cho mỗi loại tài nguyên cần truy vết. Có ba loại vừa có thật trong danh sách vừa là ba loại dự án cần đến:

- `AWS::Bedrock::KnowledgeBase`, trong đó `Retrieve` là một data event và **mặc định không được ghi**.
- `AWS::Bedrock::Guardrail`, loại tài nguyên cho các lời gọi guardrail.
- `AWS::BedrockAgentCore::Runtime`, dùng để truy ai đã gọi Harness.

Nếu không bật thì không thể truy được ai đã truy vấn cái gì, và đến khi cần thì đã muộn.

### D.6 Bedrock — Model invocation logging

![Bedrock model invocation logging](huong-dan-console/anh/bedrock-logging-01-settings.png)

`https://eu-central-1.console.aws.amazon.com/bedrock/home?region=eu-central-1#/settings`

Bước này bật **Model invocation logging** rồi chọn đích là **CloudWatch Logs** (và/hoặc S3).

| Ô | Giá trị | Vì sao |
| --- | --- | --- |
| **Model invocation logging** | Được bật, với đích là CloudWatch Logs | Nếu không bật thì không có log lời gọi mô hình để điều tra |
| Phạm vi ghi | **Chỉ metadata** ở production | Bản gốc chưa che PII sẽ vào log nguyên văn (OPS-3) |
| Log group | Là một log group đã mã hoá KMS và đã đặt retention (D.3) | GDPR đòi tối thiểu hoá và mã hoá |

Thiết lập này áp theo **cả tài khoản và region**, và **không** áp cho Knowledge Bases, bởi vì CloudWatch được bật riêng cho từng KB. Việc che PII của Guardrails chỉ áp cho response API, nên log gốc vẫn ở dạng nguyên văn.

---

## E · AgentCore

`https://eu-central-1.console.aws.amazon.com/bedrock-agentcore/home?region=eu-central-1`: thanh bên của trang này gồm Harness, Runtime, Gateways, Memory, Policy, Identity và Payments.

Có hai đường tạo Harness là **Quick create** và **Advanced create**. Đường được dùng là Advanced, bởi vì sáu giá trị cần sửa đều nằm ở đó.

![Tạo Harness](huong-dan-console/anh/agentcore-03-tao-harness.png)

Có hai thứ nhìn thấy ngay trên ảnh, đúng như [05](05-devops.md) §4B đã cảnh báo:

- **Memory hiện `(1)`**, tức là service đã gắn sẵn một memory. Thiết kế yêu cầu đặt `disabled`, bởi vì nếu không sẽ có hai kho hội thoại song song, vừa tốn phí vừa phát sinh rủi ro dữ liệu (Q3).
- **Tools hiện `(0)`** trên giao diện, nhưng mặc định của API lại bật sẵn `shell` và `file_operations`. Khai báo `allowedTools` sẽ loại cả hai công cụ này.

![Model mặc định](huong-dan-console/anh/agentcore-04-model.png)

Model mặc định là **`global.anthropic.claude-sonnet-4-6`**, đúng nguyên văn giá trị mà [05](05-devops.md) đã cảnh báo. Tiền tố `global.*` route ra ngoài EU và vi phạm yêu cầu cư trú dữ liệu (Q1), nên giá trị này cần được đổi sang bản `eu.*`.

### E.1 Advanced configurations — số vòng và thời gian chờ

Các giá trị này nằm ở **Advanced configurations** → **Invocation limits** và **Allowed tools**.

![Giới hạn thực thi](huong-dan-console/anh/agentcore-05-advanced.png)

Hai con số mặc định trên màn hình đúng bằng hai con số mà [05](05-devops.md) §4B đã cảnh báo:

| Ô | Mặc định | Giá trị |
| --- | --- | --- |
| **Max Iterations** | **75** | 5 cho lượt thường và 7 cho `optimize` |
| **Timeout duration** | **60 phút** (trần 480) | 60 giây cho lượt thường và 90 giây cho `optimize` |
| **Allowed tools** | — | `shell` và `file_operations` bị loại bỏ |

### E.2 Inbound Auth — danh tính gọi vào

![Inbound Auth của Harness](huong-dan-console/anh/agentcore-06-inbound-auth.png)

Cấu hình cần chọn **Use JSON Web Tokens (JWT)** → **Use existing Identity provider configurations** (không dùng Quick create Cognito), rồi điền Discovery URL của Keycloak.

Phần **JWT Authorization Configuration** có bốn ô, và theo mặc định chỉ **Allowed clients** được tick:

- Cả **Allowed audiences lẫn Allowed clients** đều cần được tick và điền. AWS chỉ đòi ít nhất một ràng buộc, nhưng nếu chỉ đặt một thì token hợp lệ của một client khác trên cùng Keycloak vẫn gọi được.
- `Allowed scopes` và `Custom claims` là hai ràng buộc bổ sung và hiện chưa chốt trong thiết kế.

### E.3 Gateway

![Tạo Gateway](huong-dan-console/anh/agentcore-07-gateway.png)

Inbound Auth type có bốn lựa chọn. Tuỳ chọn **`No authorization` tuyệt đối không được sử dụng**, bởi vì khi đó gateway sẽ thành công khai và không kiểm soát truy cập. Tuỳ chọn `Use IAM permissions` là SigV4, xác thực được nhưng **không mang danh tính người dùng xuống Gateway**, nên Cedar không có gì để xét.

Trang tạo Gateway còn có **Policy - optional** (nơi gắn Cedar) và **KMS key - optional**. DevOps **không tạo được Gateway target** nếu Backend chưa phát hành schema OpenAPI của facade, và đây là điểm đồng bộ cứng giữa hai đội.

Keycloak token exchange (V-A6) không có trang trên console AWS mà được làm bên Keycloak.

**Cấu hình Harness phải là mã trong repo**, kèm test tự động đọc lại sau mỗi lần triển khai; console chỉ dùng để xem cho hiểu chứ không phải nơi giữ cấu hình production.

---

## F · Mạng, container, mạng biên

### F.1 VPC endpoint

![Danh sách endpoint](huong-dan-console/anh/vpce-01-danh-sach.png)

![Tạo endpoint](huong-dan-console/anh/vpce-02-tao.png)

Thao tác này được lặp lại năm lần, và **nếu thiếu một cái thì phiên Harness không khởi động** vì image-pull timeout:

| Tên dịch vụ | Loại |
| --- | --- |
| `com.amazonaws.eu-central-1.ecr.dkr` | Interface |
| `com.amazonaws.eu-central-1.ecr.api` | Interface |
| `com.amazonaws.eu-central-1.bedrock-runtime` | Interface |
| `com.amazonaws.eu-central-1.bedrock-agent-runtime` | Interface |
| `com.amazonaws.eu-central-1.s3` | Gateway |

`bedrock-agent-runtime` là cái dễ sót nhất, bởi vì mọi tài liệu đều chỉ nhắc `bedrock-runtime`, trong khi `Retrieve` lại chạy trên endpoint kia.

### F.2 ECR

![ECR](huong-dan-console/anh/ecr-01.png)

Console ECR đã tách **Private registry** và **Public registry** thành hai mục riêng, và repo của dự án nằm ở Private. Ở chế độ VPC, Harness kéo image từ repo ECR **riêng** của AWS (`harness-<region>`) qua endpoint chứ không qua ECR Public, và cũng không cần NAT gateway.

### F.3 ECS

![ECS](huong-dan-console/anh/ecs-01.png)

Đây là nơi chạy `Assistant.Api` và Worker trên Fargate; đây là mặc định đề xuất ở [09](09-trien-khai.md) §8 và còn chờ Q4 chốt.

### F.4 ALB — cho SSE đi qua

![Load balancer](huong-dan-console/anh/alb-01.png)

Với một ALB đã có sẵn, đường cấu hình là: chọn nó → tab **Attributes** → **Edit** → **Idle timeout** được đặt ở mức **≥ 120 giây**. Lượt `optimize` có trần 90 giây, nên nếu timeout để ở 60 giây thì nó sẽ cắt ngang và frontend nhận một luồng bị đứt, không có sự kiện `done`.

### F.5 CloudFront

![CloudFront](huong-dan-console/anh/cf-01.png)

CloudFront là dịch vụ toàn cục, nên link tự chuyển về `us-east-1`; đây là hành vi đúng chứ không phải nhầm vùng.

Với một phân phối đã có sẵn, đường cấu hình là: mở nó → tab **Behaviors** → thêm một behavior cho `/v1/chat` với cache policy **CachingDisabled**. Nếu bật cache trên đường này thì SSE sẽ bị gom lại, chữ không hiện dần và người dùng chỉ nhìn thấy màn hình trắng.

---

## G · Chi phí

![Budgets](huong-dan-console/anh/budget-01.png)

Budgets và Cost Anomaly Detection là dịch vụ toàn cục, nên URL vùng sẽ tự chuyển về `us-east-1`.

**Hai thứ này cần được dựng trước khi tăng lưu lượng chứ không phải sau.** Nếu không có chúng thì hệ thống không có phanh chi phí.

### G.1 Cost Explorer — đã bật, đang chờ dữ liệu

![Cost Explorer vừa bật](huong-dan-console/anh/ce-01-bat.png)

Việc mở Cost Explorer lần đầu **chính là thao tác bật** nó cho cả tài khoản, và không có nút "Enable" riêng. Ngay sau khi bật, console chuyển sang mã `_CE_Not_Ready_` và lời gọi `ce.us-east-1.amazonaws.com` trả về 400, bởi vì AWS đang dựng dữ liệu lịch sử, quá trình này mất tới **24 giờ**. Trong thời gian đó, cả Cost Explorer lẫn Cost Anomaly Detection đều chưa xem được, vì Anomaly Detection đọc dữ liệu của Cost Explorer.

### G.2 Cost Anomaly Detection — còn một việc phải làm

Sau khi Cost Explorer sẵn sàng, ở phần **Cost Anomaly Detection** cần kiểm xem AWS đã tự tạo monitor mặc định chưa rồi mới tạo thêm. Một monitor chỉ hữu ích khi có **alert subscription**, và subscription lại cần địa chỉ người nhận; địa chỉ này hiện chưa chốt nên phải hỏi chủ tài khoản trước khi tạo.

### G.3 Kích hoạt cost allocation tags

![Kích hoạt cost allocation tags](huong-dan-console/anh/costtag-01-activate.png)

`https://us-east-1.console.aws.amazon.com/costmanagement/home#/tags` (Billing là dịch vụ toàn cục, URL tự về `us-east-1`)

Sau khi tạo application inference profile và gắn tag `CostCenter`/`Project` bằng CLI, hai tag đó xuất hiện trong danh sách **User-defined cost allocation tags**. Hai tag này cần được tick rồi bấm **Activate**.

- Tag **không có hiệu lực hồi tố**, bởi vì chỉ những chi phí phát sinh **sau** khi kích hoạt mới được gắn tag.
- Cần chờ khoảng **~24 giờ** thì tag mới hiện trong Cost Explorer.
- Việc tạo inference profile là thao tác **[CLI/API]** và không làm được trên Console, chi tiết ở [05](05-devops.md) §4.

---

## H · IAM — role và policy least-privilege

Có bốn role tách biệt, gồm `assistant-runtime` (Assistant.Api), `assistant-ingest` (Worker), service role của KB và execution role của Harness. Giá trị policy đầy đủ nằm ở [05](05-devops.md) §2A.7 và [15](15-chi-tiet-devops.md).

![Danh sách role IAM](huong-dan-console/anh/iam-01-danh-sach.png)

### H.1 Chọn loại thực thể tin cậy

![Chọn trusted entity](huong-dan-console/anh/iam-02-trusted-entity.png)

`https://us-east-1.console.aws.amazon.com/iam/home#/roles` → **Create role** (IAM là dịch vụ toàn cục).

| Role | Trusted entity | Ghi chú |
| --- | --- | --- |
| `assistant-runtime`, `assistant-ingest` | **AWS service** → Use case nơi chạy (ECS Task) | Đây là role được gắn vào task chạy ứng dụng |
| Service role KB | **Custom trust policy**, trust `bedrock.amazonaws.com` | Trust được tự dán để thêm điều kiện chống confused-deputy |
| Execution role Harness | **Custom trust policy**, trust `bedrock-agentcore.amazonaws.com` | Cần thêm `iam:PassRole` khi gọi `CreateHarness` |

### H.2 Dán policy least-privilege (tab JSON)

![Tab JSON của policy](huong-dan-console/anh/iam-03-json-policy.png)

`#/policies/create` → tab **JSON**.

| Nguyên tắc | Vì sao |
| --- | --- |
| Chỉ cho phép **ARN của từng model** (Sonnet 5, Haiku 4.5, Sonnet 4.6) | Để không phải dùng `bedrock:*` hay `AmazonBedrockFullAccess` |
| **Deny khi thiếu `bedrock:GuardrailIdentifier`**, chỉ áp cho ARN model chat | Nhờ đó lập trình viên không bỏ được guardrail, và điều kiện này không áp cho embedding |
| `bedrock:Rerank` được đặt ở một statement `Resource: "*"` riêng | Rerank không nhận ARN cụ thể |
| `assistant-ingest` chỉ đọc/ghi S3 nguồn và **không** có Rerank hay Guardrails | Worker không gọi model chat |

### H.3 Trust policy chống confused-deputy

![Custom trust policy](huong-dan-console/anh/iam-04-trust-policy.png)

Với role của KB và Harness, trust policy tự viết được dán vào kèm các điều kiện sau:

| Điều kiện | Cho role nào | Chặn gì |
| --- | --- | --- |
| `aws:SourceAccount` + `aws:SourceArn` | KB (`knowledge-base/*`, siết về KB ID sau khi tạo), Harness (`harness/*`) | Ngăn dịch vụ bị bên khác mượn để đóng vai role |
| `aws:ResourceAccount` | S3 của service role KB | Ngăn đọc nhầm bucket trùng tên ở một tài khoản khác |
| `kms:ViaService` | Giải mã bucket nguồn SSE-KMS | Đảm bảo chỉ dùng khoá qua đúng dịch vụ S3 |

`iam:PassRole` là quyền cần cho `CreateHarness`, và nếu thiếu thì sẽ gặp lỗi `AccessDenied` phổ biến khi tạo Harness. IAM có độ trễ lan truyền, nên nếu gặp lỗi "unable to assume role" ngay sau khi tạo role thì cần đợi khoảng ~10 giây rồi thử lại.

---

## I · Cơ sở dữ liệu — RDS/Aurora PostgreSQL

> **Ghi chú AD-17:** dự án không còn cần `pgvector` vì vector store đã nằm ở KB, nên ràng buộc phiên bản vốn sinh ra vì pgvector được bỏ đi. Extension thật sự cần đến là **`fuzzystrmatch`** (dùng cho `levenshtein()` để gợi ý mã điều khoản, AD-29). Aurora DSQL **không** được dùng vì nó không hỗ trợ extension.

### I.1 Engine và template

![Chọn engine PostgreSQL](huong-dan-console/anh/rds-01-engine.png)

`https://eu-central-1.console.aws.amazon.com/rds/home?region=eu-central-1#launch-dbinstance:` → **Create database** → **Standard create**.

| Ô | Giá trị |
| --- | --- |
| **Engine** | **PostgreSQL** hoặc **Aurora PostgreSQL-Compatible** (cả hai đều dùng được) |
| **Templates** | **Production** |
| Master credentials | Nên chọn **Manage master credentials in AWS Secrets Manager** |

### I.2 Connectivity — trong VPC, không public

![Connectivity](huong-dan-console/anh/rds-02-connectivity.png)

| Ô | Giá trị | Vì sao |
| --- | --- | --- |
| **Public access** | **No** | Để database không phơi ra internet |
| **VPC / Security group** | Nằm trong VPC, với security group chỉ mở cổng 5432 từ SG của Assistant.Api/Worker/facade | Để không mở `0.0.0.0/0` |
| (Tuỳ) **RDS Proxy** | Được cân nhắc khi chạy nhiều instance | Giúp pool kết nối |

### I.3 Encryption at-rest

![Encryption KMS](huong-dan-console/anh/rds-03-encryption.png)

Cấu hình mã hoá gồm: bật **Enable encryption** → chọn **AWS KMS key** là khoá customer-managed của công ty (§D.1). **Khoá này không đổi được sau khi đã tạo database.**

### I.4 Row-Level Security và extension — [SQL], không có trên Console

RLS và extension **không cấu hình được trên Console** mà chỉ làm được bằng SQL sau khi đã kết nối:

```sql
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- App kết nối bằng role KHÔNG phải owner và KHÔNG có BYPASSRLS
ALTER TABLE "case" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case" FORCE ROW LEVEL SECURITY;
CREATE POLICY case_org_isolation ON "case"
  USING (org_id = current_setting('app.current_org', true));
```

Giá trị `org_id` đặt vào session phải được lấy từ thuộc tính đã xác thực (Payment API) chứ không lấy từ giá trị mà client gửi lên. Một ràng buộc quan trọng là role ứng dụng không được là owner của bảng và không được có `BYPASSRLS`, bởi vì nếu không thì RLS sẽ bị bỏ qua.

---

## Nguồn

- [How content chunking works for knowledge bases](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-chunking-parsing.html) — năm chiến lược chunking và hệ quả của No chunking
- [Ingest changes directly into a knowledge base](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-direct-ingestion.html) — khác biệt giữa nạp trực tiếp và sync
- [Ingest documents directly into a knowledge base](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-direct-ingestion-add.html) — hình dạng request, metadata inline, hạn mức 25 tài liệu
- [CreateDataSource](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_CreateDataSource.html) — `vectorIngestionConfiguration` là trường cấp ngoài cùng; `chunkingConfiguration` không sửa được sau khi tạo

Những gì không có dòng nguồn ở trên là **đọc trực tiếp từ console tài khoản công ty ngày 23/09/2026**: trang Model access đã bị gỡ, model mặc định của Harness là `global.anthropic.claude-sonnet-4-6`, Harness gắn sẵn một memory, Managed KB không cho chọn chunking, và danh sách resource type của CloudTrail có `AWS::Bedrock::KnowledgeBase`, `AWS::Bedrock::Guardrail`, `AWS::BedrockAgentCore::Runtime`. Ảnh mục **H · IAM**, **I · Cơ sở dữ liệu**, **D.6 (Model invocation logging)** và **G.3 (cost allocation tags)** chụp trực tiếp trên console ngày **24/09/2026**, đã che tên và số tài khoản. Giao diện AWS thay đổi liên tục, nên cần kiểm lại trước khi dựa vào.
