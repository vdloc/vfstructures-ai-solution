# Kiến trúc VF Structures AI Assistant — các step trong một lượt hỏi

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/`
(`01-kien-truc-tong-the.md`, `02-assistant-service.md`, `03-rag.md`, `04-tool-calling.md`, `kien-truc-day-du.md`)

---

## 1. Sơ đồ luồng một lượt hỏi

```mermaid
flowchart TB
  START(["Kỹ sư gửi câu hỏi"]) --> S1

  subgraph GATE["Cổng vào"]
    S1["1 · POST /v1/chat<br/>BFF proxy → Assistant.Api"]
    S2{"2 · Middleware<br/>rate limit · JWT/JWKS · quota"}
    S1 --> S2
  end

  S2 -->|"trượt"| REJ["Rejected"]
  S2 -->|"qua"| S3

  subgraph PREP["Chuẩn bị ngữ cảnh"]
    S3["3 · AccessScopeResolver<br/>scope đọc ← Authorization + Payment API"]
    S4["4 · ConversationStore<br/>lịch sử rút gọn ← PostgreSQL"]
    S3 --> S4
  end

  S4 --> S5{"5 · IntentRouter<br/>Claude Haiku 4.5 hoặc luật"}

  S5 -->|"out_of_scope"| REF["Refused"]
  S5 -->|"doc_qa · app_help"| R1
  S5 -->|"calc · mixed · optimize"| T1
  S5 -->|"case_lookup"| C1

  subgraph RAG["6a · Đường RAG — Retrieving"]
    R0["ClauseResolver giải mã điều khoản<br/>nếu câu hỏi có mã"] -.-> R1
    R1["Tìm rộng: Bedrock MKB Retrieve<br/>40 chunk, lọc scope_key + status"]
    R2["Chọn hẹp: Bedrock Rerank<br/>→ 8 chunk tốt nhất"]
    R3{"điểm ≥ ngưỡng?"}
    R1 --> R2 --> R3
  end

  R3 -->|"không"| REF

  subgraph TOOL["6b · Vòng lặp tool — ToolLoop"]
    T1["AgentCore Harness<br/>mô hình phát tín hiệu gọi hàm"]
    T2["AgentCore Gateway<br/>Cedar policy + đổi token"]
    T3["Tool facade — 6 lớp gate"]
    G1["L1 schema"] --> G2["L2 quyền gọi tool"] --> G3["L3 khoảng giá trị"]
    G3 --> G4["L4 ⚠ đơn vị đo bắt buộc"] --> G5["L5 chống gọi lặp > 2"] --> G6["L6 ⚠ mã lỗi ẩn trong response 200"]
    T4["Main API — engine tính toán<br/>gọi bằng token người dùng"]
    T1 --> T2 --> T3 --> G1
    G6 --> T4
  end

  subgraph CASE["6c · Case memory"]
    C1["CaseMemoryService<br/>tra tình huống đã tính đạt, RLS trên PostgreSQL"]
  end

  R3 -->|"đủ căn cứ"| S7
  T4 -->|"verdict pass thì ghi case"| S7
  T4 -.->|"quá vòng/thời gian<br/>hoặc tool lỗi 2 lần"| DEG
  C1 --> S7

  S7["7 · Generating<br/>ILlmClient → Bedrock ConverseStream<br/>Claude Sonnet 5 + Guardrails"]
  S7 -.->|"Bedrock lỗi giữa chừng"| DEG["Degraded<br/>trả danh sách nguồn đã truy xuất"]
  S7 --> S8

  S8{"8 · Validating<br/>CitationValidator + NumberValidator"}
  S8 -->|"khớp"| OK["Completed"]
  S8 -->|"không khớp"| UNV["CompletedUnverified"]
  DEG --> OK

  OK --> S9
  UNV --> S9
  REF --> S9
  REJ --> S9

  S9["9 · SSE writer → client"] --> S10
  S10[("10 · Ghi message · retrieval_log<br/>tool_run · audit_event<br/>PostgreSQL assistant")]
  S10 --> END(["Hết lượt"])

  classDef danger fill:#ffe0e0,stroke:#c62828,color:#000
  classDef term fill:#f0f0f0,stroke:#9e9e9e,color:#333
  classDef aws fill:#fff4e0,stroke:#ef6c00,color:#000
  class G4,G6 danger
  class REJ,REF,OK,UNV,DEG term
  class R1,R2,T1,T2,S7 aws
```

**Đọc sơ đồ**

- Cam = dịch vụ AWS (Bedrock, AgentCore)
- Đỏ = hai lớp gate nguy hiểm nhất — sai mà màn hình vẫn trông hợp lý
- Xám = trạng thái kết thúc; mọi đường đều đổ về step 10, kể cả khi lỗi
- Nét đứt = đường chịu lỗi hoặc phụ trợ

---

## 2. Bảng step

| # | Step | Thành phần | Kết cục xấu |
| --- | --- | --- | --- |
| 1 | Nhận `POST /v1/chat` | BFF proxy → Assistant.Api | — |
| 2 | Middleware: rate limit → JWT (JWKS Keycloak) → quota | Middleware | `Rejected` |
| 3 | Giải scope đọc của user | `AccessScopeResolver` (Authorization API + Payment API) | — |
| 4 | Lấy lịch sử hội thoại rút gọn | `ConversationStore` (PostgreSQL) | — |
| 5 | Định tuyến ý định | `IntentRouter` — Claude Haiku 4.5 hoặc luật | `out_of_scope` → `Refused` |
| 6 | Rẽ nhánh theo intent | `doc_qa`/`app_help` → RAG · `calc`/`mixed`/`optimize` → tool loop · `case_lookup` → case memory | — |
| 7 | Sinh câu trả lời (stream) | `ILlmClient` → Bedrock ConverseStream + Guardrails, Claude Sonnet 5 | `Degraded` khi Bedrock lỗi |
| 8 | Kiểm lại đầu ra | `CitationValidator` + `NumberValidator` | `CompletedUnverified` khi trích dẫn/số không khớp |
| 9 | Đẩy SSE về client | SSE writer | — |
| 10 | Ghi `message`, `retrieval_log`, `tool_run`, `audit_event` | PostgreSQL assistant | luôn ghi, kể cả khi lỗi |

**State machine**

`Received → Routing → {Retrieving | ToolLoop | CaseLookup} → Generating → Validating → Completed`

Nhánh phụ: `Rejected`, `Refused`, `AskBack`, `Degraded`, `CompletedUnverified`, `Aborted`.

---

## 3. Sáu lớp gate của tool facade

Đường đi: `Assistant.Api → AgentCore Harness → AgentCore Gateway (Cedar + đổi token) → tool facade → Main API`

| Lớp | Kiểm gì |
| --- | --- |
| 1 | Đúng khuôn dạng tham số (schema) |
| 2 | Người dùng có quyền gọi công cụ này không |
| 3 | Giá trị tham số nằm trong khoảng hợp lệ đã khai báo |
| 4 | **Đơn vị đo bắt buộc phải có** — thiếu đơn vị thì từ chối, không suy diễn |
| 5 | Chống gọi lặp — cùng công cụ, cùng tham số, quá hai lần thì dừng |
| 6 | **Đọc đúng mã lỗi thật ẩn trong phản hồi thành công của Main API** |

Lớp 4 và 6 nguy hiểm hơn bốn lớp còn lại: cả hai đều là điểm hệ thống có thể sai mà kết quả vẫn trông hợp lý trên màn hình.

---

## 4. Ba tầng mô hình

| Việc | Mô hình | Lý do |
| --- | --- | --- |
| Phân loại câu hỏi, viết lại, bóc tham số | Claude Haiku 4.5 | Chạy trên mọi lượt hỏi, cần nhanh và rẻ |
| Trả lời chính, vòng lặp gọi hàm | Claude Sonnet 5 | Việc cần chất lượng suy luận cao nhất |
| Đường dự phòng khi mô hình chính lỗi | Claude Sonnet 4.6 | Giữ lượt hỏi hoàn thành thay vì gãy hẳn |

---

## 5. Bảy luồng toàn hệ thống

| Luồng | Kích hoạt bởi | Mô tả | Tài liệu gốc |
| --- | --- | --- | --- |
| F1 | Kỹ sư gửi câu hỏi | Hỏi đáp có dẫn chứng (RAG) | `02`, `03` |
| F2 | Gửi câu hỏi / bấm "Hỏi AI" trên trang tính toán | Vòng lặp tool tính toán | `04` |
| F3 | Engine tính đạt một cấu kiện | Tự ghi case + tra tình huống (case memory) | `ship/12` |
| F4 | Kỹ sư tri thức tải tài liệu | Nạp và cập nhật kho tài liệu | `03` |
| F5 | Chấm tốt/xấu | Phản hồi → bổ sung bộ eval | `09` |
| F6 | Pull request đổi prompt/retrieval/tool | Eval gate trong CI, chặn merge khi chất lượng lùi | `09` |
| F7 | Lịch định kỳ | Quota, quan sát, retention, audit | `07`, `09` |
