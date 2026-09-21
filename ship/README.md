# AI Assistant cho VF Structures — bộ tài liệu bàn giao

**Phiên bản 2.0 · Trạng thái: sẵn sàng bàn giao**

---

## Đọc gì

| # | File | Ai đọc | Trả lời câu hỏi gì |
| --- | --- | --- | --- |
| 00 | [Thuật ngữ và nguồn](00-thuat-ngu-va-nguon.md) | Tất cả | Mỗi từ lạ nghĩa là gì, vì sao hệ thống cần nó, quyết định dựa trên nguồn nào |
| 01 | [**Kiến trúc tổng thể**](01-kien-truc.md) | Tất cả — **điểm vào của bộ** | Vì sao hệ thống có hình dạng này, nó gồm gì, chạy thế nào, 27 quyết định kiến trúc (mã tới AD-28). Mỗi mục có đường dẫn sang file con giữ chi tiết |
| 02 | [Hợp đồng API](02-hop-dong.md) | **Backend + Frontend cùng ký** | Endpoint, schema, 11 SSE event, mã lỗi |
| 03 | [Thi công Backend](03-backend.md) | Backend | Sáu bước, nghiệm thu từng bước, rủi ro phải canh |
| 04 | [Thi công Frontend](04-frontend.md) | Frontend | Dựng UI từ 11 event, trạng thái phải xử lý |
| 05 | [Thi công DevOps](05-devops.md) | DevOps AWS | Bedrock, MKB, AgentCore, network, quan sát |
| 06 | [Bảo mật và phân quyền](06-bao-mat.md) | Backend, DevOps, pháp chế | Ai đọc được gì, chặn lạm dụng, chống prompt injection |
| 07 | [Giao diện](07-giao-dien.md) | Frontend, thiết kế | Hiện gì khi hệ thống không chắc, khi chờ, khi từ chối |
| 08 | [Đánh giá và quan sát](08-eval-quan-sat.md) | Backend, DevOps, kỹ sư tri thức | Đo chất lượng bằng gì, theo dõi gì khi chạy thật |
| 09 | [Triển khai](09-trien-khai.md) | DevOps | Topology, môi trường, CI/CD, phát hành |
| 10 | [Rủi ro và câu hỏi mở](10-rui-ro.md) | Tất cả | Cái gì có thể hỏng, cái gì chưa ai biết |
| 11 | [Thuyết minh](11-thuyet-minh.md) | Người không chuyên | Toàn bộ hệ thống giải thích bằng lời thường |
| 12 | [Tra case](12-tra-case.md) | Backend, DevOps, Frontend | Case là cấu hình JSON đã tính đạt (AD-28); tra thế nào; vì sao không dùng OpenSearch |
| 13 | [Chi phí](13-chi-phi.md) | Lãnh đạo, DevOps, Backend | Đơn giá thật ở Frankfurt, chi phí một lượt, ba kịch bản, đòn bẩy giảm chi phí |
| 14 | [Chi tiết cài đặt Backend](14-chi-tiet-backend.md) | Backend | Cấu trúc solution, mã mẫu cho từng lời gọi AWS, SQL |
| 15 | [Chi tiết cài đặt DevOps](15-chi-tiet-devops.md) | DevOps AWS | Hạ tầng dưới dạng CDK, IAM, KMS, mạng, quan sát, chi phí |
| — | [Hồ sơ đề xuất cho lãnh đạo/CTO](../kien-truc-day-du.md) | Ban lãnh đạo, CTO, Giám đốc Kỹ thuật | Vì sao xây, vận hành thế nào, chi phí và rủi ro — hồ sơ trình duyệt đầu tư, song song bộ này |

**Thứ tự đọc lần đầu**

| Bạn là | Đọc theo thứ tự |
| --- | --- |
| Lãnh đạo, CTO — cần quyết định đầu tư | [Hồ sơ đề xuất](../kien-truc-day-du.md) |
| Quản lý, không chuyên kỹ thuật | 11 → 10 mục 1 |
| Backend | 01 mục 1–5 → 02 → 03 → 06 |
| Frontend | 11 → 02 → 04 → 07 |
| DevOps | 01 mục 7 → 05 → 09 → 06 |
| Gặp từ lạ ở bất kỳ file nào | 00 |

Tranh cãi về "hệ thống phải như thế nào" thì **01 thắng**. Tranh cãi về "hai đội nói chuyện thế nào" thì **02 thắng**. Bản hiện tại là v1.1: 11 sự kiện giữ nguyên, phần bổ sung chỉ cộng thêm, hai đội ký lại phần đó.

---

## Trạng thái thật

**Chưa có dòng code nào chạy.** Tài khoản AWS hiện có là tài khoản đăng ký trải nghiệm, chưa bật billing, nên **chưa có số đo nào**. Mọi con số về latency và chi phí trong bộ này là dự toán hoặc lấy từ tài liệu AWS.

Bộ tài liệu ghi rõ chỗ nào là số đo, chỗ nào là ước lượng, và chỗ nào chưa kiểm chứng. Xem [00 · phần "Chưa kiểm chứng được"](00-thuat-ngu-va-nguon.md).

---

## Verification chặn

Ba verification **đã trả lời** bằng tài liệu AWS đọc trực tiếp — xem [00](00-thuat-ngu-va-nguon.md):

- **V-K2** — MKB có ở `eu-central-1`.
- **V-K5** — MKB **luôn tìm hybrid** và không có `overrideSearchType`, nên không còn gì để kiểm.
- **V-A10** — Harness ở chế độ VPC **không cần NAT gateway** để kéo image; cần endpoint `ecr.dkr`, `ecr.api`, `s3`, `bedrock-runtime`.

Fetch trực tiếp cũng làm lộ ra **V-K6**: MKB kèm sẵn một reranker không tính thêm tiền, nên phải đo trước khi trả tiền cho Cohere Rerank. Reranker này **chỉ dùng được khi KB dùng embedding do AWS quản**, nên V-K6 gắn với quyết định embedding (AD-06).

Năm mã còn mở ở bảng dưới. [01](01-kien-truc.md) mục 11.1 còn liệt kê thêm V-A4 và V-A9 ở mức Chặn. Trượt cái nào thì đưa quyết định tương ứng lại lên bàn **ngay**, không đi tiếp.

| Mã | Kiểm gì | Của ai | Trượt thì |
| --- | --- | --- | --- |
| V-A1 | .NET gọi `InvokeHarness` bằng Bearer JWT | Backend | Bỏ AgentCore, về tool loop C# (đã thiết kế sẵn) |
| V-A6 | Keycloak bật token exchange RFC 8693, audience khớp | DevOps | Như trên |
| V-K3 | AWS SDK for .NET có `MANAGED` và `MANAGED_KNOWLEDGE_BASE_CONNECTOR`, và gửi được `managedSearchConfiguration` | Backend | AD-17 lên bàn lại |
| V-K4 | Managed S3 connector đọc được sidecar và filter được — **kiểm đủ ba đường có thể hỏng im lặng**, gồm hai điều tài liệu chưa nói: thuộc tính thiếu thì rỗng hay lỗi, `startsWith`/`stringContains` thì lỗi hay bị bỏ qua | DevOps | AD-17 lên bàn lại |
| V-K6 | So reranker quản lý sẵn của MKB (**không tính thêm tiền**, chỉ với embedding `MANAGED`) với Cohere Rerank 3.5 | Backend | Giữ Cohere Rerank, chịu thêm chi phí và độ trễ; nếu đã chọn embedding riêng thì chỉ còn đường này |

Hai mã mới, **không chặn**, chỉ ảnh hưởng chi phí và chạy lại an toàn: **V-A11** (hủy đọc stream `InvokeHarness` có dừng tool loop phía AWS không) và **V-A12** (Gateway có chuyển `toolUseId` xuống facade không). V-K3 nay gửi thử `filter` ở **cả hai** vị trí, vì skill `amazon-bedrock` và tài liệu AWS ghi khác nhau ([01](01-kien-truc.md) §11.1).

`Retrieve` của MKB là **hard dependency**: không có fallback viết sẵn.

---

## Bốn điểm đồng bộ

| # | Ai giao | Ai chờ | Mức |
| --- | --- | --- | --- |
| 1 | Backend: hợp đồng [02](02-hop-dong.md) ở trạng thái ký được | Frontend | **Chặn** |
| 2 | Backend: OpenAPI schema của tool facade | DevOps | **Chặn** |
| 3 | Frontend: `pageContext` có `hasResult`, `resultKind`, `calcAt` | Backend | **Chặn** |
| 4 | DevOps: SSE qua đúng tuyến production không bị buffer | Cả hai đội | **Chặn** |

Điểm 2 là **hard sync**: DevOps không tạo được Gateway target nếu thiếu.

---

## Năm nguyên tắc không nhượng bộ

| # | Nguyên tắc | Ép bằng gì |
| --- | --- | --- |
| P1 | AI hỗ trợ kỹ sư, không thay thế kỹ sư | Case chỉ sinh từ thao tác Approve có danh tính và thời điểm |
| P2 | **Model không bao giờ tự tính số** | `NumberValidator`; số chỉ đến từ `tool_run` hoặc citation |
| P3 | **Không có căn cứ thì không có câu trả lời** | Score threshold, refusal trước khi gọi model trả lời |
| P4 | Hàng rào nằm ngoài model | Scope filter, guardrail ở Bedrock, ToolGate. Câu dặn trong prompt **không** phải biện pháp kiểm soát |
| P5 | Leo thang từ rẻ đến đắt | prompt → RAG → tool → case memory. Không fine-tuning |

---

## Ba thứ công ty phải chốt trước khi bắt đầu

Ba câu chặn nặng nhất, trích từ bộ tám câu hỏi mở (Q1–Q8). Bảng gốc, kèm hệ quả của từng câu và mức chặn, ở [10-rui-ro.md](10-rui-ro.md) mục 1.

| Mã | Câu hỏi | Chặn gì |
| --- | --- | --- |
| Q1 | Ai làm hồ sơ đánh giá tác động chuyển dữ liệu cá nhân ra nước ngoài theo Luật 91/2025/QH15 và Nghị định 356? | Chặn. Không tránh được bằng cách chọn region — AWS không có region tại Việt Nam |
| Q2 | Có quyền hợp pháp ingest NF EN và DTU vào corpus nội bộ không? | Chặn toàn bộ nhánh tài liệu |
| Q4 | Nền tảng chạy container ở production, và assistant dùng chung instance PostgreSQL hay tách riêng? | Chặn |

Danh sách đầy đủ ở [10-rui-ro.md](10-rui-ro.md) mục 1.

---

## Quy ước trong bộ này

`[CHẶN]` đội khác không làm được nếu thiếu · `[CHỜ]` đang chờ đội khác · `[CHỜ CHỐT]` phụ thuộc quyết định chưa chốt.

**Về nguồn tham chiếu.** Một dòng **Nguồn** chỉ xuất hiện khi thứ đó đã được kiểm chứng thật — đọc tài liệu AWS trực tiếp, hoặc đọc chương sách. Chỗ nào chưa kiểm chứng được thì ghi thẳng là chưa kiểm chứng.

**Về ngày tháng.** Bộ này **không chứa mốc thời gian**. Thứ tự phụ thuộc ("ai chặn ai") là ràng buộc kiến trúc và có trong tài liệu; lịch cụ thể thuộc kế hoạch dự án, không thuộc thiết kế.

Mỗi file thi công kết bằng bảng **"không bao giờ được làm"**. Đọc bảng đó trước khi review PR của nhau.
