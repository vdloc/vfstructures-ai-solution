# Bước 5 — Phân loại câu hỏi

Một mô hình nhỏ đọc câu hỏi, dán nhãn ý định, viết lại câu hỏi cho rõ nghĩa và bóc các thông số số học. Nhãn quyết định bước 6 đi nhánh nào.

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/`

## Luồng của bước 5

```
Assistant.Api · ChatOrchestrator
│  Đã có: câu hỏi và pageContext (bước 1), 3 lượt gần nhất (bước 4)
│  Câu hỏi đã qua ApplyGuardrail INPUT
▼
5.1 DỰNG PROMPT                                 Assistant.Api · IntentRouter
│  Làm gì:     Chuẩn bị đầu vào cho Haiku
│  Làm thế nào: System prompt + danh sách similarity_keys từ tools.manifest.yaml
│              + 3 lượt gần nhất + pageContext + câu hỏi
│              Prompt và schema là hằng số có version trong repo
▼
5.2 GỌI HAIKU                                   Bedrock Runtime · Claude Haiku 4.5
│  Làm gì:     Phân loại, viết lại câu hỏi, bóc case_hints trong một lần gọi
│              Chạy ở mọi lượt (AD-15)
│  Làm thế nào: Gọi thẳng Bedrock Runtime, không qua AgentCore Harness
│              Structured output theo JSON schema
│              temperature 0, MaxTokens 300–400
▼
5.3 KIỂM ĐẦU RA                                 Assistant.Api · IntentRouter
│  Làm gì:     Chắc chắn JSON không bị cắt giữa chừng
│  Làm thế nào: Kiểm stopReason khác "max_tokens"
│              ✗ lỗi, quá thời gian, hoặc JSON bị cắt → báo lỗi (5.4)
▼
5.4 BÁO LỖI   (chỉ khi 5.2 hoặc 5.3 hỏng)       Assistant.Api · IntentRouter
│  Làm gì:     Dừng lượt, không đoán nhãn
│  Làm thế nào: Lỗi tạm thời đã được SDK thử lại tối đa 2 lần
│              Vẫn lỗi → event error có retryable, giao diện hiện nút Thử lại
▼
5.5 RẼ NHÁNH                                    Assistant.Api · ChatOrchestrator
   doc_qa, app_help                        → 6a  RetrievalService
   calc, explain_result, mixed, optimize   → 6b  AgentCore Harness
   case_lookup                             → 6c  CaseMemoryService
   out_of_scope                            ✗ Refused
```

## Ví dụ đầu ra của router

```
{
  "intent": "case_lookup",
  "search_query": "dầm nhịp 12 m bê tông C30/37",
  "instruction": "",
  "needs_clarification": false,
  "case_hints": {
    "tool_id": "calc.beam.flexure",
    "params": [
      { "key": "span", "value": 12.0, "unit": "m" },
      { "key": "fck",  "value": 30.0, "unit": "MPa" }
    ]
  }
}
```

## Từ khóa

**IntentRouter**
<!-- alias: IntentRouter -->
- Là gì: Router là thành phần định tuyến: đọc yêu cầu rồi quyết định gửi yêu cầu đó sang đường xử lý nào.
- Ở kiến trúc này: Chạy ở đầu mọi lượt, trong `Assistant.Api`. Gọi Haiku một lần, nhận về nhãn ý định, câu hỏi viết lại và `case_hints`.
- Vì sao: Hỏi tài liệu cần một lần gọi mô hình. Tính toán cần vòng lặp nhiều lần gọi. Hai kiểu chi phí khác hẳn nhau nên phải tách đường ngay từ đầu.
- Nguồn: `02-assistant-service.md` §4 · `19-dac-ta-kien-truc.md` §5.3

**Bedrock Runtime**
<!-- alias: Bedrock Runtime -->
- Là gì: Endpoint của Amazon Bedrock để gọi mô hình trực tiếp, qua các API như `Converse` và `ConverseStream`.
- Ở kiến trúc này: IntentRouter gọi Haiku thẳng qua Bedrock Runtime. AgentCore Harness chỉ được gọi **sau** bước này, và chỉ khi nhãn là nhóm tính toán.
- Vì sao: Router chỉ cần một lần gọi, trả một khối JSON. Đi qua Harness là thêm một lớp vòng lặp không cần thiết.
- Nguồn: `02-assistant-service.md` §3 · `04-tool-calling.md` §8

**Claude Haiku 4.5**
<!-- alias: Haiku -->
- Là gì: Mô hình nhỏ, nhanh và rẻ của Anthropic. ID trên Bedrock: `eu.anthropic.claude-haiku-4-5-20251001-v1:0`.
- Ở kiến trúc này: Làm các việc chạy ở mọi lượt: phân loại, viết lại câu hỏi, tóm tắt lịch sử dài.
- Vì sao: Router chạy ở mọi lượt nên phải rẻ. Haiku cũng hỗ trợ structured output, Sonnet 5 trên Bedrock thì không.
- Nguồn: `06-tang-bedrock.md` §1, §2

**Intent (nhãn ý định)**
<!-- alias: RẼ NHÁNH -->
- Là gì: Tám nhãn: `doc_qa`, `app_help`, `calc`, `explain_result`, `mixed`, `optimize`, `case_lookup`, `out_of_scope`.
- Ở kiến trúc này: Nhãn quyết định bước 6 đi nhánh nào. `out_of_scope` dừng luôn và trả `refusal`.
- Vì sao: Mỗi nhánh có chi phí và độ trễ khác nhau. Hỏi tài liệu chiếm tỉ trọng lớn nhất nên đi đường cố định, một lần gọi Sonnet.
- Nguồn: `02-assistant-service.md` §4 · `ship/02-hop-dong.md` §8

**Structured output**
<!-- alias: Structured output -->
- Là gì: Ép mô hình trả JSON đúng một schema cho trước.
- Ở kiến trúc này: Schema của router quy định `key` của `case_hints` là enum lấy từ manifest, `unit` là enum đơn vị hợp lệ, `value` là số.
- Vì sao: Structured output bảo đảm **hình dạng**, không bảo đảm **nghĩa**. JSON đúng khuôn vẫn có thể phân loại sai.
- Nguồn: `02-assistant-service.md` §4a · `ship/03-backend.md`

**temperature**
<!-- alias: temperature 0 -->
- Là gì: Tham số điều chỉnh độ ngẫu nhiên khi mô hình chọn chữ. 0 là ít ngẫu nhiên nhất.
- Ở kiến trúc này: Router đặt 0.
- Vì sao: Cùng một câu hỏi phải ra cùng một nhãn. Router ra nhãn khác nhau giữa các lần chạy thì không eval được.
- Nguồn: `02-assistant-service.md` §4

**MaxTokens và stopReason**
<!-- alias: MaxTokens 300–400, stopReason -->
- Là gì: `MaxTokens` là trần số token mô hình được viết ra. `stopReason` cho biết mô hình dừng vì sao; `max_tokens` nghĩa là bị cắt vì chạm trần.
- Ở kiến trúc này: Router đặt 300–400, vì khối `case_hints` làm đầu ra dài hơn. Sau mỗi lần gọi phải kiểm `stopReason`.
- Vì sao: Chạm trần thì JSON đứt giữa chừng, structured output không cứu được. Để trống `MaxTokens` thì Bedrock giữ chỗ quota theo mức tối đa của mô hình, gây throttling.
- Nguồn: `02-assistant-service.md` §4a · `06-tang-bedrock.md` §2

**search_query và instruction**
<!-- alias: search_query -->
- Là gì: Router tách câu hỏi làm hai phần. `search_query` là nội dung cần tra, viết lại thành câu độc lập từ lịch sử. `instruction` là phần lệnh như "giải thích", "so sánh", "viết ngắn".
- Ở kiến trúc này: `search_query` đi vào retrieval ở bước 6a, giữ nguyên ngôn ngữ gốc, không dịch. `instruction` đi vào prompt ở bước 7.
- Vì sao: Đưa cả phần lệnh vào retrieval thì các chữ chỉ dẫn làm nhiễu kết quả tìm.
- Nguồn: `02-assistant-service.md` §4a · `ship/02-hop-dong.md` §8

**case_hints (AD-16)**
<!-- alias: case_hints -->
- Là gì: Khối thông số số học router bóc ra từ câu hỏi, kèm đơn vị, ví dụ nhịp 12 m, bê tông fck 30 MPa.
- Ở kiến trúc này: Chỉ nhánh `case_lookup` dùng. Thứ tự tin cậy: `tool_run` lượt trước > `pageContext` > `case_hints`. Giá trị chỉ có từ `case_hints` hiện thành chip cho kỹ sư xác nhận.
- Vì sao: `case_hints` **không bao giờ** vào công thức tính. Nó chỉ dùng để lọc và chấm điểm case cũ.
- Nguồn: `02-assistant-service.md` §4a · `19-dac-ta-kien-truc.md` AD-16

**tools.manifest.yaml và similarity_keys**
<!-- alias: tools.manifest.yaml, similarity_keys -->
- Là gì: File khai báo từng tool: tham số, đơn vị bắt buộc, dải giá trị hợp lệ. `similarity_keys` là danh sách tham số dùng để so độ giống nhau giữa hai case.
- Ở kiến trúc này: Danh sách key, đơn vị và dải giá trị được nhúng vào system prompt của router.
- Vì sao: Không nhúng thì mô hình tự bịa tên tham số. Tài liệu ghi rõ đây là hành vi mặc định, không phải trường hợp hiếm.
- Nguồn: `02-assistant-service.md` §4a · `05-case-memory.md` §4

**pageContext**
<!-- alias: pageContext -->
- Là gì: Thông tin màn hình trình duyệt gửi kèm câu hỏi: module, dự án, cấu kiện, đã tính chưa.
- Ở kiến trúc này: Ba trường `hasResult`, `resultKind`, `calcAt` là bắt buộc. Router dựa vào đó để ra nhãn `explain_result`.
- Vì sao: Thiếu ba trường này thì nhãn `explain_result` không bao giờ xuất hiện. `pageContext` là dữ liệu untrusted, không dùng làm căn cứ phân quyền hay input của engine.
- Nguồn: `ship/02-hop-dong.md` §3 · `02-assistant-service.md` §4

**AD-15**
<!-- alias: AD-15 -->
- Là gì: Quyết định kiến trúc số 15, chốt 20/09/2026: bỏ luật nhanh khỏi đường chính, mọi lượt đều qua IntentRouter.
- Ở kiến trúc này: Luật nhanh cũ phân loại sai câu hỏi hỗn hợp. "6.2.2 tôi tính rồi, dầm B12 có đạt không?" có mã điều khoản nên bị ép thành `doc_qa`, trong khi ý định là `mixed`.
- Vì sao: Cái giá là mọi lượt chậm thêm 300–500 ms, và router thành điểm chết đơn (R44). Router hỏng thì lượt báo lỗi chứ không đoán nhãn, vì đoán `doc_qa` sẽ đưa câu hỏi tính toán sang RAG rồi trả lời trôi chảy về sai việc. Vì vậy phải so Haiku với Nova Lite ở mốc M1.
- Nguồn: `19-dac-ta-kien-truc.md` AD-15 · `02-assistant-service.md` §4

## Chưa rõ trong tài liệu

- Tài liệu không ghi router dùng `Converse` hay `ConverseStream`. Router cần cả khối JSON mới dùng được, nên nhiều khả năng là `Converse`.
- `06-tang-bedrock.md` §2 vẫn tách hai lần gọi: phân loại `maxTokens ~50` và viết lại `~200`. `02-assistant-service.md` §4a (AD-16, mới hơn) gộp thành một lần gọi, trần 300–400.
