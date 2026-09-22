# Kiến trúc giải pháp AI Assistant — VF Structures

**Phiên bản 1.1 · 19/09/2026 · Đội 5 người · 8 tuần (POC 4 tuần)**

> **Đã cập nhật trong `ship/`.** Bộ này là bản 1.1, đã được thay bằng bộ bàn giao 2.0 ở [`ship/`](ship/README.md). Chỗ nào hai bộ khác nhau thì `ship/` đúng, đặc biệt là AD-28 (case tự ghi khi engine tính đạt, không còn bước duyệt) và việc ToolGate đặt ở facade dù Harness có lifecycle hook.

Bộ tài liệu này đề xuất kiến trúc cho trợ lý AI trong ứng dụng tính toán kết cấu `vfstructures-app`: hỏi đáp tiêu chuẩn có dẫn chứng (RAG), tính toán qua engine hiện có (tool calling) và kho tình huống (case memory). Backend .NET 8, PostgreSQL, Amazon Bedrock. Trình bày theo hướng **sơ đồ trước**: sơ đồ tổng thể ở tài liệu 01, mỗi phần có sơ đồ chi tiết riêng (hơn 60 sơ đồ Mermaid, đã kiểm tra render bằng mermaid-cli 11.17.0, 19/09/2026).

## Đọc theo thứ tự

| # | Tài liệu | Nội dung | Sơ đồ chính |
| --- | --- | --- | --- |
| 00 | [Tổng quan](00-tong-quan.md) | Mục tiêu, phạm vi, giả định, **22 quyết định kiến trúc (AD)**, đối chiếu yêu cầu cuộc họp (§8) | Thang năng lực |
| 01 | [Kiến trúc tổng thể](01-kien-truc-tong-the.md) | **Sơ đồ tổng thể**, bản đồ 7 luồng | System context, container, bản đồ luồng |
| 02 | [Assistant service](02-assistant-service.md) | Một lượt hỏi đáp end-to-end, SSE, định tuyến | Sequence chat, state machine, hợp đồng SSE |
| 03 | [RAG](03-rag.md) | Nạp tài liệu, cắt đoạn, **truy xuất trên Managed Knowledge Base (AD-17)**, schema | Pipeline, sequence truy xuất, ERD |
| 04 | [Tool calling](04-tool-calling.md) | Registry, ToolGate, nhóm rủi ro, explain_result | Tool gate, sequence tool, CI registry |
| 05 | [Case memory](05-case-memory.md) | Ghi nhận tự động khi duyệt, tra tình huống tương tự | Sequence ghi nhận/truy xuất, ERD |
| 06 | [Tầng Bedrock](06-tang-bedrock.md) | **Thông số AWS đã xác minh**, chịu lỗi, guardrail, cache, IAM, chi phí | Định tuyến mô hình, retry/fallback, guardrail |
| 07 | [Xác thực và bảo mật](07-auth-bao-mat.md) | Token, scope, middleware, đe dọa, prompt injection | Sequence token, trust boundary |
| 08 | [Trải nghiệm người dùng](08-ux.md) | Bố cục panel, trạng thái, duyệt, từ chối, streaming | State UI, kiểm chứng trích dẫn |
| 09 | [Eval và quan sát](09-eval-quan-sat.md) | Golden set, cổng CI, telemetry, cảnh báo | Pipeline eval, cây span |
| 10 | [Triển khai](10-trien-khai.md) | Topology, môi trường, credential dev, CI/CD, phát hành | Deployment, CI/CD |
| 11 | [Lộ trình](11-lo-trinh.md) | Phân vai, Gantt 8 tuần, cổng G0–G3, nghiệm thu | Gantt, cổng quyết định |
| 12 | [Rủi ro](12-rui-ro.md) | Câu hỏi mở, 47 rủi ro, cạm bẫy, phần chưa kiểm chứng | — |
| 13 | [Đối chiếu skill](13-doi-chieu-skill.md) | Đã đọc gì trong 13 skill sách, áp dụng gì, sửa gì, cố ý bỏ gì | — |
| 14 | [Giải thích cho người mới](14-giai-thich-cho-nguoi-moi.md) | Mọi công nghệ và thuật ngữ bằng lời đời thường, có ví von và bảng tra | Một sơ đồ đường đi của câu hỏi |
| 15 | [Hỏi đáp từng bước](15-hoi-dap-tung-buoc.md) | Một lượt hỏi đi qua 6 bước, bám một ví dụ; ghi lại câu hỏi đã đặt và câu trả lời | — |
| 16 | [Guideline — Backend](16-guideline-backend.md) | Việc thi công theo 6 bước: phải làm, nghiệm thu, rủi ro, ai đang chờ mình | — |
| 17 | [Guideline — Frontend](17-guideline-frontend.md) | Hợp đồng SSE, luồng giả 4 kịch bản, quy tắc dựng thẻ từ JSON | — |
| 18 | [Guideline — DevOps AWS](18-guideline-devops.md) | Bốn lệnh gọi thử ngày 1, sáu cấu hình Harness, NAT gateway, quota | — |
| 19 | [Đặc tả kiến trúc](19-dac-ta-kien-truc.md) | Chỉ kiến trúc, cấu trúc arc42 12 mục: thành phần, hợp đồng, luồng, dữ liệu, cấu hình, AD, rủi ro | C4 mức 1 và 2, state machine, sequence, ERD, deployment |
| 20 | [Architecture Design Document](20-tai-lieu-thiet-ke-kien-truc.md) | Bản trình duyệt theo chuẩn doanh nghiệp: approver, goals/non-goals, stakeholders và concerns, alternatives, operations, risks, Well-Architected, nhật ký ADR | C4, state machine, sequence, ERD, deployment |
| 21 | [Kịch bản trình bày](21-kich-ban-trinh-bay.md) | Buổi chung 20 phút, 6 slide: lời thuyết minh từng slide, câu hỏi thủ sẵn, thứ tự gửi tài liệu | Không có |
| 22 | [Thuyết minh kiến trúc](22-thuyet-minh-toan-bo-kien-truc.md) | 12 phần giải thích cho người không chuyên: khái niệm nền, sáu khối, ba nhánh, validator, state machine, SSE, phân quyền, bảng thuật ngữ | Không có |

## Tám điều cần công ty quyết định trước khi bắt đầu

1. **Residency, hai khu vực pháp lý:** người dùng ở Việt Nam và Pháp. (a) Sonnet 5 trên `bedrock-runtime` buộc dùng profile `eu.*` (route trong 6 region EU), không có single-region — chấp nhận không? (b) Công ty đặt tại Việt Nam và có người dùng là công dân Việt Nam, nên đưa dữ liệu cá nhân của họ ra nước ngoài cần hồ sơ đánh giá tác động nộp Bộ Công an theo Luật 91/2025/QH15 và Nghị định 356; ai làm, theo lịch nào? ([12](12-rui-ro.md) Q1, [06](06-tang-bedrock.md) §10a)
2. **Bản quyền tiêu chuẩn:** có quyền ingest NF EN/DTU vào kho nội bộ không? ([12](12-rui-ro.md) Q2)
3. **Dữ liệu cá nhân:** lưu hội thoại bao lâu, cơ sở pháp lý nào? ([12](12-rui-ro.md) Q3)
4. **Topology production:** nền tảng chạy container, và assistant dùng chung instance PostgreSQL hay cần instance riêng? ([12](12-rui-ro.md) Q4)
5. **Tài liệu hướng dẫn sử dụng VF:** có ở dạng nạp được không, phiên bản nào? ([12](12-rui-ro.md) Q5)
6. **POC 4 hay 8 tuần**, ngày bắt đầu và hạn nghiệm thu ([12](12-rui-ro.md) Q6, [11](11-lo-trinh.md) §10)
7. **Lưu vết khi có tranh chấp:** giữ bản ghi bất biến cho lượt có phương án được duyệt hay không ([12](12-rui-ro.md) Q7)
8. **Tỉ lệ câu hỏi tiếng Anh so với tiếng Pháp**, để cân trọng số golden set. Giao diện đã chốt chỉ có `fr` và `en`, thị trường mục tiêu là EU ([12](12-rui-ro.md) Q8)

## Ba điểm khác với tài liệu POC trong bộ zip

| Tài liệu POC (zip) | Tài liệu này | Vì sao |
| --- | --- | --- |
| Backend là route API trong Next.js, dùng Vercel AI SDK | Service .NET 8 mới, gọi Bedrock bằng AWS SDK | Đồng nhất với hệ thống hiện có; engine và permission ở .NET. Rủi ro "AI SDK không hỗ trợ profile EU cho embedding" không còn |
| Hybrid search và rerank hoãn sau POC | Truy xuất chạy trên Bedrock Managed Knowledge Base (AD-17); rerank sau cờ tính năng | Theo tiêu chí ưu tiên dịch vụ có sẵn của AWS. Bốn kiểm chứng chặn V-K2 đến V-K5 hạn hết ngày 3 |
| Case memory cần kỹ sư ghi nhận thủ công (GĐ-06) | Ghi nhận tự động khi kỹ sư bấm Duyệt | Loại bỏ giả định rủi ro nhất |

## Quy ước

- Tài liệu viết ở thể **phi cá nhân** (không dùng "bạn"), giữ thuật ngữ tiếng Anh chuẩn ngành (`deploy`, `cache`, `guardrail`, `streaming`).
- Mọi số liệu về độ trễ là **ngân sách mục tiêu**, không phải số đo. Mọi thông số AWS ghi rõ đã xác minh bằng cách nào; mục ghi "xác minh ở M0" chưa được kiểm chứng.
- **Đơn giá chỉ ghi khi tra được từ trang giá chính thức**, kèm ghi chú chưa xác nhận theo vùng ([06](06-tang-bedrock.md) §10). Đơn giá của các mô hình Claude và embedding chưa tra được; dùng AWS Pricing Calculator khi lập dự toán.

## Nguồn

- Bộ tài liệu `vfstructures-ai-docs-2026-09-17.zip` (kiến trúc production, POC, đặc tả Bedrock, nghiên cứu, hệ thống thiết kế) và `kien-truc-solution-architecture-v2.md` (hiện trạng VFSoftware).
- Tài liệu AWS (model card Claude Sonnet 5 và Cohere Embed v4, inference profiles, Knowledge Bases, rerank, AgentCore endpoints) và lệnh `aws bedrock` thực tế, tra ngày 18/09/2026 và **đối chiếu lại toàn bộ ngày 19/09/2026** (danh sách chỗ đã sửa ở [13](13-doi-chieu-skill.md)).
- Đối chiếu với 13 skill sách trong repo `ai-books-skills`, đọc `cheatsheet.md` của cả 13 cuốn, `patterns.md` của 6 cuốn; **chương gốc của cả 13 cuốn** (cả 13 cuốn đọc phần khung, mô hình tư duy, phản mẫu và điểm rút ra; chưa đọc ví dụ mã của 9 cuốn, chưa đọc `glossary.md` và `SKILL.md`). Chi tiết và phần đã sửa ở [13](13-doi-chieu-skill.md).
- Các skill AWS: `amazon-bedrock` (đọc các tệp tham chiếu), `aws-iam` và `aws-observability` (chỉ đọc phần mô tả và bảng định tuyến).
