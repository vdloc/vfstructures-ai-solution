# 01 · Kiến trúc tổng thể

Tài liệu này chứa **sơ đồ tổng thể** và bản đồ các luồng. Mỗi luồng được phóng to ở một tài liệu chi tiết, có liên kết ngay dưới bản đồ.

---

## 1. Bối cảnh hệ thống (System context)

**Sơ đồ 1.1 — System context**

```mermaid
flowchart TB
  ENG["Kỹ sư kết cấu<br/>(người dùng chính)"]
  CURATOR["Kỹ sư phụ trách tri thức<br/>(duyệt tài liệu, chấm eval)"]
  ADMIN["Quản trị viên<br/>(vfstructures-admin)"]

  subgraph VF["Hệ thống VFSoftware"]
    APP["vfstructures-app<br/>+ AI Assistant"]
  end

  KC["Keycloak<br/>(danh tính)"]
  BR["Amazon Bedrock<br/>(eu-central-1, profile eu.*)"]
  AC["Amazon Bedrock AgentCore<br/>(Harness + Gateway + Policy, eu-central-1)"]
  S3["Kho tệp S3 / MinIO<br/>(tài liệu nguồn)"]
  CW["CloudWatch<br/>(log, metric, trace)"]

  ENG -->|"hỏi đáp, tính toán, duyệt"| APP
  CURATOR -->|"nạp tài liệu, bộ câu hỏi"| APP
  ADMIN -->|"quản lý user, quota"| APP
  APP -->|"OIDC + PKCE"| KC
  APP -->|"Converse, Embed, Rerank, Guardrails"| BR
  APP -->|"vòng lặp tool"| AC
  APP -->|"đọc/ghi tài liệu"| S3
  APP -->|"telemetry"| CW
```

---

## 2. Sơ đồ tổng thể (Container diagram)

Màu xanh lá là thành phần **mới**. Màu xám là thành phần **hiện có**, không sửa (trừ hai điểm ghi chú bên dưới sơ đồ).

**Sơ đồ 1.2 — Container diagram tổng thể**

```mermaid
flowchart TB
  subgraph CLIENT["Trình duyệt"]
    UI["vfstructures-app<br/>Panel AI + nút Hỏi AI trên trang tính toán"]
  end

  subgraph NEXT["Next.js (vfstructures-app)"]
    BFF["BFF proxy<br/>đọc cookie HttpOnly, gắn Bearer<br/>chuyển tiếp SSE"]
  end

  subgraph SVC["Backend .NET 8"]
    MAIN["Main API<br/>tính toán + Project"]
    AUTHZ["Authorization API<br/>module và quyền"]
    PAY["Payment API<br/>organization, subscription"]
    FILE["File API<br/>S3 / MinIO"]
    NOTI["Notification API<br/>SignalR"]
    ASSIST["Assistant.Api (MỚI)<br/>orchestrator, RAG, case memory, SSE"]
    FAC["Tool facade C# (MỚI)<br/>ToolGate, gọi Main API,<br/>ghi tool_run"]
    WORKER["Assistant.Worker (MỚI)<br/>ingestion, embedding,<br/>tổng hợp eval"]
  end

  subgraph DATA["Dữ liệu"]
    PGMAIN[("PostgreSQL VFSoftware<br/>hiện có")]
    PGAI[("PostgreSQL assistant (MỚI)<br/>pgvector + FTS")]
    OBJ[("S3 / MinIO<br/>tài liệu nguồn")]
  end

  KC["Keycloak"]

  subgraph AWS["AWS eu-central-1"]
    BRT["Bedrock Runtime<br/>Converse / ConverseStream<br/>InvokeModel (embedding)"]
    BRG["Bedrock Guardrails"]
    BRR["Bedrock Rerank"]
    AGC["AgentCore Harness + Gateway<br/>+ Policy (Cedar)"]
    CW["CloudWatch<br/>Logs, Metrics, Traces"]
  end

  UI -->|"HTTPS"| BFF
  BFF -->|"REST + SSE, Bearer"| ASSIST
  BFF -->|"REST, Bearer"| MAIN
  UI -.->|"WebSocket"| NOTI

  ASSIST -->|"tool calc/tra cứu<br/>chuyển tiếp token người dùng"| MAIN
  ASSIST -->|"quyền module"| AUTHZ
  ASSIST -->|"organization của user"| PAY
  ASSIST -->|"tải tài liệu"| FILE
  ASSIST -->|"đọc/ghi"| PGAI
  WORKER -->|"đọc/ghi"| PGAI
  WORKER -->|"đọc tệp nguồn"| OBJ
  FILE --> OBJ
  MAIN --> PGMAIN
  AUTHZ --> PGMAIN
  PAY --> PGMAIN

  ASSIST -->|"JWKS validate"| KC
  ASSIST --> BRT
  ASSIST --> BRG
  ASSIST --> BRR
  ASSIST -->|"InvokeHarness, Bearer JWT"| AGC
  AGC -->|"tool qua Gateway, token đã đổi"| FAC
  FAC -->|"gọi bằng token người dùng"| MAIN
  FAC -->|"ghi tool_run"| PGAI
  WORKER --> BRT
  ASSIST -->|"OTLP"| CW
  WORKER -->|"OTLP"| CW

  classDef new fill:#dff5e1,stroke:#2e7d32,color:#000
  classDef old fill:#f0f0f0,stroke:#9e9e9e,color:#333
  class ASSIST,WORKER,PGAI new
  class MAIN,AUTHZ,PAY,FILE,NOTI,PGMAIN,OBJ,KC old
```

**Hai điểm chạm vào hệ thống hiện có:**

| Điểm chạm | Thay đổi | Ghi chú |
| --- | --- | --- |
| Keycloak | Thêm audience `assistant-api` vào token của client `vfstructures-app` (audience mapper) | Token cũ vẫn hợp lệ cho các service khác. Hướng cứng hơn là token exchange (RFC 8693), để sau |
| BFF proxy | Thêm route `/api/assistant/*` chuyển tiếp nguyên dạng luồng SSE, tắt buffering | Kiểm tra qua nginx và gateway production ở M0 |

Ngoài hai điểm trên, **Main API không sửa**. Tool gọi các endpoint tính toán hiện có qua HTTP, mang token người dùng.

---

## 3. Bản đồ luồng

Toàn bộ hệ thống là **bảy luồng**. Bảng dưới liệt kê từng luồng, kích hoạt bởi ai, và tài liệu nào chứa sơ đồ chi tiết.

**Sơ đồ 1.3 — Bản đồ các luồng**

```mermaid
flowchart LR
  subgraph TRIGGER["Kích hoạt"]
    T1["Kỹ sư gửi câu hỏi"]
    T2["Kỹ sư bấm Hỏi AI trên trang tính toán"]
    T3["Kỹ sư bấm Duyệt trên thẻ kết quả"]
    T4["Kỹ sư phụ trách tri thức tải tài liệu"]
    T5["Kỹ sư chấm tốt/xấu"]
    T6["Pull request đổi prompt, retrieval, tool"]
    T7["Lịch định kỳ"]
  end

  subgraph FLOW["Luồng"]
    F1["F1 Hỏi đáp có dẫn chứng (RAG)"]
    F2["F2 Gọi tool tính toán / kiểm định"]
    F3["F3 Ghi nhận và tra tình huống"]
    F4["F4 Nạp và cập nhật tài liệu"]
    F5["F5 Phản hồi và cải tiến"]
    F6["F6 Đánh giá tự động (eval gate)"]
    F7["F7 Vận hành: quota, quan sát, retention"]
  end

  T1 --> F1
  T1 --> F2
  T2 --> F2
  T3 --> F3
  T4 --> F4
  T5 --> F5
  T6 --> F6
  T7 --> F7
  F1 -.->|"lấy tình huống tương tự"| F3
  F2 -.->|"kết quả được duyệt"| F3
  F5 -.->|"câu hỏi xấu vào bộ eval"| F6
  F4 -.->|"kho mới phải qua eval"| F6
```

| Luồng | Mô tả | Tài liệu chứa sơ đồ |
| --- | --- | --- |
| F1 | Hỏi đáp tài liệu: định tuyến → truy xuất → rerank → sinh có trích dẫn → guardrail | [02](02-assistant-service.md), [03](03-rag.md) |
| F2 | Vòng lặp tool: chọn tool → tool gate → gọi engine → thẻ kết quả | [04](04-tool-calling.md) |
| F3 | Case memory: tự ghi nhận khi được duyệt, tra lại theo điều kiện tương tự | [05](05-case-memory.md) |
| F4 | Ingestion: tải tệp → phân tích → cắt đoạn → embedding → phát hành phiên bản | [03](03-rag.md) |
| F5 | Phản hồi tốt/xấu → phân loại → bổ sung bộ eval | [09](09-eval-quan-sat.md) |
| F6 | Eval gate trong CI: chặn merge khi chất lượng lùi | [09](09-eval-quan-sat.md) |
| F7 | Rate limit, quota, retention, telemetry, audit | [07](07-auth-bao-mat.md), [09](09-eval-quan-sat.md) |

Các luồng xuyên suốt nằm ở: xác thực ([07](07-auth-bao-mat.md)), tầng Bedrock và chịu lỗi ([06](06-tang-bedrock.md)), giao diện ([08](08-ux.md)), triển khai ([10](10-trien-khai.md)).

---

## 4. Quy tắc phụ thuộc trong Assistant.Api

Assistant tuân theo Clean Architecture 4 lớp giống Main API: `Api → Infrastructure → Application → Domain`, phụ thuộc hướng vào trong. Điểm khác so với Main API: **có dùng interface cho mọi cổng ra ngoài** (`ILlmClient`, `IEmbeddingClient`, `IReranker`, `IToolExecutor`, `IAccessScopeResolver`), vì các cổng này cần thay bằng bản giả trong eval và test, và cần thay đổi nhà cung cấp mô hình mà không sửa nghiệp vụ.

**Sơ đồ 1.4 — Lớp và hướng phụ thuộc**

```mermaid
flowchart TB
  subgraph API["Api"]
    EP["Endpoints: /v1/chat, /v1/conversations,<br/>/v1/approvals, /v1/feedback, /v1/admin/corpus"]
    MW["Middleware: rate limit, auth,<br/>quota, correlation id"]
  end
  subgraph INFRA["Infrastructure"]
    BEDROCK["BedrockLlmClient, BedrockEmbeddingClient,<br/>BedrockReranker, GuardrailGateway"]
    PG["EF Core + Npgsql + pgvector<br/>AssistantDbContext"]
    MAINCLIENT["MainApiToolClient<br/>(typed HttpClient)"]
    SCOPE["AccessScopeResolver<br/>(Authorization API, Payment API)"]
    OTEL["OpenTelemetry exporters"]
  end
  subgraph APP["Application"]
    ORCH["ChatOrchestrator"]
    ROUTER["IntentRouter"]
    RAG["RetrievalService"]
    TOOLS["ToolRegistry, ToolGate"]
    CASES["CaseMemoryService"]
    PORTS["Cổng: ILlmClient, IEmbeddingClient,<br/>IReranker, IToolExecutor, IAccessScopeResolver"]
  end
  subgraph DOM["Domain"]
    ENT["Conversation, Message, Chunk, Document,<br/>ToolRun, CaseRecord, Citation"]
    RULES["Quy tắc: RiskGroup, RefusalPolicy,<br/>CitationValidator"]
  end

  API --> APP
  INFRA --> APP
  APP --> DOM
  INFRA -.->|"cài đặt"| PORTS
```
