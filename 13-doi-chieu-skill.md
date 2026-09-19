# 13 · Đối chiếu với các skill trong repo

Tài liệu này ghi lại **đã đọc gì, áp dụng gì, sửa gì, và cố ý không áp dụng gì** khi đối chiếu bộ kiến trúc với 13 skill sách trong repo `ai-books-skills`. Mục đích: người đọc biết chính xác mức độ đối chiếu, không phải tin vào một câu chung chung.

## Phạm vi đã đọc

| Đã đọc | Chưa đọc |
| --- | --- |
| `cheatsheet.md` và `patterns.md` của 6 cuốn: Enterprise GenAI, AI Agents on AWS, Vector Databases, Designing AI Interfaces, Interpretable and Trustworthy AI, Engineering GenAI Software. **Chương gốc:** Hands-On RAG for Production (cả 10 chương), Designing AI Interfaces (cả 6), Vector Databases (cả 9), AI Agents on AWS (cả 7): đọc phần khung, phản mẫu, điểm rút ra. **9 cuốn còn lại (mọi chương):** đọc phần **phản mẫu, điểm rút ra, khung và mô hình tư duy**; không đọc ví dụ mã và phần dẫn giải dài | Ví dụ mã và dẫn giải dài của 9 cuốn ở dòng trên; `glossary.md` và `SKILL.md` của cả 13 cuốn |
| Chỉ `cheatsheet.md` của 7 cuốn: Hands-On RAG, AI Agents in Action, AI-Enhanced Web Apps, Building AI-Powered Products, Building Gen AI Applications with Amazon Bedrock, Generative AI Tools, Using Amazon Bedrock | `patterns.md` của 7 cuốn ở dòng trên |

Cheatsheet và patterns là phần đúc kết quyết định và ngưỡng của mỗi cuốn, nên đủ để đối chiếu ở mức quyết định kiến trúc. Chúng **không** thay cho đọc chương gốc; các con số trích từ sách là số của tác giả, theo bối cảnh của họ, không phải hằng số.

---

## Đối chiếu từng skill

| Skill | Áp dụng vào kiến trúc | Đã sửa tài liệu vì skill này | Cố ý không áp dụng |
| --- | --- | --- | --- |
| **Hands-On RAG for Production** | Chất lượng RAG là vấn đề tìm kiếm; ngưỡng recall 60–70%; một agent là mặc định; hybrid + rerank; cổng đánh giá CI; chi phí lệch dự toán 3–5 lần | (đã dùng từ vòng đầu) | Knowledge graph (chưa đạt ≥ 4/6 điều kiện); nền tảng RAG SaaS (kiểm soát dữ liệu quan trọng hơn) |
| **Enterprise Generative & Agentic AI** | Định tuyến LLM có điều kiện; shadow test; canary; zero trust; vòng học chủ động từ phản hồi; NIST AI RMF (Map); ngưỡng đối kháng; danh mục agent | [00](00-tong-quan.md) §6 (AI có phải câu trả lời không, HITL, cho phép/không cho phép); [09](09-eval-quan-sat.md) §7 (shadow test, ngưỡng đối kháng); [11](11-lo-trinh.md) §3 | Federated learning, differential privacy (không có bài toán huấn luyện); reflection agent (thay bằng validator tất định) |
| **AI Agents on AWS** | Khung RAG hay agent; thang trưởng thành; Guardrails và chính sách tất định cần cả hai; chọn nơi chạy (Lambda/ECS/AgentCore); 4 lớp quan sát; đánh giá theo phiên/lượt/bước; thiết kế tool một việc; CoALA | [04](04-tool-calling.md) §7; [07](07-auth-bao-mat.md) §8; [09](09-eval-quan-sat.md) §7; [10](10-trien-khai.md) §7; [05](05-case-memory.md) §8 | Multi-agent (Supervisor/Swarm/Graph), A2A, AgentCore Memory/Gateway/Runtime: để pha 2 |
| **Vector Databases: A Practical Intro** | Postgres + pgvector là mặc định quy mô nhỏ/vừa; HNSW `m=16`, `ef_construction=64`; ngưỡng 0,7; cột `embedding_model`; overfetch-then-filter; cửa sổ ngữ cảnh đối xứng; mô hình ba bảng | [03](03-rag.md): overfetch/`iterative_scan` khi lọc, mở rộng chunk lân cận, ngưỡng theo mô hình, cách ly tenant, tách bảng vector; rủi ro R22 | Cộng có trọng số 0,7/0,3 (chọn RRF, ghi lý do); trung vị hình học, FAISS |
| **Designing AI Interfaces** | Không hiện phần trăm tin cậy, kiểm chứng được thay thế; ngưỡng 1 giây và 10 giây; lộ ngữ cảnh ngầm; tiến trình ba tầng; quyền theo mức rủi ro | [08](08-ux.md) §10 (công khai AI, không giả tiến trình, lộ kế hoạch, thử lại vs báo sai) | Canvas cộng tác (không phải công việc lặp nhiều phiên trong panel); checkpoint/rollback (không có artifact tiến hóa) |
| **Engineering Generative AI-Based Software** | Kiểm thử hai đường (oracle + benchmark); kiểm thử biến thể (metamorphic); API có version, xác thực, TLS; bộ ba chịu lỗi (điều kiện, ngưỡng, phản ứng); phần mềm cổ điển cầm lái khi quy trình đếm được; giới hạn vòng | [02](02-assistant-service.md) (capabilities, health, họ mã trạng thái); [06](06-tang-bedrock.md) §3 (ngưỡng số); [04](04-tool-calling.md) §7 | ONNX, lượng tử hóa, mô hình chạy cục bộ (mô hình chạy trên Bedrock) |
| **AI Agents in Action** | Chỉ giao tool cần dùng; trả dữ liệu có cấu trúc đầy đủ; giám khảo khác/mạnh hơn cho điểm tuyệt đối; ghi chú chi phí quản lý phân cấp | [04](04-tool-calling.md) §7 (output JSON đầy đủ, không tóm tắt); [09](09-eval-quan-sat.md) §7 (chọn giám khảo) | AutoGen, CrewAI, Semantic Kernel, behavior tree, Prompt Flow (cùng lý do không multi-agent) |
| **AI-Enhanced Web Apps** | Thử lại lỗi tạm thời, fallback lỗi kéo dài; hạn mức kiểm sau rate limit; tenant dùng chung có lọc nghiêm ngặt; cái gì mock, cái gì không; đầu ra có cấu trúc | [06](06-tang-bedrock.md) §2 (bảng kỹ thuật đầu ra có cấu trúc khi Sonnet 5 không hỗ trợ structured outputs); [03](03-rag.md) (tenant) | Vercel AI SDK, LangChain, server actions (backend là .NET); Redis cho quota (dùng PostgreSQL) |
| **Building AI-Powered Products** | Kiểm tra "AI có phải câu trả lời"; ba cột (khả thi, giá trị, người dùng muốn); MVQ đặt trước; chỉ số chặn; tự chủ tăng dần; rà soát pháp lý khi dữ liệu đi qua bên thứ ba | [00](00-tong-quan.md) §6; [11](11-lo-trinh.md) §8 (OKR); [12](12-rui-ro.md) Q3 | Phân loại sustaining/disruptive, ma trận build-vs-buy đầy đủ (không trong phạm vi kiến trúc kỹ thuật) |
| **Building Gen AI Applications with Amazon Bedrock** | Chọn nơi chạy Lambda/ECS; retry có jitter, circuit breaker, fallback; IAM hẹp ở production; version prompt MAJOR/MINOR/PATCH; log đủ để dựng lại; mô hình rẻ cho định tuyến | [06](06-tang-bedrock.md) (Nova làm ứng viên định tuyến, sơ đồ circuit breaker, temperature); [10](10-trien-khai.md) §7 (version prompt, bản ghi kiểm toán) | Fine-tuning, alignment (RLHF/DPO/KTO), Provisioned Throughput (không fine-tune) |
| **Using Amazon Bedrock** | Đường thang chi phí; mức lọc guardrail theo mức rủi ro; thông điệp chặn chung chung; GDPR (tối thiểu hóa, quyền xóa); thứ tự giảm chi phí; batch inference | [06](06-tang-bedrock.md) (§4 cấu hình guardrail, §9 thứ tự giảm chi phí); mục xác minh #7 về biểu mẫu Anthropic và Marketplace | Chọn kho vector ngoài AWS (Pinecone, Milvus...), quy mô bộ nhớ SageMaker |
| **Interpretable and Trustworthy AI** | Mức giám sát HITL theo rủi ro; pipeline giải thích chạy song song dự đoán từ đầu; kiểm toán theo rủi ro | [00](00-tong-quan.md) §6.2 (ba mức HITL áp cho từng luồng) | SHAP/LIME, GAN, giảm thiên lệch, HE/SMPC (không có mô hình dự đoán tự huấn luyện) |
| **Generative AI Tools: From Algorithms to Applications** | Không dùng LLM cho bài toán số liệu có cấu trúc (ví dụ 99,5% so 47–53%); báo cáo độ chính xác theo nhóm, không chỉ tổng | [00](00-tong-quan.md) §6.1 | Phần lớn nội dung (GAN/VAE, IoT, phân đoạn ảnh) không liên quan tới bài toán |

---

## Những thay đổi thực chất do đối chiếu

Ngoài phần bổ sung, đối chiếu chỉ ra **hai lỗi thiết kế** (mục 1 và 2) và **một điểm chặn tiềm ẩn** (mục 3), đã sửa:

1. **Lọc `scope_key` kết hợp HNSW có thể bỏ sót kết quả trong im lặng** (rủi ro R22). Bản thảo đầu chỉ ghi `ef_search`; thiếu biện pháp cho trường hợp tài liệu của một organization là phần nhỏ của kho. Đã thêm `iterative_scan`/overfetch, nhóm eval G và đo recall theo scope.
2. **Tool trả bản tóm tắt cho model** trái nguyên tắc "trả dữ liệu đầy đủ, không lọc trước" và làm `NumberValidator` thiếu số để đối chiếu. Đã đổi sang trả toàn bộ output JSON.
3. **Biểu mẫu use-case Anthropic và đăng ký Marketplace** là điểm chặn có thể xảy ra ngay ngày đầu, chưa có trong bản thảo (rủi ro R21, mục xác minh #7).

## Skill ngoài repo đã dùng

`amazon-bedrock` (đọc các tệp tham chiếu Knowledge Base, guardrails, prompt caching, quota, IAM), `aws-iam` và `aws-observability` (chỉ đọc phần mô tả và bảng định tuyến, chưa đọc tệp tham chiếu chi tiết bên trong), `superpowers:brainstorming`, `vietnamese-tech-writing` (validator, 0 lỗi), `artifact-design`.

---

## Đối chiếu lại với tài liệu AWS hiện hành (19/09/2026)

Lượt thứ hai tra lại toàn bộ thông số AWS của bộ tài liệu với trang hướng dẫn, trang API và model card hiện hành, cộng lệnh `aws bedrock` thực tế. Các chỗ đã **sửa hoặc thay đổi thiết kế**:

| # | Nội dung ở bản 18/09 | Tài liệu AWS hiện hành nói gì | Thay đổi |
| --- | --- | --- | --- |
| 1 | Frankfurt là region EU duy nhất có cả rerank lẫn AgentCore | Trang AgentCore Regions liệt kê cả Paris có Harness, Runtime, Memory, Gateway, Policy. Rerank vẫn chỉ ở Frankfurt trong EU | Sửa lý do chọn Frankfurt: chỉ còn rerank; AgentCore không phải yếu tố ([00](00-tong-quan.md) AD-03, [06](06-tang-bedrock.md) §1) |
| 2 | Contextual grounding chạy trên stream ở ngưỡng 0.7 | **Không hỗ trợ chatbot hội thoại**; giới hạn 100 000/1 000/5 000 ký tự; chỉ kiểm đầu ra; stream có thể chỉ đánh dấu sau khi đã stream xong | Hạ xuống lớp hậu kiểm bằng `ApplyGuardrail` cho câu trả lời cuối, chỉ gắn cờ `unverified`; hàng rào chính là validator tất định ([06](06-tang-bedrock.md) §4) |
| 3 | Chunk qua `search_documents` trong vòng lặp tool được guardrail bảo vệ | `guardrailConfig` **không đánh giá** `toolResult`, `toolSpec`, `toolUse.input` | Thêm `ApplyGuardrail` riêng trên chunk trước khi vào `toolResult`; rủi ro R24 ([04](04-tool-calling.md) §7, [07](07-auth-bao-mat.md) §4) |
| 4 | Sonnet 5 dùng explicit caching | Hỗ trợ cả implicit và explicit; Anthropic có chế độ đơn giản hóa một breakpoint; thứ tự `tools` → `system` → `messages`; **chuyển `adaptive` ↔ `disabled` làm mất cache ở `messages`** | Viết lại §5; cố định chế độ thinking cho mỗi đường ([06](06-tang-bedrock.md) §5) |
| 5 | Chưa rõ cách truyền thinking/effort qua Converse | `additionalModelRequestFields` với `thinking` và `output_config.effort` riêng (đặt effort trong `thinking` gây lỗi); `budget_tokens` không hỗ trợ trên Sonnet 5; `max_tokens` gồm cả thinking | Ghi cú pháp chính xác; nâng `maxTokens` vòng lặp tool lên ~4 000 ([06](06-tang-bedrock.md) §1–2) |
| 6 | Router dùng Haiku 4.5 với ngưỡng cache 4 096 chưa xác minh; Sonnet 5 không structured outputs | Haiku 4.5 **hỗ trợ structured outputs và count tokens**; ngưỡng cache 4 096 đúng; vòng đời "EOL không sớm hơn 16/10/2026" | Nhãn định tuyến dùng structured outputs của Haiku; thêm rủi ro R23 |
| 7 | Chiều vector của Cohere Embed v4 "xác minh ở M0" | 256/512/1024/1536, mặc định 1536; `texts` ≤ 96 mỗi lượt; nhận ảnh trang PDF qua `inputs` | Điền số đã xác minh; thêm phương án B cho trang bảng ([03](03-rag.md)) |
| 8 | IAM Rerank gộp chung statement | Cần `bedrock:Rerank` với Resource `*` **và** `bedrock:InvokeModel` theo ARN mô hình; `sources` ≤ 1 000, `queries` đúng 1 | Tách statement ([06](06-tang-bedrock.md) §7) |
| 9 | Dùng batch inference cho eval và vision | **Sonnet 5 và Cohere Embed v4 không có trong danh sách batch**; caching không hỗ trợ trong batch | Giới hạn batch ở giám khảo Opus 5 và vision bằng Haiku 4.5/Sonnet 4.6 ([06](06-tang-bedrock.md) §9, [09](09-eval-quan-sat.md) §7) |
| 10 | Retry "adaptive" của AWS SDK | .NET SDK v4: `Adaptive` là **experimental**, mặc định `Legacy`; `Timeout` không tác dụng với lệnh async | `RetryMode.Standard`, `MaxErrorRetry = 2`, Polly chỉ làm breaker/fallback, timeout bằng `CancellationToken` ([06](06-tang-bedrock.md) §3) |
| 11 | Biểu mẫu Anthropic và Marketplace | Bật mặc định, tự subscribe lần gọi đầu (~15 phút), FTU một lần, kế thừa từ tài khoản quản lý, không áp cho `bedrock-mantle`; kiểm tra bằng `get-foundation-model-availability` | Viết lại mục xác minh 7 và ghi chú IAM |
| 12 | Log gọi mô hình chỉ metadata ở production | Cấu hình **theo tài khoản và Region**, chỉ áp `bedrock-runtime`, thân tới 100 KB | Khuyến nghị tài khoản riêng; thêm `requestMetadata` ([06](06-tang-bedrock.md) §8) |
| 13 | `iterative_scan` "xác minh phiên bản ở M0" | pgvector 0.8.x trên RDS: PostgreSQL 15.18+, 16.6+, 17.3+; PostgreSQL 14 chỉ 0.7.4 | Ghi phiên bản ([03](03-rag.md)); mục M0 số 8 |
| 14 | Roles Anywhere ≤ 1 giờ | Tài nguyên theo Region, trust boundary ở mức tài khoản | Bỏ con số 1 giờ; thêm ràng buộc trust policy ([10](10-trien-khai.md) §3) |
| 15 | Guardrail chỉ ở một Region | Có tùy chọn cross-Region guardrail (prompt và kết quả có thể ra ngoài Region chính trong geography) | Thêm vào quyết định residency và IAM ([06](06-tang-bedrock.md) §4, §7) |

**Chưa đối chiếu được từ tài liệu (vẫn là giả định hoặc cần gọi thật):** Managed Knowledge Base ở `eu-central-1`; khả dụng pgvector trên Aurora; Application Signals cho .NET trên nền tảng cụ thể; giá trị quota mặc định; độ trễ thật của từng bước; hành vi guardrail `sync` trên luồng dài; `textDataDeliveryEnabled` và còn lại của log khi tắt Text. Các mục này đã nằm trong danh sách xác minh M0.


## Thay đổi từ việc đọc chương gốc của Hands-On RAG (ch03, ch04, ch06)

| Chương | Điểm rút ra | Nơi đã áp dụng |
| --- | --- | --- |
| Ch3 | Phòng thủ chỉ dẫn bằng thẻ XML tách system/context/query; injection gián tiếp qua **văn bản ẩn** trong PDF (chữ trắng trên nền trắng); ingestion phải idempotent, xử lý từng trang, không cắt giữa bảng | [07](07-auth-bao-mat.md) §4; [03](03-rag.md) |
| Ch4 | Denial-of-wallet và Budgets 50/80/100%; semantic cache cần hủy theo sự kiện (và ở đây phải khóa theo scope); ngưỡng production tham chiếu | [06](06-tang-bedrock.md) §9; [11](11-lo-trinh.md) §7 |
| Ch6 | Đánh giá trực tuyến lấy mẫu 5–10%; UMBRELA; độ chính xác trích dẫn (hỗ trợ đúng câu khẳng định, không chỉ tồn tại); tính nhất quán; kiểm tra tài liệu hết hiệu lực; kiểm chứng chỉ số tự động bằng phản hồi người dùng | [09](09-eval-quan-sat.md) §8 |

Phát hiện đáng chú ý nhất: **`CitationValidator` của bản đầu chỉ kiểm trích dẫn có tồn tại**, không kiểm trích dẫn có hỗ trợ câu khẳng định. Đã thêm kiểm tra tất định về số/thuật ngữ và giám khảo Tầng 2.

## Thay đổi từ việc đọc chương gốc của bốn cuốn còn lại

Chỉ đọc các phần **khung, phản mẫu và điểm rút ra** của mỗi chương (không đọc ví dụ mã và phần dẫn giải dài).

| Cuốn | Điểm rút ra | Nơi đã áp dụng |
| --- | --- | --- |
| Hands-On RAG ch2, 5, 7–10 | Viết lại câu hỏi tách lệnh khỏi nội dung tra; `truncate` không cắt âm thầm; ghép bảng nhiều trang; chunk con trỏ cho bảng; bounding box là trường hạng nhất để trích dẫn; phân loại thất bại agent; bộ nhớ dài hạn là gánh nặng quản trị | [02](02-assistant-service.md), [03](03-rag.md), [04](04-tool-calling.md), [05](05-case-memory.md) §9 |
| Designing AI Interfaces ch1–6 | Định tuyến ngầm làm mất niềm tin (hiện mô hình, huy hiệu fallback); hạn mức hiển thị trước; gợi ý cụ thể; sycophancy; nói "không có trong tài liệu"; kỳ vọng sai của người dùng; đầu ra điều chỉnh được | [08](08-ux.md) §11, [09](09-eval-quan-sat.md) |
| Vector Databases ch1–9 | Chunk cấp tài liệu tìm song song; `is_target`; parser sau interface; singleton client; tách vai trò cơ sở dữ liệu; suy giảm khi thiếu FTS | [03](03-rag.md), [10](10-trien-khai.md) §8 |
| AI Agents on AWS ch1–7 | Chuyển tiếp token đầu vào là điểm kiểm toán hay bắt lỗi; quản trị ba lớp; client dùng lại; tác vụ định kỳ; DLQ; bốn kiểm tra khi đánh giá agent | [07](07-auth-bao-mat.md) §1, §9; [09](09-eval-quan-sat.md); [10](10-trien-khai.md) §8; R25 |

**Chín cuốn này** chủ yếu bổ sung kiến thức nền hoặc nội dung AWS mà tài liệu AWS hiện hành đã có thẩm quyền cao hơn. Phần khung được đọc ở lượt sau (mục kế tiếp).

## Thay đổi từ việc đọc phản mẫu và điểm rút ra của 9 cuốn còn lại

| Cuốn | Điểm rút ra | Nơi đã áp dụng |
| --- | --- | --- |
| Enterprise GenAI | Chuỗi mục tiêu kinh doanh → kỹ thuật → KPI; MoSCoW, RACI, RTM; lớp nguồn bất biến; bốn trụ cột đánh giá; ngưỡng phi chức năng kèm hành động; nhịp active learning; rủi ro dây chuyền; bảo trì mô hình là yêu cầu | [00](00-tong-quan.md), [03](03-rag.md), [09](09-eval-quan-sat.md) §9, [11](11-lo-trinh.md) §9, [12](12-rui-ro.md) |
| Engineering GenAI Software | Tiêu chí chấp nhận kiểm tra được; bảo trì mô hình; bộ ba chịu lỗi (đã có); EU AI Act và trách nhiệm về IP/đầu ra AI | [00](00-tong-quan.md), [07](07-auth-bao-mat.md) §9 |
| Using Amazon Bedrock | STRIDE trong thiết kế; Shared Responsibility; thông điệp chặn chung chung; chỉ người được phép ghi vào kho vector; RACCCA | [07](07-auth-bao-mat.md) §9–10, [09](09-eval-quan-sat.md) §9 |
| Building Gen AI Applications with Amazon Bedrock | Ghi log đủ để dựng lại (đã có); persona nhất quán; `AmazonBedrockFullAccess` chỉ khi học | [08](08-ux.md) §12, [06](06-tang-bedrock.md) §7 |
| AI-Enhanced Web Apps | Tự cuộn có điều kiện; lỗi kèm mã yêu cầu; che PII ở biên; hạn mức theo organization chống tài khoản dùng một lần; quét tệp tải lên; cờ tính năng bằng cấu hình có giới hạn; MCP bên thứ ba | [02](02-assistant-service.md), [03](03-rag.md), [07](07-auth-bao-mat.md), [08](08-ux.md) §12, [10](10-trien-khai.md) |
| AI Agents in Action | Chỉ giao tool cần dùng (đã có); persona; nhất quán không phải đúng; trích xuất ngữ nghĩa cho bộ nhớ là đánh đổi | [05](05-case-memory.md), [09](09-eval-quan-sat.md) §9 |
| Building AI-Powered Products | Chọn precision/recall theo chi phí lỗi; human intervention rate; engage GRC liên tục; RACI | [09](09-eval-quan-sat.md), [11](11-lo-trinh.md) §9 |
| Interpretable and Trustworthy AI | HITL theo mức rủi ro (đã có); kiểm toán liên tục và có các bên liên quan; ghi đè của người dùng vào audit; nguồn gốc dữ liệu; anonymization không chống nhận diện lại | [07](07-auth-bao-mat.md) §6, §9; [09](09-eval-quan-sat.md) |
| Generative AI Tools | Không dùng LLM cho bài toán số liệu có cấu trúc (đã có); báo cáo theo nhóm (đã có); bảy chiều triển khai; cơ chế đạo đức cụ thể | [10](10-trien-khai.md), [08](08-ux.md) §12 |

**Lỗi thời của sách so với tài liệu AWS:** sách Building Gen AI Applications with Amazon Bedrock và Using Amazon Bedrock (và một phần AI Agents on AWS) mô tả bước "yêu cầu truy cập từng mô hình trong console" như điều bắt buộc; tài liệu AWS hiện hành ghi truy cập bật mặc định kèm quyền Marketplace, riêng Anthropic vẫn cần biểu mẫu First Time Use. Trường hợp này và các thông số chọn mô hình, ngưỡng cache, IAM đều theo **tài liệu AWS hiện hành**, không theo sách.

Sau lượt này, mọi cuốn trong 13 cuốn đã được đọc ở **mức chương**, nhưng ở mức chi tiết khác nhau (bảng ở đầu tài liệu). Ở lượt sau, phần khung và mô hình tư duy của 9 cuốn cuối cũng đã đọc; ví dụ mã vẫn chưa đọc.

## Thay đổi từ phần khung và mô hình tư duy của 9 cuốn còn lại

Đọc toàn bộ phần **Frameworks Introduced** và **Mental Models** của mọi chương trong 9 cuốn. Trước khi thêm gì, tôi kiểm tra bộ tài liệu đã có điểm đó chưa: phần lớn đã có (định tuyến có điều kiện, shadow test, circuit breaker, chuyển tiếp token, MCP bên thứ ba, chọn precision hay recall, STRIDE, tool độc lập chạy song song, phân loại lỗi Bedrock, R10). Còn lại là các bổ sung nhỏ dưới đây.

| Điểm | Nguồn | Nơi đã áp dụng |
| --- | --- | --- |
| Semantic Kernel / `IChatClient` làm lớp điều phối trên .NET: ghi vào bảng cắt phạm vi kèm điều kiện xem lại (gói `AWSSDK.Extensions.Bedrock.MEAI` đã xác minh tồn tại, chưa thử) | AI Agents in Action ch5 | [00](00-tong-quan.md) §2 |
| Chặn lời gọi lặp cùng tool cùng tham số; chỉ số `tool_repeat_rate` | AI Agents in Action ch4 | [04](04-tool-calling.md) §6, [09](09-eval-quan-sat.md) §9 |
| Đối chiếu mô hình năm thành phần; suy luận và lập kế hoạch tối thiểu có chủ ý | AI Agents in Action ch1, ch11 | [04](04-tool-calling.md) §6 |
| Lời diễn giải không thay bước tính; ba độ sâu giải thích | Interpretable AI ch14, ch18 | [04](04-tool-calling.md) §7 |
| Phát hiện duyệt qua loa; đọc tỉ lệ ghi đè cùng tỉ lệ duyệt | Building AI-Powered Products ch8, Interpretable AI ch12 | [08](08-ux.md) §13, R10 |
| Bản ghi lần gọi mô hình không chứa nội dung (dựng lại bằng mã) | Building Gen AI Applications with Amazon Bedrock ch7 | [09](09-eval-quan-sat.md) §6 |
| Mỗi thành phần truy xuất phải thắng phương án đơn giản hơn | Interpretable AI ch18, Enterprise GenAI ch8 | [09](09-eval-quan-sat.md) §9 |
| Định vị lỗi theo Plan / Action / Observation | Building Gen AI Applications with Amazon Bedrock ch8 | [09](09-eval-quan-sat.md) §9 |
| Giới hạn tải lên và phân tích tệp | AI-Enhanced Web Apps ch11 | [03](03-rag.md) §1 |
| Kiểm quyền ở mức tài nguyên, mã UUID, test IDOR | AI-Enhanced Web Apps ch11 | [07](07-auth-bao-mat.md) §7 |
| Đối chiếu NIST AI RMF; phân loại rủi ro ba trục | Enterprise GenAI ch7 | [07](07-auth-bao-mat.md) §11, [12](12-rui-ro.md) §5 |

### Cố ý không áp dụng

| Nội dung | Vì sao |
| --- | --- |
| Vercel AI SDK, LangChain, Redis làm kho phiên, Streamlit, Flask, Upstash | Sai stack (đội dùng C#/.NET, PostgreSQL); các nguyên lý đã lấy, mã thì không |
| AutoGen, CrewAI, Nexus, cây hành vi, Prompt Flow (Azure) | Multi-agent nằm ngoài phạm vi 8 tuần ([00](00-tong-quan.md) §2) |
| Tree of Thought, self-consistency lúc sinh câu trả lời | Nhân số lần gọi (sách ghi tới 27 lần mỗi bài toán); độ trễ và chi phí không hợp một trợ lý hỏi đáp. Chỉ dùng ý tưởng nhất quán ở eval |
| Fine-tuning, PEFT, provisioned throughput, tinh chỉnh RL, nén/cắt tỉa mô hình | Không fine-tune ([00](00-tong-quan.md) §2); bậc thang chi phí giữ ở prompt và RAG |
| Federated learning, differential privacy, mã hóa đồng cấu, SMPC | Không huấn luyện mô hình; bài toán quyền riêng tư giải bằng cách ly scope, che PII và retention |
| Text-to-SQL, Athena, Glue, Zero-ETL, Step Functions | Assistant không truy vấn trực tiếp CSDL nghiệp vụ; mọi truy cập qua Main API |
| GAN, VAE, IDS cho IoT, phân đoạn ảnh y tế, dự báo sạc EV, marketing | Ngoài miền bài toán (chương chủ yếu của Generative AI Tools và Interpretable AI) |
| SHAP, LIME, Grad-CAM | Áp cho mô hình học máy có đặc trưng; ở đây engine tất định và LLM không có đặc trưng để gán trọng số theo nghĩa đó |
| Chấm điểm rủi ro có trọng số | Giải thích ở [12](12-rui-ro.md) §5 |

Còn thiếu ở phần này: chưa đọc ví dụ mã của 9 cuốn; chưa đọc `glossary.md` và `SKILL.md` của cả 13 cuốn. Các mục "chưa xác minh" ở [12](12-rui-ro.md) §4 (trong đó dịch vụ quét malware cho S3 và Security Scoping Matrix) vẫn giữ nguyên.

## Thay vòng lặp tool tự viết bằng AgentCore Harness (AD-13)

Yêu cầu của người dùng: thay vòng lặp agent tự viết bằng AgentCore. Đây **không** đến từ skill sách nào; nguồn là tài liệu AWS AgentCore tra ngày 19/09/2026 (Overview, Regions, Harness, Tools, Models, Memory, Security, Operations, Harness so với Runtime, API InvokeHarness, Gateway outbound authorization, Policy). Bảng cắt phạm vi ở [00](00-tong-quan.md) có dòng AgentCore viết trước khi Harness tồn tại và đã được viết lại.

| Điểm | Kết luận |
| --- | --- |
| Có thay được vòng lặp không | Có: Harness là vòng lặp quản lý sẵn, GA, có ở `eu-central-1` |
| Hook | Không hỗ trợ; ToolGate phải chuyển ra facade C# sau Gateway ([04](04-tool-calling.md) §8) |
| Mặc định nguy hiểm | Model `global.*`, `shell` và `file_operations` bật, Managed Memory bật, giới hạn 75 vòng và 3 600 giây: đều phải đặt lại ([07](07-auth-bao-mat.md) §12) |
| Nâng cấp R25 | Gateway hỗ trợ token exchange cho target OpenAPI; cần JWT vào Harness và Keycloak bật token exchange |
| Cái giá | microVM theo phiên, lớp dịch stream, kênh phụ `tool_result`, có thể phải tự viết bộ đọc event stream bằng `HttpClient` (R27 đến R33) |
| Đường thoát | Export sang mã của Harness ra **Python (Strands)**, không phải C#; đường thoát thực tế, cũng là đường chính của POC, là vòng lặp C# ở [04](04-tool-calling.md) §6 |

**Quyết định ban đầu (lịch sử, đã thay ở Vòng 2):** AD-13 chỉ giữ nếu V-A1, V-A3, V-A4, V-A6 đạt cuối tuần 1 ([06](06-tang-bedrock.md) §1a). Người dùng không trả lời câu hỏi chọn giữa Harness với Gateway, Harness với tool inline, và giữ vòng lặp C#; tôi chọn phương án đã khuyến nghị (Harness với Gateway và facade) vì khớp yêu cầu thay vòng lặp, và ghi rõ điều kiện để quay lại.

**Đã cập nhật ở Vòng 2:** POC dùng vòng lặp C#; V-A1, V-A3, V-A4, V-A6 chạy sau G1, không thuộc M0; phương án "Harness với Gateway và facade" không còn là lựa chọn của POC ([00](00-tong-quan.md) AD-13, [06](06-tang-bedrock.md) §1a).

**Chưa xác minh** (V-A1 đến V-A9, chạy sau G1, không thuộc M0): gọi `InvokeHarness` bằng Bearer JWT từ .NET; stream có phát sự kiện tool phía server không; độ trễ phiên lạnh; hợp đồng lịch sử khi tắt Memory; token exchange từ Keycloak và khả năng Gateway tới facade; điều kiện số học của Cedar; tắt thinking qua `additionalParams`; claim Guardrails không đánh giá `toolResult`; đơn giá `eu-central-1`.

## Đối chiếu với tài liệu yêu cầu của cuộc họp triển khai

Nguồn: ảnh do người dùng cung cấp, `/home/vdloc/Downloads/f0d256ae7cf7fca9a5e6.jpg`. Kết quả đối chiếu và các khoảng trống đã bổ sung nằm ở [00](00-tong-quan.md) §8. Kết luận trung thực: kiến trúc **chưa** đáp ứng đủ ngay từ đầu (thiếu hướng dẫn dùng VF, gợi ý phương án có kiểm chứng, tra kết quả theo dự án và cấu kiện, lịch 4 tuần, chi phí mỗi yêu cầu); sau bổ sung thì đáp ứng bốn yêu cầu chức năng ở các mức ghi trong bảng, với các điều kiện chưa xác nhận: Q5, endpoint kết quả của Main API, đơn giá của các mô hình Claude ở EU, và người ký manifest cho yêu cầu 4.

## Phản biện của subagent Opus về các quyết định kiến trúc

Nguồn: một subagent chạy mô hình Opus được giao phản biện AD-01 đến AD-13 (chỉ đọc). Kết quả đã được kiểm lại trước khi áp dụng; không phải mọi điểm đều đúng.

**Chấp nhận và đã áp dụng:** Q1 phải trả lời trước ngày bắt đầu và có phương án dự phòng single-region ([06](06-tang-bedrock.md) §11); khung thời gian 2 ngày cho kiểm chứng AgentCore, quay về vòng lặp C# nếu không đạt (AD-13) (**đã thay ở Vòng 2**: kiểm chứng AgentCore chạy sau G1); bỏ yêu cầu 3 và 4 nếu hết ngày 3 chưa có endpoint của Main API; role tách riêng thành điều kiện của AD-10; kết luận nộp qua công cụ có cấu trúc thay vì chỉ lọc cụm từ ([04](04-tool-calling.md) §10); Q3 dời lên trước khi dùng dữ liệu thật; thêm Q7 (lưu vết tranh chấp) và R38 (chủ sở hữu manifest); đơn giá và đo chi phí trước khi hứa tiêu chí chi phí; mức hứa với khách hàng theo từng yêu cầu ([11](11-lo-trinh.md) §10).

**Chấp nhận một phần:** chốt embedding sớm. Không thể dời phép so sánh embedding lên tuần 1 vì golden set 50 câu chỉ xong ngày 02/10; thay bằng mini-set 20 câu neo trước 28/09 và nạp thử trên tài liệu vứt được.

**Không chấp nhận:** (1) "AD-02 gộp ba endpoint vào một interface": bộ tài liệu đã tách `BedrockLlmClient`, `BedrockEmbeddingClient`, `BedrockReranker` ([01](01-kien-truc-tong-the.md)); chỉ sửa lại câu chữ của AD-02. (2) "AD-05 chọn mô hình định tuyến theo thói quen": bộ tài liệu đã yêu cầu so sánh Nova, Haiku 4.5 và Sonnet 4.6 ở M1 (R23). (3) "Haiku EOL trùng ngày nghiệm thu POC": kết luận đúng một phần. Cả hai mốc 1/10/2026 và 16/10/2026 đều là "không sớm hơn" kèm legacy ít nhất 6 tháng, nên không chặn POC; nhưng mâu thuẫn hai mốc trong [06](06-tang-bedrock.md) §1 trước đây không có hành động, nay đã thêm kiểm tra ở ngày 1. (4) "L quá tải": **phản bác này sai** (vòng 2). Việc AgentCore nằm gần hết ở L, còn phần của B2 không chạm kiểm chứng nào; đã xử lý bằng cách đưa kiểm chứng AgentCore ra khỏi tuần 1.

**Chưa quyết, thuộc về người dùng:** đưa AD-13 ra khỏi POC hoàn toàn (subagent đề nghị) hay giữ trong khung 2 ngày (bản của Vòng 1; **đã thay ở Vòng 2**: POC dùng vòng lặp C#, Harness đánh giá lại sau G1, xem [00](00-tong-quan.md) AD-13). Người dùng đã yêu cầu thay vòng lặp bằng AgentCore, nên tôi giữ có điều kiện thay vì tự bỏ.

### Vòng 2 (reviewer Opus độc lập)

**Chấp nhận:** (1) hai reviewer độc lập cùng kết luận Harness quá đắt cho POC, nên AD-13 đổi thành: POC dùng vòng lặp C#, Harness đánh giá lại sau G1 ([00](00-tong-quan.md) AD-13); hai ngày đầu dành cho V-K1 và đo chi phí mẫu; (2) POC 4 tuần là **bản nén** chứ không phải lát cắt, vì M4 đến M6 của Gantt kết thúc sau ngày nghiệm thu; (3) Gantt sửa để Q1 có trước ngày bắt đầu; (4) mô hình trả lời cho `doc_qa` cũng phải qua đo (đòn bẩy chi phí lớn nhất); (5) hạn mức chi phí ước tính mỗi ngày thay vì chỉ token ([07](07-auth-bao-mat.md) §5); (6) nhãn "Đạt các kiểm tra của engine" kèm điều không kiểm, và manifest phải có người ký ([04](04-tool-calling.md) §10); (7) trần 7 vòng và 90 giây cho lượt `optimize` vì thêm `submit_recommendation`; (8) 20 câu đầu là một phần của golden set 50 câu, không phải bộ thêm; (9) hiệu chỉnh giám khảo cùng họ ([09](09-eval-quan-sat.md) §9); (10) phần vận hành trước beta ([10](10-trien-khai.md) §10).

**Kiểm chứng AWS của reviewer:** Harness không hỗ trợ hook: xác nhận. Token exchange có, token passthrough không có ở target OpenAPI: xác nhận, thêm hai chi tiết (đã ghi ở [04](04-tool-calling.md) §8). Sonnet 5 buộc profile geo hoặc global: reviewer không đọc được, nhưng model card Sonnet 5 đã được đọc thành công trong phiên này và ghi đúng như vậy; vẫn kiểm bằng lệnh gọi thật ở ngày 1.

### Vòng 3 (rà soát nhất quán)

Kết quả: chưa hội tụ, 5 lỗi phải sửa, cả 5 đều đúng và đã sửa: (1) tiêu chí nghiệm thu POC mâu thuẫn với phần "chỉ hứa yêu cầu 1 và 2" ([11](11-lo-trinh.md) §10); (2) kiểm chứng AgentCore vẫn ghi "ở M0" dù đã dời sang sau G1 ([06](06-tang-bedrock.md) §1a, [02](02-assistant-service.md) §8, [10](10-trien-khai.md) §9); (3) trần 5 vòng còn sót ở lượt `optimize` ([04](04-tool-calling.md) §8, §10); (4) loạt so sánh thành phần truy xuất xếp sau G1 trong khi phải làm bằng chứng cho G1 ([09](09-eval-quan-sat.md) §9); (5) R35 và [00](00-tong-quan.md) §8 còn gọi POC là "lát cắt". Reviewer cũng xác nhận thêm hai claim AWS: Cohere Rerank 3.5 trong EU chỉ có ở `eu-central-1`, và Harness, Gateway, Policy có ở `eu-central-1` và `eu-west-3`.

### Vòng 4 (rà soát nhất quán, chỗ khác vòng 3)

Kết quả: chưa hội tụ, 5 lỗi phải sửa, cả 5 đều đúng và đã sửa: (1, 2) mục Harness ở đầu tài liệu này còn đọc như trạng thái hiện tại, nay ghi rõ là biên bản lịch sử và đã thay ở Vòng 2, và "đưa vào M0" đổi thành "sau G1"; (3) tài liệu 14 còn gọi POC là "lát cắt"; (4) bảng ToolGate ở [04](04-tool-calling.md) §3 còn trần 5 vòng không nêu ngoại lệ 7 vòng của `optimize`; (5) R27 đến R33 chưa nói rõ chỉ áp dụng nếu chọn Harness, và R29 còn nêu phương án tool inline đã bị loại ở AD-13. Reviewer xác nhận thêm hai claim AWS: Guardrails không đánh giá `toolResult`, `toolSpec` và `toolUse.input` trong Converse; Titan Text Embeddings V2 có in-region ở `eu-central-1`.

### Vòng 5 (quét cuối)

Kết quả: chưa hội tụ, 3 lỗi phải sửa, cả 3 đúng và đã sửa; cùng một gốc là chi phí và mô tả AgentCore còn viết như thể thuộc POC trong khi AD-13 đã chốt POC dùng vòng lặp C#: (1) đơn giá Runtime, Gateway, Policy nằm trong bảng ngân sách POC ([06](06-tang-bedrock.md) §10), nay tách ra và ghi "chỉ áp dụng nếu Harness được chọn sau G1"; (2) chỉ số `cost_per_request` ([09](09-eval-quan-sat.md) §4) tính Gateway và Policy vào phần cố định và đặt ngưỡng cho POC, trong khi POC chỉ đo và báo cáo; (3) [11](11-lo-trinh.md) §7 dùng cụm "nếu AD-13 được giữ" theo nghĩa đảo ngược. Sửa thêm các điểm nên có: dòng trạng thái "sau G1" ở [10](10-trien-khai.md) §9, điều kiện người ký manifest ở ma trận yêu cầu, phiên bản tài liệu 00, và ghi rõ nhóm E, G, B là bộ riêng ngoài 50 câu. Reviewer xác nhận thêm hai claim AWS: Rerank API nằm trên `bedrock-agent-runtime`; Sonnet 5 có ngưỡng cache tối thiểu 1 024 token và tối đa 4 checkpoint. Claim "Converse cho nhiều khối `toolUse` trong một lượt" chưa xác minh được, là điều 04 §10 đang dựa vào để chạy 3 phương án song song.

Bổ sung sau vòng 5: tra lại claim nhiều khối `toolUse` trong một lượt qua trang "Call a tool with the Converse API" và các ví dụ đi kèm của AWS. Tài liệu mô tả phản hồi của model có thể gồm nhiều khối nội dung, mỗi khối là một yêu cầu tool thì được thực thi và kết quả gom vào **một** message `user` chứa nhiều khối `toolResult`. Mức xác nhận: **một phần** (dựa vào mô tả và ví dụ, chưa thấy câu khẳng định tường minh về song song), nên vẫn thử một lần gọi thật khi làm tool đầu tiên.

### Vòng 6 (rà soát hồi quy có mục tiêu)

Kết quả: chưa hội tụ, 2 lỗi phải sửa, cả 2 đúng và đã sửa: (1) tài liệu 14 ghi golden set "50 câu, có 15 câu ngoài phạm vi", trong khi 15 câu đó là bộ riêng ngoài 50 câu ([09](09-eval-quan-sat.md) §9); (2) hai câu ở phần vòng 1 của tài liệu này còn khẳng định ở thì hiện tại rằng AgentCore nằm trong khung 2 ngày của POC, nay gắn "đã thay ở Vòng 2". Reviewer quét toàn bộ 00 đến 14 và xác nhận mọi chỗ khác về Harness, Gateway, Policy, facade đã được điều kiện hóa đúng ("sau G1" hoặc "nếu chọn Harness"); các số liệu ngày và trần vòng khớp. Sửa thêm nhãn "sau G1" ở hai cạnh của Sơ đồ 1.2 và dòng trạng thái ở [02](02-assistant-service.md) §8.

### Vòng 7 (vòng cuối)

Kết quả: chưa hội tụ, 2 lỗi phải sửa, cả 2 đúng và đã sửa, đều ở tài liệu 14: (1) mục "câu người mới hay hỏi" còn ghi kiểm chứng AgentCore chạy ở tuần đầu (M0), nay ghi 8 mục ở [06](06-tang-bedrock.md) §1 chạy ở M0 và các kiểm chứng AgentCore chạy sau G1; (2) ba ô về Gateway, `InvokeHarness` và `vf-tools` mô tả đấu nối như đang dùng, nay ghi điều kiện "chỉ khi Harness được chọn sau G1". Reviewer đọc hết tài liệu này và xác nhận các khẳng định ở thì hiện tại đều đúng hoặc đã gắn nhãn lịch sử; README, 00, 11 khớp nhau về ngày, số đếm và phạm vi POC. Vòng lặp dừng ở đây theo yêu cầu của người dùng, không phải vì reviewer báo hội tụ: kết quả cuối vòng 7 vẫn là còn 2 lỗi câu chữ, đã sửa nhưng chưa có vòng nào kiểm lại các sửa đó.


### Quyết định của công ty ngày 19/09/2026: đảo AD-13 sang AgentCore

Người dùng chọn AgentCore Harness làm vòng lặp tool của POC, đảo lại kết luận của Vòng 2. Đây là **quyết định của công ty, không phải kết quả suy luận lại**: các phản biện của hai reviewer ở Vòng 2 chưa bị bác, chúng chỉ đổi vai từ lý do loại bỏ thành rủi ro phải quản lý trong POC (R27, R29, R32, R33 và R39 mới).

Lý do được ghi nhận: tiêu chí "ưu tiên dịch vụ có sẵn của AWS" của tài liệu cuộc họp; không phải tự bảo trì vòng lặp; Gateway và Cedar Policy là hạ tầng phân quyền dùng lại được về sau.

Các thay đổi kèm theo, để quyết định này không thành lời hứa suông:

| Thay đổi | Nơi |
| --- | --- |
| Bốn kiểm chứng quyết định V-A1, V-A3, V-A4, V-A6 chuyển từ "sau G1, ngoài đường găng" sang **tuần 1, trên đường găng** | [06](06-tang-bedrock.md) §1a |
| Cổng G0 thêm hai nhánh: V-A1 và V-A6 trượt, hoặc V-A4 ngoài ngân sách, thì bỏ AgentCore ngay trong tuần 1 | [11](11-lo-trinh.md) §3 |
| Gantt thêm m0f, m0g, m0h và mốc G0 (25/09); facade, Gateway và Cedar vào CI từ tuần 1 | [11](11-lo-trinh.md) §2, [10](10-trien-khai.md) §9 |
| [04](04-tool-calling.md) §6 **không bị xóa**: đổi vai thành đường thoát đã thiết kế sẵn, vì R28, R29 và R32 đều lấy nó làm biện pháp giảm nhẹ | [04](04-tool-calling.md) §6 |
| Đơn giá AgentCore Runtime, Gateway, Policy vào ngân sách POC và vào `cost_per_request` | [06](06-tang-bedrock.md) §10, [09](09-eval-quan-sat.md) §4 |
| R28, R29, R32, R35 tăng mức tác động; thêm R39 (ba hạ tầng mới trong tuần 1 của bản nén) | [12](12-rui-ro.md) §2 |
| Bản nén 4 tuần: điểm cắt sớm hơn G0 — V-A1 và V-A6 phải đạt trước hết ngày 3 | [11](11-lo-trinh.md) §10 |

Điều chưa giải quyết: tuần 1 nay gánh 8 xác minh Bedrock, V-K1, đo chi phí mẫu, SSE qua chuỗi thật, khung service và CI, cộng bốn kiểm chứng AgentCore và ba hạ tầng mới. Đây là R39, và nó chưa có biện pháp nào ngoài điểm cắt sớm. Nếu công ty muốn giữ cả AgentCore lẫn bản nén 4 tuần, cần thêm người hoặc bớt việc tuần 1, không có cách thứ ba.

Kiểm lại sau khi sửa: 68 sơ đồ Mermaid render không lỗi; 13 quyết định AD, 39 rủi ro R, 7 câu hỏi Q, không có tham chiếu gãy; quét lại toàn bộ 00 đến 14 cho các cụm "sau G1", "không thuộc POC", "chỉ khi Harness" chỉ còn một chỗ hợp lệ (điểm cắt phạm vi ở G1, không liên quan AgentCore); mọi chỗ nhắc "vòng lặp C#" đều ở vai đường thoát.


### Vòng rà lại bằng Opus ngày 19/09/2026: xác minh AWS và hai khu vực pháp lý

Người dùng yêu cầu rà lại vì các vòng trước chạy bằng mô hình nhỏ hơn. Vòng này **không đụng tới AD-13** — đó là quyết định của công ty, không phải kết luận suy ra được. Phạm vi là các **khẳng định kiểm chứng được** nằm dưới quyết định đó. Nguồn: skill `amazon-bedrock` (tệp `references/agentcore-harness.md` và `references/agentcore-gateway.md`, được skill tuyên bố là có thẩm quyền cao hơn trang docs), trang API `CreateHarness` và `InvokeHarness`, trang giá AgentCore.

**Ba câu hỏi đang chặn tuần 1 đã có câu trả lời từ tài liệu, không cần chạy thử:**

| Mã | Trước vòng này | Sau vòng này |
| --- | --- | --- |
| V-A3 | "Chưa xác minh Harness có phát sự kiện tool phía server" — là kiểm chứng quyết định | **Đã trả lời.** Trang API InvokeHarness ghi `contentBlockDelta.delta` mang một trong `text`, `toolUse`, `toolResult`, `reasoningContent`. Rời khỏi nhóm quyết định và rời đường găng tuần 1 |
| V-A1 | "SDK ký SigV4 nên khả năng cao phải viết `HttpClient` thô" | **Thu hẹp.** Trang API InvokeHarness liệt kê AWS SDK for .NET V4, nên SDK có thao tác này; rủi ro còn lại chỉ là thay bộ ký bằng header Bearer |
| V-A6 | "Tài liệu ghi Gateway target OpenAPI hỗ trợ token exchange" — chưa chắc | **Thu hẹp.** AgentCore Identity hỗ trợ RFC 8693 như một grant type sẵn có, và Gateway tự đổi token trước khi gọi target. Rủi ro dồn về phía Keycloak, không phải phía AWS |

**Một lỗi kỹ thuật có thể làm hỏng tuần 1, đã sửa.** Tài liệu ghi chế độ VPC của Harness "cần endpoint `ecr.dkr`, `ecr.api`". Sai: Harness kéo container từ **ECR Public**, và ECR Public **không có VPC endpoint**, nên VPC **bắt buộc có NAT gateway**; thiếu NAT thì mọi phiên hỏng vì image-pull timeout. Nếu đội DevOps làm đúng theo bản cũ, tuần 1 sẽ mất thời gian gỡ một lỗi không có trong danh sách rủi ro. Thêm V-A10.

**Bốn chỗ bổ sung về an toàn và độ chính xác:** trust policy của execution role phải có điều kiện chống confused deputy (`aws:SourceAccount`, `aws:SourceArn`), nếu không thì harness của tài khoản bất kỳ cũng assume được vai; authorizer JWT thiếu **cả** `allowedClients` lẫn `allowedAudience` thì nhận mọi token hợp lệ của issuer; `CreateHarness` cần `iam:PassRole`; xác thực gọi vào là **loại trừ**, một harness chỉ nhận SigV4 hoặc JWT. Thêm V-A11 vì hai trang API của AWS **mâu thuẫn nhau** về ngữ nghĩa `maxTokens` (tổng cho một lần gọi, hay mỗi vòng lặp).

**Hai khẳng định bị hạ độ chắc chắn, không bị bác:** trang API CreateHarness **không ghi giá trị mặc định nào**, nên các số "75 vòng, 3 600 giây" chỉ có ở trang vận hành và có thể đổi. Kết luận không đổi vì nó không phụ thuộc số cụ thể: luôn đặt tường minh.

**Thay đổi lớn nhất của vòng này không đến từ tài liệu AWS mà từ một câu của người dùng:** công ty ở **Việt Nam**, phần mềm phục vụ kỹ sư ở **Việt Nam và Pháp**. Giả định GĐ-1 của bản thảo ("người dùng hỏi bằng tiếng Pháp là chính") và cách đặt Q1 ("residency" như một câu hỏi EU thuần) đều được viết khi chưa có thông tin này. Ba hệ quả, ghi thành AD-14, Q8, R40, R41, R42 và mục §10a của [06](06-tang-bedrock.md):

1. **Pháp lý.** Luật 91/2025/QH15 và Nghị định 356 đã có hiệu lực từ 01/01/2026, đòi hồ sơ đánh giá tác động chuyển dữ liệu xuyên biên giới nộp Bộ Công an, với mức phạt tới 5% doanh thu năm liền trước. AWS không có vùng đặt tại Việt Nam, nên **mọi** phương án vùng đều là chuyển dữ liệu xuyên biên giới. Đây không phải việc hoãn tới GA.
2. **Ngôn ngữ.** Câu hỏi tiếng Việt trên kho tài liệu tiếng Pháp là **truy vấn xuyên ngôn ngữ**. Cấu hình FTS `fr_unaccent` không chặt gốc từ tiếng Việt, nên nhánh từ khóa của tìm kiếm lai mất tác dụng với nhóm người dùng này và chỉ còn nhánh vector gánh; `unaccent` còn làm mất nghĩa tiếng Việt. Golden set và số recall phải **tách theo ngôn ngữ**, vì một số gộp sẽ che đúng chỗ hỏng.
3. **Độ trễ.** Việt Nam tới Frankfurt cộng khoảng 250 đến 320 ms mỗi lượt. Cộng cold start khoảng 2 giây thì ngân sách p95 ≲ 3 giây rất chật cho nhóm này. Đo **tách theo nhóm người dùng**.

Vòng này **không** tự chốt vùng chạy: đó là đánh đổi pháp lý mà công ty và pháp chế quyết, nên ba phương án được viết ra kèm khuyến nghị (phương án A, một vùng EU, cho POC) chứ không viết thành quyết định đã rồi.

**Đối chiếu sách, đọc hẹp ba cuốn liên quan tới quyết định vòng lặp.** Không cuốn nào mâu thuẫn với thiết kế; ba điểm xác nhận và một điểm bổ sung.

| Nguồn | Nội dung | Kết quả |
| --- | --- | --- |
| *AI Agents on AWS* | "Guardrails và Policy: cần cả hai. Guardrails kiểm văn bản mô hình sinh ra; Cedar Policy kiểm việc gọi tool" | **Xác nhận** thiết kế hiện tại. Đây cũng là lý do ToolGate ở facade không thừa: Cedar chặn trước lời gọi, facade kiểm nội dung phản hồi mà Cedar không thấy |
| *AI Agents on AWS* | "Một tool một việc, không dùng tool đa chế độ có cờ `mode`" | **Xác nhận** quy tắc ở [04](04-tool-calling.md) §2 |
| *AI Agents on AWS* | ECS Fargate cho hội thoại nhiều lượt cần trạng thái nóng và kết nối bền | **Xác nhận** khuyến nghị ở [10](10-trien-khai.md) §7 cho `Assistant.Api` |
| *AI Agents on AWS* | AgentCore Runtime đổi mức cô lập và quản trị sẵn có lấy **phụ thuộc AWS** | **Bổ sung.** Bản thảo chưa gọi tên cái giá này trong AD-13; đã thêm, kèm ghi nhận rằng phụ thuộc bị chặn một phần vì engine, phân quyền và kho tài liệu đều nằm ngoài AgentCore |
| *Enterprise Generative and Agentic AI* | Danh mục agent nên mang metadata **data-residency** để chọn được theo ràng buộc tuân thủ | **Ủng hộ** hướng tách theo khu vực pháp lý ở [06](06-tang-bedrock.md) §10a, dù danh mục agent chưa thuộc phạm vi POC |

Một điểm ghi nhận để dùng về sau, chưa áp dụng: Gateway có `x_amz_bedrock_agentcore_search` để tìm tool theo ngữ nghĩa khi vượt khoảng 100 tool. POC có khoảng 5 tool nên chưa cần.

Kiểm lại sau khi sửa: 14 quyết định AD, 42 rủi ro R, 8 câu hỏi Q; 69 sơ đồ Mermaid render không lỗi; 0 tham chiếu gãy; validator tiếng Việt 0 lỗi.
