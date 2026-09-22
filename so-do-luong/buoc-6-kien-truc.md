# Bước 6 — Gom nguyên liệu

Đi lấy nguyên liệu để trả lời: đoạn tài liệu, kết quả tính của engine, hoặc case đã duyệt. Nhãn ở bước 5 quyết định đi nhánh nào.

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/`

## 6a · Tìm tài liệu — doc_qa, app_help

```
Assistant.Api · ChatOrchestrator
│  Đã có: search_query (bước 5), scope (bước 3)
│  → SSE status "Đang tìm trong kho tài liệu"
▼
6a.1 PHÂN GIẢI MÃ ĐIỀU KHOẢN                    Assistant.Api · ClauseResolver
│  Làm gì:     Tra đúng điều khoản khi câu hỏi có mã, kể cả gõ nhầm
│  Làm thế nào: Regex bóc mã "6.22", "EN 1992-1-1"
│              pg_trgm trên bảng clause_ref → clause_path chuẩn "6.2.2"
│              Không có mã → bỏ qua bước này
▼
6a.2 TÌM RỘNG                                   ScopedKnowledgeBaseClient → Bedrock MKB
│  Làm gì:     Lấy 40 chunk liên quan nhất, chỉ trong scope được đọc
│  Làm thế nào: Retrieve, numberOfResults = 40
│              metadata filter: scope_key IN scope, status = active
│              [, clause_path IN danh sách từ 6a.1]
▼
6a.3 CHỌN HẸP                                   Bedrock Rerank
│  Làm gì:     Chấm lại 40 chunk kỹ hơn, giữ 8
▼
6a.4 ÁP NGƯỠNG                                  Assistant.Api · RetrievalService
│  Làm gì:     Không đủ căn cứ thì từ chối, không trả lời bừa
│  Làm thế nào: Điểm cao nhất dưới score threshold (khởi điểm 0.5) 
│              ✗ → Refused
▼
6a.5 MỞ RỘNG LÂN CẬN                            ScopedKnowledgeBaseClient → Bedrock MKB
│  Làm gì:     Lấy thêm chunk liền trước, liền sau cho đủ ý
│  Làm thế nào: chunk_index ±1, cùng doc_id
▼
6a.6 GHI LOG                                    PostgreSQL · retrieval_log
   Kết quả: 8 chunk + chunk lân cận → bước 7
   → SSE retrieval: danh sách nguồn
```

## 6b · Gọi engine tính toán — calc, explain_result, mixed, optimize

```
Assistant.Api · ChatOrchestrator
│  InvokeHarness kèm Bearer JWT của người dùng
│  Giới hạn đặt tường minh: 5 vòng, 60 giây (optimize: 7 vòng, 90 giây)
▼
6b.1 CHỌN TOOL                                  AgentCore Harness ⇄ Bedrock · Sonnet 5
│  Làm gì:     Sonnet 5 quyết định gọi tool nào, tham số gì
│  Làm thế nào: Mô hình phát toolUse: tên tool + tham số
│              thinking adaptive, effort low
▼
6b.2 KIỂM QUYỀN GỌI TOOL                        AgentCore Gateway · Cedar
│  Làm gì:     Người này có được gọi tool này không
│  Làm thế nào: Cedar policy kiểm theo danh tính đã xác thực
│              Token exchange (RFC 8693): đổi token cho facade
▼
6b.3 TOOLGATE                                   Tool facade C#
│  Làm gì:     Kiểm tham số trước khi cho gọi engine
│  Làm thế nào: L1 schema · L2 quyền · L3 khoảng giá trị
│              L4 ĐƠN VỊ bắt buộc · L5 chống gọi lặp
▼
6b.4 GỌI ENGINE                                 Main API
│  Làm gì:     Tính thật
│  Làm thế nào: Gọi bằng token của người dùng, [ApiAccess] kiểm quyền
│              như mọi request khác
▼
6b.5 ĐỌC KẾT QUẢ                                Tool facade C#
│  Làm gì:     Không để lỗi ẩn lọt vào câu trả lời
│  Làm thế nào: L6: đọc ApiResult.Code — Forbidden có thể nằm trong HTTP 200
│              search_documents, find_similar_cases: ApplyGuardrail trên nội dung
│              Ghi tool_run, trả nguyên JSON, không tóm tắt
▼
6b.6 VÒNG LẶP                                   AgentCore Harness ⇄ Sonnet 5
   Cần tính thêm → quay lại 6b.1
   Đủ rồi → Sonnet viết câu trả lời luôn, bước 7 gộp vào đây
   ⏸ kết quả tool nhóm B có thể vào case → approval_required
   ✗ quá vòng, quá giờ, hoặc cùng tool lỗi 2 lần → Degraded
```

## 6c · Tra case đã duyệt — case_lookup

```
Assistant.Api · ChatOrchestrator
▼
6c.1 GOM THAM SỐ                                Assistant.Api · ChatOrchestrator
│  Làm gì:     Lấy các thông số để so
│  Làm thế nào: Thứ tự tin cậy: tool_run lượt trước > pageContext > case_hints
│              Ghi đè theo từng key, không theo cả khối
│              Key chỉ có từ case_hints → chip cho kỹ sư xác nhận
│              ⏸ dưới 2 key → hỏi lại người dùng
▼
6c.2 LỌC CỨNG                                   PostgreSQL · bảng case, RLS
│  Làm gì:     Chỉ giữ case đúng công ty, đã duyệt, đúng loại
│  Làm thế nào: org_id, status = Approved, tool_id / element_type khớp
│              Tối đa 200 ứng viên
▼
6c.3 CHẤM ĐIỂM                                  Assistant.Api · CaseSimilarityScorer
│  Làm gì:     Xếp hạng theo độ giống về con số
│  Làm thế nào: Chuẩn hóa từng key về [0, 1] theo dải trong manifest
│              Điểm cuối = distance / coverage → top 5
│              Tie-break bằng vector của summary, chỉ khi câu hỏi có phần chữ tự do
▼
Kết quả: 5 case → bước 7, nhãn "Kinh nghiệm nội bộ, không phải tiêu chuẩn"
```

## Từ khóa

**ClauseResolver và pg_trgm**
<!-- alias: ClauseResolver, pg_trgm -->
- Là gì: `pg_trgm` là extension của PostgreSQL so khớp chuỗi theo cụm 3 ký tự, nên tìm được cả chuỗi gõ gần đúng. `ClauseResolver` dùng nó để đổi mã điều khoản người dùng gõ thành `clause_path` chuẩn.
- Ở kiến trúc này: Chạy trên một bảng nhỏ `clause_ref` trong PostgreSQL, trước khi gọi Bedrock MKB.
- Vì sao: MKB tìm theo nghĩa, không sửa được mã gõ sai. "6.2.2" gõ thành "6.22" thì cả vector search lẫn keyword search đều trượt.
- Nguồn: `03-rag.md` §2 · `19-dac-ta-kien-truc.md` §5.3

**Bedrock MKB (Managed Knowledge Base)**
<!-- alias: Bedrock MKB -->
- Là gì: Dịch vụ AWS quản lý trọn gói kho tài liệu: nhận file, cắt chunk, tạo embedding, lưu vector store và trả kết quả retrieval.
- Ở kiến trúc này: Chứa toàn bộ chunk tài liệu, nạp từ S3 qua managed connector. PostgreSQL chỉ giữ bản sao nội dung để dựng citation.
- Vì sao: Không phải tự vận hành vector store (AD-17). Cái giá: không chỉnh được tham số tìm kiếm sâu, và không đổi được mô hình embedding sau khi tạo kho.
- Nguồn: `kien-truc-day-du.md` §3.3 · `03-rag.md`

**Retrieve và numberOfResults**
<!-- alias: Retrieve, numberOfResults -->
- Là gì: `Retrieve` là API của Bedrock Knowledge Base trả về các chunk khớp câu hỏi kèm điểm. `numberOfResults` là số chunk muốn lấy.
- Ở kiến trúc này: Đặt tường minh 40.
- Vì sao: Để trống thì nhận mặc định của dịch vụ (tài liệu chung ghi 5), không phải số mình cần. Ngân sách rerank tính trên 40.
- Nguồn: `03-rag.md` §2

**Metadata filter và scope_key**
<!-- alias: metadata filter, scope_key -->
- Là gì: Điều kiện lọc gắn vào lời gọi `Retrieve`, dựa trên thuộc tính của từng chunk trong file sidecar `.metadata.json`.
- Ở kiến trúc này: Luôn có `scope_key` (lấy từ bước 3) và `status`. Chỉ dùng toán tử `equals`, `in`, `notIn` và toán tử số.
- Vì sao: Bỏ filter thì code vẫn chạy, vẫn trả 40 chunk đúng định dạng, nhưng lấy từ tài liệu của **mọi** organization. Lọc thuộc tính chưa khai thì trả rỗng mà không báo lỗi.
- Nguồn: `03-rag.md` §2 · `ship/00-thuat-ngu-va-nguon.md`

**ScopedKnowledgeBaseClient**
<!-- alias: ScopedKnowledgeBaseClient -->
- Là gì: Class duy nhất trong code được phép gọi `Retrieve`. Scope là tham số constructor bắt buộc; rỗng thì ném lỗi ngay.
- Ở kiến trúc này: Không có overload nào nhận filter từ ngoài. Architecture test trong CI cấm mọi class khác tham chiếu client `bedrock-agent-runtime`.
- Vì sao: Ở SQL, quên lọc quyền là chuyện gần như không làm được. Ở API, quên lọc chỉ là chuyện khó. Gom về một class để quên lọc thành chuyện không làm được (R46).
- Nguồn: `03-rag.md` §2 · `ship/00-thuat-ngu-va-nguon.md`

**Bedrock Rerank**
<!-- alias: Bedrock Rerank -->
- Là gì: Mô hình chấm lại mức liên quan giữa câu hỏi và từng chunk, kỹ hơn bước tìm rộng. Ứng viên: Cohere Rerank 3.5 hoặc Amazon Rerank 1.0.
- Ở kiến trúc này: Nhận 40 chunk, giữ 8. Có cờ bật tắt; tắt thì lấy 8 chunk đầu theo điểm của MKB.
- Vì sao: Tìm rộng ưu tiên không bỏ sót. Chọn hẹp ưu tiên chính xác. Hai bước tách riêng thì được cả hai.
- Nguồn: `03-rag.md` §2 · `06-tang-bedrock.md` §2

**Score threshold**
<!-- alias: score threshold -->
- Là gì: Ngưỡng điểm tối thiểu để một chunk được coi là đủ liên quan.
- Ở kiến trúc này: Khởi điểm 0.5, hiệu chỉnh sau khi đo. Chunk tốt nhất dưới ngưỡng thì lượt đó trả `refusal`.
- Vì sao: Thang điểm của MKB khác thang cosine, không bê con số của hệ khác sang. Đặt ngưỡng quá cao thì không bao giờ trả được gì.
- Nguồn: `03-rag.md` §2 · `00-tong-quan.md` P3

**retrieval_log**
<!-- alias: retrieval_log -->
- Là gì: Bảng ghi lại mỗi lần retrieval: câu truy vấn, các chunk trả về, điểm.
- Ở kiến trúc này: Ghi ở cuối nhánh 6a. Dùng để truy lại vì sao câu trả lời dựa trên các chunk đó, và làm dữ liệu eval.
- Vì sao: Không có log thì khi câu trả lời sai không biết lỗi do retrieval hay do mô hình viết.
- Nguồn: `03-rag.md` §2 · `07-auth-bao-mat.md` §6

**AgentCore Harness**
<!-- alias: AgentCore Harness, InvokeHarness -->
- Là gì: Dịch vụ AWS quản lý sẵn vòng lặp "mô hình đề xuất gọi tool → hệ thống gọi thật → trả kết quả → mô hình xem tiếp".
- Ở kiến trúc này: Đường chính của POC (AD-13). Mặc định của Harness là 75 vòng, 3 600 giây và model route toàn cầu, nên phải đặt tường minh model `eu.*`, số vòng, thời gian.
- Vì sao: Không phải tự viết vòng lặp. Cái giá: Harness không có hook, nên mọi bước kiểm tham số phải dời ra tool facade. Vòng lặp C# tự viết là phương án dự phòng.
- Nguồn: `04-tool-calling.md` §6, §8

**AgentCore Gateway và Cedar**
<!-- alias: AgentCore Gateway, Cedar -->
- Là gì: Gateway biến API nội bộ thành tool mô hình gọi được. Cedar là ngôn ngữ viết policy phân quyền của AWS.
- Ở kiến trúc này: Gateway áp Cedar policy: người này có được gọi tool này, với dự án này không. Sau đó đổi token rồi gọi tool facade.
- Vì sao: Cedar phải kiểm thuộc tính đã xác thực, không kiểm giá trị mà một hội thoại bị prompt injection có thể ảnh hưởng tới.
- Nguồn: `04-tool-calling.md` §8 · `ship/00-thuat-ngu-va-nguon.md`

**Token exchange (RFC 8693)**
<!-- alias: Token exchange -->
- Là gì: Chuẩn OAuth để đổi một token lấy token khác có audience phù hợp với service đích.
- Ở kiến trúc này: Gateway đổi token của người dùng thành token cho facade. Điều kiện: Keycloak bật token exchange và audience khớp (V-A6).
- Vì sao: Gửi thẳng token gốc xuống API hạ nguồn là điều kiểm toán viên hay bắt lỗi, vì ranh giới tin cậy bị nhòe.
- Nguồn: `04-tool-calling.md` §8 · `07-auth-bao-mat.md` §1

**Tool facade và ToolGate**
<!-- alias: Tool facade C#, TOOLGATE -->
- Là gì: Tool facade là service C# nằm giữa Gateway và Main API. ToolGate là chuỗi 6 lớp kiểm chạy trong facade.
- Ở kiến trúc này: Kiểm schema, quyền, khoảng giá trị, đơn vị, chống gọi lặp, rồi đọc mã lỗi ẩn. Ghi `tool_run`.
- Vì sao: Lớp 4 (đơn vị) và lớp 6 (lỗi ẩn) nguy hiểm nhất: sai mà kết quả vẫn trông hợp lý. `b = 0.3` là mét hay milimét, đoán sai một nghìn lần vẫn ra con số nghe được.
- Nguồn: `04-tool-calling.md` §3, §8 · `kien-truc-day-du.md` §3.4

**ApiResult.Code**
<!-- alias: ApiResult.Code -->
- Là gì: Mã kết quả nằm trong body phản hồi của Main API.
- Ở kiến trúc này: Main API có thể trả HTTP 200 mà body mang `Code = Forbidden`. Facade đọc mã này và đổi thành lỗi 4xx kèm mô tả.
- Vì sao: Gateway và Cedar không đọc body. Không bắt ở facade thì lỗi quyền trôi vào kết quả tool như dữ liệu hợp lệ (R9).
- Nguồn: `04-tool-calling.md` §8 · `ship/03-backend.md`

**ApplyGuardrail trên kết quả tool**
<!-- alias: ApplyGuardrail -->
- Là gì: Lời gọi riêng tới Bedrock Guardrails để soát nội dung, không kèm lời gọi mô hình.
- Ở kiến trúc này: Chạy trong facade, trên nội dung `search_documents` và `find_similar_cases` trả về, trước khi đưa vào `toolResult`.
- Vì sao: Guardrail gắn vào lời gọi mô hình không soát `toolResult`. Chunk tài liệu bên thứ ba có thể chứa chỉ dẫn độc hại (R12, R24).
- Nguồn: `04-tool-calling.md` §8 · `ship/06-bao-mat.md`

**tool_run**
<!-- alias: tool_run -->
- Là gì: Bảng ghi mỗi lần gọi engine: tool, phiên bản tool, input, output, đơn vị.
- Ở kiến trúc này: Facade ghi. Bước 8 đối chiếu số trong câu trả lời với bảng này. Lượt sau dùng lại làm thông số tra case.
- Vì sao: Là nguồn duy nhất của mọi con số tính ra. Nguyên tắc: mô hình không bao giờ tự tính.
- Nguồn: `19-dac-ta-kien-truc.md` §8.1 · `04-tool-calling.md` §4

**approval_required**
<!-- alias: approval_required -->
- Là gì: Event gửi về giao diện để kỹ sư bấm Duyệt hoặc Bỏ qua một kết quả tính.
- Ở kiến trúc này: Chỉ cho tool nhóm B (tính toán). Kỹ sư duyệt thì kết quả thành một case trong kho kinh nghiệm.
- Vì sao: Case chỉ sinh từ thao tác duyệt của kỹ sư trên một `tool_run` có thật. Đây là cách chặn đầu độc kho case.
- Nguồn: `ship/02-hop-dong.md` §4 · `05-case-memory.md`

**RLS (Row-Level Security)**
<!-- alias: RLS -->
- Là gì: Tính năng của PostgreSQL gắn policy lọc dòng vào chính bảng. Mọi truy vấn đều bị lọc, kể cả truy vấn viết sai.
- Ở kiến trúc này: Bảng `case` dùng RLS để cách ly theo organization.
- Vì sao: Điều kiện để RLS có tác dụng: role của ứng dụng không phải superuser, không có `BYPASSRLS`, không phải owner của bảng.
- Nguồn: `ship/00-thuat-ngu-va-nguon.md` · `05-case-memory.md` §5

**CaseSimilarityScorer**
<!-- alias: CaseSimilarityScorer -->
- Là gì: Thành phần chấm độ giống giữa bài toán hiện tại và từng case, bằng khoảng cách trên các con số.
- Ở kiến trúc này: Chỉ tính trên các key có ở cả hai phía. Điểm cuối chia cho độ phủ, nên case khớp 4/5 key thắng case khớp 2/5 key.
- Vì sao: Vector search không phân biệt được nhịp 8 m với nhịp 12 m, trong khi độ lớn là thứ duy nhất nhánh này cần.
- Nguồn: `05-case-memory.md` §4 · `20-tai-lieu-thiet-ke-kien-truc.md`

## Chưa rõ trong tài liệu

- `03-rag.md` khẳng định `startsWith` bị bỏ qua im lặng trên MKB. `ship/00-thuat-ngu-va-nguon.md` ghi cùng điểm đó là chưa kiểm chứng. Kiểm ở V-K4.
- Kho vector của MKB có nhận `HYBRID` search không vẫn chưa rõ (V-K5). Không nhận thì `pg_trgm` ở 6a.1 chuyển từ bổ trợ thành bắt buộc.
- Một "vòng" của Harness chưa chắc khớp một vòng tool như trong thiết kế (V-A4).
