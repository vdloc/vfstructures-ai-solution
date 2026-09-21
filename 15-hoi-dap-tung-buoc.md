# 15. Hỏi đáp: một lượt hỏi đi qua hệ thống, từng bước

Tài liệu này ghi lại các câu hỏi đã đặt trong lúc rà soát kiến trúc và câu trả lời tương ứng. Khác với [02](02-assistant-service.md) (đặc tả) và [04](04-tool-calling.md) (thiết kế tool), tài liệu này viết theo lối **giải thích cho người chưa quen**, bám một ví dụ chạy suốt từ đầu đến cuối.

Đối tượng: người mới vào dự án, thành viên không thuộc team BE, và người cần trình bày kiến trúc cho nhiều bên cùng lúc.

Thuật ngữ tra ở [14](14-giai-thich-cho-nguoi-moi.md).

---

## Mục lục

- [Bước 1 — FE gửi gì lên](#bước-1--fe-gửi-gì-lên)
- [Bước 2 — BE kiểm và phân loại](#bước-2--be-kiểm-và-phân-loại)
- [Hỏi: system prompt và output của Haiku](#hỏi-system-prompt-cho-haiku-như-thế-nào-output-là-gì-setup-ở-agentcore-ra-sao)
- [Bước 3 — Vòng lặp tool](#bước-3--vòng-lặp-tool)
- [Hỏi: giải thích bước 3 bằng lời thường](#hỏi-giải-thích-bước-3-bằng-lời-thường)
- [Hỏi: Gateway, Cedar, facade nghĩa là gì](#hỏi-gateway-cedar-facade-nghĩa-là-gì)
- [Bước 4 — Facade kiểm từng lời gọi tool](#bước-4--facade-kiểm-từng-lời-gọi-tool)
- [Bước 5 — Hậu kiểm sau khi mô hình viết xong](#bước-5--hậu-kiểm-sau-khi-mô-hình-viết-xong)
- [Bước 6 — FE dựng giao diện từ luồng sự kiện](#bước-6--fe-dựng-giao-diện-từ-luồng-sự-kiện)
- [Nhánh RAG — câu hỏi tài liệu, không có vòng lặp](#nhánh-rag--câu-hỏi-tài-liệu-không-có-vòng-lặp)
- [Nhánh case lookup — tra kinh nghiệm nội bộ](#nhánh-case-lookup--tra-kinh-nghiệm-nội-bộ)

---

## Bước 1 — FE gửi gì lên

Bước duy nhất chưa có AI nào tham gia. Chỉ là một request HTTP.

### Người dùng thấy gì

Kỹ sư đang mở một dự án trong VF Structures. Panel chat bên phải. Họ gõ:

> "Dầm này có đạt không?"

### FE gửi gì thật sự

Ba chữ đó **không đủ** để trả lời. "Dầm này" là dầm nào? FE không gửi mỗi câu chữ — gửi kèm hai thứ nữa:

```json
POST /api/assistant/chat
Authorization: Bearer eyJhbGc...        ← (1) thẻ đăng nhập

{
  "conversationId": "c-8f21",
  "message": "Dầm này có đạt không?",
  "context": {                          ← (2) ngữ cảnh trang
    "projectId": "p-1042",
    "modelId": "m-77",
    "selectedElementIds": ["beam-B12"],
    "activeView": "design-check",
    "unitSystem": "metric",
    "codeStandard": "EC3"
  }
}
```

**(1) Thẻ đăng nhập** — chứng minh đây là ai. Không phải để chào hỏi, mà vì BE phải kiểm: người này có quyền xem dự án `p-1042` không. Không có thẻ thì chặn ngay, không gọi mô hình.

**(2) Ngữ cảnh trang** — FE biết người dùng đang chọn `beam-B12`, đang ở màn hình design-check, đơn vị mét, tiêu chuẩn EC3. Người dùng không phải gõ lại. FE đọc từ chính trạng thái giao diện.

### Vì sao đây là thiết kế quan trọng chứ không phải chi tiết vặt

Nếu FE chỉ gửi câu chữ, hệ thống có hai lựa chọn tệ:

- Hỏi lại "dầm nào?" — phiền, vì kỹ sư đang nhìn thẳng vào nó
- **Để mô hình tự đoán** — mô hình đoán sai dầm, rồi trả lời trôi chảy về sai đối tượng

Cách thứ hai là kiểu lỗi nguy hiểm nhất: câu trả lời nghe rất đúng, chỉ là về nhầm cấu kiện. Nên `selectedElementIds` là **dữ liệu cứng do FE cung cấp**, mô hình không được phép đoán.

Nguyên tắc chung: **thứ gì máy biết chắc thì máy đưa, không để mô hình suy.**

### Chiều ngược lại

Request này không trả về một cục JSON. Nó mở một **kết nối SSE** — ống một chiều từ server về trình duyệt. Server đẩy về dần: chữ trước, thẻ kết quả tính toán sau, trích dẫn cuối. 11 loại sự kiện, hợp đồng cố định ([02](02-assistant-service.md) §6).

Nghĩa là FE **làm được trước khi BE xong**: dựng luồng giả bắn đúng 11 sự kiện đó, giao diện chạy đủ.

### Việc của ai

| Ai | Việc bước 1 |
| --- | --- |
| FE | Panel chat, gom ngữ cảnh từ trạng thái app, giữ SSE, dựng lại khi rớt mạng |
| BE | Định nghĩa schema request và 11 sự kiện SSE, gửi FE ngay tuần 1 |
| DevOps | Cho SSE đi qua được — ALB/CloudFront **không được đệm** response |

Bẫy DevOps có thật: proxy mặc định hay gom response rồi trả một lần. Làm vậy chữ không hiện dần, người dùng nhìn màn hình trắng hai mươi giây.

---

## Bước 2 — BE kiểm và phân loại

Bốn việc, theo thứ tự rẻ trước đắt sau.

### 2.1 Ba cổng chặn (thuần mã, không AI)

| Cổng | Hỏi gì | Trượt thì |
| --- | --- | --- |
| Rate limit | Người này có đang spam không | `429` |
| JWT | Thẻ đăng nhập thật và chưa hết hạn không | `401` |
| Quota ngày | Hôm nay đã xài hết hạn mức chưa | `429` |

Ba cái này tốn gần như không đồng nào. Đặt trước để câu hỏi rác không bao giờ chạm tới Bedrock. Đây là toàn bộ lý do thứ tự quan trọng.

Kill switch cũng nằm ở đây: gạt một cờ thì trả `503`, cả Assistant tắt, phần còn lại của VF Structures vẫn chạy. Cần có vì nếu mô hình bắt đầu nói bậy lúc hai giờ sáng, phải tắt được mà không deploy lại.

### 2.2 Ba việc chạy song song (~300ms)

```
├─ AccessScopeResolver  → người này đọc được gì?
├─ Guardrail INPUT      → câu hỏi có độc hại hoặc dụ dỗ không?
└─ ConversationStore    → 3 lượt gần nhất
```

**Scope** trả về kiểu `public, org:42, project:7`. Đây là **danh sách khóa** nhét vào mệnh đề `WHERE` của truy vấn tài liệu. Nghĩa là tài liệu ngoài quyền **không bao giờ vào vector search**, chứ không phải tìm ra rồi lọc bỏ sau. Lọc sau là chỗ rò rỉ.

**Guardrail INPUT** chặn prompt attack và chủ đề cấm.

Cả ba song song vì không cái nào cần kết quả của cái kia. Chạy tuần tự thì cộng dồn khoảng 900ms vào thời gian chờ chữ đầu tiên.

### 2.3 Phân loại ý định

Đến đây mới cần AI, nhưng là **mô hình nhỏ nhất, rẻ nhất** (Haiku 4.5), `maxTokens` nhỏ, đầu ra đúng một nhãn.

**AD-15 (chốt 20/09/2026): mọi lượt đều đi qua Haiku.** Bản trước có một lớp **luật nhanh** chạy trước, miễn phí và tức thì: câu hỏi chứa mã điều khoản thì ép `doc_qa`; `pageContext` có kết quả tính và câu dạng "vì sao" thì ép `explain_result`. Đã bỏ khỏi đường chính vì luật thứ nhất **phân loại sai**:

> "6.2.2 tôi tính rồi, dầm B12 có đạt không?"

Câu này chứa mã điều khoản nên bị ép `doc_qa`, trong khi ý định đúng là `mixed` — cần gọi engine. Người dùng nhận một đoạn tiêu chuẩn thay vì kết quả kiểm tra dầm của mình, và không có lỗi nào xuất hiện.

Luật nay **chỉ còn là đường lùi** khi router lỗi hoặc quá thời gian. Lượt đó mang cờ `degraded_routing` để lát nữa đo recall không nhầm lượt hỏng với lượt thường.

Cái giá: mọi lượt cộng 300–500 ms, và router thành điểm chết đơn trên một mô hình có mốc EOL trong POC (R44).

| Nhãn | Nghĩa | Đi đường nào |
| --- | --- | --- |
| `doc_qa` | Hỏi tài liệu, tiêu chuẩn | **Đường RAG cố định** — 1 lần gọi Sonnet |
| `app_help` | Hỏi cách dùng phần mềm | Đường RAG cố định |
| `case_lookup` | "Dự án nào từng giống thế này" | Tra case, 1 lần gọi |
| `calc` | Cần tính | **Vòng lặp tool** |
| `explain_result` | Giải thích kết quả có sẵn | Vòng lặp tool |
| `mixed` | Tính rồi đối chiếu điều khoản | Vòng lặp tool |
| `optimize` | Gợi ý phương án | Vòng lặp tool |
| `out_of_scope` | Chào hỏi, lạc đề | **Từ chối ngay, không gọi mô hình nào nữa** |

### 2.4 Vì sao chia hai đường chứ không một

Hai đường có **hình dạng chi phí khác hẳn**:

- Đường RAG: 1 lần gọi mô hình. Nhanh, giá đoán được.
- Vòng lặp tool: mỗi vòng thêm một lần gọi mô hình. Trần 5 vòng hoặc 60 giây.

`doc_qa` là nhóm câu hỏi đông nhất. Nếu để agent tự quyết "tôi nên gọi `search_documents`", ta trả thêm một vòng mô hình chỉ để nó nghĩ ra điều đã biết trước. Nên hard-code: `doc_qa` thì tìm tài liệu luôn.

Nhưng `search_documents` **vẫn là tool** trong vòng lặp, để câu `mixed` chạy được.

### 2.5 Viết lại câu hỏi

Haiku làm luôn việc thứ hai: tách câu hỏi thành hai phần.

> "Giải thích ngắn gọn xem hàm lượng cốt thép tối thiểu của dầm chịu uốn là bao nhiêu"

- **Phần lệnh**: "giải thích ngắn gọn" — đi vào prompt sinh câu trả lời
- **Phần nội dung**: "hàm lượng cốt thép tối thiểu của dầm chịu uốn" — đi vào embedding và tìm kiếm

Nếu nhét cả câu vào tìm kiếm, mấy từ "giải thích ngắn gọn" làm nhiễu vector, kéo về những đoạn tài liệu có chữ "giải thích".

Đồng thời giải quyết câu hỏi dựa vào ngữ cảnh: "còn dầm bên cạnh thì sao?" — từ 3 lượt lịch sử, Haiku viết lại thành câu **đứng độc lập** rồi mới đem đi tìm.

### Việc của ai ở bước 2

| Ai | Việc |
| --- | --- |
| BE | Toàn bộ bước này: middleware, scope resolver, IntentRouter, rewrite |
| DevOps | Guardrail trong Bedrock, quyền IAM cho Haiku, chỉ số throttle |
| FE | Nhận `refusal` sớm — không phải câu nào cũng ra chữ. Phải có thẻ từ chối tử tế |

Bẫy nằm ở FE: `out_of_scope` **chết ở bước 2**, chưa từng chạm mô hình chính. Giao diện phải xử lý trường hợp "trả lời xong mà không có chữ nào" ngay từ đầu, không phải vá sau.

---

## Hỏi: system prompt cho Haiku như thế nào, output là gì, setup ở AgentCore ra sao?

### Gỡ tiền đề trước: Haiku **không** chạy ở AgentCore

AgentCore Harness chỉ phụ trách **vòng lặp tool** — nhánh `calc / mixed / optimize / explain_result`, và nó chạy Sonnet 5.

Haiku định tuyến chạy **trước** đó, để quyết định có nên vào Harness hay không. Nó là một lệnh `Converse` thường, gọi thẳng `bedrock-runtime` từ C#. Không container, không harness, không session.

```
C# Assistant.Api
   ├─ Haiku ──► bedrock-runtime Converse        ← bước 2, ở đây
   │
   └─ nếu cần tool ──► AgentCore InvokeHarness  ← bước 3, Sonnet 5
                           └─► gọi ngược về facade C#
```

Nhét router vào AgentCore thì phải tạo session, khởi động runtime, trả phí hạ tầng — để làm một việc tốn khoảng 50 token. Không hợp lý.

### System prompt cho Haiku

Ngắn có chủ ý. Prompt dài làm tăng độ trễ của **mọi** lượt hỏi, kể cả lượt bị từ chối.

```text
You are a router for a structural-engineering assistant. You do not answer
questions. You classify and rewrite.

Input arrives in French or English. Technical terms may be French.

Return exactly one intent label:
  doc_qa        - asks what a standard, code clause, or internal document says
  app_help      - asks how to use the VF Structures software itself
  calc          - asks for a verification or computation on a model element
  explain_result- asks why an existing computed result came out as it did
  mixed         - needs both a computation and a document reference
  optimize      - asks for an alternative or improved design option
  case_lookup   - asks about past projects with similar conditions
  out_of_scope  - greeting, chit-chat, or unrelated to structural engineering

Also split the user turn into two parts:
  search_query - ONLY the subject matter to look up, as a standalone sentence.
                 Resolve pronouns and ellipsis from the conversation history.
                 Strip every instruction verb (explain, compare, summarise,
                 keep it short). Keep the original language.
  instruction  - the delivery instruction, if any. Empty string if none.

Never invent an element id. If the turn refers to an element not present in
pageContext, set needs_clarification true.
```

Block user kèm theo:

```text
<history>
[3 lượt gần nhất, đã rút gọn]
</history>

<page_context>
project=p-1042  element=beam-B12  view=design-check  code=EC3  units=metric
</page_context>

<turn>
Giải thích ngắn gọn xem hàm lượng cốt thép tối thiểu của dầm chịu uốn là bao nhiêu
</turn>
```

`pageContext` đưa vào **dạng rút gọn một dòng**, không phải JSON đầy đủ. Router chỉ cần biết có hay không có phần tử đang chọn.

### Output của Haiku

Haiku 4.5 **hỗ trợ structured outputs** trên Bedrock (Sonnet 5 thì không — đó là lý do việc này giao cho Haiku, không chỉ vì rẻ). Ràng buộc bằng schema, không parse JSON tự do:

```json
{
  "name": "route",
  "schema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["intent", "search_query", "instruction", "needs_clarification"],
    "properties": {
      "intent": {
        "type": "string",
        "enum": ["doc_qa","app_help","calc","explain_result",
                 "mixed","optimize","case_lookup","out_of_scope"]
      },
      "search_query":  { "type": "string", "maxLength": 300 },
      "instruction":   { "type": "string", "maxLength": 200 },
      "needs_clarification": { "type": "boolean" },
      "case_hints": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "tool_id": { "type": "string", "enum": ["calc.beam.flexure", "..."] },
          "params": {
            "type": "array",
            "maxItems": 6,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": ["key", "value", "unit"],
              "properties": {
                "key":   { "type": "string", "enum": ["span", "fck", "load", "..."] },
                "value": { "type": "number" },
                "unit":  { "type": "string", "enum": ["m", "mm", "MPa", "kN/m"] }
              }
            }
          }
        }
      }
    }
  }
}
```

Với câu ví dụ, Haiku trả:

```json
{
  "intent": "doc_qa",
  "search_query": "hàm lượng cốt thép tối thiểu của dầm bê tông cốt thép chịu uốn",
  "instruction": "giải thích ngắn gọn",
  "needs_clarification": false,
  "case_hints": { "tool_id": null, "params": [] }
}
```

**Khối `case_hints` (AD-16, chốt 20/09/2026).** Enum của `tool_id`, `key` và `unit` **sinh từ `tools.manifest.yaml`** lúc khởi động và nhúng vào system prompt, không viết tay. Không nhúng manifest thì mô hình bịa tên tham số — đây là hành vi mặc định của text-to-query, không phải trường hợp biên.

Câu ví dụ là `doc_qa` nên `params` rỗng. Với câu *"dự án nào từng làm dầm nhịp 12 m bê tông C30/37"*, Haiku trả `params: [{span, 12.0, "m"}, {fck, 30.0, "MPa"}]`.

`MaxTokens` của router đặt **300–400**, không phải 150 — khối này làm output dài thêm. Chạm trần thì JSON đứt giữa chừng và constrained decoding không cứu được, nên sau mỗi lần gọi phải assert `stopReason != "max_tokens"`.

Ba điều đáng chú ý:

1. **`instruction` bị tách ra.** "Giải thích ngắn gọn" không đi vào embedding, nó đi vào prompt của Sonnet ở bước sau.
2. **`search_query` nở ra, không co lại.** "dầm chịu uốn" thành "dầm bê tông cốt thép chịu uốn". Router thêm ngữ cảnh ngầm để câu đứng độc lập được.
3. **`intent = doc_qa`, không phải `calc`.** Người dùng hỏi tiêu chuẩn quy định bao nhiêu, không hỏi dầm B12 của mình có đạt không. Câu thứ hai mới vào Harness. Phân biệt này là toàn bộ giá trị của router.

`needs_clarification: true` khi câu hỏi trỏ tới phần tử mà `pageContext` không có. Khi đó BE hỏi lại, không đoán.

### Gọi Haiku từ C#

```csharp
var req = new ConverseRequest {
    ModelId = "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
    System  = new List<SystemContentBlock> {
        new() { Text = RouterPrompt }          // hằng số, không nội suy
    },
    Messages = new List<Message> { userTurn },
    InferenceConfig = new InferenceConfiguration {
        MaxTokens   = 150,                     // BẮT BUỘC đặt tường minh
        Temperature = 0f
    },
    GuardrailConfig = new GuardrailConfiguration {
        GuardrailIdentifier = _cfg.GuardrailArn,
        GuardrailVersion    = _cfg.GuardrailVersion   // thiếu -> guardrail
    }                                                 // im lặng không chạy
};
```

Ba chỗ dễ sai:

**`MaxTokens`** — bỏ trống thì Bedrock lấy mặc định bằng trần của mô hình (64K với Haiku 4.5), và **giữ chỗ quota theo con số đó**. Một lệnh cần 50 token lại khóa 64 000 token TPM. Đây là nguyên nhân `ThrottlingException` phổ biến nhất khi lưu lượng còn thấp.

**`GuardrailVersion`** — thiếu thì guardrail **không được áp dụng và không báo lỗi gì cả**. Test phải assert bằng cách bắn một prompt chắc chắn bị chặn rồi kiểm `stopReason`.

**`Temperature = 0`** — router phải tất định. Cùng câu hỏi ra cùng nhãn, nếu không thì bộ eval vô nghĩa.

Prompt caching **không dùng được ở đây**: ngưỡng cache của Haiku 4.5 là 4 096 token mỗi checkpoint, prompt router ngắn hơn nhiều. Chấp nhận, vì nó vốn đã rẻ.

### Chỗ AgentCore mới thật sự có mặt

```json
{
  "bedrockModelConfig": {
    "modelId":   "eu.anthropic.claude-sonnet-5",
    "apiFormat": "converse_stream"
  }
}
```

- **Mặc định của Harness là `global.anthropic.claude-sonnet-4-6`** — profile toàn cầu, route ra ngoài EU, vi phạm yêu cầu residency (Q1 chưa chốt). Phải ghi đè.
- **`converse_stream`** bắt buộc, vì Guardrails không chạy trên định dạng API khác.

### Rủi ro vòng đời

Model card Haiku 4.5 ghi EOL "không sớm hơn 01/10/2026" (một dòng khác ghi 16/10/2026) — rơi vào tuần 2 của POC. Chạy `get-foundation-model` ngày đầu để xem trạng thái vòng đời thật, và đưa Nova Lite vào bộ so sánh ngay từ M1. Đổi mô hình định tuyến là đổi một dòng cấu hình, nhưng phải có số đo độ chính xác của ứng viên thay thế sẵn, không đo lúc gấp. Xem R23 ở [12](12-rui-ro.md).

---

## Bước 3 — Vòng lặp tool

Câu ví dụ ở trên (`doc_qa`) **không đi vào bước này**. Nó đi đường RAG cố định, một lần gọi Sonnet, xong. Đó là phần lớn lượt hỏi.

Bước 3 chỉ chạy khi router ra `calc / mixed / optimize / explain_result`. Đổi câu ví dụ:

> "Dầm B12 có đạt không, và nếu không thì điều khoản nào quy định?"

Router cho `intent = mixed`. Cần **tính** rồi **tra**.

### 3.1 Hình dạng: vòng lặp, không phải đường thẳng

```
Sonnet: "tôi cần gọi calc.beam.flexure với b=300 h=600 fck=30"
  → chạy tool → trả kết quả
Sonnet: "kết quả ρ=0.0021, tôi cần tra điều khoản. gọi search_documents"
  → chạy tool → trả 8 chunk
Sonnet: "đủ rồi" → viết câu trả lời
```

Mỗi vòng là **thêm một lần gọi mô hình**. Số vòng không biết trước.

### 3.2 Vấn đề: Harness không có hook

Bảng so sánh của AWS ghi rõ: Harness **Hooks: không hỗ trợ**.

ToolGate của thiết kế cũ là một chuỗi hook — kiểm schema, kiểm quyền, kiểm đơn vị, đếm số lần thử lại, đọc mã lỗi. Không nhét được vào vòng lặp Harness.

Cách giải: **đẩy ToolGate ra sau, thành một facade C# riêng.** Harness không gọi thẳng tool — nó gọi Gateway, Gateway gọi facade, facade mới chạy ToolGate rồi gọi Main API.

```
Harness ──► Gateway ──► Facade C# ──► Main API
            (Cedar)     (ToolGate)    (engine thật)
```

Thêm hai chặng mạng. Đổi lại giữ được toàn bộ bảo đảm. Đây là cái giá của vòng lặp quản lý sẵn — đánh đổi có chủ ý, không phải nhược điểm giấu đi.

### 3.3 Một vòng, chi tiết

| # | Ai | Làm gì |
| --- | --- | --- |
| 1 | `Assistant.Api` | `InvokeHarness`, **Bearer JWT của người dùng**, session id, trần vòng, trần thời gian |
| 2 | Harness | `ConverseStream` tới `eu.anthropic.claude-sonnet-5`, kèm guardrailConfig |
| 3 | Bedrock | Trả `toolUse: calc.beam.flexure` và tham số |
| 4 | Gateway | **Cedar Policy**: người này được gọi tool này không, tham số có trong biên không |
| 5 | Gateway | Gọi facade, kèm **token đã đổi** theo người dùng (RFC 8693) |
| 6 | Facade | **ToolGate**: schema, đơn vị, khoảng hợp lý, đếm lặp |
| 7 | Facade | Gọi Main API **bằng token của người dùng**, nên `[ApiAccess]` áp dụng |
| 8 | Main API | Trả `ApiResult`, mã lỗi **nằm trong body**, HTTP vẫn 200 |
| 9 | Facade | Đọc `Code`, kiểm output, ghi `tool_run` |
| 10 | ngược lên | `toolResult` về Gateway, Harness, Bedrock; vòng tiếp |

Chỗ số 8 là bẫy thật: Main API trả `ApiResult.Code = Forbidden` **trong HTTP 200**. Gateway và Cedar không đọc body phản hồi. Nếu facade không tự đọc `Code`, một lỗi "không có quyền" sẽ trôi vào `toolResult` như dữ liệu hợp lệ và mô hình diễn giải nó thành câu trả lời. **Bắt buộc bắt ở facade** (R9).

### 3.4 Sáu cấu hình phải đặt tay, mặc định đều sai

| Mục | Mặc định của AgentCore | Phải đặt | Vì sao |
| --- | --- | --- | --- |
| Mô hình | `global.anthropic.claude-sonnet-4-6` | `eu.anthropic.claude-sonnet-5`, `converse_stream` | Profile `global` route ra ngoài EU, vi phạm residency |
| Số vòng | **75 vòng, 3 600 giây** | 5 vòng / 60 giây; 7 / 90 cho `optimize` | Mặc định để một lượt chạy một tiếng |
| Tool | `shell` và `file_operations` **bật sẵn** | `allowedTools` loại cả hai | Tốn khoảng 900 token mỗi request, và cho mô hình quyền chạy lệnh |
| Memory | **Bật sẵn** | `disabled` | Hội thoại đã ở PostgreSQL; hai kho song song là rủi ro (Q3) |
| Danh tính | SigV4 | `CUSTOM_JWT` + **cả** `allowedClients` **và** `allowedAudience` | Thiếu cả hai thì authorizer nhận **mọi** token hợp lệ của issuer |
| Mạng | — | VPC + **NAT gateway bắt buộc** | Harness kéo container từ **ECR Public** mỗi lần mở phiên; ECR Public **không có VPC endpoint**; thiếu NAT thì phiên chết vì image-pull timeout (V-A10) |

Cái NAT là chỗ đã sai trong bản trước và đã sửa: bản cũ viết "chỉ cần VPC endpoint cho `ecr.dkr` và `ecr.api`" — sai, vì image nằm ở ECR **Public**.

Hệ quả cho DevOps: cấu hình Harness phải **là mã trong repo**, và có test đọc lại cấu hình sau mỗi lần deploy để kiểm đúng sáu giá trị trên. Một mặc định lọt qua là một sự cố im lặng (R30).

### 3.5 Rủi ro chưa gỡ được: SigV4 và JWT

Danh tính người dùng **phải** đi xuống tới Gateway, nếu không Cedar không biết ai đang gọi và `[ApiAccess]` mất tác dụng. Nghĩa là `InvokeHarness` phải mang **Bearer JWT**.

Nhưng **AWS SDK for .NET ký SigV4**. Nếu SDK không cho gửi Bearer, phải tự viết `HttpClient` thô kèm bộ đọc event-stream tự chế. Nếu **chỉ** dùng được SigV4 thì hướng này **không đạt yêu cầu phân quyền**.

| Mã | Kiểm gì | Hạn |
| --- | --- | --- |
| V-A1 | `InvokeHarness` gửi được Bearer JWT từ .NET | Hết ngày 3 (23/09) |
| V-A6 | Keycloak bật token exchange, audience khớp | Hết ngày 3 (23/09) |
| V-A3 | — | Cổng G0 (25/09) |
| V-A4 | Một "vòng" của Harness có bằng một vòng tool của ta không | Cổng G0 (25/09) |

Trượt bất kỳ mốc nào thì rơi về phương án dự phòng: vòng lặp tool tự viết bằng C# ([04](04-tool-calling.md) §6). Phương án đó vẫn còn nguyên, đã viết đầy đủ, không phải làm lại.

### Việc của ai ở bước 3

| Ai | Việc |
| --- | --- |
| BE | Facade `/internal/tools/*`, ToolGate sáu lớp, manifest tool, đọc `ApiResult.Code`, NumberValidator |
| DevOps | Tạo Harness và Gateway, sáu cấu hình trên, Cedar policy, NAT, token exchange ở Keycloak |
| FE | Nhận thêm sự kiện SSE `tool_call` và `tool_result` — hiện "đang tính dầm B12…" thay vì spinner câm |
| Kỹ sư kết cấu | Định nghĩa biên hợp lý của từng tham số cho manifest. Không ai khác biết `b` nên nằm trong khoảng nào |

Điểm đồng bộ tuần 1: **BE cần schema OpenAPI của facade xong trước khi DevOps tạo Gateway target.** Hai bên không làm song song được ở chỗ đó.

---

## Hỏi: giải thích bước 3 bằng lời thường

### Tình huống

> "Dầm B12 có đạt không, và điều khoản nào quy định?"

Câu này máy **không trả lời một phát được**. Nó cần hai việc riêng: tính xem dầm B12 đạt hay không, rồi tra xem tiêu chuẩn nào nói vậy. Và việc hai phụ thuộc kết quả việc một.

### Ví von

Sonnet 5 là **một chuyên viên giỏi lý thuyết nhưng không được phép tự bấm máy tính, không được tự mở tủ hồ sơ**. Anh ta ngồi trong phòng. Muốn gì thì viết phiếu yêu cầu đưa ra ngoài. Có người bên ngoài đi lấy, đem vào.

> **Chuyên viên:** "Cho tôi kết quả tính uốn của dầm B12." *(viết phiếu)*
> → ngoài phòng chạy engine → đem vào tờ kết quả
>
> **Chuyên viên:** "À, tỉ lệ cốt thép 0,21%. Cho tôi mấy trang tiêu chuẩn về hàm lượng tối thiểu." *(phiếu thứ hai)*
> → ngoài phòng tìm tài liệu → đem vào 8 đoạn
>
> **Chuyên viên:** "Đủ rồi." → viết câu trả lời

**Ba lượt nói chuyện**, không phải một. Đó là "vòng lặp".

### Ai làm người chạy việc

Phải có ai đó ngồi giữa: nhận phiếu, đi lấy, đem vào, hỏi tiếp. Lặp cho tới khi chuyên viên nói "đủ rồi".

- **A. Team BE tự viết** — code C#, vài trăm dòng, tự bảo trì.
- **B. Thuê dịch vụ AWS làm** (AgentCore Harness) — chỉ khai báo cấu hình.

**Đã chọn B** (AD-13).

### Rắc rối của lựa chọn B

Tự viết (A) thì BE chèn được kiểm tra vào **giữa** vòng lặp: phiếu vừa ra khỏi phòng là chặn lại soi ngay.

Thuê AWS (B) thì **không chèn vào giữa được**. AWS nói thẳng: không có hook.

Giải: không soi ở giữa nữa, **dựng một quầy kiểm ở cửa**. Mọi phiếu đều phải qua quầy đó trước khi được thực hiện.

```
Chuyên viên ──► [quầy kiểm] ──► engine / tủ hồ sơ
```

Quầy kiểm là "facade C#" cộng "ToolGate". Vẫn là code của team BE, chỉ đổi chỗ đứng: từ trong vòng lặp ra ngoài cửa.

### Quầy kiểm soi gì

Phiếu ghi: *"tính dầm, b=300mm, h=600mm, fck=30"*

- Đúng định dạng không? Thiếu `fck` thì trả về.
- Người hỏi có quyền xem dự án này không?
- `b=300mm` có hợp lý không? `b=50000mm` thì chặn, dầm không rộng 50 mét.
- Phiếu này vừa gửi rồi, y hệt? Chặn, kẻo lặp vô tận.

Qua hết mới chạy engine thật.

### Vì sao không tin chuyên viên tự viết phiếu đúng

Vì anh ta **đoán giỏi và đoán tự tin**. Anh ta có thể viết `b=300` khi dầm thật là 250, rồi giải thích rất thuyết phục. Kiểm ở quầy là chỗ duy nhất bắt được.

### Hai cái bẫy

**Bẫy 1 — lỗi giả dạng dữ liệu.** Engine của VF khi từ chối vì thiếu quyền vẫn trả HTTP 200, chữ "Forbidden" nằm bên trong nội dung. Quầy kiểm phải **mở ra đọc**. Không đọc thì chuyên viên nhận được chữ "Forbidden" như một kết quả bình thường và bịa ra câu trả lời quanh nó.

**Bẫy 2 — mặc định của AWS đều sai với ta.**

| Thứ | AWS mặc định | Ta cần |
| --- | --- | --- |
| Tối đa bao nhiêu lượt | **75 lượt, 1 tiếng** | 5 lượt, 60 giây |
| Mô hình nào | Bản chạy toàn cầu | Bản chỉ chạy EU |
| Cho phép chạy lệnh máy | **Bật sẵn** | Tắt |
| Tự lưu hội thoại | **Bật sẵn** | Tắt, ta lưu ở DB riêng |

Không đụng vào thì chạy được, nhưng sai. Đó là loại lỗi tệ nhất: không báo gì cả.

### Một điều chưa chắc

Chuyên viên cần biết **ai đang hỏi** để quầy kiểm soi quyền đúng người. Chưa chắc thư viện .NET của AWS cho gửi kèm danh tính người dùng — có thể nó chỉ gửi được danh tính của máy chủ. Nếu vậy quầy kiểm không biết người hỏi là ai, phân quyền sập.

**Thử trong ba ngày đầu.** Không được thì quay về lựa chọn A.

---

## Hỏi: Gateway, Cedar, facade nghĩa là gì

Ba thứ, ba việc khác nhau, xếp theo thứ tự phiếu đi qua:

```
Sonnet  ──►  Gateway  ──►  Facade  ──►  Main API
             (Cedar ở đây)
```

### 1. Gateway — "bảng danh sách tool"

**Vấn đề nó giải:** mô hình cần biết nó **được phép gọi những gì**, và mỗi tool nhận tham số gì. Ta có sẵn REST API của VF Structures, nhưng mô hình không đọc được REST API — nó cần danh sách tool theo định dạng riêng (MCP).

Gateway làm đúng một việc: **đưa vào file mô tả API (OpenAPI), nó đẻ ra danh sách tool cho mô hình.**

```
Ta đưa vào:                    Gateway phát ra cho mô hình:
OpenAPI của facade       →     calc.beam.flexure(b, h, fck, ...)
                               search_documents(query)
                               project.list_members(projectId)
```

Không có Gateway thì BE phải tự viết và tự bảo trì bản mô tả tool đó, tự lo phiên bản, tự expose.

Tên trong tài liệu: Gateway `vf-tools`.

**Nó KHÔNG làm:** không chạy tool. Chỉ nhận phiếu rồi chuyển tiếp.

### 2. Cedar — "luật ai được gọi cái gì"

Cedar là **ngôn ngữ viết luật phân quyền** của AWS. Không phải dịch vụ riêng — là các dòng luật cắm vào Gateway.

```
permit(
  principal in Role::"structural_engineer",
  action   == Action::"calc.beam.flexure",
  resource
)
when {
  principal.projects.contains(resource.projectId)
};

forbid(
  principal,
  action == Action::"project.get_member_result",
  resource
)
unless {
  principal.projects.contains(resource.projectId)
};
```

Đọc: *kỹ sư kết cấu được gọi tool tính dầm, với điều kiện dự án đó nằm trong danh sách dự án của họ.*

**Vì sao cần, trong khi facade cũng kiểm?**

| | Cedar (Gateway) | Facade (code BE) |
| --- | --- | --- |
| Ở đâu | Ngoài cùng, trước khi request rời AWS | Trong code của ta |
| Hình thức | Luật khai báo, DevOps sửa | Code C#, BE sửa |
| Chặn được | "Anh này không được gọi tool này" | Mọi thứ, kể cả logic phức tạp |
| Đọc được body phản hồi | **Không** | Có |

Cedar chặn sớm và rẻ. Nhưng Cedar **không thấy kết quả trả về**, nên bẫy `ApiResult.Code = Forbidden` nằm trong body thì Cedar mù.

Còn một chỗ **chưa xác minh** (V-A9): chưa rõ Cedar có kiểm được điều kiện số học kiểu `b >= 100 && b <= 2000` hay không. Nếu không, toàn bộ việc kiểm biên tham số dồn về facade.

### 3. Facade — "quầy kiểm của ta"

Facade là một **endpoint HTTP nội bộ do team BE viết**, đứng chen giữa Gateway và Main API.

```
POST /internal/tools/calc.beam.flexure
```

**Vì sao không để Gateway gọi thẳng Main API?** Vì Main API là API cho người dùng thật, không phải cho mô hình. Giữa hai bên thiếu mất một loạt việc:

| Việc | Ai làm |
| --- | --- |
| Kiểm `b=50000mm` vô lý, chặn | Facade |
| Kiểm đơn vị: mô hình gửi mét hay milimét | Facade |
| Mở body ra đọc `ApiResult.Code` | Facade |
| Đếm "tool này đã gọi ba lần cùng tham số", chặn lặp | Facade |
| Chạy Guardrail trên tài liệu trước khi đưa cho mô hình | Facade |
| Ghi `tool_run` để NumberValidator đối chiếu | Facade |

Sáu việc đó là **ToolGate**. Facade là cái nhà chứa nó.

**Facade là cái vỏ mỏng.** Nó không tính toán gì. Engine thật vẫn ở Main API, không đổi. Tên "facade" (mặt tiền) là vì vậy: mặt tiền mới, ruột cũ.

Điểm quan trọng nhất: **facade gọi Main API bằng token của người dùng**, không phải token hệ thống. Nhờ vậy `[ApiAccess]` sẵn có của VF vẫn áp dụng nguyên vẹn. Người không có quyền dự án thì hỏi qua AI cũng không đọc được — không cần viết lại phân quyền.

### Ghép lại: một phiếu đi hết đường

Mô hình viết: `calc.beam.flexure(projectId=p-1042, memberId=beam-B12, b=300, h=600)`

| Trạm | Kiểm | Trượt thì |
| --- | --- | --- |
| **Gateway** | Tool này có trong danh sách `vf-tools` | Tool không tồn tại |
| **Cedar** | User + tool + dự án, có cho phép | Từ chối, không đi tiếp |
| **Gateway** | Đổi token người dùng thành token cho facade (RFC 8693) | — |
| **Facade** | Schema đủ field, `b` trong biên, đơn vị đúng, đã gọi trùng chưa | Trả lỗi mô tả, mô hình đọc và dừng |
| **Main API** | `[ApiAccess]`: token này xem được `p-1042` không | `Code = Forbidden` trong HTTP 200 |
| **Facade** | Mở body, thấy `Forbidden`, đổi thành lỗi 4xx thật | — |
| **Facade** | Ghi `tool_run` | — |

### Một câu mỗi cái

| | Là gì | Ai dựng |
| --- | --- | --- |
| **Gateway** | Dịch vụ AWS biến API của ta thành danh sách tool mô hình đọc được | DevOps |
| **Cedar** | Ngôn ngữ viết luật "ai gọi được tool nào", cắm vào Gateway | DevOps |
| **Facade** | Endpoint C# của ta, chứa ToolGate, đứng trước Main API | BE |

Gateway và Cedar là **hàng AWS, khai báo cấu hình**. Facade là **code của mình**, và là chỗ chặn cuối cùng đáng tin nhất, vì nó là chỗ duy nhất đọc được nội dung phản hồi.

---

## Bước 4 — Facade kiểm từng lời gọi tool

Bước này đã mô tả trong bước 3 (trạm số 6 đến 9). Phần dưới bổ sung chi tiết ToolGate.

### Sáu lớp của ToolGate

| # | Lớp | Kiểm gì | Trượt thì |
| --- | --- | --- | --- |
| 01 | Schema | Đủ field bắt buộc, đúng kiểu | Lỗi mô tả để mô hình sửa và gọi lại |
| 02 | Quyền | Token người dùng có `[ApiAccess]` với dự án | 403, ghi `audit_event` |
| 03 | Biên tham số | `b` trong `[100, 2000]` mm, `fck` trong danh sách cấp bền | Lỗi mô tả kèm khoảng hợp lệ |
| 04 | **Đơn vị** | `b=0.3` là mét hay milimét | **Chặn, không tự suy** |
| 05 | Chống lặp | Băm `(tên tool, tham số)`, gọi trùng quá hai lần thì dừng | Lỗi cụ thể để mô hình đổi hướng |
| 06 | Đọc `ApiResult.Code` | `Forbidden` / `NotFound` nằm trong HTTP 200 | Đổi thành lỗi HTTP thật |

**Lớp 04 là lớp dễ bị coi nhẹ nhất và nguy hiểm nhất.** Mô hình thấy `b=0.3` có thể hiểu là 0,3 m hoặc 0,3 mm. Đoán sai một nghìn lần đơn vị thì kết quả vẫn ra một con số trông hợp lý. Manifest tool phải ghi đơn vị bắt buộc cho từng tham số, và facade **từ chối** khi thiếu đơn vị chứ không suy diễn.

### Trả dữ liệu đầy đủ, không lọc trước

Facade trả **toàn bộ output JSON của engine** cho mô hình, trong ngân sách token, không tự rút gọn thành câu văn. Hai lý do:

1. Mô hình cần đủ dữ liệu để diễn giải.
2. `NumberValidator` ở bước 5 cần đủ số để đối chiếu. Rút gọn trước là tự bịt mắt bộ kiểm.

### Guardrail trên kết quả tool

Với `search_documents` và `find_similar_cases`, facade chạy `ApplyGuardrail` trên chunk **trước khi** đưa vào `toolResult`. Dưới Harness đây là **lớp bảo vệ còn lại**, vì chưa xác minh được guardrail của Harness có đánh giá `toolResult` hay không (V-A8).

---

## Bước 5 — Hậu kiểm sau khi mô hình viết xong

Đây là chỗ nguyên tắc "LLM không bao giờ tự tính một con số nào" được **thực thi**, chứ không chỉ được hứa.

### Ba bộ kiểm, đều tất định

Không bộ nào dùng LLM làm giám khảo. Tất cả là mã C# so khớp.

| Bộ | Kiểm gì | Trượt thì |
| --- | --- | --- |
| `NumberValidator` | Mọi giá trị số trong lời diễn giải phải xuất hiện trong output của `tool_run` (cho phép làm tròn) hoặc trong đoạn trích của chunk đã truy xuất | `warning: unverified_number` |
| `CitationValidator` | Mọi `[n]` phải ứng với một chunk đã thật sự truy xuất | `warning: unverified_citation` |
| `VerificationValidator` | Không có nhãn "đạt", "thỏa mãn" gắn với mã phương án mà thiếu `tool_run` khớp tham số | Đánh dấu `unverified` |

### Quy tắc số liệu

Đây là quy tắc gốc, ba bộ trên chỉ là cách thực thi:

- Số **tính ra** chỉ đến từ `tool_run`.
- Số **của tiêu chuẩn** chỉ đến từ đoạn trích của chunk đã truy xuất, và phải có `[n]`.
- Điều khoản chỉ được nêu nếu có `[n]`.

Bản `NumberValidator` đầu tiên coi mọi số phải nằm trong output của tool. Sai — câu trả lời nêu giá trị giới hạn của tiêu chuẩn sẽ bị gắn `unverified` oan. Đã mở rộng cho phép số nằm trong trích dẫn.

### Thêm: kiểm phiên bản tiêu chuẩn

Engine chạy theo một phiên bản tiêu chuẩn (`standardRef`). Chunk tài liệu cũng có phiên bản. Nếu engine tính theo EC3:2005 mà trích dẫn lấy từ bản 2023, câu trả lời **mâu thuẫn nội tại** dù cả hai vế đều đúng riêng lẻ. Phải so và cảnh báo.

### Vì sao cảnh báo chứ không xóa

Chữ đã hiện dần trên màn hình rồi. Xóa đi là trải nghiệm tệ và làm người dùng mất tin. Thay vào đó, giao diện **hiện banner cảnh báo trên câu trả lời**, trạng thái lượt là `CompletedUnverified`.

Trạng thái này được đếm trong bộ đo chất lượng. Tỉ lệ `unverified` tăng là tín hiệu sớm của prompt hỏng hoặc kho tài liệu lệch.

### Contextual grounding: dùng, nhưng không làm hàng rào chính

Guardrails có tính năng contextual grounding. AWS ghi rõ nó **không hỗ trợ trường hợp chatbot hội thoại**, và với stream thì câu trả lời không liên quan có thể chỉ bị đánh dấu sau khi đã stream hết. Giới hạn: nguồn 100 000 ký tự, câu hỏi 1 000, phản hồi 5 000.

Nên dùng làm **lớp hậu kiểm phụ** qua `ApplyGuardrail`, chỉ khi câu trả lời dưới 5 000 ký tự, và kết quả chỉ gắn cờ `unverified`. Ngưỡng khởi điểm 0,7, hiệu chỉnh bằng eval. **Bộ kiểm tất định mới là lớp chính.**

### Chế độ Degraded

Khi mô hình không dùng được (throttle, lỗi, quá thời gian), hệ thống **không trả lỗi trắng**. Nó trả **danh sách nguồn đã truy xuất** — người dùng vẫn mở được tài liệu và tự đọc. Kém hơn câu trả lời, hơn hẳn một thông báo lỗi.

---

## Bước 6 — FE dựng giao diện từ luồng sự kiện

### Hợp đồng 11 sự kiện SSE

Giao diện chỉ phụ thuộc vào các sự kiện sau. Hợp đồng này có version cùng đường dẫn `/v1`.

| Sự kiện | Dữ liệu chính | Khi nào | Giao diện làm gì |
| --- | --- | --- | --- |
| `status` | `phase`, `text` | Đầu mỗi pha | Dòng trạng thái một dòng |
| `retrieval` | `{docId, title, page, clause}[]` · Nhánh `case_lookup` thêm `params: [{key, value, unit, source, confirmed}]` (AD-16) | Sau truy xuất, hoặc sau khi gom tham số với `case_lookup` | Danh sách nguồn bấm được; với `case_lookup` là chip tham số |
| `token` | `text` | Mỗi đoạn sinh | Nối vào bong bóng trả lời |
| `tool_call` | `toolId`, `version`, `inputs` | Trước khi gọi tool | Thẻ "Đang tính…" kèm tham số |
| `tool_result` | `toolRunId`, `outputs`, `units`, `standard` | Sau khi tool xong | **Dựng thẻ kết quả từ JSON** |
| `approval_required` | `toolRunId`, `summary` | Kết quả có thể vào kho kinh nghiệm | Nút Duyệt / Bỏ qua |
| `citation` | `[{n, docId, page, clause, quote}]` | Sau khi kiểm trích dẫn | Đánh dấu `[n]` bấm được |
| `refusal` | `reason`, `suggestion` | Không đủ căn cứ hoặc ngoài phạm vi | Thẻ từ chối kèm gợi ý |
| `warning` | `code` | Hậu kiểm thất bại | Banner cảnh báo |
| `error` | `code`, `retryable`, `partial`, `requestId` | Lỗi giữa chừng | Giữ phần đã có, nút Thử lại |
| `done` | `messageId`, `usage` | Kết thúc | Mở khóa ô nhập, nút chấm tốt/xấu |

### Quy tắc quan trọng nhất cho FE

**Thẻ kết quả tính toán dựng từ JSON của `tool_result`, không dựng từ văn bản mô hình viết.**

Mô hình viết văn xuôi diễn giải. Con số hiển thị trong thẻ lấy từ `outputs` của engine. Hai luồng tách biệt. Nếu FE parse số từ chữ mô hình viết, toàn bộ công sức ở bước 5 thành vô nghĩa.

Đơn vị và tiêu chuẩn cũng đến từ `tool_result`, không từ chữ.

### Ba trường hợp FE phải xử lý ngay từ đầu, không vá sau

1. **Trả lời không có chữ nào.** `out_of_scope` chết ở bước 2, chỉ có `refusal` rồi `done`. Phải có thẻ từ chối tử tế kèm gợi ý phạm vi hỗ trợ.
2. **Chữ đã hiện xong rồi mới có cảnh báo.** `warning` đến sau `token` cuối. Banner phải chèn được lên một câu trả lời đã hiển thị đầy đủ.
3. **Rớt giữa chừng.** `error` mang `partial` và `requestId`. Giữ nguyên phần đã có, hiện nút Thử lại, và cho người dùng copy `requestId` để gửi hỗ trợ — id này truy được toàn bộ lượt.

### Nút Duyệt

`approval_required` xuất hiện khi kết quả có thể vào kho kinh nghiệm. Người dùng bấm Duyệt thì FE gọi `POST /v1/approvals/{toolRunId}`.

Rủi ro con người ở đây, không phải rủi ro phần mềm: nhãn "đã qua engine" dễ bị hiểu thành "đã được thẩm định". Engine chỉ kiểm những điều đã lập trình, không thay đánh giá tổng thể của kỹ sư. Giao diện phải nói rõ engine đã kiểm những gì, và hệ thống đo xem có ai đang bấm Duyệt quá nhanh không.

### FE làm được trước khi BE xong

Hợp đồng 11 sự kiện cố định từ tuần 1. FE dựng một luồng giả bắn đúng các sự kiện đó theo kịch bản (có tool, không tool, từ chối, lỗi giữa chừng) và hoàn thiện giao diện song song với BE. Đây là lý do hợp đồng SSE phải là **việc tuần 1 của BE**, trước cả khi tool chạy được.

---

## Nhánh RAG — câu hỏi tài liệu, không có vòng lặp

Đây là nhánh **đông nhất**, và là nhánh của câu ví dụ gốc:

> "Giải thích ngắn gọn xem hàm lượng cốt thép tối thiểu của dầm chịu uốn là bao nhiêu"

Router cho `doc_qa`. Không vào AgentCore, không có tool, **một lần gọi Sonnet duy nhất**.

Chi tiết đầy đủ ở [03](03-rag.md). Phần dưới là lối giải thích bám ví dụ.

### Hình dạng: đường thẳng

Kho chunk nằm ở Bedrock Managed Knowledge Base (AD-17). Phần giải thích ba nhánh và RRF bên dưới **không mô tả đường chạy thật** — giữ lại vì đó là cách dễ nhất để hiểu *vì sao* cần nhiều hơn một cách tìm, và vì MKB làm hộ đúng việc đó bên trong. Hình dạng thật của đường chính:

```
câu hỏi đã viết lại
   → có mã điều khoản không?  (regex)
        có → pg_trgm trong PostgreSQL phân giải "6.22" thành "6.2.2"
   → Retrieve của Managed KB
        filter: scope_key ∈ scope của user, status = active [, clause_path]
        numberOfResults = 40   ← mặc định của dịch vụ là 5, phải đặt tay
   → rerank 40 xuống 8
   → NGƯỠNG: đủ căn cứ không?   (bắt đầu 0.5, không phải 0.7)
        không → từ chối, KHÔNG gọi Sonnet
        có    → Sonnet viết, stream về
   → CitationValidator
```

Ba thứ đổi so với hình cũ: embedding và kho vector nay do AWS lo; lọc quyền từ một mệnh đề trong câu SQL thành một **tham số của lời gọi API** (quên là lộ tài liệu của tổ chức khác); và `pg_trgm` ở lại PostgreSQL vì Managed KB không có gì tương đương để tra mã điều khoản gõ gần đúng.


Khác vòng lặp tool ở chỗ: **số bước biết trước**. Chi phí đoán được, độ trễ đoán được.

### Vì sao Managed Knowledge Base chứ không tự dựng kho vector

Kho dự kiến **dưới một triệu chunk** — quy mô đó tự dựng cũng chạy được. Chọn MKB không vì quy mô, mà vì công ty chốt ưu tiên dịch vụ có sẵn của AWS, và vì ba thứ sau biến mất khỏi việc của đội:

1. **Không phải chọn và vận hành kho vector.** Không chỉ mục, không tham số, không sao lưu riêng cho vector.
2. **Không phải tự viết đường nạp embedding.** Managed connector đọc thẳng từ tiền tố S3.
3. **Không thêm hệ thống mới cho DevOps.** PostgreSQL vẫn chỉ là PostgreSQL.

Cái trả giá, đã biết và chấp nhận: **lọc quyền không còn là mệnh đề SQL mà là tham số `filter` của lời gọi API** — quên dựng là lộ tài liệu của organization khác (R46); tham số chỉ mục thành hộp đen; mô hình embedding không đổi được sau khi tạo KB.

Khi nào đưa lại lên bàn: một trong bốn kiểm chứng V-K2 đến V-K5 trượt, hoặc recall theo scope không đạt ở M3. Đo, không đoán trước.

### Ba đường tìm, vì sao cần cả ba

Cùng một câu hỏi, ba cách tìm khác nhau, chạy **song song trong cùng một câu SQL**:

| Đường | Cơ chế | Giỏi gì | Dở gì |
| --- | --- | --- | --- |
| **Vector** (HNSW, cosine) | So nghĩa | "cốt thép tối thiểu" khớp "hàm lượng cốt thép nhỏ nhất", "armature minimale" | Tra số hiệu điều khoản chính xác |
| **FTS** (`tsvector`, `fr_unaccent`) | So từ khóa đã chặt gốc | Bắt đúng thuật ngữ; người dùng gõ **không dấu** vẫn khớp tài liệu **có dấu** | Không hiểu từ đồng nghĩa |
| **Trigram** (`pg_trgm`) | So chuỗi gần đúng | `6.2.2`, `NF EN 1992-1-1` — kể cả gõ sai một ký tự | Vô dụng với câu hỏi không có mã |

Nhánh trigram **chỉ chạy khi regex trích được mã điều khoản** từ câu hỏi. Không có mã thì bỏ nhánh, **không** đẩy cả câu hỏi vào trigram (sẽ ra rác).

Câu ví dụ không có mã điều khoản, nên chỉ hai nhánh chạy.

### RRF — gộp ba bảng xếp hạng

Vấn đề: ba nhánh cho **ba loại điểm không so được với nhau**. Cosine có trần (0 đến 1). BM25 của FTS không có trần. Trigram lại là thang khác.

Giải: **bỏ điểm đi, chỉ dùng thứ hạng.**

```sql
SUM(1.0 / (60 + r))     -- r = thứ hạng trong nhánh đó, k = 60
```

Chunk đứng hạng 1 ở một nhánh được `1/61`. Hạng 2 được `1/62`. Cộng lại từ cả ba nhánh.

Hệ quả: **chunk được nhiều nhánh cùng tìm thấy sẽ vượt lên**, kể cả khi không đứng đầu ở nhánh nào. Đúng ý — ba cách tìm khác nhau cùng chỉ vào một đoạn là tín hiệu mạnh.

Sách *Vector Databases* dùng cộng có trọng số 0,7/0,3 sau khi chuẩn hóa BM25. RRF được chọn vì **bỏ được bước chuẩn hóa và không phải tinh chỉnh trọng số**. Nếu eval cho thấy cần lệch về một nhánh, thêm hệ số cho từng nhánh trong tổng RRF sau.

### Rerank: 40 xuống 8

RRF trả 40 chunk. Rerank (Cohere Rerank 3.5 hoặc Amazon Rerank 1.0, cả hai có ở `eu-central-1`) đọc **cả câu hỏi và từng chunk cùng lúc** rồi chấm lại, giữ 8.

Khác embedding ở chỗ: embedding mã hóa chunk **một mình, lúc nạp**, không biết câu hỏi. Rerank thấy cả hai nên chính xác hơn nhiều.

Đắt hơn và chậm hơn (~200–400ms). Nên nằm sau **cờ tính năng**: chỉ bật nếu cải thiện recall@k trên bộ eval và độ trễ còn trong ngân sách.

### Ngưỡng — hàng rào thật, không phải tùy chọn

**Vector search luôn trả về một cái gì đó.** Hỏi "công thức nấu phở" trên kho tiêu chuẩn kết cấu, nó vẫn trả 40 chunk, xếp hạng đàng hoàng. Chúng chỉ là những chunk **ít vô lý nhất** trong kho.

Nên phải có ngưỡng: điểm tốt nhất dưới `0.7` thì **từ chối trước khi gọi Sonnet**.

Hai cái lợi:
- Không trả tiền cho một câu trả lời sẽ bịa
- Từ chối nhanh hơn trả lời

Ngưỡng `0.7` là điểm **khởi đầu**, phải hiệu chỉnh riêng cho từng mô hình embedding — phân phối điểm của Cohere Embed v4 và Titan V2 khác nhau. Trên `0.8` là rất chắc; dưới `0.6` là "liên quan giả".

Đây là chỗ nối với trần 30% ở slide `promise`: từ chối quá tay cũng là hỏng, nên ngưỡng phải đo hai chiều.

### Mở rộng lân cận

Một điều khoản dài bị cắt làm nhiều chunk. Chunk khớp có thể **thiếu điều kiện áp dụng nằm ở chunk kề bên**.

Nên với top hit thuộc điều khoản bị cắt, lấy thêm `chunk_index ± 1` cùng tài liệu.

Chunk khớp được đánh dấu `is_target` để prompt phân biệt **chunk khớp** và **chunk ngữ cảnh**. Không đánh dấu thì mô hình coi cả hai ngang nhau và có thể trích dẫn nhầm chunk ngữ cảnh.

### Chunk ở đâu ra — khâu nạp

Chất lượng RAG là **vấn đề của khâu tìm kiếm, không phải khâu viết câu trả lời**. Tỉ lệ tìm đúng dưới 60–70% thì tinh chỉnh prompt là vô nghĩa.

Vài quyết định ở khâu nạp ảnh hưởng thẳng tới đó:

| Quyết định | Vì sao |
| --- | --- |
| Cắt theo **ranh giới điều khoản**, không theo số ký tự cứng | Điều khoản cắt đôi thì mất điều kiện áp dụng ở nửa kia. Khởi điểm 800 ký tự, chồng lấn 15%, nhưng **ranh giới điều khoản ưu tiên hơn con số** |
| Bảng thành **JSON riêng**, mỗi chunk kèm tiêu đề cột | Bảng phẳng thành văn xuôi làm mất quan hệ tiêu đề với ô số liệu. Số liệu mất tiêu đề cột là lỗi nguy hiểm |
| Bảng: embedding **tóm tắt**, prompt nhận **JSON đầy đủ** | Tóm tắt giúp tìm được, JSON giúp trả lời đúng |
| Mỗi chunk **tiền tố bằng đường dẫn ngữ cảnh** (`EN 1992-1-1:2004 · 6.2.2 Cắt · trang 84`) trước khi embedding | Vector mang cả vị trí điều khoản, không chỉ nội dung |
| Trang có bảng/công thức đi qua **Claude vision**, trang thường dùng PdfPig | Vision chỉ chạy trên trang cần, giữ chi phí thấp |
| Phát hành **hai bước**: `staged` → eval nhanh 10 câu neo → `active` | Một tài liệu lỗi không được làm hỏng cả kho |
| `document` mang `edition`, `valid_from`, `valid_to`; truy xuất chỉ lấy `active` | Câu trả lời đúng theo bản cũ là câu trả lời **sai** cho người đang làm theo bản mới |

### Một lỗi im lặng phải canh

Bộ lọc `scope_key` rất chọn lọc — tài liệu của một organization là phần nhỏ của kho. Chỉ mục vector với bộ lọc mạnh có thể **trả ít hơn số kết quả yêu cầu hoặc bỏ sót ứng viên, mà không báo lỗi gì**.

Trước AD-17 còn `hnsw.iterative_scan` để chữa. Nay tham số chỉ mục nằm trong hộp đen của MKB, **không có nút nào**. Còn lại đúng hai biện pháp: đặt `numberOfResults = 40` thay cho mặc định 5, và đo. Hỏng thì phải xử lý ở mức quyết định chứ không phải mức cấu hình.

Bắt buộc **đo recall theo từng scope** ở M3. Không đo thì không biết mình đang mất bao nhiêu.

### Ngân sách độ trễ

| Bước | Mục tiêu |
| --- | --- |
| Auth + quota + scope | ≲ 50 ms |
| Guardrail input | song song, không cộng dồn |
| Định tuyến + viết lại (Haiku) | ~300–500 ms |
| Embedding câu hỏi | ~100–200 ms |
| Hybrid SQL | ~50–150 ms |
| Rerank | ~200–400 ms |
| Chữ đầu tiên từ Sonnet | ~1–1,5 s |
| **Tổng tới chữ đầu tiên** | **≲ 3 s** |

Vượt 10 giây thì chỉ báo tiến trình là bắt buộc — đó là lý do sự kiện `status` có trong hợp đồng SSE.

### Việc của ai ở nhánh RAG

| Ai | Việc |
| --- | --- |
| BE | `ScopedKnowledgeBaseClient` (lớp duy nhất được gọi `Retrieve`), chặng `pg_trgm`, ngưỡng, mở rộng lân cận, pipeline nạp ghi chunk ra S3 kèm sidecar, CitationValidator |
| DevOps | Tạo Managed KB + data source + role, bật CloudTrail data event, V-K2 đến V-K5; PostgreSQL cho `pg_trgm` và kho case |
| FE | `retrieval` đến **trước** `token` — hiện danh sách nguồn trước khi có chữ |
| Kỹ sư kết cấu | Bộ câu hỏi neo để đo recall. Không ai khác biết câu nào là câu thật |

---

## Nhánh case lookup — tra kinh nghiệm nội bộ

> "Dự án nào từng làm dầm nhịp 8 mét với bê tông C30 mà không cần tăng tiết diện?"

Router cho `case_lookup`. Đây là nhánh **khác hẳn hai nhánh kia**, vì nó không tra tài liệu và không tính toán — nó tra **việc đơn vị mình đã làm**.

Chi tiết đầy đủ ở [05](05-case-memory.md).

### Vấn đề nó giải

Tiêu chuẩn cho biết **giới hạn được phép**. Nó không cho biết **đơn vị thường chọn phương án nào trong giới hạn đó**.

Khoảng cách giữa "được phép" và "nên làm" là kinh nghiệm, và tài liệu không bao giờ ghi lại phần này. Nó nằm trong đầu vài người, và đi theo họ khi họ nghỉ việc.

### Dữ liệu ở đâu ra: một cú bấm

Thiết kế gốc dự tính một form ghi nhận thủ công. Giả định kèm theo — "kỹ sư sẵn sàng ghi nhận quyết định dưới 2 phút" — là **giả định rủi ro nhất của cả hệ thống**. Sai thì tầng này không có dữ liệu.

Thiết kế hiện tại bỏ hẳn giả định đó:

| | Form thủ công | Thiết kế này |
| --- | --- | --- |
| Nguồn dữ liệu | Kỹ sư nhập tay | `tool_run` đã có schema, sinh ra trong hội thoại |
| Công sức thêm | Mở form, điền, lưu | **Một cú bấm "Duyệt"** trên thẻ kết quả |
| Nếu không bấm | Mất dữ liệu | Không có case — đúng ý, chỉ ghi cái đã được kiểm |
| Chất lượng cấu trúc | Phụ thuộc kỷ luật nhập | Tự đảm bảo: tham số là input tool đã validate |

Ràng buộc từ nguyên tắc P1: **AI không tự ghi case.** Chính thao tác duyệt — có danh tính, có thời điểm — là cái biến một kết quả tính toán thành một tình huống đã được kiểm.

### Tóm tắt sinh bằng template, không dùng LLM

Case sẽ được **người khác trong organization đọc lại**. Nếu LLM viết lời tóm tắt, nó có thể đưa vào tên dự án, chi tiết khách hàng, hoặc một khẳng định sai.

Template chỉ ghép các trường cấu trúc, nên **không thể bịa và không lộ thêm gì ngoài tham số**.

Cùng lý do: case lưu `project_id` (định danh), **không lưu tên dự án**.

### Chống trùng

`dedupe_key = hash(tool_id, tool_version, input đã chuẩn hóa)`.

Mười người cùng duyệt một phép tính giống hệt nhau thì ra **một case**, ghi nhận mười lượt duyệt. Không có bước này thì kho case đầy bản sao và việc tra trở nên vô dụng.

### Tra: lọc cứng trước, chấm điểm sau

Khác RAG ở chỗ **không bắt đầu bằng vector**:

```
0. Gom tham số:   tool_run > pageContext > case_hints
                  (ghi đè theo từng key, không theo cả khối)
                  < 2 key giải được → hỏi lại, dừng tại đây

1. Lọc cứng SQL:  org_id = 42
                  status = 'Approved'
                  tool_id / element_type khớp
   → tối đa 200 ứng viên

2. Chấm điểm:     khoảng cách chuẩn hóa trên similarity_keys
                  (nhịp, cấp bê tông, tải)
   → top 5

3. Tie-break:     vector của summary, CHỈ khi câu hỏi có phần
                  ngôn ngữ tự nhiên

4. Sonnet:        so sánh và diễn giải 5 case
```

**Vì sao số học chứ không vector:** "nhịp 8 mét" và "nhịp 8,2 mét" gần nhau **theo con số**, và đó là định nghĩa "tương tự" đúng ở đây. Vector của câu tóm tắt không nắm được quan hệ đó — nó thấy hai câu chữ na ná nhau, không thấy hai con số cách nhau 0,2 mét.

`similarity_keys` **khai báo trong `tools.manifest.yaml`** cho từng tool. Kỹ sư kết cấu định nghĩa, không phải BE — chỉ họ biết với dầm thì nhịp và cấp bê tông quan trọng hơn hay bề rộng quan trọng hơn.

Khoảng cách tính trong C# trên tập đã lọc nhỏ (≤ 200), nên **không cần chỉ mục đặc biệt**.

**Thiếu key thì tính thế nào.** Chuẩn hóa từng key về `[0,1]` theo dải khai báo trong manifest, lấy trung bình **trên tập key giải được ở cả hai phía**, rồi chia cho `coverage` (tỉ lệ key giải được trên tổng `similarity_keys`). Case khớp 4 trên 5 key thắng case khớp 2 trên 5 khi khoảng cách ngang nhau. Dưới 2 key thì không truy vấn.

**Giá trị chỉ đến từ `case_hints`** mang cờ `unconfirmed` và hiện thành chip cho kỹ sư sửa trước khi tra ([08](08-ux.md) §4a). Bóc sai tham số không để lại dấu vết trong câu trả lời — con số hiển thị là con số thật của một case thật, chỉ sai ở chỗ không liên quan (R45).

### Cách ly giữa các organization

Hồ sơ dự án có thể bị ràng buộc bảo mật với chủ đầu tư. Vì vậy case **không bao giờ vượt ranh giới organization**.

- `org_id` lấy từ **Payment API**, không tin `org_id` do client gửi
- Chỉ `Approved` mới tra được; `Proposed` không bao giờ xuất hiện
- Organization rời hệ thống hoặc yêu cầu xóa (GDPR): **xóa cứng toàn bộ**, kèm `audit_event` bản xóa
- Dự án bị xóa ở Main API: case giữ `project_id` nhưng đánh dấu `project_deleted`, xóa theo chính sách retention

Đây là điểm khác quan trọng với nhánh RAG: RAG có ba mức scope (`public`, `org:*`, `project:*`), case **chỉ có một** — `org_id`. Không có case công khai.

### Trình bày: nhãn bắt buộc

Case hiển thị **tham số, kết quả, người duyệt, ngày**, kèm nhãn rõ ràng:

> **Kinh nghiệm nội bộ, không phải căn cứ tiêu chuẩn**

Hệ thống **không tự áp dụng** case cũ vào bài toán mới. Kỹ sư tự quyết.

Case có ngày duyệt cũ hơn phiên bản tiêu chuẩn hiện hành được gắn cảnh báo **"có thể theo tiêu chuẩn cũ"**. Không có cảnh báo này thì case trở thành đường lan truyền một cách làm đã lỗi thời.

### Việc của ai ở nhánh case

| Ai | Việc |
| --- | --- |
| BE | `POST /v1/approvals/{toolRunId}`, dựng case từ `tool_run`, template summary, dedupe, scorer |
| DevOps | Không có gì riêng — cùng PostgreSQL với RAG |
| FE | Nút Duyệt trên thẻ kết quả, nhãn "kinh nghiệm nội bộ", cảnh báo tiêu chuẩn cũ |
| Kỹ sư kết cấu | Khai `similarity_keys` cho từng tool trong manifest |

### Ba nhánh, so sánh nhanh

| | RAG | Case lookup | Vòng lặp tool |
| --- | --- | --- | --- |
| Tra gì | Tiêu chuẩn, tài liệu | Việc đơn vị đã làm | Không tra, **tính** |
| Số lần gọi mô hình | 1 | 1 | 1 đến 5 |
| Tìm bằng | `Retrieve` của Managed KB + `pg_trgm` phân giải mã điều khoản | Lọc SQL rồi khoảng cách số học | — |
| Phạm vi quyền | `public`, `org`, `project` | Chỉ `org` | Theo `[ApiAccess]` của dự án |
| Dữ liệu ở đâu ra | Kỹ sư phụ trách nạp tài liệu | Kỹ sư bấm Duyệt | Engine tính tại chỗ |
| Chạy ở đâu | C# + PostgreSQL | C# + PostgreSQL | AgentCore Harness |
| Rủi ro chính | Tìm sai đoạn, bịa trích dẫn | Áp dụng kinh nghiệm lỗi thời | Sai đơn vị, sai tham số |

---

## Liên quan

- [02-assistant-service.md](02-assistant-service.md) — đặc tả đầy đủ một lượt, hợp đồng SSE, máy trạng thái
- [03-rag.md](03-rag.md) — đường RAG cố định, hybrid search, RRF, rerank, pipeline nạp
- [05-case-memory.md](05-case-memory.md) — ghi nhận và tra tình huống, cách ly organization
- [04-tool-calling.md](04-tool-calling.md) — ToolGate, manifest, Harness (§8), vòng lặp C# dự phòng (§6)
- [06-tang-bedrock.md](06-tang-bedrock.md) — mô hình, guardrail, chịu lỗi, chi phí
- [12-rui-ro.md](12-rui-ro.md) — R9, R23, R30, V-A1 đến V-A11, Q1 đến Q8
- [14-giai-thich-cho-nguoi-moi.md](14-giai-thich-cho-nguoi-moi.md) — từ điển thuật ngữ
