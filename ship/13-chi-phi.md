# 13 · Chi phí — đơn giá thật, mô hình tính, ba kịch bản

> **Mục này trả lời:** một lượt hỏi tốn bao nhiêu, tiền đi vào đâu, một tháng tốn bao nhiêu ở ba mức lưu lượng, và chỉnh chỗ nào thì giảm được.
>
> **Ai đọc:** Lãnh đạo và CTO (mục 1, 5), DevOps (mục 3, 4, 7), Backend (mục 2, 6).

---

## Đọc bảng số trong file này thế nào

| Loại số | Nguồn | Độ tin cậy |
| --- | --- | --- |
| **Đơn giá** | AWS Price List Bulk API, `eu-central-1`, on-demand, USD, trước thuế. Bản công bố: mô hình nền 11/09/2026, AgentCore và Knowledge Base 15/09/2026, Bedrock (Guardrails, Rerank) 17/09/2026 | Đã kiểm chứng. Tải lại bằng [`cong-cu/fetch_prices.py`](cong-cu/fetch_prices.py) |
| **Kích thước prompt, số vòng tool loop, tỉ trọng loại câu hỏi, số kỹ sư** | Giả định, ghi rõ ở mục 2 | **Chưa đo.** Thay bằng số thật đọc từ `usage` của event `done` và từ Cost Explorer ngay khi có traffic |
| **Tổng tiền** | Tính bằng [`cong-cu/cost_model.py`](cong-cu/cost_model.py) từ hai loại trên | Đúng bằng độ đúng của giả định |

Mọi phép tính chạy bằng script, không tính tay. Đổi một giả định thì chạy lại script, không sửa số trong file này bằng tay.

**Quy ước giá.** Hệ thống gọi mô hình qua inference profile `eu.*` (AD-03), nên dùng dòng giá "Standard", "Regional" hoặc "cross-region-geo". Dòng giá "Global" rẻ hơn khoảng 10% nhưng cho phép route ra ngoài EU, nên không dùng.

---

## 1. Kết luận

- **Một lượt hỏi trung bình khoảng $0,049**, tức khoảng **$49 cho 1 000 lượt**, theo tỉ trọng loại câu hỏi giả định ở mục 2.
- **Tiền mô hình chiếm khoảng 85% chi phí biến đổi**, Guardrails khoảng 12%, Knowledge Base cộng rerank khoảng 2%, AgentCore khoảng 0,25%. Con số "token mô hình ~98%" ở [05](05-devops.md) chưa tính Guardrails.
- **Lượt `optimize` đắt gấp khoảng 5 lần lượt hỏi tài liệu**, vì tool loop gửi lại toàn bộ ngữ cảnh ở mỗi vòng.
- **Chi phí cố định khoảng $355 mỗi tháng**, trong đó VPC endpoint chiếm gần 40%. Ở quy mô thí điểm, phần cố định là 2/3 hóa đơn; ở quy mô mở rộng chỉ còn khoảng 8%.
- **Guardrails chiếm khoảng 25% chi phí của một lượt hỏi tài liệu, riêng phần soát chunk bọc `guardContent` là khoảng 22%.** Đây là đòn bẩy lớn chưa được thiết kế nhắc tới (mục 6).
- **Không dùng OpenSearch để tra case**: giữ ấm tốn $495–990 mỗi tháng, trong khi case nằm trong Aurora tốn thêm chưa tới $1 ([12](12-tra-case.md) §6).

---

## 2. Giả định

**Kích thước prompt và đầu ra (token).** Trần đầu ra lấy từ [01](01-kien-truc.md) §8.3; phần còn lại là giả định.

| Lời gọi | Mô hình | Đầu vào | Đầu ra trung bình |
| --- | --- | --- | --- |
| Phân loại, vòng đầu của Harness | Sonnet 5 | 1 500 tĩnh + 600 lịch sử 3 lượt + 80 câu hỏi + 200 `pageContext`. Không cache, cùng lý do với tool loop ở dòng dưới | 150 |
| Trả lời RAG (bước 7) | Sonnet 5, thinking tắt | 2 500 tĩnh **đọc từ cache** + 1 500 lịch sử + 12 chunk × 400 + 80 câu hỏi | 600 |
| So sánh case (bước 7) | Sonnet 5 | 2 500 tĩnh đọc từ cache + 1 500 lịch sử + 5 case × 300 + 80 | 500 |
| Tool loop (bước 6b) | Sonnet 5 qua Harness | Mỗi vòng: 4 000 tĩnh + 1 500 lịch sử + 80 câu hỏi + kết quả các vòng trước (1 200 + 350 mỗi vòng). **Không cache**, vì Harness có cache hay không chưa kiểm chứng | 350 mỗi vòng, 700 ở vòng cuối |

**Số vòng tool loop:** `calc` 3, `explain_result` 3, `mixed` 4, `optimize` 7.

**Guardrails:** bật content filter (gồm prompt attack), denied topics, PII trả phí; tổng $0,40 cho 1 000 text unit. Một text unit tối đa 1 000 ký tự. Giả định 4 ký tự mỗi token. Soát câu hỏi (`ApplyGuardrail` INPUT), soát câu trả lời, và soát nội dung bọc `guardContent`. Contextual grounding **tắt** trong kịch bản gốc.

**Retrieval:** 2 lần `Retrieve` mỗi lượt hỏi tài liệu (lần chính và lần lấy chunk lân cận). Rerank dùng reranker quản lý sẵn của Knowledge Base, không tính tiền (V-K6).

**Tỉ trọng loại câu hỏi:**

| `doc_qa` | `app_help` | `calc` | `explain_result` | `mixed` | `optimize` | `case_lookup` | `out_of_scope` | bị chặn ở guardrail |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 50% | 5% | 15% | 8% | 7% | 3% | 5% | 2% | 5% |

**Ba kịch bản lưu lượng**, 22 ngày làm việc mỗi tháng:

| Kịch bản | Kỹ sư hoạt động | Lượt mỗi kỹ sư mỗi ngày |
| --- | --- | --- |
| Thí điểm | 20 | 8 |
| Một công ty | 60 | 15 |
| Mở rộng | 250 | 15 |

---

## 3. Đơn giá dùng trong mô hình

**Mô hình**, USD mỗi 1 triệu token, profile `eu.*`:

| Mô hình | Input | Output | Cache read | Cache write 5 phút | Cache write 1 giờ |
| --- | --- | --- | --- | --- | --- |
| Claude Sonnet 5 | 2,20 | 11,00 | 0,22 | 2,75 | 4,40 |
| Claude Haiku 4.5 | 1,10 | 5,50 | 0,11 | 1,375 | 2,20 |
| Claude Sonnet 4.6 (fallback) | 3,30 | 16,50 | 0,33 | 4,125 | 6,60 |
| Claude Opus 5 (giám khảo eval) | 5,50 | 27,50 | 0,55 | — | — |
| Claude Opus 5, batch | 2,75 | 13,75 | — | — | — |

**Dịch vụ Bedrock khác:**

| Khoản | Đơn giá |
| --- | --- |
| Knowledge Base `Retrieve` | $0,001 mỗi lần gọi |
| Knowledge Base lưu trữ | $5,00 mỗi GB-tháng |
| Rerank quản lý sẵn của MKB | $0 (chỉ khi dùng embedding `MANAGED`) |
| Cohere Rerank 3.5 | $0,002 mỗi lần gọi, tối đa 100 chunk mỗi lần |
| Cohere Embed v4 | $0,12 mỗi 1 triệu token |
| Guardrails: content filter / denied topics | $0,15 mỗi 1 000 text unit, mỗi loại |
| Guardrails: PII | $0,10 mỗi 1 000 text unit |
| Guardrails: contextual grounding | $0,10 mỗi 1 000 text unit |
| Guardrails: word filter | $0 |
| AgentCore Runtime | $0,0895 mỗi vCPU-giờ; $0,00945 mỗi GB-giờ |
| AgentCore Gateway | $0,000005 mỗi lần gọi tool |

Giá riêng cho AgentCore **Harness** và **Policy** không có trong Price List. Mô hình giả định Harness tính theo Runtime; Policy chưa có giá để đưa vào.

### 3a. Kho vector: tám lựa chọn, còn lại ba

AD-17 đổi sang customer-managed KB nên phải tự nuôi kho vector. Tài liệu AWS liệt kê **tám** kho dùng được; sáu cái rụng trước khi bàn tới tiền.

| Kho | Vì sao loại |
| --- | --- |
| OpenSearch Managed Cluster | *"For Network, you must choose **Public access**. OpenSearch domains that are behind a VPC are not supported for your Knowledge Base"* — trái thiết kế chạy trong VPC |
| Pinecone | Bên thứ ba, dữ liệu rời tài khoản AWS. Q1 chưa trả lời thì không mở đường này |
| Redis Enterprise Cloud | Như trên, lại còn đòi endpoint công khai |
| MongoDB Atlas | Như trên. Thêm một bẫy: lọc theo metadata **không chạy mặc định**, phải tự cấu hình trong vector index |
| Neptune Analytics | Dành cho GraphRAG. Sàn nhỏ nhất 16 m-NCU = 0,581 $/giờ ≈ **424 $/tháng** ở Frankfurt, đắt hơn OpenSearch Serverless mà không giải bài toán của mình |
| OpenSearch Serverless *(giữ lại)* | — |

Ba ứng viên thật: **OpenSearch Serverless**, **Aurora PostgreSQL Serverless v2**, **S3 Vectors**.

**Khác nhau ở tính năng, không chỉ ở giá**

| | OpenSearch Serverless | Aurora PG Serverless v2 | S3 Vectors |
| --- | --- | --- | --- |
| Hybrid search (`overrideSearchType: HYBRID`) | **Có** — kho duy nhất | Không | Không |
| Vector nhị phân | Có | Không | Không (chỉ float32) |
| Độ đo khoảng cách | AWS khuyến nghị Euclidean | `vector_cosine_ops` | Cosine **hoặc** Euclidean |
| Số chiều | Theo mô hình embedding | Theo mô hình | 1 – 4096 |
| Trần metadata mỗi vector | Không nêu | Hạn mức của PostgreSQL | **1 KB và 35 khoá** khi dùng với Bedrock KB |
| Lọc theo metadata | Sẵn | Cần cột `custom_metadata` JSONB + chỉ mục GIN | Sẵn, trừ khoá đánh dấu non-filterable |
| Chạy trong VPC | Được (chọn VPC endpoint lúc tạo collection) | Trong VPC của mình | Gọi qua endpoint AWS |
| Khoá KMS | Lúc tạo collection | Của cluster | Lúc tạo bucket, **không đổi được sau đó** |

Dòng đầu là dòng đắt nhất: theo tài liệu API, *"If you're using an Amazon OpenSearch Serverless vector store that contains a filterable text field, you can specify whether to query the knowledge base with a `HYBRID` search … **For other vector store configurations, only `SEMANTIC` search is available**"*. Chọn Aurora hay S3 Vectors là chấp nhận tìm thuần ngữ nghĩa.

Với dự án này, mất hybrid **không chí mạng**: mã điều khoản không tìm bằng vector mà do ClauseResolver tra trên `clause_ref` trong PostgreSQL trước khi gọi `Retrieve` (AD-29). Hybrid chỉ giúp khi người dùng gõ đúng một chuỗi ký tự hiếm mà embedding làm nhoè.

**Khác nhau ở cơ cấu giá**

| Kho | Trả tiền cho cái gì | Khi không ai hỏi | Ước tính tháng |
| --- | --- | --- | --- |
| **OpenSearch Serverless** | OCU-giờ | Đặt được sàn **0 OCU**, khi đó lượt đầu chịu cold start | 494,94 $ với 2 search OCU; 989,88 $ nếu thêm 2 indexing OCU |
| **Aurora PG Serverless v2** | ACU-giờ + dung lượng | Đặt sàn **0 ACU** thì tự ngủ; lúc ngủ không tính tiền compute, **vẫn tính lưu trữ** | ~204 $ nếu giữ 2 ACU chạy cả tháng; gần 0 $ compute nếu để ngủ |
| **S3 Vectors** | Dung lượng, byte nạp, từng request | **Gần bằng 0** — không có sàn theo giờ | Vài đô cho kho nhỏ; tiền đi theo lưu lượng thật |

Cả ba nay đều **co được về 0** khi rảnh, nhưng trả giá khác nhau lúc thức dậy:

- **OpenSearch Serverless** sàn 0 OCU: tài liệu chỉ nói *"avoid cold start delays when scaling from zero"*, không nêu con số. Chưa đo được.
- **Aurora** sàn 0 ACU: ngủ sau ít nhất 5 phút không kết nối (đặt được tới 1 ngày), **thức dậy khoảng 15 giây**; ngủ quá 24 giờ thì 30 giây trở lên. Cần Aurora PostgreSQL ≥ 16.3 / 15.7 / 14.12 / 13.15. Một request qua RDS Data API cũng đủ đánh thức. Mười lăm giây trên đường trả lời người dùng là **không chấp nhận được**, nên hoặc giữ sàn khác 0, hoặc phải có cơ chế hâm nóng.
- **S3 Vectors** không có khái niệm ngủ: không request thì không tính tiền, có request thì tính ngay.

Ba con số ước tính trên không so trực tiếp được: hai kho đầu là **chi phí cố định**, kho thứ ba **biến đổi theo lưu lượng**. Lưu lượng dự án còn chưa đo, nên cơ cấu biến đổi an toàn hơn cho hóa đơn — đổi lại AWS mô tả S3 Vectors *"best suited for infrequent query workloads"*, mà tra tài liệu nằm ngay trên đường trả lời người dùng. Phải đo độ trễ trên lượt thật.

**Hai cái bẫy riêng của S3 Vectors**

Trần **1 KB metadata tuỳ biến và 35 khoá mỗi vector** là trần của Bedrock KB, chặt hơn nhiều so với trần 40 KB / 50 khoá của bản thân S3 Vectors. Mười hai khoá lọc ở [01](01-kien-truc.md) §8.2 vẫn lọt, nhưng không còn nhiều chỗ thừa. Vượt trần thì **ingestion job ném lỗi**, không phải bỏ qua âm thầm.

AWS cảnh báo riêng: hierarchical chunking dễ vượt trần metadata vì quan hệ chunk cha–con được lưu dưới dạng metadata non-filterable. Dự án chọn `NONE` nên không dính, nhưng đừng quay lại hierarchical mà quên điều này.

Chưa chốt kho nào: đó là V-K7.

**Hạ tầng:**

| Khoản | Đơn giá |
| --- | --- |
| Aurora PostgreSQL Serverless v2 | $0,14 mỗi ACU-giờ |
| Aurora lưu trữ | $0,119 mỗi GB-tháng |
| OpenSearch Serverless | $0,339 mỗi OCU-giờ (search và indexing tính riêng) |
| S3 Vectors · lưu trữ | $0,064 mỗi GB-tháng |
| S3 Vectors · nạp | $0,214 mỗi GB ghi vào |
| S3 Vectors · truy vấn | $0,0000027 mỗi request, cộng $0,000004185 mỗi GB quét (bậc 1) và $0,01 mỗi GB trả về |
| Fargate ARM | $0,03725 mỗi vCPU-giờ; $0,00409 mỗi GB-giờ |
| VPC interface endpoint | $0,012 mỗi giờ, cho mỗi AZ |
| KMS | $1 mỗi khóa customer-managed mỗi tháng; $0,03 mỗi 10 000 request |
| CloudWatch Logs | $0,63 mỗi GB ghi vào; $0,0324 mỗi GB-tháng lưu |
| Secrets Manager | $0,40 mỗi secret mỗi tháng |

---

## 4. Chi phí một lượt

| Loại | Guardrail đầu vào | Router | Mô hình | Knowledge Base | Rerank | AgentCore | Guardrail đầu ra | **Tổng** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `doc_qa` | 0,00040 | 0,00689 | 0,02119 | 0,00200 | 0 | 0,00036 | 0,00920 | **0,04003** |
| `app_help` | 0,00040 | 0,00689 | 0,02119 | 0,00200 | 0 | 0,00036 | 0,00920 | **0,04003** |
| `calc` | 0,00040 | 0,00689 | 0,06246 | 0 | 0 | 0,00037 | 0,00120 | **0,07131** |
| `explain_result` | 0,00040 | 0,00689 | 0,06246 | 0 | 0 | 0,00037 | 0,00120 | **0,07131** |
| `mixed` | 0,00040 | 0,00689 | 0,08881 | 0 | 0 | 0,00037 | 0,00120 | **0,09767** |
| `optimize` | 0,00040 | 0,00689 | 0,18834 | 0 | 0 | 0,00039 | 0,00120 | **0,19721** |
| `case_lookup` | 0,00040 | 0,00689 | 0,01283 | 0 | 0 | 0,00036 | 0,00360 | **0,02407** |
| `out_of_scope` | 0,00040 | 0,00689 | 0 | 0 | 0 | 0,00036 | 0 | **0,00764** |
| Bị chặn ở guardrail | 0,00040 | 0 | 0 | 0 | 0 | 0 | 0 | **0,00040** |

USD mỗi lượt. Trung bình theo tỉ trọng ở mục 2: **$0,05255 mỗi lượt**.

**Đọc bảng:**
- Lượt bị chặn ở `ApplyGuardrail` INPUT chỉ tốn tiền guardrail, không gọi mô hình và không dựng phiên Harness. Đây là lý do soát câu hỏi phải chạy **trước** Harness.
- Cột Router nay là phần phân loại chạy trong vòng đầu của Harness (AD-15). Nó tăng từ 0,00344 lên 0,00689 vì cùng khoảng 2 380 token ấy chuyển từ Haiku 4.5 sang Sonnet 5, tức đắt gấp đôi.
- Cột AgentCore nay khác 0 ở cả `doc_qa`, `app_help`, `case_lookup` và `out_of_scope`, vì mọi lượt đều dựng phiên Harness. Khoản này nhỏ; phần đắt là cột Router.
- Tool loop đắt vì mỗi vòng gửi lại cả phần tĩnh và kết quả các vòng trước. `optimize` 7 vòng tốn gấp 4,9 lần một lượt hỏi tài liệu.
- AgentCore gần như không đáng kể trong chi phí biến đổi.

---

## 5. Chi phí theo tháng

**Chi phí cố định** (không phụ thuộc số lượt):

| Khoản | USD/tháng |
| --- | --- |
| Aurora PostgreSQL Serverless v2, tối thiểu 0,5 ACU luôn bật | 51,10 |
| Aurora lưu trữ 20 GB | 2,38 |
| Knowledge Base lưu trữ 1 GB | 5,00 |
| Fargate ARM: `Assistant.Api` 2 task × (1 vCPU, 2 GB) | 66,33 |
| Fargate ARM: tool facade 2 task × (0,5 vCPU, 1 GB) | 33,16 |
| Fargate ARM: `Assistant.Worker` 1 task × (1 vCPU, 2 GB) | 33,16 |
| VPC interface endpoint: 8 endpoint × 2 AZ | 140,16 |
| KMS: 5 khóa customer-managed | 5,00 |
| Secrets Manager: 4 secret | 1,60 |
| CloudWatch Logs: 10 GB ghi vào và lưu | 6,62 |
| CloudWatch: 30 metric, 15 alarm | 10,50 |
| **Tổng** | **355,02** |

Tám endpoint giả định: `bedrock-runtime`, `bedrock-agent-runtime`, `bedrock-agentcore`, `ecr.api`, `ecr.dkr`, `logs`, `secretsmanager`, `kms`. Endpoint `s3` là gateway endpoint, không tính tiền. Danh sách thật chốt ở [15](15-chi-tiet-devops.md).

**Ba kịch bản:**

| Kịch bản | Lượt/tháng | Biến đổi | Cố định | **Tổng/tháng** | USD mỗi kỹ sư | Phần cố định |
| --- | --- | --- | --- | --- | --- | --- |
| Thí điểm | 3 520 | 184,96 | 355,02 | **539,98** | 27,00 | 66% |
| Một công ty | 19 800 | 1 040,42 | 355,02 | **1 395,44** | 23,26 | 25% |
| Mở rộng | 82 500 | 4 335,10 | 355,02 | **4 690,12** | 18,76 | 8% |

**Chưa tính:** chạy golden set và eval trong CI (dùng Opus 5 làm giám khảo; batch rẻ bằng một nửa, nhưng Sonnet 5 có thể không hỗ trợ batch, AD-21), shadow eval (gấp đôi tiền mô hình trên phần chạy shadow, [08](08-eval-quan-sat.md)), ingestion tài liệu lần đầu, môi trường staging, truyền dữ liệu ra Internet, thuế.

---

## 6. Đòn bẩy giảm chi phí

Độ nhạy tính trên kịch bản "Một công ty", đổi một giả định và giữ nguyên phần còn lại:

| Thay đổi | Tổng mới | Chênh |
| --- | --- | --- |
| Harness có prompt caching cho phần tĩnh | 1 141,26 | **−185,04** |
| Quay lại IntentRouter riêng chạy Haiku 4.5 (bản trước AD-15) | 1 326,31 | −69,14 |
| Rerank bằng Cohere thay cho reranker của MKB | 1 348,09 | +21,78 |
| Bật contextual grounding cho mọi câu trả lời | 1 353,12 | +26,81 |

Dòng thứ hai ghi lại cái giá của AD-15. Gộp phân loại vào Harness làm hóa đơn tăng 69,14 $/tháng: bỏ được 64,76 $ tiền Haiku nhưng Sonnet 5 gánh lại phần việc ấy với 129,53 $, cộng 4,38 $ vì mọi lượt nay đều dựng phiên. Khoản tăng được đổi lấy việc bỏ 300–500 ms khỏi thời gian tới chữ đầu tiên và bớt một thành phần phải vận hành. Đây là quyết định đã chốt, không phải đòn bẩy để cân nhắc lại.

**Xếp theo mức tác động:**

| # | Đòn bẩy | Tác động | Cái giá |
| --- | --- | --- | --- |
| 1 | **Cache phần tĩnh trong tool loop.** Kiểm Harness có dùng prompt caching không; nếu không, vòng lặp C# (đường thoát của AD-13) đặt `cachePoint` được | Khoảng −14% tổng hóa đơn ở kịch bản Một công ty | Cần một kiểm chứng mới về Harness |
| 2 | **Soát chunk một lần lúc nạp, không soát lại mỗi lượt.** 12 chunk bọc `guardContent` tốn khoảng $0,008 mỗi lượt hỏi tài liệu, khoảng $87 mỗi tháng ở kịch bản Một công ty, dù nội dung chunk không đổi giữa các lượt. Policy của guardrail áp cho cả lời gọi, không chọn riêng cho từng khối `guardContent`, nên không bật "chỉ content filter cho chunk" trong cùng một lời gọi được. Hướng khả thi: Worker gọi `ApplyGuardrail` trên từng chunk lúc nạp, chunk bị chặn thì không đẩy lên MKB. Skill `amazon-bedrock` cảnh báo: bỏ chunk ra khỏi `guardContent` thì phần lớn filter sẽ không soát nội dung retrieval nữa | Tới −22% chi phí mỗi lượt hỏi tài liệu | Mất lớp soát prompt injection gián tiếp **lúc truy vấn**; chỉ còn lớp lúc nạp. Chỉ làm khi [06](06-bao-mat.md) đồng ý |
| 3 | **Giữ reranker quản lý sẵn của MKB** (V-K6) | Tránh +$22 mỗi tháng | Chỉ dùng được với embedding `MANAGED` (AD-06) |
| 4 | **Giảm số vòng tool loop.** Mỗi vòng thêm gửi lại toàn bộ ngữ cảnh | `optimize` 7 vòng tốn gấp 2,77 lần `calc` 3 vòng | Mô tả tool và tham số tốt hơn, không phải nâng trần |
| 5 | **Giảm số VPC endpoint**, dùng chung endpoint giữa các môi trường cùng VPC | Mỗi endpoint trên 2 AZ tốn khoảng $17,5 mỗi tháng | Phụ thuộc thiết kế mạng |
| 6 | **Aurora tự dừng ở môi trường dev** | Dev gần như chỉ còn tiền lưu trữ | Lần truy vấn đầu sau khi dừng phải chờ khởi động |

**Không bao giờ dùng để giảm chi phí:** profile `global.*` (rẻ hơn 10% nhưng route ra ngoài EU, vi phạm AD-03); tắt Guardrails ở đầu ra; tắt validator.

---

## 7. Theo dõi và phanh chi phí

| Việc | Cách làm | Nguồn |
| --- | --- | --- |
| Tách chi phí Assistant khỏi phần còn lại | Tài khoản AWS riêng cho Assistant (cũng cần cho model invocation logging, [06](06-bao-mat.md)); tag `project=vf-assistant`, `env`, `component` trên mọi tài nguyên; bật tag đó làm cost allocation tag | Skill `aws-billing-and-cost-management` |
| Tách chi phí theo tính năng | Application inference profile riêng cho router, trả lời RAG và tool loop; gắn `requestMetadata` (`feature`, `env`, `path`) vào mỗi lời gọi, không đưa định danh người dùng vào đây | [06](06-bao-mat.md) §8; [11](11-thuyet-minh.md) |
| Cảnh báo ngân sách | AWS Budgets, `BudgetType = COST`, ngưỡng 50%, 80%, 100% loại `ACTUAL` và một ngưỡng `FORECASTED` 100%. API Budgets chỉ chạy ở `us-east-1`. Cảnh báo đánh giá mỗi ngày một lần, nên trễ tới 24 giờ | Skill `aws-billing-and-cost-management`, `references/budgets.md` |
| Phát hiện chi tiêu bất thường | Cost Anomaly Detection, monitor theo service cho Amazon Bedrock | Như trên |
| Chặn trong lượt | Trần mỗi lượt: số vòng, thời gian, `MaxTokens`, số lần `search_documents` ([01](01-kien-truc.md) §8.12) | [01](01-kien-truc.md) |
| Chặn trong ngày | Quota token ngày theo user và org (AD-23); chốt con số sau khi có chi phí mỗi lượt thật | [06](06-bao-mat.md) §2a |
| Đo chi phí thật | Đọc `usage` từ event `done` và từ `metadata` của stream Harness; ghi `cost_usd_est` vào `invocation_record` bằng bảng đơn giá ở mục 3 | [08](08-eval-quan-sat.md) §4 |

Sách *Building Gen AI Applications with Amazon Bedrock* ch06 yêu cầu có sẵn quy trình theo dõi, phân bổ chi phí và ép ngân sách bằng AWS Budgets và Cost Explorer khi ứng dụng lớn dần, và xếp việc mặc định dùng mô hình lớn nhất vào anti-pattern gây tốn kém không cần thiết. Sách *Using Amazon Bedrock* ch05 cảnh báo Provisioned Throughput tính tiền liên tục và có thể tốn "hàng nghìn USD mỗi tháng" nếu quên tắt sau khi thử; dự án không dùng Provisioned Throughput.

---

## Chưa rõ

| Điểm | Ảnh hưởng | Cách trả lời |
| --- | --- | --- |
| Harness có prompt caching không | −14% tổng ở kịch bản Một công ty | Gọi thử, đọc `cacheReadInputTokens` trong `metadata` |
| Giá AgentCore Harness và Policy | Hiện giả định bằng giá Runtime; Policy chưa có giá | Trang giá AgentCore, hoặc hóa đơn đầu tiên |
| **Cách tính phiên AgentCore Runtime** | Tính theo đồng hồ treo tường của phiên hay chỉ lúc chạy thật. [05](05-devops.md) §2A nói Runtime v2 chỉ tính theo mức tiêu thụ thật; nếu tính cả thời gian nằm không tới `idleRuntimeSessionTimeout` 900 giây thì cột AgentCore thấp hơn thực tế khoảng 30 lần. Từ AD-15 mọi lượt đều dựng phiên, nên câu hỏi này nặng hơn trước | Dựng một runtime, gọi một lượt, để nằm không qua 900 giây, đọc Cost Explorer hôm sau |
| Số ký tự thật mỗi token với tiếng Pháp và tiếng Việt kỹ thuật | Guardrails tính theo ký tự, mô hình tính theo token | Đo trên golden set |
| Tỉ trọng loại câu hỏi thật | Đổi tỉ trọng `optimize` từ 3% lên 10% làm chi phí trung bình tăng rõ | Đếm `intent` trong `audit_event` sau vài tuần chạy |
| Kích thước kho Knowledge Base thật (GB) | $5 mỗi GB-tháng | Sau lần ingestion đầu |

---

## Bảng tra nhanh: cái gì không bao giờ được làm

| Không bao giờ | Vì sao |
| --- | --- |
| Tính chi phí bằng tay rồi chép số vào tài liệu | Sai số của phép tính tay không kiểm được; chạy lại `cost_model.py` |
| Dùng profile `global.*` để rẻ hơn 10% | Route ra ngoài EU, vi phạm AD-03 |
| Để trống `MaxTokens` | Bedrock giữ chỗ quota theo trần của mô hình, gây throttling ([05](05-devops.md)) |
| Mua Provisioned Throughput để thử | Tính tiền liên tục kể cả khi không dùng |
| Tăng lưu lượng trước khi có Budgets và Cost Anomaly Detection | Không có phanh chi phí |
| Dựng OpenSearch chỉ để tra case | $495–990 mỗi tháng, trong khi Aurora làm được gần như miễn phí ([12](12-tra-case.md)) |
| Coi con số ở mục 5 là dự toán đã chốt | Đơn giá thật nhưng lưu lượng và kích thước prompt là giả định |

---

## Liên quan

| Cần gì | Đọc |
| --- | --- |
| Trần mỗi lượt, routing mô hình | [01-kien-truc.md](01-kien-truc.md) §8.3, §8.12 |
| Quota ngày, model invocation logging | [06-bao-mat.md](06-bao-mat.md) |
| Đo `cost_per_request` | [08-eval-quan-sat.md](08-eval-quan-sat.md) |
| So sánh OpenSearch và Aurora cho case | [12-tra-case.md](12-tra-case.md) §6 |
| Cài Budgets, tag, endpoint | [15-chi-tiet-devops.md](15-chi-tiet-devops.md) |
