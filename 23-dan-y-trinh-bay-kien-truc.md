# 23 · Dàn ý trình bày kiến trúc — bản dễ hiểu

> **Đã cập nhật trong `ship/`.** File này ghi dàn ý trình bày trước lượt rà soát 21/09/2026. Bản đã sửa: `ship/01-kien-truc.md` và `ship/11-thuyet-minh.md`. Từ AD-28 (22/09/2026), case tự ghi khi engine tính đạt và không còn bước duyệt: xem `ship/12-tra-case.md`. Harness có lifecycle hook, nhưng ToolGate vẫn đặt ở facade: xem `ship/01-kien-truc.md` §8.5.

**Dành cho:** người trình bày (AI Solution Architect)
**Người nghe:** sếp, Backend, Frontend, DevOps, cùng một phòng
**Thời lượng:** 20 phút, 16 slide chính (một slide một phút) + References + phụ lục Q&A
**Nguồn:** bộ `ship/` phiên bản 2.0, chủ yếu [ship/01-kien-truc.md](ship/01-kien-truc.md). Dựng theo skill `academic-pptx` (structured argument).

Chỉ có dàn ý, chưa dựng file `.pptx`.

---

## Cách dựng

**Mạch chính: Situation → Complication → Resolution.**

- **Situation:** kỹ sư tra tiêu chuẩn bằng tay, trong khi ứng dụng đã có sẵn engine tính toán.
- **Complication:** gắn thẳng một chatbot vào thì sinh ra ba lỗi không chấp nhận được: bịa số, bịa citation, lộ dữ liệu giữa các organization.
- **Resolution:** năm nguyên tắc đặt hàng rào ra ngoài mô hình, kèm ba nhánh xử lý và bước post-validation. Phần chưa chắc thì ghi rõ và có hạn verification.

**Cả buổi chỉ bảo vệ một luận điểm:** *mọi con số và mọi citation mà hệ thống đưa ra đều truy ngược được về engine hoặc về điều khoản gốc.* Slide nào không phục vụ luận điểm này thì chuyển xuống phụ lục.

**Một sơ đồ gốc:** slide 6 là sơ đồ container. Các slide 7–11 dùng lại đúng sơ đồ đó, chỉ highlight phần đang nói. Người nghe chỉ phải nhớ một hình.

**Trạng thái thật, nói ít nhất một lần:** chưa có dòng code nào chạy, tài khoản AWS chưa bật billing, nên mọi con số về latency và chi phí đều là ngân sách mục tiêu hoặc lấy từ tài liệu AWS, không phải số đo.

---

## Ghost deck test

Chỉ đọc cột action title từ trên xuống, không nhìn phần còn lại, phải hiểu được cả lập luận:

| # | Action title |
| --- | --- |
| 1 | Trợ lý AI cho VF Structures: mọi câu trả lời truy ngược được về engine hoặc điều khoản gốc |
| 2 | Kỹ sư mất nhiều phút để tra một điều khoản mà ngày nào cũng phải tra lại |
| 3 | Gắn thẳng một chatbot vào ứng dụng sẽ bịa số, bịa citation và lộ dữ liệu giữa các organization |
| 4 | Bài toán thiết kế: trả lời nhanh mà vẫn kiểm lại được mọi con số và mọi citation |
| 5 | Năm nguyên tắc chặn ba lỗi đó ngay ở tầng thiết kế, không trông vào câu dặn trong prompt |
| 6 | Phần mới đặt cạnh ứng dụng hiện có; Main API và engine tính toán không sửa dòng nào |
| 7 | Mỗi câu hỏi qua ba gate, gate rẻ chạy trước, rồi router chia vào một trong ba nhánh |
| 8 | Nhánh tài liệu chỉ trả lời khi tìm đủ căn cứ; không đủ thì từ chối |
| 9 | Nhánh tính toán lấy mọi con số từ engine VF; mô hình chỉ chọn tool và trình bày kết quả |
| 10 | Case memory chỉ lớn lên từ kết quả có kỹ sư bấm Duyệt |
| 11 | Ba validator kiểm lại câu trả lời sau khi stream; trượt thì gắn cờ, không lặng lẽ cho qua |
| 12 | Một lượt có bảy cách kết thúc, và giao diện phải hiển thị đúng cả bảy |
| 13 | Ba quyết định đắt nhất đều có cái giá đã biết và cách chặn đã thiết kế sẵn |
| 14 | Bảy verification vẫn đang chặn quyết định; trượt cái nào thì đưa quyết định đó lại lên bàn ngay |
| 15 | Buổi hôm nay cần bốn người chốt bốn việc, mỗi việc có hạn |
| 16 | Kết luận: đổi thêm một ít latency và hạ tầng để kiểm lại được mọi con số |

Đọc liền mạch: pain point → cách gắn thẳng chatbot hỏng ở đâu → bài toán thật → nguyên tắc → hình hệ thống → ba nhánh → post-validation → cái giá → cái chưa chắc → việc cần chốt → kết luận. Test đạt.

---

## Dàn ý từng slide

Quy ước cho mỗi slide: **Exhibit** là thứ chiếu lên màn hình, mỗi slide một exhibit. **Chữ trên slide** tối đa khoảng 40 từ. **Ý nói** là phần người trình bày nói, không in lên slide. **Nguồn** là chỗ lấy dữ liệu.

### Slide 1 · Tiêu đề — 0:30

- **Tiêu đề:** Trợ lý AI cho VF Structures: mọi câu trả lời truy ngược được về engine hoặc điều khoản gốc
- **Dòng phụ:** Đề xuất kiến trúc · bộ tài liệu 2.0 · tên người trình bày · ngày
- **Ghi chú:** tiêu đề là một luận điểm chứ không chỉ tên dự án. Người nghe biết ngay mình sắp phải kiểm tra điều gì.

### Slide 2 · Situation: pain point — 2:00

- **Exhibit:** không có slide. Chiếu màn hình thật, tra một điều khoản trong PDF `EN 1992-1-1` và bấm giờ. Cách làm theo [21-kich-ban-trinh-bay.md](21-kich-ban-trinh-bay.md) slide 1.
- **Chữ trên slide (khi quay lại slide):** thời gian vừa bấm được, ghi to ở giữa.
- **Ý nói:** một kỹ sư tra việc này bao nhiêu lần mỗi ngày, nhân với số kỹ sư. Con số cần giảm là con số đó, không phải "có AI".
- **Lưu ý:** không nói "thường mất khoảng…". Chưa có số đo thì để đồng hồ tự nói.

### Slide 3 · Complication: gắn thẳng chatbot thì hỏng ở đâu — 1:30

- **Exhibit:** bảng ba cột, ba dòng.

  | Lỗi | Ví dụ | Hậu quả |
  | --- | --- | --- |
  | Bịa số | Mô hình tự "tính" hàm lượng cốt thép | Có người xây theo |
  | Bịa citation | Trích §6.2.2 trang 84, nhưng điều khoản đó không nói vậy | Kỹ sư mất niềm tin vào mọi câu trả lời |
  | Lộ dữ liệu | Retrieval trả tài liệu của organization khác | Sự cố pháp lý |

- **Highlight:** dòng "Bịa số", vì đây là nỗi lo lớn nhất trong phòng.
- **Ý nói:** giải thích *hallucination* một lần bằng lời thường: mô hình đoán token tiếp theo, nên nó có thể bịa một cách rất trôi chảy.
- **Nguồn:** [ship/11-thuyet-minh.md](ship/11-thuyet-minh.md) Phần 0.

### Slide 4 · Bài toán thiết kế — 1:00

- **Exhibit:** một câu hỏi in to, bên dưới là ba tiêu chí đo được.
- **Chữ trên slide:**
  - 100% con số truy được về `tool_run` hoặc chunk
  - 100% citation phân giải được về `chunk_id` có thật
  - Không case nào vượt ranh giới `org_id`
- **Ý nói:** ba tiêu chí này có cách đo cụ thể (`NumberValidator`, `CitationValidator`, test tích hợp đa organization). Chỉ tiêu nào không đo được thì không đưa vào.
- **Nguồn:** [ship/01-kien-truc.md](ship/01-kien-truc.md) §1.2.

### Slide 5 · Năm nguyên tắc — 1:30

- **Exhibit:** bảng P1–P5. Thêm cột "chặn lỗi nào" để nối về slide 3.

  | Mã | Nguyên tắc | Chặn lỗi |
  | --- | --- | --- |
  | P1 | AI hỗ trợ kỹ sư, người ký duyệt vẫn là kỹ sư | — |
  | **P2** | **Mô hình không tự tính bất kỳ con số nào** | Bịa số |
  | **P3** | **Không có căn cứ thì không có câu trả lời** | Bịa citation |
  | P4 | Hàng rào nằm ngoài mô hình: scope filter, guardrail, ToolGate | Lộ dữ liệu |
  | P5 | Leo thang từ rẻ đến đắt: prompt → RAG → tool → case memory, không fine-tuning | — |

- **Highlight:** P2 và P3, chữ lớn hơn.
- **Ý nói:** chỉ đọc P2 và P3. Câu then chốt của P4: câu dặn trong prompt chỉ là gợi ý, và gợi ý thì lách được.
- **Lý do đặt ở phút thứ 6:** dập nỗi lo "AI bịa số" sớm, để các câu hỏi phía sau là câu hỏi kỹ thuật.
- **Nguồn:** [ship/01-kien-truc.md](ship/01-kien-truc.md) §1.3.

### Slide 6 · Sơ đồ gốc — 2:00

- **Exhibit:** sơ đồ container rút gọn. Khối mới màu xanh, khối hiện có màu xám. Bỏ Payment, File, Authorization API cho đỡ rối và ghi chú ở chân slide.

  ```
  [Panel AI] → [BFF] → [Assistant.Api] ──→ [Bedrock: Converse + Guardrails]
                            │   │   └────→ [Managed Knowledge Base] ← [S3: chunk + sidecar] ← [Assistant.Worker]
                            │   └────────→ [AgentCore Harness + Gateway] → [Tool facade] → [Main API (không sửa)]
                            └────────────→ [PostgreSQL assistant: case, tool_run, message, audit]
  ```

- **Chữ trên slide:** nhãn "không sửa" đặt cạnh Main API.
- **Ý nói:** mỗi khối một câu, trả lời "nó là gì, làm gì, nói chuyện với ai". Dừng lâu nhất ở Managed Knowledge Base: AWS giữ hộ toàn bộ phần vector, dự án không dựng vector store nào.
- **Không làm:** không giải thích từng mũi tên, không mở sơ đồ bên trong `Assistant.Api`.
- **Nguồn:** [ship/01-kien-truc.md](ship/01-kien-truc.md) §5.1, §5.2.

### Slide 7 · Đường đi của một câu hỏi — 1:30

- **Exhibit:** flowchart ngang.

  ```
  Câu hỏi → [3 gate: rate limit · JWT/quota · guardrail input] → [Router Haiku] ─┬→ Nhánh tài liệu
                                                                                  ├→ Nhánh tính toán
                                                                                  ├→ Nhánh case memory
                                                                                  └→ Từ chối (ngoài phạm vi)
  ```

- **Chú thích trên hình:** "Router lỗi → fallback sang luật cứng, vẫn trả lời được, gắn cờ `degraded_routing`".
- **Ý nói:** Gate rẻ chạy trước gate đắt. Router là một lần gọi mô hình nhỏ để phân loại ý định và viết lại câu hỏi.
- **Nguồn:** [ship/01-kien-truc.md](ship/01-kien-truc.md) §6.1, §6.2.

### Slide 8 · Nhánh tài liệu (RAG) — 1:30

- **Exhibit:** sơ đồ gốc, highlight Worker → S3 → Managed KB → Assistant.Api → Bedrock.
- **Chữ trên slide:**
  - Worker cắt tài liệu theo điều khoản, không cắt theo số ký tự
  - `Retrieve` luôn kèm filter `scope_key` + `status`
  - Không đủ căn cứ → từ chối
- **Chú thích trên hình:** "Từ chối là hành vi đúng. Golden set có riêng một nhóm câu mà đáp án đúng là phải từ chối."
- **Ý nói:** giải thích RAG một lần: tìm đoạn tài liệu liên quan trước, rồi mới cho mô hình đọc và trả lời. Embedding hiểu nôm na là biến đoạn văn thành vector để tìm theo nghĩa, không theo từ khóa.
- **Nguồn:** [ship/01-kien-truc.md](ship/01-kien-truc.md) §4, §6.3; AD-17.

### Slide 9 · Nhánh tính toán (tool calling) — 1:30

- **Exhibit:** sơ đồ gốc, highlight Harness → Gateway → Tool facade → Main API → `tool_run`.
- **Chữ trên slide:**
  - Mô hình chọn tool và điền tham số
  - ToolGate 6 lớp kiểm trước khi gọi engine
  - Engine trả JSON → thẻ kết quả dựng từ JSON
- **Chú thích trên hình:** "Số liệu từ engine VF, không phải từ AI". Đây cũng là dòng chữ trên thẻ kết quả ở giao diện.
- **Ý nói:** tool gọi engine bằng chính token của người dùng, nên phân quyền dùng lại `[ApiAccess]` sẵn có, không viết lại. Mỗi lần chạy đều ghi `tool_run`.
- **Nguồn:** [ship/01-kien-truc.md](ship/01-kien-truc.md) §5.2, §5.4, §6.4.

### Slide 10 · Nhánh case memory — 1:00 · *cắt được nếu thiếu giờ*

- **Exhibit:** hai hàng ngang.
  - Ghi: kỹ sư bấm **Duyệt** → case có tên người và thời điểm
  - Tra: lọc cứng bằng SQL → chấm khoảng cách số học → vector chỉ để tie-break → top 5
- **Chú thích:** "Giải được dưới 2 tham số → hỏi lại, không đoán".
- **Ý nói:** tình huống kết cấu giống nhau ở con số chứ không ở câu chữ, nên tìm theo tham số chứ không tìm theo nghĩa.
- **Nguồn:** [ship/01-kien-truc.md](ship/01-kien-truc.md) §4, §6.5; AD-09, AD-16.

### Slide 11 · Post-validation — 1:00

- **Exhibit:** ba ô ngang.

  | Validator | Kiểm gì |
  | --- | --- |
  | `NumberValidator` | Mỗi con số khớp `tool_run` hoặc chunk |
  | `CitationValidator` | Mỗi `[n]` phân giải về `chunk_id` có thật |
  | `VerificationValidator` | Nhãn "đạt" phải có `tool_run` khớp |

- **Chú thích:** trượt → trạng thái `CompletedUnverified`, giao diện gắn cờ lên câu trả lời chứ không xóa chữ.
- **Nguồn:** [ship/01-kien-truc.md](ship/01-kien-truc.md) §5.3, §4 (F6).

### Slide 12 · Bảy cách kết thúc — 1:00 · *cắt được nếu thiếu giờ*

- **Exhibit:** bảng trạng thái kết thúc → thứ giao diện hiển thị.

  | Trạng thái | Giao diện hiện |
  | --- | --- |
  | `Completed` | Câu trả lời + citation |
  | `CompletedUnverified` | Câu trả lời + cờ cảnh báo |
  | `Refused` | Lý do từ chối + gợi ý phạm vi |
  | `AskBack` | Câu hỏi lại tham số còn thiếu |
  | `Degraded` | Thông báo tool lỗi, không có số |
  | `Rejected` | Lỗi quota, rate limit hoặc guardrail |
  | `Aborted` | Lượt bị dừng |

- **Ý nói:** slide này dành cho Frontend. Có những lượt kết thúc mà không sinh ra chữ nào, và giao diện phải chuẩn bị cho cả trường hợp đó.
- **Nguồn:** [ship/01-kien-truc.md](ship/01-kien-truc.md) §6.1; [ship/07-giao-dien.md](ship/07-giao-dien.md).

### Slide 13 · Ba quyết định và cái giá — 2:00

- **Exhibit:** bảng. Cột "cái giá" in màu đỏ.

  | Quyết định | Cái giá đã biết | Cách chặn |
  | --- | --- | --- |
  | AD-17 · Retrieval trên Managed KB | Lọc quyền là tham số API chứ không phải mệnh đề SQL; quên truyền thì lộ tài liệu mà không báo lỗi (R46) | Chỉ một class `ScopedKnowledgeBaseClient` được gọi `Retrieve`, scope bắt buộc + architecture test trong CI |
  | AD-13 · Tool loop trên AgentCore Harness | Harness không có hook, ToolGate phải ra facade; ba hạ tầng AWS mới cùng lúc (R27, R39) | V-A1/V-A6 trượt → fallback sang tool loop C# |
  | AD-15/16 · Mọi lượt qua router Haiku | Thêm 300–500 ms; router đoán sai thì không để lại vết (R44, R45) | Fallback luật cứng; nhóm câu riêng trong golden set |

- **Ý nói:** toàn bộ tài liệu có 22 quyết định, ở đây chỉ nêu ba quyết định mà chọn sai thì phải viết lại phần lớn hệ thống. Nói cái giá trước khi có người hỏi.
- **Nguồn:** [ship/01-kien-truc.md](ship/01-kien-truc.md) §9, §11.2.

### Slide 14 · Phần chưa chắc — 1:30

- **Exhibit:** bảng verification còn mức **Chặn**.

  | Mã | Kiểm gì |
  | --- | --- |
  | V-A1 | Gọi `InvokeHarness` bằng Bearer JWT |
  | V-A6 | Token exchange RFC 8693 trên Keycloak |
  | V-A4 | Stream của Harness dịch được sang 11 sự kiện SSE |
  | V-A9 | Cedar kiểm được điều kiện số học |
  | V-K3 | AWS SDK for .NET gửi được `managedSearchConfiguration` |
  | V-K4 | Connector đọc sidecar và filter lọc đúng `scope_key` |
  | V-K6 | Reranker có sẵn của MKB có đủ tốt so với Cohere Rerank 3.5 |

- **Chú thích:** "Đã có câu trả lời: V-K2, V-K5, V-A10". Chứng tỏ danh sách đang ngắn dần.
- **Ý nói:** chưa bật billing nên chưa gọi thật được lần nào. Bỏ vector store tự dựng thì không còn fallback viết sẵn cho `Retrieve`. Trượt verification nào thì đưa quyết định tương ứng lại lên bàn ngay trong tuần 1.
- **Nguồn:** [ship/01-kien-truc.md](ship/01-kien-truc.md) §11.1; [ship/README.md](ship/README.md).

### Slide 15 · Việc cần chốt — 1:00

- **Exhibit:** bảng tên người, việc và hạn. Lấy từ [21-kich-ban-trinh-bay.md](21-kich-ban-trinh-bay.md) slide 6 và cập nhật theo ship 2.0.

  | Ai | Chốt gì |
  | --- | --- |
  | Sếp | Q4 topology và ngân sách; Q1 hồ sơ chuyển dữ liệu cá nhân ra nước ngoài (Luật 91/2025, Nghị định 356) |
  | DevOps | Bật billing, mở quyền dùng mô hình Claude và embedding |
  | Backend | Nhận V-A1, V-K3 |
  | Frontend | Hợp đồng SSE ở [ship/02-hop-dong.md](ship/02-hop-dong.md), đã freeze |

- **Ý nói:** đọc từng dòng và nhìn đúng người phụ trách. Hạn cụ thể điền theo ngày bắt đầu dự án.

### Slide 16 · Kết luận — giữ trên màn hình suốt Q&A

- **Chữ trên slide:**
  - Con số đến từ engine, citation đến từ điều khoản, không đến từ mô hình
  - Hàng rào nằm ngoài mô hình: scope filter, guardrail, ToolGate, validator
  - Cái giá: thêm latency, thêm hạ tầng AWS, còn bảy verification phải chạy
  - Tài liệu: `ship/README.md` (thứ tự đọc cho từng vai)
- **Lời mời:** "Có câu hỏi hay góp ý gì cho thiết kế không?"
- **Không có** slide "Cảm ơn" phía sau.

### References

- `ship/01-kien-truc.md` · `ship/02-hop-dong.md` · `ship/10-rui-ro.md` · `ship/11-thuyet-minh.md`
- `ship/00-thuat-ngu-va-nguon.md` Phần F: tài liệu AWS (Bedrock, Managed Knowledge Base, AgentCore, Guardrails, Evaluations) kèm ngày fetch
- Luật 91/2025/QH15, Nghị định 356

---

## Phụ lục (chỉ mở khi có người hỏi)

| Mã | Action title | Nguồn |
| --- | --- | --- |
| A1 | Hỏi "sao không dùng ChatGPT": số đến từ engine, tài liệu nội bộ không rời tài khoản công ty | [21](21-kich-ban-trinh-bay.md) phụ lục A |
| A2 | Hỏi "8 tuần có kịp không": không hứa kịp, có gate G3 cuối tuần 4 đo bằng số trên golden set | [11-lo-trinh.md](11-lo-trinh.md) |
| A3 | Hỏi "tốn bao nhiêu": chưa đo được, có công thức theo số lượt và kích thước ngữ cảnh; bật Budgets trước khi tăng lưu lượng | [06-tang-bedrock.md](06-tang-bedrock.md) §10 |
| A4 | Hỏi "dữ liệu đi đâu": Bedrock ở Frankfurt, route trong 6 region EU, không dùng để huấn luyện; người dùng Việt Nam vướng Luật 91 | ship/01 §2, AD-03, AD-14 |
| A5 | Hỏi "sao không tự dựng": mua hay tự làm xét theo từng thành phần; chunking theo điều khoản vẫn tự làm | AD-17 |
| A6 | Đủ 22 quyết định kiến trúc kèm phương án đã loại | ship/01 §9 |
| A7 | Sơ đồ triển khai và danh sách VPC endpoint | ship/01 §7 |
| A8 | Bảng thuật ngữ: LLM, RAG, embedding, SSE, guardrail, tool calling | ship/00, ship/11 Phần 12 |

**Không đưa lên màn hình chính:** bảng 22 AD, bảng 47 rủi ro, sơ đồ bên trong `Assistant.Api`. Gửi [ship/01-kien-truc.md](ship/01-kien-truc.md) trước buổi họp một ngày.

---

## Khác gì so với kịch bản 21

| Kịch bản 21 (6 slide) | Dàn ý này (16 slide) | Vì sao |
| --- | --- | --- |
| Tiêu đề slide là chủ đề ("Pain point", "Sơ đồ") | Tiêu đề là câu khẳng định | Ghost deck test: đọc tiêu đề là hiểu lập luận |
| Một slide sơ đồ, không đi vào từng nhánh | Sơ đồ gốc + ba slide cho ba nhánh + một slide post-validation | Mục tiêu "dễ hiểu": mỗi slide một ý |
| Bảng verification còn V-K2, V-K5 | V-K2, V-K5, V-A10 đã có câu trả lời; thêm V-A4, V-A9, V-K6 | Theo ship 2.0 |
| Kết bằng bảng chữ ký | Bảng chữ ký ở slide 15, slide kết luận để lại trong lúc Q&A | Theo quy tắc của skill: kết luận là slide cuối |

**Nếu thiếu giờ:** cắt slide 10 và 12 trước, rồi gộp 8 và 9. Không cắt slide 3, 5, 13, 14.
