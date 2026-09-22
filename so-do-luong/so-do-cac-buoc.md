# Sơ đồ các bước

Nguồn dựng sơ đồ ở đầu mỗi tab trong `luong-mot-luot-hoi.html`.

Cú pháp:
- `start: Tiêu đề | Dòng phụ` — node đầu bên trái, rẽ nhánh vào từng hàng
- `row: Nhãn hàng` — bắt đầu một hàng, sau đó mỗi dòng `- Tiêu đề | Dòng phụ` là một node
- `end: Tiêu đề | Dòng phụ` — node cuối bên phải (chỉ khi có một hàng), rẽ nhánh từ node cuối của hàng
- Tiền tố của tiêu đề: `*` bước khác, `!` dừng / từ chối, `?` cần chú ý
- Một tab nhiều sơ đồ: đặt heading `## aws`, `## aws.2`, `## aws.3`…

## 1

```diagram
row:
- 1.1 Đọc ngữ cảnh trang | readPageContext · store
- 1.2 Dựng request | conversationId, message, locale, context
- 1.3 fetch tới BFF | /api/assistant/chat · cookie HttpOnly
- 1.4 BFF gắn Bearer | làm mới token · req.signal
- 1.5 Mở luồng SSE | không buffer
end: *Bước 2 · Middleware | Assistant.Api /v1/chat
```

## 2

```diagram
row:
- 2.1 CORS | whitelist origin
- 2.2 requestId | CorrelationIdMiddleware
- 2.3 Burst theo IP | 5 / 10 giây
- 2.4 JWT | JWKS · aud assistant-api
- 2.5 Module | Assistant.Use
- 2.6 Sliding window | 20 lượt / phút
- 2.7 Kill switch | cấu hình nóng
- 2.8 Một lượt / user | active_turn
- 2.9 Hạn mức ngày | token user + org
end: *Bước 3 + 4 · Chuẩn bị | Task.WhenAll
end: !Từ chối | 401 · 403 · 429 · 503
```

## 3

```diagram
row:
- 3.1 Tra cache | 60 giây, trong tiến trình
- 3.2 Hỏi Payment API | org_id
- 3.3 Hỏi Main API | project của user
- 3.4 Gộp scope | public, org:*, project:*
end: *Bước 6a · Retrieve | filter scope_key IN danh sách
end: *Bước 6c · Tra case | org_id + Row-Level Security
```

## 4

```diagram
row:
- 4.1 Tìm hội thoại | ConversationStore
- 4.2 Đọc message | PostgreSQL
- 4.3 Gom thành lượt | đếm theo lượt (AD-22)
- 4.4 Cửa sổ router | 3 lượt gần nhất
- 4.5 Cửa sổ trả lời | 6 lượt, hoặc 4 lượt + tóm tắt
- 4.6 Tóm tắt lượt cũ | Haiku, khi hơn 6 lượt
end: *Bước 5 · IntentRouter | nhận 3 lượt
end: *Bước 7 · ILlmClient | nhận lịch sử + tóm tắt
```

## 5

```diagram
row:
- 5.1 Dựng prompt | IntentRouter
- 5.2 Gọi Haiku | Bedrock Runtime · structured output
- 5.3 Kiểm đầu ra | lỗi → fallback, degraded_routing
end: *6a · Tìm tài liệu | doc_qa, app_help
end: *6b · Gọi engine | calc, explain_result, mixed, optimize
end: *6c · Tra case | case_lookup
end: !Refused | out_of_scope
```

## 6

```diagram
start: Nhãn từ bước 5 | IntentRouter
row: 6a · Tìm tài liệu
- 6a.1 Phân giải mã | ClauseResolver · pg_trgm
- 6a.2 Tìm rộng 40 | Bedrock MKB · filter scope
- 6a.3 Chọn hẹp 8 | Bedrock Rerank
- 6a.4 Áp ngưỡng | dưới ngưỡng → Refused
- 6a.5 Chunk lân cận | chunk_index ±1
- *Bước 7 | Viết câu trả lời
row: 6b · Gọi engine
- 6b.1 Chọn tool | Harness · Sonnet 5
- 6b.2 Kiểm quyền | Gateway · Cedar
- 6b.3 ToolGate | Tool facade C#
- 6b.4 Tính | Main API
- 6b.5 Đọc kết quả | ghi tool_run · cần thêm → 6b.1
- *Bước 8 | Harness đã viết xong
row: 6c · Tra case
- 6c.1 Gom tham số | cần ≥ 2 key
- 6c.2 Lọc cứng | PostgreSQL · RLS
- 6c.3 Chấm điểm | CaseSimilarityScorer · top 5
- *Bước 7 | Viết câu trả lời
```

## 7

```diagram
row: Đường chính
- 7.1 Dựng prompt | cachePoint · guardContent
- 7.2 Gọi Sonnet 5 | ConverseStream + guardrailConfig
- 7.3 Stream | SSE token
- *Bước 8 | Soát lại
row: Khi lỗi
- SDK retry | tối đa 2 lần
- Fallback | Sonnet 4.6
- !Degraded | chỉ trả danh sách nguồn
```

## 8

```diagram
row:
- 8.1 Soát số | NumberValidator
- 8.2 Soát citation | CitationValidator
- 8.3 Soát "đạt" | VerificationValidator
- 8.4 Phiên bản | standardRef ↔ edition
- 8.5 Grounding | ApplyGuardrail · lớp phụ
end: *Completed | không có cảnh báo
end: ?CompletedUnverified | có warning, không xóa chữ
```

## 9

```diagram
row:
- SSE writer | Assistant.Api
- 9.1 Chuyển tiếp | Next.js BFF · không buffer
- 9.2 Hạ tầng | nginx · ALB · CloudFront
- 9.3 Đọc luồng | fetch + ReadableStream
- 9.4 Dựng giao diện | 11 event
```

## 10

```diagram
start: Mọi đường kết thúc | kể cả Rejected và lỗi
row:
- 10.1 Ghi lượt | message · tool_run · audit_event
- 10.2 Trừ quota | usage · token thực dùng
- 10.3 Mở khóa | xóa active_turn trong finally
- 10.4 Telemetry | OTLP → CloudWatch
```

## aws

```diagram
start: Assistant.Api | IAM role assistant-runtime
row: Gọi mô hình
- VPC endpoint | bedrock-runtime
- Bedrock Runtime | profile eu.* · bắt buộc kèm guardrail
- *Haiku 4.5 · Sonnet 5 | bước 5, bước 7
row: Tìm tài liệu
- VPC endpoint | bedrock-agent-runtime
- Knowledge Base | Retrieve · filter theo scope
- Rerank | 40 → 8 chunk
row: Bộ lọc an toàn
- Guardrails | ApplyGuardrail · guardrailConfig
row: Vòng lặp tool
- AgentCore Harness | InvokeHarness · Bearer JWT
- AgentCore Gateway | Cedar · token exchange
- *Tool facade → Main API | bước 6b
```

## aws.2

```diagram
start: Assistant.Worker | IAM role assistant-ingest
row: Nạp tài liệu
- S3 tài liệu nguồn | chunk + sidecar · SSE-KMS
- KB đồng bộ | đóng vai service role
- KB lưu vector | khóa KMS đặt lúc tạo KB
```

## aws.3

```diagram
start: KMS | khóa customer-managed
row:
- PostgreSQL assistant | hội thoại · tool_run · audit
row:
- S3 tài liệu nguồn | SSE-KMS
row:
- Knowledge Base | kmsKeyArn đặt lúc tạo KB
row:
- Guardrail | --kms-key-id
row:
- CloudWatch Logs | log có thể chứa PII
```
