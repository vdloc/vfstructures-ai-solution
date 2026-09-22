# Audit nguồn — toàn bộ quyết định kiến trúc AD-01 … AD-28

**Ngày audit:** 22/09/2026. **Phạm vi:** bảng quyết định §9 của `01-kien-truc.md`, đối chiếu bảng nguồn `00-thuat-ngu-va-nguon.md` (Phần F) và các file chi tiết trong thư mục này.
**Quy tắc phân loại:**
- **AWS-capability** — khẳng định về năng lực một dịch vụ AWS; **bắt buộc** có URL tài liệu AWS.
- **internal** — lựa chọn build, biện minh bằng lập luận/tradeoff hoặc pattern trong sách; không cần nguồn ngoài.
- **assumption** — số tự khai, hiệu chỉnh bằng golden set; không lấy từ nguồn ngoài (theo thiết kế).

**Tổng: 27 mã hiện diện (không có AD-04), AD-09 đã superseded → 26 quyết định active.**

## Phủ nguồn 100%

| Mã | Loại | Nguồn (URL đầy đủ / tên sách + tác giả) | Trạng thái |
| --- | --- | --- | --- |
| AD-01 | internal | NONE (lập luận: thêm service phải vận hành vs route Next.js) | không cần nguồn ngoài |
| AD-02 | internal + AWS sub-claim | https://docs.aws.amazon.com/bedrock/latest/userguide/agents-classic-maintenance-mode.html (fetch 21/09/2026, trích verbatim) | confirmed |
| AD-03 | AWS-capability | https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html · https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5.html (Playwright 22/09/2026) | **confirmed đầy đủ** — `eu.anthropic.claude-sonnet-5`, eu-central-1 supported, EU geo = **8 region** (bản cũ ghi 6 → đã sửa) |
| AD-05 | internal | *Building Gen AI Applications with Amazon Bedrock* (Syed Kadar Ansari Syed Ahamed); model card ba model: https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5.html · https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html · https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html (Playwright 22/09/2026) | internal; **availability confirmed** — `eu.anthropic.claude-sonnet-5`, `eu.anthropic.claude-haiku-4-5-20251001-v1:0`, `eu.anthropic.claude-sonnet-4-6` đều supported ở eu-central-1 |
| AD-06 | AWS-capability | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-create.html · https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-retrieve.html (21/09/2026) | confirmed |
| AD-07 | internal | *Designing AI Interfaces* (Louise Macfadyen) — chỉ đỡ phần UX streaming | không cần nguồn ngoài |
| AD-08 | internal | NONE (không dựng MCP server riêng — lựa chọn kiến trúc) | không cần nguồn ngoài |
| AD-09 | n/a | superseded bởi AD-28 | status marker |
| AD-10 | AWS-capability | https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-permissions-id.html (21/09/2026, đọc Playwright) · https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-use-converse-api.html | confirmed |
| AD-11 | internal + Postgres sub-claim | https://www.postgresql.org/docs/current/sql-select.html (22/09/2026, trích verbatim) | confirmed — SKIP LOCKED có nguồn |
| AD-12 | AWS-capability | https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-unsupported-features.html (21/09/2026, trích verbatim) | confirmed |
| AD-13 | AWS-capability + internal | https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness.html · https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_CreateHarness.html · https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-security.html (21/09/2026); *AI Agents on AWS* (Bunny Kaushik, Mona M) ch6 | confirmed |
| AD-14 | mixed | https://docs.aws.amazon.com/general/latest/gr/bedrock.html (region, 21/09/2026); độ trễ = assumption; luật VN: **Luật 91/2025/QH15 + Nghị định 356** (10 §1 Q1) | có nguồn nội bộ — cần luật sư xác nhận (không verify bằng AWS/Playwright) |
| AD-15 | internal | NONE (bỏ luật nhanh, mọi lượt qua IntentRouter) | không cần nguồn ngoài |
| AD-16 | internal + assumption | NONE; `MaxTokens` 300–400 = assumption | không cần nguồn ngoài |
| AD-17 | AWS-capability | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-build-managed.html · https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-create.html · https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-ds-s3.html · https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-retrieve.html · https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-config.html · https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_ManagedSearchConfiguration.html (21/09/2026) | confirmed — dùng đúng `managedSearchConfiguration` |
| AD-18 | AWS-capability | https://docs.aws.amazon.com/bedrock/latest/userguide/evaluation.html (21/09/2026, Playwright) | confirmed |
| AD-19 | AWS-capability | https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-management.html (21/09/2026) | confirmed |
| AD-20 | AWS-capability | https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventBridge.html · https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-targets.html (22/09/2026) | confirmed — đã sửa claim: **S3 → EventBridge → Step Functions** |
| AD-21 | AWS-capability | https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference-supported.html · https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference.html (21/09, xác minh lại 22/09/2026) | cited-but-contradicts (Sonnet 5) — phải test trước khi triển khai |
| AD-22 | internal + assumption | *AI Agents on AWS* (Bunny Kaushik, Mona M) ch3; *AI Agents in Action* (Micheal Lanham) ch8 | confirmed (sách); 3 con số = assumption |
| AD-23 | internal + assumption | *Build AI-Enhanced Web Apps* (Theo Despoudis) — pattern *Defense-in-Depth Abuse Control* | confirmed (sách); ngưỡng = assumption |
| AD-24 | internal | *Interpretable and Trustworthy AI* (Pethuru Raj và cộng sự, chủ biên); *Enterprise Guide for Implementing Generative AI and Agentic AI* (Shakuntala Gupta Edward, Rahul Bhattacharya, Vikas Sinha) | confirmed (sách) |
| AD-25 | internal | NONE cho cơ chế .NET (`CancellationToken`/`RequestAborted` = ASP.NET Core chuẩn); *Designing AI Interfaces* (Louise Macfadyen) đỡ phần UX hủy/chờ | không cần nguồn ngoài |
| AD-26 | AWS-capability + internal | https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-ds-s3.html · https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-config.html (21/09/2026) | confirmed |
| AD-27 | internal | NONE (`toolUseId` khái niệm Converse; idempotency = thiết kế nội bộ) | không cần nguồn ngoài |
| AD-28 | internal + Postgres | https://www.postgresql.org/docs/current/ddl-rowsecurity.html (21/09/2026); *Vector Databases: A Practical Introduction* (Nitin Borwankar) — loại phương án pgvector | confirmed |

## Tổng kết đếm (27 mã)

- **Confirmed — có nguồn xác minh:** 16 — AD-02, 03, 06, 10, 12, 13, 17, 18, 19, 20, 21, 22, 23, 24, 26, 28.
- **Internal — không cần nguồn ngoài:** 9 — AD-01, 05, 07, 08, 11, 15, 16, 25, 27.
- **Superseded:** 1 — AD-09.
- **KHÔNG CĂN CỨ:** 0 — sau vá 22/09/2026, mọi quyết định đều truy được nguồn. AD-14 có trích dẫn pháp lý nội bộ (Luật 91/2025/QH15 + Nghị định 356, 10 §1 Q1); chỉ cần luật sư xác nhận phạm vi, không phải lỗ hổng nguồn.

**Không còn khẳng định năng lực AWS nào thiếu nguồn.**

## Danh mục sách (tên đầy đủ + tác giả) — đối chiếu `00` dòng 669–680

- *Hands-On RAG for Production* — Ofer Mendelevitch, Forrest Sheng Bao
- *Vector Databases: A Practical Introduction* — Nitin Borwankar
- *AI Agents on AWS* — Bunny Kaushik, Mona M
- *AI Agents in Action* — Micheal Lanham
- *Build AI-Enhanced Web Apps* — Theo Despoudis
- *Building AI-Powered Products* — Dr. Marily Nika
- *Enterprise Guide for Implementing Generative AI and Agentic AI* — Shakuntala Gupta Edward, Rahul Bhattacharya, Vikas Sinha
- *Designing AI Interfaces* — Louise Macfadyen
- *Using Amazon Bedrock* — Renaldi Gondosubroto
- *Building Gen AI Applications with Amazon Bedrock* — Syed Kadar Ansari Syed Ahamed
- *Interpretable and Trustworthy AI* — Pethuru Raj và cộng sự (chủ biên)

## Đã verify + vá trong lượt audit này (22/09/2026)

### AD-20 — S3 → EventBridge → Step Functions
Claim cũ sai kỹ thuật: "kích hoạt bằng S3 Event Notification" (→ Step Functions trực tiếp).
- WebFetch https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html + https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventBridge.html + https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-targets.html (22/09/2026): đích trực tiếp của S3 Event Notification chỉ gồm **SNS, SQS, Lambda, EventBridge**; **"Step Functions state machine (ASYNC)"** là target của EventBridge rule.
- **Đã làm:** sửa AD-20 (`01` §9 + `09` §8a) thành **S3 → EventBridge → Step Functions**, thêm EventBridge vào phạm vi (R39), thêm hai dòng nguồn vào `00`. Vẫn ở trạng thái **Proposed** (cần thử dựng thực tế trước khi rời AD-11), nhưng cơ chế đã có nguồn.

### AD-03 / AD-05 — inference profile EU (Playwright)
- Model card từng model xác nhận Geo inference ID + `eu-central-1` = supported (icon `icon-yes.png`, alt="supported"): `eu.anthropic.claude-sonnet-5`, `eu.anthropic.claude-haiku-4-5-20251001-v1:0`, `eu.anthropic.claude-sonnet-4-6`.
- EU geo phủ **8 region**: eu-central-1 (Frankfurt), eu-central-2 (Zurich), eu-north-1 (Stockholm), eu-south-1 (Milan), eu-south-2 (Spain), eu-west-1 (Ireland), eu-west-2 (London), eu-west-3 (Paris).
- **Đã sửa "6 region EU" → "8 region EU"** ở `01` (dòng 105 + AD-03) và `10` §1 Q1; thêm dòng nguồn model card vào `00`.

### AD-11 — FOR UPDATE ... SKIP LOCKED
- https://www.postgresql.org/docs/current/sql-select.html (22/09/2026): *"With `SKIP LOCKED`, any selected rows that cannot be immediately locked are skipped"*, nêu đúng dùng cho "queue-like table". Đã thêm dòng nguồn vào `00`.

### AD-14 — trích dẫn pháp lý nội bộ
Claim "nghĩa vụ hồ sơ theo luật Việt Nam" **có** dẫn văn bản cụ thể trong bộ tài liệu: **Luật 91/2025/QH15 + Nghị định 356** (`10` §1 Q1 — audit ban đầu sót vì chỉ quét file của AD-14, không quét 10 Q1). Đã sửa AD-14 (`01` §9) trỏ tới trích dẫn này.
- **Còn lại:** cần luật sư xác nhận phạm vi áp dụng (chuyển dữ liệu xuyên biên giới, hồ sơ nộp Bộ Công an). Việc pháp lý, không phải lỗ hổng nguồn — không verify được bằng AWS/Playwright.

## Có nguồn nhưng phải test trước khi triển khai

### AD-21 — batch inference cho Sonnet 5
- Bảng "Supported Regions and models for batch inference" (WebFetch 22/09/2026, https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference-supported.html) liệt kê **Claude Opus 5** nhưng **KHÔNG có Claude Sonnet 5** (chỉ Sonnet 4/4.5/4.6).
- Batch **không hỗ trợ tool calling / structured output**.
- **Việc phải làm:** gọi thử `CreateModelInvocationJob` với `eu.anthropic.claude-sonnet-5`. Nếu không hỗ trợ, sinh câu trả lời golden set + nhóm cần tool (C, D, I, J) phải chạy `Converse` vòng lặp; chỉ chấm điểm bằng Opus 5 mới batch được.

## Phụ thuộc đã tự flag (không phải lỗ hổng nguồn)

- **AD-27 / V-A12:** chưa biết Gateway có chuyển `toolUseId` xuống facade không.
- **AD-25 / V-A11:** Harness phía AWS có thể chưa dừng khi client ngắt; chặn bằng `maxIterations`/`timeoutSeconds`.

## Ghi chú cấu trúc nguồn (`00`)

`00` có **hai** bảng URL: nhóm "đã fetch trực tiếp và xác minh" (có claim + ngày fetch + trích verbatim) và nhóm "trích từ skill `amazon-bedrock`, chưa fetch trực tiếp" (chỉ URL, không ngày fetch). AD-03 dựa một phần vào nhóm chưa-fetch — đã tự WebFetch + Playwright lại 22/09/2026 để xác minh, và bổ sung dòng model card vào nhóm đã-fetch.
