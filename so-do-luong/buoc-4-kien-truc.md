# Bước 4 — Lấy lịch sử hội thoại

Bước này lấy các lượt hỏi đáp trước đó trong cùng cuộc trò chuyện, rồi rút gọn lại, để AI hiểu những chữ như "cái đó", "dầm này", "vậy thì sao" đang nói tới cái gì.

Tab này dùng đúng tên thành phần trong kiến trúc. Mỗi thuật ngữ đều có thẻ giải thích ở phần **Từ khóa**.

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/`

## Bước 4 nằm ở đâu trong kiến trúc

```
FE (Panel AI) ──▶ BFF (Next.js) ──▶ Assistant.Api
                                     │
                                     │  Middleware (bước 2)
                                     ▼
                                     ChatOrchestrator
                                     │
                                     │  Task.WhenAll — ba việc cùng lúc, ~300 ms
                                     ├── AccessScopeResolver       (bước 3)
                                     ├── ApplyGuardrail INPUT      (soát câu hỏi)
                                     └── ConversationStore         (bước 4)
                                          │
                                          ├── 3 lượt ──────────▶ IntentRouter (bước 5)
                                          └── 6 hoặc 4 lượt ───▶ ILlmClient   (bước 7)
                                              + bản tóm tắt
```

## Luồng của bước 4

```
Assistant.Api · ChatOrchestrator
│  Nhận POST /v1/chat đã qua middleware, trong body có conversationId
▼
4.1 TÌM HỘI THOẠI                              Assistant.Api · ConversationStore
│  Làm gì:     Xác định câu hỏi nối vào hội thoại nào
│  Làm thế nào: Tra conversationId trong PostgreSQL
│              Chưa có → lượt đầu tiên, trả lịch sử rỗng, xong
▼
4.2 ĐỌC MESSAGE                                PostgreSQL · database assistant
│  Làm gì:     Lấy các message đã lưu của hội thoại
│  Làm thế nào: Bảng conversation 1 ──< n message
│              Lấy lời hỏi, lời đáp, tool_call và tool_result
│              KHÔNG lấy chunk đã truy xuất ở lượt trước
▼
4.3 GOM THÀNH LƯỢT                             Assistant.Api · ConversationStore
│  Làm gì:     Đếm lịch sử theo lượt, không theo message (AD-22)
│  Làm thế nào: Một lượt = message hỏi + tool_call, tool_result nếu có
│              + message đáp
▼
4.4 CỬA SỔ CHO ROUTER                          Assistant.Api · ConversationStore
│  Làm gì:     Bản ngắn, đủ để phân loại và viết lại câu hỏi
│  Làm thế nào: 3 lượt gần nhất
▼
4.5 CỬA SỔ CHO ĐƯỜNG TRẢ LỜI                   Assistant.Api · ConversationStore
│  Làm gì:     Bản dài hơn, đủ giữ mạch hội thoại
│  Làm thế nào: Từ 6 lượt trở xuống → giữ hết
│              Hơn 6 lượt → 4 lượt gần nhất + bản tóm tắt các lượt cũ
│              Ba con số 3 / 6 / 4 đọc từ ConversationWindowOptions
▼
4.6 TÓM TẮT LƯỢT CŨ  (chỉ khi hơn 6 lượt)      Bedrock · Claude Haiku 4.5
│  Làm gì:     Gộp các lượt cũ thành một đoạn ngắn
▼
Kết quả
   ├─▶ IntentRouter (bước 5): 3 lượt gần nhất
   └─▶ ILlmClient   (bước 7): xếp vào prompt theo thứ tự
          tools + system prompt      cachePoint ttl = 1 giờ
          bản tóm tắt lượt cũ        cachePoint ttl = 5 phút
          lượt gần nhất              không cache
          chunk, tool_result, câu hỏi của lượt này

Ghi và xóa (không thuộc bước 4, nhưng quyết định bước 4 đọc được gì):
   ApplyGuardrail ANONYMIZE che PII trước khi ghi message
   Mỗi message có expires_at = ngày tạo + retention (đề xuất 90 ngày)
   Job chạy hằng ngày xóa cứng message, tool_run, retrieval_log quá hạn
```

## Ví dụ: hội thoại đã có 8 lượt, người dùng gửi câu thứ 9

```
Lịch sử:      [1] [2] [3] [4] [5] [6] [7] [8]    câu mới [9]

IntentRouter:                     [6] [7] [8]  + [9]
ILlmClient:   └── tóm tắt ──┘ [5] [6] [7] [8]  + [9]
```

8 lượt là hơn 6, nên đường trả lời giữ 4 lượt gần nhất, còn lượt 1 đến 4 gộp thành một bản tóm tắt do Haiku viết.

## Từ khóa

### Nhóm A · Thành phần

**Assistant.Api**
- Là gì: Service backend viết bằng .NET 8. "Service" là một chương trình chạy riêng trên máy chủ, nhận request qua mạng và trả kết quả.
- Ở kiến trúc này: Service mới, xây riêng cho trợ lý AI. Bước 2 đến bước 10 gần như đều chạy trong service này. Main API (engine tính toán đang chạy nhiều năm) không bị sửa.
- Vì sao: Tách riêng thì lỗi hoặc tải nặng của phần AI không kéo sập hệ thống tính toán đang chạy.
- Nguồn: `01-kien-truc-tong-the.md` §2 · `19-dac-ta-kien-truc.md` §5.2

**ChatOrchestrator**
- Là gì: "Orchestrator" là thành phần điều phối: nó không tự làm việc chuyên môn mà gọi các thành phần khác theo đúng thứ tự.
- Ở kiến trúc này: Nắm máy trạng thái của một lượt hỏi. Nó gọi bước 3, việc soát câu hỏi và bước 4 cùng lúc, rồi chuyển kết quả cho bước 5.
- Vì sao: Gom logic "làm gì trước, làm gì sau, lỗi thì rẽ đi đâu" vào một chỗ, các thành phần còn lại chỉ lo một việc của mình.
- Nguồn: `19-dac-ta-kien-truc.md` §5.3 · `02-assistant-service.md` §2

**ConversationStore**
- Là gì: "Store" là thành phần chuyên đọc và ghi một loại dữ liệu. Code khác muốn lấy dữ liệu đó thì phải đi qua nó.
- Ở kiến trúc này: Chịu trách nhiệm đọc lịch sử từ PostgreSQL, gom thành lượt, cắt theo cửa sổ và gọi tóm tắt khi cần.
- Vì sao: Quy tắc cửa sổ (3 / 6 / 4, đếm theo lượt, không lấy chunk) nằm ở một chỗ. Đổi quy tắc thì chỉ sửa một nơi.
- Nguồn: `02-assistant-service.md` §2, §7

**PostgreSQL · database `assistant`**
- Là gì: PostgreSQL là hệ quản trị cơ sở dữ liệu quan hệ: dữ liệu lưu thành bảng có cột, các bảng nối với nhau bằng khóa.
- Ở kiến trúc này: Database **mới**, tách khỏi database VFSoftware đang có. Chứa hội thoại, message, tool_run, case, audit_event.
- Vì sao: Dữ liệu của trợ lý AI có vòng đời riêng (xóa sau 90 ngày, xóa theo yêu cầu). Để chung database cũ thì khó tách quyền và khó xóa sạch.
- Nguồn: `01-kien-truc-tong-the.md` §2 · `19-dac-ta-kien-truc.md` §5.2

**Bảng `conversation` và `message`**
- Là gì: Quan hệ một-nhiều: một hội thoại chứa nhiều message. Mỗi message là một câu hỏi hoặc một câu trả lời.
- Ở kiến trúc này: Message còn nối tới `tool_run` (các lần gọi engine), `citation` (trích dẫn) và `audit_event` (nhật ký). Bước 4 đọc message và tool_run, bỏ qua citation.
- Vì sao: Tách message khỏi tool_run thì kết quả tính giữ nguyên dạng JSON, lượt sau dùng lại được làm thông số tra trường hợp cũ.
- Nguồn: `19-dac-ta-kien-truc.md` §8.1

**`conversationId`**
- Là gì: Mã định danh dạng UUID, là một chuỗi ngẫu nhiên đủ dài để gần như không bao giờ trùng.
- Ở kiến trúc này: Trình duyệt tự sinh ở câu đầu tiên và gửi kèm mọi câu sau. Trình duyệt **chỉ** gửi mã, không gửi lịch sử. Bấm "Phiên mới" thì sinh mã mới.
- Vì sao: Máy chủ tự giữ lịch sử thì trình duyệt không sửa được lịch sử gửi cho AI, và phần đầu prompt giữ ổn định để nhớ đệm được.
- Nguồn: `ship/02-hop-dong.md` §2 · `02-assistant-service.md` §7

**Amazon Bedrock · Claude Haiku 4.5**
- Là gì: Amazon Bedrock là dịch vụ AWS cho gọi các mô hình AI qua một cổng chung, trả phí theo token. Claude Haiku 4.5 là mô hình nhỏ, nhanh và rẻ của Anthropic.
- Ở kiến trúc này: Haiku làm các việc chạy thường xuyên, cần nhanh: phân loại câu hỏi ở bước 5, tóm tắt lượt cũ ở bước 4. Câu trả lời chính do Claude Sonnet 5 viết.
- Vì sao: Tóm tắt không cần suy luận sâu. Dùng mô hình lớn cho việc này là tốn tiền và chậm vô ích.
- Nguồn: `kien-truc-day-du.md` §3.5 · `02-assistant-service.md` §7

**`ApplyGuardrail` và `guardrailConfig`**
- Là gì: Hai cách dùng Bedrock Guardrails, bộ lọc an toàn của AWS. `ApplyGuardrail` là API gọi riêng để soát một đoạn văn bản, không kèm lời gọi mô hình nào. `guardrailConfig` là cấu hình gắn thẳng vào lời gọi mô hình, soát đầu vào và đầu ra của chính lời gọi đó.
- Ở kiến trúc này: Bước 4 chạy song song với `ApplyGuardrail` INPUT. Lời gọi này chặn prompt attack và chủ đề cấm, đồng thời che PII (ANONYMIZE) trước khi câu hỏi tới Haiku và trước khi ghi `message`. `guardrailConfig` dùng ở bước 7, khi Sonnet 5 viết câu trả lời, chế độ `sync`. `ApplyGuardrail` còn được gọi ở tool facade (bước 6b) và sau bước 8.
- Vì sao: `guardrailConfig` không soát `toolResult`, nên nội dung do công cụ trả về phải qua một lời gọi `ApplyGuardrail` riêng. Thiếu `guardrailVersion` thì guardrail không chạy mà không báo lỗi.
- Nguồn: `06-tang-bedrock.md` §4 · `07-auth-bao-mat.md` §6 · `ship/06-bao-mat.md`

### Nhóm B · Cách lấy lịch sử

**`Task.WhenAll`**
- Là gì: Hàm của .NET cho chạy nhiều việc bất đồng bộ cùng lúc và chờ tới khi tất cả xong.
- Ở kiến trúc này: ChatOrchestrator chạy cùng lúc ba việc: lấy scope, soát câu hỏi, lấy lịch sử. Tổng khoảng 300 ms.
- Vì sao: Ba việc không phụ thuộc nhau. Chạy lần lượt thì mỗi câu hỏi chậm thêm vài trăm mili giây trước khi AI bắt đầu viết.
- Nguồn: `ship/03-backend.md` · `02-assistant-service.md` §3

**Lượt (turn) và message**
- Là gì: Message là một mẩu trong hội thoại. Lượt là một câu hỏi cùng mọi thứ xảy ra để trả lời nó, gồm cả `tool_call` (AI yêu cầu gọi engine) và `tool_result` (engine trả kết quả).
- Ở kiến trúc này: Mọi con số của cửa sổ lịch sử đều đếm theo lượt. Đây là quyết định AD-22.
- Vì sao: Lượt có gọi engine sinh thêm nhiều message. Đếm theo message thì cửa sổ lúc rộng lúc hẹp tùy loại câu hỏi.
- Nguồn: `19-dac-ta-kien-truc.md` AD-22 · `02-assistant-service.md` §7

**Context window và context rot**
- Là gì: Context window là giới hạn số token tối đa mô hình đọc được trong một lần gọi. Context rot là hiện tượng mô hình suy luận kém dần khi đầu vào quá dài và lẫn nhiều thứ không liên quan.
- Ở kiến trúc này: Lý do bước 4 không gửi cả hội thoại, dù context window của Sonnet 5 đủ chứa.
- Vì sao: Sách xếp việc nhồi cả lịch sử vào đầu vào là anti-pattern: "chạy được khi demo, sai khi lên production".
- Nguồn: *AI Agents on AWS* ch3, qua `ship/00-thuat-ngu-va-nguon.md`

**Sliding window (cửa sổ trượt)**
- Là gì: Chỉ giữ N phần tử gần nhất. Có phần tử mới thì phần tử cũ nhất bị đẩy ra.
- Ở kiến trúc này: IntentRouter nhận 3 lượt. Đường trả lời nhận tối đa 6 lượt, dài hơn thì 4 lượt kèm tóm tắt.
- Vì sao: Rẻ nhất trong các cách quản lý lịch sử. Cái giá là quên chi tiết ở đầu hội thoại, nên phải ghép thêm tóm tắt.
- Nguồn: `19-dac-ta-kien-truc.md` AD-22 · *AI Agents on AWS* ch3

**Compaction (tóm tắt)**
- Là gì: Thay nhiều lượt cũ bằng một bản tóm tắt ngắn, thay vì bỏ hẳn.
- Ở kiến trúc này: Chỉ chạy khi hội thoại hơn 6 lượt. Haiku viết bản tóm tắt.
- Vì sao: Giữ được ý chính của hội thoại dài. Cái giá là mất chi tiết nhỏ ở các lượt cũ. Sách ghi hệ thống production thường ghép sliding window với compaction.
- Nguồn: `02-assistant-service.md` §7 · *AI Agents on AWS* ch3

**Bộ nhớ ngắn hạn và dài hạn**
- Là gì: Ngắn hạn là "đang nói chuyện gì", tức lịch sử gần. Dài hạn là "biết gì", tức kho tri thức lưu lâu.
- Ở kiến trúc này: Bước 4 chỉ lo bộ nhớ ngắn hạn. Bộ nhớ dài hạn đi qua bước 6: Bedrock Knowledge Base cho tài liệu, bảng `case` cho trường hợp đã tính đạt.
- Vì sao: Dùng lịch sử làm kho tri thức thì phải giữ lịch sử rất dài, quay lại đúng vấn đề context rot.
- Nguồn: *AI Agents in Action* ch8 · *AI Agents on AWS* ch3

**`ConversationWindowOptions`**
- Là gì: Class cấu hình theo Options pattern của .NET: các con số nằm trong file cấu hình, code đọc qua một class có kiểu rõ ràng.
- Ở kiến trúc này: Chứa ba con số 3 / 6 / 4. Không được viết cứng trong code.
- Vì sao: Ba con số sẽ chỉnh lại ở mốc M1 sau khi đo thực tế. Để trong cấu hình thì đổi số không cần sửa code.
- Nguồn: `ship/03-backend.md` · `20-tai-lieu-thiet-ke-kien-truc.md`

**AD-22**
- Là gì: "AD" là Architecture Decision, một bản ghi quyết định kiến trúc có đánh số: quyết định gì, các phương án đã cân nhắc, cái giá phải trả, trạng thái.
- Ở kiến trúc này: AD-22 chốt ngày 20/09/2026: cửa sổ lịch sử đếm theo lượt, router 3 lượt, đường trả lời 6 / 4 lượt kèm tóm tắt. Hai phương án bị loại: gửi toàn bộ lịch sử, và cắt cứng theo số message.
- Vì sao: Ghi lại lý do để người sau không lặp lại tranh luận cũ, và biết phải đo gì trước khi đổi.
- Nguồn: `20-tai-lieu-thiet-ke-kien-truc.md` AD-22

### Nhóm C · Chi phí

**Token**
- Là gì: Đơn vị mô hình AI dùng để đọc và viết chữ, cỡ một phần của một từ. Bedrock tính tiền theo số token vào và ra.
- Ở kiến trúc này: Hạn mức ngày của người dùng tính theo token (bước 2). Mỗi lượt lịch sử gửi kèm là thêm token phải trả.
- Vì sao: Đây là lý do cửa sổ lịch sử phải có giới hạn.
- Nguồn: `07-auth-bao-mat.md` §2a · `06-tang-bedrock.md` §9

**Prompt caching · `cachePoint` · TTL**
- Là gì: Prompt caching cho phép Bedrock nhớ lại phần đầu prompt giống hệt lần trước, nên lần sau rẻ và nhanh hơn. `cachePoint` là mốc đánh dấu "nhớ tới đây". TTL là thời gian nhớ trước khi hết hạn.
- Ở kiến trúc này: Tools và system prompt nhớ 1 giờ. Bản tóm tắt lượt cũ nhớ 5 phút. Lượt gần nhất nằm sau mọi `cachePoint` nên không được nhớ.
- Vì sao: Dễ lầm tưởng thêm lịch sử là "gần như miễn phí nhờ cache". Thực tế lịch sử gần nhất trả đủ giá mỗi lượt: thêm một lượt vào cửa sổ là mọi lượt sau trong phiên đều đắt thêm.
- Nguồn: `06-tang-bedrock.md` §5 · `ship/00-thuat-ngu-va-nguon.md`

### Nhóm D · Dữ liệu

**Chunk**
- Là gì: Một đoạn tài liệu đã cắt nhỏ, là đơn vị mà hệ thống tìm kiếm trả về.
- Ở kiến trúc này: Bước 4 **không** đưa chunk của lượt trước vào lịch sử. Mỗi lượt tự tìm chunk mới ở bước 6 theo câu hỏi đã viết lại.
- Vì sao: Chunk cũ có thể lạc đề với câu hỏi mới, và trích dẫn `[1]` `[2]` sẽ trỏ lẫn giữa các lượt.
- Nguồn: `02-assistant-service.md` §7

**Retention · `expires_at` · xóa cứng**
- Là gì: Retention là thời hạn giữ dữ liệu. `expires_at` là cột ghi ngày hết hạn của từng dòng. Xóa cứng là xóa hẳn khỏi database, không khôi phục được, khác với xóa mềm chỉ đánh dấu "đã xóa".
- Ở kiến trúc này: Message, tool_run, retrieval_log giữ đề xuất 90 ngày. Một job chạy hằng ngày xóa cứng những dòng quá hạn. Người dùng xóa hội thoại, hoặc yêu cầu xóa dữ liệu cá nhân, cũng dẫn tới xóa cứng. Chỉ giữ số liệu tổng hợp và `audit_event` không chứa nội dung.
- Vì sao: Câu hỏi có thể chứa thông tin cá nhân hoặc bí mật của chủ đầu tư. Giữ mãi là giữ rủi ro mãi.
- Nguồn: `07-auth-bao-mat.md` §6

**PII · `ApplyGuardrail` ANONYMIZE**
- Là gì: PII (Personally Identifiable Information) là thông tin nhận diện được một người: tên, email, số điện thoại. `ApplyGuardrail` là API của Bedrock Guardrails, chế độ ANONYMIZE thay PII bằng nhãn che.
- Ở kiến trúc này: Che PII **trước** khi đưa cho mô hình và **trước** khi ghi bảng message. Hệ thống chỉ lưu và dùng bản đã che, nên bước 4 lần sau đọc ra cũng là bản đã che.
- Vì sao: Lưu bản gốc thì PII nằm lại trong database và nhật ký. Che không chống được việc ghép dữ liệu để nhận diện lại, nên vẫn phải tách dữ liệu theo organization.
- Nguồn: `07-auth-bao-mat.md` §6

**GDPR · DPO**
- Là gì: GDPR là quy định bảo vệ dữ liệu cá nhân của EU. DPO (Data Protection Officer) là người phụ trách bảo vệ dữ liệu của công ty.
- Ở kiến trúc này: Hệ thống chạy ở vùng AWS `eu-central-1` và có người dùng ở Pháp. Con số retention cuối cùng và cơ sở pháp lý để lưu lịch sử do DPO quyết, không do đội kỹ thuật.
- Vì sao: Lưu lịch sử hội thoại có thể được xem là xử lý dữ liệu cá nhân. Phải trả lời câu hỏi này trước khi chạy beta.
- Nguồn: `07-auth-bao-mat.md` §6 · `06-tang-bedrock.md` §10a

## Chưa rõ trong tài liệu

- Bản tóm tắt lượt cũ được sinh **lúc nào**: ngay trong lượt hỏi (lượt đó chậm thêm một lần gọi Haiku), hay sinh sẵn sau mỗi lượt rồi lưu lại.
- Tài liệu chưa có quy tắc gì ngăn bản tóm tắt do Haiku viết thêm thông tin sai. Ở phần case memory, tài liệu lại cố tình **không** dùng AI để tóm tắt vì đúng lý do này.
- Sequence ở `02-assistant-service.md` §3 chỉ ghi đọc 3 lượt trong pha song song. Tài liệu chưa nói cửa sổ 6 / 4 lượt cho đường trả lời được đọc cùng lúc đó hay đọc lại lần nữa trước bước 7.
