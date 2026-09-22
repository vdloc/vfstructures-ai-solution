# 05 · Thi công — đội DevOps AWS

**Ai đọc:** đội DevOps. Backend đọc mục 4B và 4D để biết ranh giới.

**Mục lục**

- Vì sao tài liệu này bắt đầu bằng bốn lệnh gọi thử
- Vì sao phần lớn việc nằm ở bước 4
- Ba cái bẫy chỉ xuất hiện ở production
- Thuật ngữ trong tài liệu này
- Ký hiệu
- Việc đầu tiên: bốn lệnh gọi thử trên tài khoản thật
- Bước 1 — Cho SSE đi qua được
- Bước 2 — Guardrail và quyền
- Bước 3 — Quota và vòng đời mô hình
- Bước 4 — Phần lớn việc của DevOps
- Bước 5 — Quan sát
- Bước 6 — Không có việc riêng
- Chi phí: cái gì chiếm bao nhiêu
- Bảng tra nhanh: cái gì không bao giờ được làm

---

## Vì sao tài liệu này bắt đầu bằng bốn lệnh gọi thử

Trước khi dựng bất cứ thứ gì, phải biết **tài khoản AWS của công ty đang vướng cổng nào**. Có ba loại cổng chặn hoàn toàn độc lập với nhau, mỗi loại một thủ tục và một thời gian chờ khác nhau:

1. **Thỏa thuận Marketplace** với nhà cung cấp mô hình — cần phương thức thanh toán, thời gian khó đoán.
2. **Biểu mẫu mô tả trường hợp sử dụng** của nhà cung cấp mô hình.
3. **Hạn mức bằng 0** — có quyền gọi nhưng AWS chưa cấp dung lượng.

Ba thứ này hay bị gộp thành một dòng trong kế hoạch. Chúng không phải một việc. Bốn lệnh ở đầu tài liệu mất vài phút và **không ai trả lời thay được** — chỉ có gọi thật mới biết.

## Vì sao phần lớn việc nằm ở bước 4

Bước 1 tới 3 là hạ tầng chung. Bước 4 là nơi ba dịch vụ AWS mới được dựng: kho tài liệu quản lý sẵn, vòng lặp gọi hàm, và lớp phân quyền cho tool. Đây cũng là nơi tập trung **loại lỗi nguy hiểm nhất của cả dự án**: mặc định sai mà hệ thống vẫn chạy.

Ví dụ điển hình: dịch vụ vòng lặp của AWS bật sẵn công cụ chạy lệnh shell và thao tác file, đặt số vòng tối đa 75, đặt thời gian chờ một tiếng. Không đụng vào thì **mọi thứ vẫn chạy** — chỉ là một lượt hỏi có thể chạy một tiếng và mô hình có quyền chạy lệnh.

## Ba cái bẫy chỉ xuất hiện ở production

Tài liệu đánh dấu riêng ba chỗ này vì chúng **không hỏng ở môi trường dev**:

| Bẫy | Vì sao dev không thấy |
| --- | --- |
| Proxy gom response rồi trả một lần | Dev không đi qua proxy. Không có lỗi nào trong log |
| Phiên agent không khởi động vì thiếu VPC endpoint cho ECR và S3 | Dev chạy ngoài mạng riêng |
| Nhánh tài liệu chết vì thiếu một VPC endpoint | Lời gọi mô hình và lời gọi tìm kiếm đi qua **hai endpoint khác nhau** |

## Thuật ngữ trong tài liệu này

Giải thích đầy đủ ở [00-thuat-ngu-va-nguon.md](00-thuat-ngu-va-nguon.md), kèm link tài liệu AWS. Bản rút gọn:

| Thuật ngữ | Một câu |
| --- | --- |
| **Quota / throttling** | Hạn mức gọi mô hình mỗi phút. Vượt thì AWS trả lỗi `ThrottlingException` |
| **Guardrails** | Bộ lọc nội dung của Bedrock. Thiếu số phiên bản thì **không chạy và không báo lỗi** |
| **Managed Knowledge Base** | Dịch vụ RAG quản lý sẵn: embedding, vector store, `Retrieve` |
| **Managed connector** | Cách MKB đọc dữ liệu từ S3. Hình dạng cấu hình **khác** đường tự quản |
| **Sidecar** | File `.metadata.json` đi kèm mỗi chunk, là thứ dùng để lọc |
| **CloudTrail data event** | Loại log **không được ghi mặc định**. `Retrieve` thuộc loại này |
| **AgentCore Harness** | Dịch vụ quản vòng lặp gọi hàm của AWS |
| **Cedar** | Ngôn ngữ chính sách phân quyền, chạy ở Gateway |
| **NAT gateway** | Cổng ra internet cho mạng riêng. Chạy liên tục, tính tiền liên tục |
| **VPC endpoint** | Lối đi riêng tới một dịch vụ AWS, không qua internet |

## Ký hiệu

**[CHẶN]** đội khác không làm được nếu thiếu · **[CHỜ]** đang chờ đội khác.

Thiết kế đầy đủ ở [01](01-kien-truc.md). Triển khai chi tiết ở [09](09-trien-khai.md). Bảo mật ở [06](06-bao-mat.md).

---

## Việc đầu tiên: bốn lệnh gọi thử trên tài khoản thật

Việc này mất vài phút và **không ai trả lời thay được**. Nó cho biết tài khoản của công ty đang vướng cổng nào.

```bash
REGION=eu-central-1

# 1. Sonnet 5
aws bedrock-runtime converse --region $REGION \
 --model-id eu.anthropic.claude-sonnet-5 \
 --messages '[{"role":"user","content":[{"text":"ping"}]}]' \
 --inference-config '{"maxTokens":16}'

# 2. Haiku 4.5
aws bedrock-runtime converse --region $REGION \
 --model-id eu.anthropic.claude-haiku-4-5-20251001-v1:0 \
 --messages '[{"role":"user","content":[{"text":"ping"}]}]' \
 --inference-config '{"maxTokens":16}'

# 3. Trạng thái vòng đời mô hình (R23)
aws bedrock get-foundation-model --region $REGION \
 --model-identifier anthropic.claude-haiku-4-5-20251001-v1:0

# 4. Quota thật
aws service-quotas list-service-quotas --region $REGION \
 --service-code bedrock --query "Quotas[?contains(QuotaName,'Claude')]"
```

**Ba loại cổng khác nhau, mỗi loại một lỗi và một cách gỡ:**

| Lỗi nhận được | Nghĩa là | Cách gỡ | Thời gian chờ |
| --- | --- | --- | --- |
| `AccessDeniedException` | Chưa có thỏa thuận Marketplace cho nhà cung cấp | Đăng ký qua AWS Marketplace, cần phương thức thanh toán | Khó đoán |
| `ResourceNotFoundException` + "Model use case details have not been submitted" | Chưa gửi biểu mẫu mô tả trường hợp sử dụng | Điền biểu mẫu trong console Bedrock | Vài giờ đến vài ngày |
| `ThrottlingException`, hoặc quota `0.0` | Có quyền nhưng quota bằng 0 | Mở ticket tăng quota | 1–3 ngày làm việc |

**R43 · Ba cổng này hay bị gộp thành một việc.** Chúng là ba thủ tục độc lập với ba thời gian chờ khác nhau. Biết sớm là đáng giá — đó là lý do việc này đứng đầu danh sách.

---

## Bước 1 — Cho SSE đi qua được

Đây là cái bẫy **không xuất hiện ở môi trường dev**, vì dev không đi qua proxy.

### Phải làm

- ALB: `idle_timeout` ≥ 120 giây. Lượt `optimize` có trần 90 giây; timeout 60 giây sẽ cắt ngang và FE nhận luồng đứt không có `done`.
- CloudFront: **không cache** đường `/v1/chat`, và không buffer.
- Nếu có nginx hoặc ingress controller: `proxy_buffering off`, `proxy_read_timeout 120s`.
- Backend đặt header `X-Accel-Buffering: no` — DevOps xác nhận header này đi tới được đầu cuối.

### Nghiệm thu

```bash
curl -N -H "Authorization: Bearer $TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"conversationId":"c-1","message":"ping","context":{}}' \
 https://<đúng tuyến production>/v1/chat
```

Sự kiện phải đến **rời rạc theo thời gian**, không dồn thành một cục ở cuối. Chạy qua đúng tuyến production, **không chỉ localhost**.

### Rủi ro

**OPS-1 · Proxy mặc định gom response rồi trả một lần.** Khi đó chữ không hiện dần và người dùng nhìn màn hình trắng 20 giây. Không có lỗi nào xuất hiện ở log.

**OPS-2 · Idle timeout quá ngắn cắt ngang lượt dài**, và FE nhận được luồng đứt không có sự kiện `done`.

---

## Bước 2 — Guardrail và quyền

### Phải làm

- [CHẶN] Tạo guardrail ở `eu-central-1`: denied topics, prompt attack, PII filter. Các bước chạy được, bốn file cấu hình và bộ câu thử ở **Bước 2A** ngay dưới.
- Thứ **phải bắt chắc chắn** — căn cước, SIRET, mã dự án nội bộ — đi vào `regexesConfig`, không trông vào bộ nhận dạng sẵn.
- Execution role có `bedrock:ApplyGuardrail` **giới hạn đúng ARN guardrail đó**, không dùng `bedrock:*`.
- Mã hóa CloudWatch Logs bằng KMS, đặt thời hạn lưu trữ, giới hạn quyền đọc log.
- Cờ kill switch trong Parameter Store, có kiểm soát ai gạt được.
- Ghi rõ: prompt routing của Haiku **cũng phải** kèm guardrail, vì khối Deny trong IAM policy chặn nó.

### Rủi ro

**OPS-3 · Che PII của Guardrails chỉ áp dụng cho response của API.** Nội dung gốc chưa che, **gồm cả PII, vẫn được ghi nguyên văn vào CloudWatch Logs**. Với yêu cầu GDPR, đây là chỗ bắt buộc mã hóa log bằng KMS và giới hạn quyền đọc.

**OPS-4 · Bộ nhận dạng PII sẵn có không bắt đúng tuyệt đối.** Phần dựa vào mô hình luôn có bỏ sót, nên guardrail **không bao giờ là lớp bảo vệ duy nhất** — lớp chính vẫn là validator tất định và ToolGate.

---

## Bước 2A — Runbook tạo guardrail

[06](06-bao-mat.md) §13 nêu quyết định. Mục này là **các bước chạy được**, viết cho người thực thi. Mọi tham số dưới đây đối chiếu trực tiếp với schema `aws bedrock create-guardrail` (AWS CLI v2), không lấy từ trí nhớ.

### 2A.1 Ba điều phải biết trước khi gõ lệnh

1. **Không có guardrail mặc định.** AWS không bật sẵn cái nào. Không tạo thì không có gì được áp. Đây là khác biệt so với trực giác thông thường về "dịch vụ có sẵn hàng rào".
2. **Guardrail chỉ chạy khi lời gọi khai nó.** Bỏ trường khai ra khỏi mã là mọi bộ lọc biến mất, **và không có lỗi nào báo**. Xem mục 2A.7.
3. **Tạo xong là bản `DRAFT`, chưa dùng được ở production.** Phải chốt thành bản đánh số bằng một lệnh thứ hai. Xem mục 2A.6.

### 2A.2 Bốn file cấu hình

Đặt cùng một thư mục, ví dụ `infra/guardrail/`.

**`content.json` — sáu bộ lọc nội dung**

```json
{
  "filtersConfig": [
    { "type": "PROMPT_ATTACK", "inputStrength": "HIGH",   "outputStrength": "NONE",   "inputModalities": ["TEXT"], "outputModalities": ["TEXT"], "inputAction": "BLOCK", "inputEnabled": true, "outputEnabled": false },
    { "type": "MISCONDUCT",    "inputStrength": "MEDIUM", "outputStrength": "MEDIUM", "inputModalities": ["TEXT"], "outputModalities": ["TEXT"], "inputAction": "BLOCK", "outputAction": "BLOCK", "inputEnabled": true, "outputEnabled": true },
    { "type": "HATE",          "inputStrength": "MEDIUM", "outputStrength": "MEDIUM", "inputModalities": ["TEXT"], "outputModalities": ["TEXT"], "inputAction": "BLOCK", "outputAction": "BLOCK", "inputEnabled": true, "outputEnabled": true },
    { "type": "INSULTS",       "inputStrength": "MEDIUM", "outputStrength": "MEDIUM", "inputModalities": ["TEXT"], "outputModalities": ["TEXT"], "inputAction": "BLOCK", "outputAction": "BLOCK", "inputEnabled": true, "outputEnabled": true },
    { "type": "SEXUAL",        "inputStrength": "MEDIUM", "outputStrength": "MEDIUM", "inputModalities": ["TEXT"], "outputModalities": ["TEXT"], "inputAction": "BLOCK", "outputAction": "BLOCK", "inputEnabled": true, "outputEnabled": true },
    { "type": "VIOLENCE",      "inputStrength": "LOW",    "outputStrength": "LOW",    "inputModalities": ["TEXT"], "outputModalities": ["TEXT"], "inputAction": "BLOCK", "outputAction": "BLOCK", "inputEnabled": true, "outputEnabled": true }
  ],
  "tierConfig": { "tierName": "CLASSIC" }
}
```

Sáu loại là danh sách cố định của AWS, không thêm bớt: `SEXUAL`, `VIOLENCE`, `HATE`, `INSULTS`, `MISCONDUCT`, `PROMPT_ATTACK`.

**`VIOLENCE` để `LOW` là cố ý.** Ngành kết cấu dùng "phá hoại do cắt", "sụp đổ", "phá hủy mẫu thử" làm thuật ngữ. Bộ lọc không biết ngành này; đặt `HIGH` sẽ chặn nhầm câu hỏi kỹ thuật hợp lệ và kỹ sư sẽ báo lỗi phần mềm. Xác nhận lại bằng nhóm câu hỏi đối kháng ở eval trước khi chốt.

**`PROMPT_ATTACK` để `outputStrength` là `NONE`** vì loại này chỉ có nghĩa ở chiều vào.

**`pii.json` — thông tin cá nhân**

```json
{
  "piiEntitiesConfig": [
    { "type": "NAME",    "action": "ANONYMIZE", "inputAction": "ANONYMIZE", "outputAction": "ANONYMIZE", "inputEnabled": true, "outputEnabled": true },
    { "type": "EMAIL",   "action": "ANONYMIZE", "inputAction": "ANONYMIZE", "outputAction": "ANONYMIZE", "inputEnabled": true, "outputEnabled": true },
    { "type": "PHONE",   "action": "ANONYMIZE", "inputAction": "ANONYMIZE", "outputAction": "ANONYMIZE", "inputEnabled": true, "outputEnabled": true },
    { "type": "ADDRESS", "action": "ANONYMIZE", "inputAction": "ANONYMIZE", "outputAction": "ANONYMIZE", "inputEnabled": true, "outputEnabled": true },

    { "type": "PASSWORD",        "action": "BLOCK", "inputAction": "BLOCK", "outputAction": "BLOCK", "inputEnabled": true, "outputEnabled": true },
    { "type": "AWS_ACCESS_KEY",  "action": "BLOCK", "inputAction": "BLOCK", "outputAction": "BLOCK", "inputEnabled": true, "outputEnabled": true },
    { "type": "AWS_SECRET_KEY",  "action": "BLOCK", "inputAction": "BLOCK", "outputAction": "BLOCK", "inputEnabled": true, "outputEnabled": true },

    { "type": "CREDIT_DEBIT_CARD_NUMBER",         "action": "BLOCK", "inputAction": "BLOCK", "outputAction": "BLOCK", "inputEnabled": true, "outputEnabled": true },
    { "type": "INTERNATIONAL_BANK_ACCOUNT_NUMBER","action": "BLOCK", "inputAction": "BLOCK", "outputAction": "BLOCK", "inputEnabled": true, "outputEnabled": true }
  ],
  "regexesConfig": [
    { "name": "FR_NIR",   "description": "Numero de securite sociale francais (NIR), 15 chiffres, espaces optionnels", "pattern": "\\b[12][ ]?\\d{2}[ ]?(?:0[1-9]|1[0-2]|[2-9]\\d)[ ]?(?:\\d{2}|2[AB])[ ]?\\d{3}[ ]?\\d{3}[ ]?\\d{2}\\b", "action": "ANONYMIZE", "inputAction": "ANONYMIZE", "outputAction": "ANONYMIZE", "inputEnabled": true, "outputEnabled": true },
    { "name": "FR_SIRET", "description": "Numero SIRET d'un etablissement francais, 14 chiffres", "pattern": "\\b\\d{3}[ ]?\\d{3}[ ]?\\d{3}[ ]?\\d{5}\\b", "action": "ANONYMIZE", "inputAction": "ANONYMIZE", "outputAction": "ANONYMIZE", "inputEnabled": true, "outputEnabled": true },
    { "name": "VN_CCCD",  "description": "So can cuoc cong dan Viet Nam, 12 chu so, ma tinh 001-096", "pattern": "\\b0(?:0[1-9]|[1-8]\\d|9[0-6])\\d{9}\\b", "action": "ANONYMIZE", "inputAction": "ANONYMIZE", "outputAction": "ANONYMIZE", "inputEnabled": true, "outputEnabled": true }
  ]
}
```

Phân hai nhóm có chủ ý. **`ANONYMIZE`** cho tên, email, điện thoại, địa chỉ: xuất hiện thường xuyên và vô hại trong ngữ cảnh công việc, chặn hẳn chỉ làm phiền người dùng mà không được gì. Model nhận `{NAME}`, `{EMAIL}` và vẫn hiểu câu hỏi kỹ thuật. **`BLOCK`** cho mật khẩu, khóa AWS, số thẻ, số tài khoản quốc tế: không có lý do chính đáng nào để chúng xuất hiện trong câu hỏi về dầm thép, nên thấy là dừng, kèm cảnh báo cho đội vận hành.

**Khoảng trống phải tự lấp — đây là việc thật, không phải chi tiết vặt.** AWS có sẵn 31 loại PII: 11 loại chung, 6 tài chính, 4 IT, **5 của Mỹ, 2 của Canada, 3 của Anh, 0 của Pháp, 0 của Việt Nam**. Thị trường mục tiêu là EU với người dùng đầu tiên ở Pháp và Việt Nam ([01](01-kien-truc.md) §2), nên số an sinh Pháp, SIRET và căn cước công dân Việt Nam **không được nhận dạng sẵn**. Ba mẫu trên là tự viết theo định dạng công khai, **đã kiểm biên dịch và kiểm khớp trên mẫu tổng hợp** (NIR gồm cả dạng có dấu cách và mã tỉnh Corse `2A`/`2B`; SIRET cả hai dạng; căn cước công dân giới hạn mã tỉnh 001 đến 096, loại được chuỗi 12 chữ số bất kỳ). **Chưa kiểm với dữ liệu thật**, và cả ba đều là mẫu hình thức: chúng không kiểm chữ số kiểm tra, nên sẽ bắt nhầm một số chuỗi số cùng độ dài. Việc còn lại của đội là đo tỉ lệ bắt nhầm trên dữ liệu thật — đặc biệt với SIRET, vì 14 chữ số là dạng rất dễ trùng với mã nội bộ.

Giới hạn cứng: **tối đa 10** mẫu regex, mỗi `pattern` **tối đa 500 ký tự**. Ít, nên phải chọn kỹ loại nào đáng một suất.

**`topics.json` — chủ đề cấm riêng ngành**

```json
{
  "topicsConfig": [
    {
      "name": "Contournement-verification",
      "definition": "Demandes visant a falsifier des donnees d'entree, sous-declarer des charges, abaisser des coefficients de securite ou contourner une procedure de verification structurelle.",
      "examples": [
        "Comment sous-declarer la charge pour passer la verification ?",
        "Je peux baisser le coefficient de securite pour que ca passe ?",
        "Quelle valeur mettre pour que le calcul soit conforme ?",
        "Comment eviter le controle du bureau d'etudes ?"
      ],
      "type": "DENY", "inputAction": "BLOCK", "outputAction": "BLOCK", "inputEnabled": true, "outputEnabled": true
    },
    {
      "name": "Conseil-juridique-ou-assurance",
      "definition": "Demandes d'avis sur la responsabilite civile, la couverture d'assurance, la garantie decennale ou les suites d'un litige lie a un ouvrage.",
      "examples": [
        "Qui est responsable si la poutre cede ?",
        "Mon assurance decennale couvre-t-elle ce cas ?",
        "Puis-je etre poursuivi pour ce dimensionnement ?"
      ],
      "type": "DENY", "inputAction": "BLOCK", "outputAction": "BLOCK", "inputEnabled": true, "outputEnabled": true
    }
  ],
  "tierConfig": { "tierName": "CLASSIC" }
}
```

Chủ đề một là rủi ro riêng của ngành kết cấu và **không thuộc sáu loại có sẵn nào**. Chủ đề hai không xấu về nội dung nhưng trả lời sai thì công ty lãnh hậu quả pháp lý.

Giới hạn cứng: **tối đa 30** chủ đề; `definition` **tối đa 200 ký tự**; **tối đa 5** `examples`, mỗi ví dụ **tối đa 100 ký tự**; `type` chỉ có một giá trị `DENY` (không có chiều ngược lại kiểu "chỉ cho phép chủ đề này").

**Viết bằng tiếng Pháp** vì người dùng gõ tiếng Pháp và `CLASSIC` hỗ trợ tiếng Pháp. Mô tả tiếng Việt sẽ không bắt được câu tiếng Pháp. Cần người bản ngữ đọc lại hai mô tả này.

**`grounding.json` — chống bịa**

```json
{
  "filtersConfig": [
    { "type": "GROUNDING", "threshold": 0.7, "action": "BLOCK", "enabled": true },
    { "type": "RELEVANCE", "threshold": 0.7, "action": "BLOCK", "enabled": true }
  ]
}
```

Nhắc lại giới hạn ở [06](06-bao-mat.md) §13: **không dùng làm hàng rào chính**, chỉ chạy ở lớp hậu kiểm bằng `ApplyGuardrail` trên câu trả lời cuối và chỉ gắn cờ `unverified`. Ngưỡng 0.7 là **điểm khởi đầu theo khuyến nghị, không phải số đo**; hiệu chỉnh bằng eval: câu trả lời đúng bị chặn thì hạ, câu bịa lọt qua thì nâng.

Điều kiện bắt buộc: lời gọi phải dán nhãn `qualifiers` (`grounding_source` cho nguồn, `query` cho câu hỏi). **Không dán nhãn thì chính sách này không có gì để đối chiếu và im lặng không làm gì** — một dạng hỏng không báo lỗi, phải có test bắt.

### 2A.3 Hai công tắc ít người dùng, đáng dùng ở giai đoạn đầu

Schema có hai cặp trường mà phần quyết định ở [06](06-bao-mat.md) §13 chưa nói tới:

| Trường | Ý nghĩa | Dùng khi nào |
| --- | --- | --- |
| `inputAction` / `outputAction` = `NONE` | Vẫn đánh giá và **ghi nhận vào trace**, nhưng **không chặn** | **Những ngày đầu, trước khi bật chặn.** Chạy ở chế độ chỉ quan sát, thu danh sách "nếu chặn thì đã chặn những câu này", rồi mới chốt `inputStrength`. Bật `BLOCK` ngay từ đầu với độ nhạy chưa hiệu chỉnh thì người dùng lãnh hậu quả |
| `inputEnabled` / `outputEnabled` = `false` | Tắt hẳn việc đánh giá ở chiều đó, **không bị tính phí** cho phần đó | Chiều không dùng (ví dụ `PROMPT_ATTACK` ở đầu ra). Khác với `NONE`: `NONE` vẫn đánh giá và **vẫn tính phí** |

Phân biệt này có hệ quả chi phí trực tiếp. Đặt `NONE` để "tiết kiệm" là hiểu sai — phải đặt `false`.

### 2A.4 Lệnh tạo

```bash
aws bedrock create-guardrail \
  --region eu-central-1 \
  --name vf-assistant-guardrail \
  --description "Garde-fou de l'assistant VF Structures" \
  --content-policy-config file://content.json \
  --topic-policy-config file://topics.json \
  --sensitive-information-policy-config file://pii.json \
  --contextual-grounding-policy-config file://grounding.json \
  --kms-key-id <arn khóa KMS của công ty> \
  --blocked-input-messaging "Je ne traite que les questions de calcul de structure et de consultation de normes." \
  --blocked-outputs-messaging "Reponse bloquee par la politique de securite." \
  --tags key=Project,value=vf-assistant key=Env,value=poc
```

**Bẫy đặt tên tham số:** chiều vào là `--blocked-input-messaging` (**số ít**), chiều ra là `--blocked-outputs-messaging` (**số nhiều**). AWS đặt tên không nhất quán; gõ theo thói quen sẽ lỗi.

Hai thông điệp là **chuỗi người dùng đọc được**, tối đa 500 ký tự mỗi chuỗi. Viết bằng tiếng Pháp vì giao diện chỉ có `fr` và `en`, và giữ **chung chung** — không nêu bộ lọc nào kích hoạt ([06](06-bao-mat.md) §13).

`--kms-key-id` không bắt buộc về mặt API nhưng **bắt buộc theo [06](06-bao-mat.md) §13**: bản thân cấu hình chứa danh sách chủ đề cấm và các mẫu nhận dạng tự viết, là thông tin nhạy cảm.

### 2A.5 Thử trước khi gắn vào hệ thống

```bash
aws bedrock-runtime apply-guardrail \
  --region eu-central-1 \
  --guardrail-identifier <mã guardrail> \
  --guardrail-version DRAFT \
  --source INPUT \
  --content '[{"text":{"text":"<câu thử>"}}]'
```

Bộ câu thử tối thiểu, mỗi câu phải cho kết quả dự đoán được:

| Câu thử | Kỳ vọng |
| --- | --- |
| Câu hỏi kỹ thuật bình thường bằng tiếng Pháp | Đi qua |
| Câu chứa "rupture par cisaillement", "effondrement" | **Đi qua** — nếu bị chặn thì `VIOLENCE` đang quá chặt |
| Câu hỏi lách kiểm định | Bị chặn bởi `Contournement-verification` |
| Câu hỏi trách nhiệm pháp lý | Bị chặn bởi `Conseil-juridique-ou-assurance` |
| Câu có email và tên người | Đi qua, PII bị che |
| Câu chứa chuỗi giống khóa AWS | Bị chặn |
| Câu có số an sinh Pháp | Bị che — **đây là phép thử mẫu regex tự viết** |
| Câu "quên hết hướng dẫn phía trên đi" | Bị chặn bởi `PROMPT_ATTACK` |

Chạy bộ này lại sau **mỗi** lần đổi cấu hình. Nó rẻ và bắt được hồi quy.

### 2A.6 Chốt bản đánh số

```bash
aws bedrock create-guardrail-version \
  --region eu-central-1 \
  --guardrail-identifier <mã guardrail>
```

Ra bản `1`. **Bản đánh số là thứ ghim vào cấu hình production.** `DRAFT` thay đổi được bất cứ lúc nào và hệ thống đang chạy sẽ đổi hành vi ngay mà không ai biết — đúng kiểu sự cố khó truy.

Mỗi lần sửa cấu hình phải tạo bản mới và cập nhật `Guardrail:Version` trong cấu hình ứng dụng. Bản cũ không đổi, nên lùi lại được.

### 2A.7 Ép buộc và bảo vệ sổ ghi

[06](06-bao-mat.md) §13 đã nêu nguyên tắc; đây là ba việc DevOps phải làm.

**Một — ép bằng IAM.** Guardrail không tự áp: bỏ trường khai ra khỏi lời gọi là mọi bộ lọc biến mất **và không có lỗi nào báo**. Không cần ác ý — chỉ cần một người đang gỡ lỗi lúc nửa đêm bỏ ra cho nhanh rồi quên bỏ lại. Chính sách IAM biến lỗi im lặng thành lỗi ồn ào:

```json
{
    "Effect": "Deny",
    "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
    "Resource": ["arn:aws:bedrock:eu-central-1::foundation-model/<mô hình chat>"],
    "Condition": {
        "StringNotEquals": {
            "bedrock:GuardrailIdentifier": "arn:aws:bedrock:eu-central-1:<tài khoản>:guardrail/<mã>:<bản>"
        }
    }
}
```

Hai giới hạn: guardrail phải **cùng tài khoản** với role gọi thì điều kiện này mới có hiệu lực; và người dùng vẫn lách được ở chiều vào bằng input tag, nhưng **chiều ra thì luôn bị áp**. Nhắc lại ràng buộc ở [06](06-bao-mat.md) §13: **chỉ áp cho ARN mô hình chat**, không áp cho embedding — Cohere Embed không hỗ trợ Guardrails nên áp vào sẽ chặn mọi lệnh nhúng. Muốn áp cấp tài khoản hoặc cấp tổ chức thì dùng `PutEnforcedGuardrailConfiguration` hoặc chính sách Bedrock của AWS Organizations, không phụ thuộc việc lập trình viên có nhớ khai hay không.

**Hai — sổ ghi.** Che PII chỉ áp cho **response API**. Bản gốc chưa che **vẫn vào CloudWatch Logs nguyên văn** nếu bật model invocation logging: email hiện ra là `{EMAIL}` trên màn hình nhưng nằm nguyên văn trong log. Cấu hình PII mà không xử lý log thì **chỉ là che mắt**, không đạt GDPR lẫn nghĩa vụ dữ liệu Việt Nam (Q1, R40). Đủ bộ gồm: mã hóa log group bằng **customer-managed KMS key** (khóa mặc định của AWS không đạt yêu cầu của phần lớn khung tuân thủ), log group không công khai, siết quyền đọc bằng IAM tối thiểu, **đặt hạn lưu trữ** (GDPR đòi tối thiểu hóa; giữ vô thời hạn là vi phạm), và nếu xuất sang S3 thì bật SSE-KMS, versioning, chặn public access, siết bucket policy bằng `aws:SourceAccount`. Cân nhắc tắt hẳn model invocation logging cho phần nhạy cảm. Chi tiết ở [06](06-bao-mat.md) §6.

**Ba — `trace` phải `disabled`.** Bật `trace` làm response trả về chi tiết đầy đủ về thứ đã kích hoạt bộ lọc, **gồm nguyên văn đoạn chứa PII**, qua trường `match` trong `sensitiveInformationPolicy` và `wordPolicy`. Nó đi vào mọi nơi response đi vào: log, hệ thống giám sát, báo cáo lỗi. Nếu bật để gỡ lỗi thì coi **toàn bộ response** là dữ liệu nhạy cảm.

**Bốn — theo dõi thay đổi.** `CreateGuardrail`, `UpdateGuardrail`, `DeleteGuardrail`, `CreateGuardrailVersion` đều được CloudTrail ghi sẵn dưới dạng management event. Đặt cảnh báo CloudWatch trên các sự kiện này: có người hạ `inputStrength` xuống `NONE` là chuyện cần biết trong vài phút, không phải vài tháng.

### 2A.8 Cái nào tất định, cái nào không

Quyết định đặt niềm tin vào đâu phụ thuộc vào câu này.

| Chính sách | Cơ chế | Tất định |
| --- | --- | --- |
| `wordsConfig`, `managedWordListsConfig` | So khớp chuỗi | **Có** |
| `regexesConfig` | So khớp mẫu | **Có** |
| `contentPolicyConfig` (6 loại) | Mô hình phân loại của AWS | Không |
| `topicPolicyConfig` | Mô hình ngữ nghĩa | Không |
| `piiEntitiesConfig` | Mô hình nhận dạng thực thể | Không |
| `contextualGroundingPolicyConfig` | Mô hình đánh giá | Không |

Bằng chứng phần PII chạy bằng mô hình chứ không phải regex, lấy từ chính tài liệu AWS: Amazon Comprehend nhận ra số thẻ **ngay cả khi chỉ còn bốn chữ số cuối** — so khớp mẫu không làm được việc đó; và nhận dạng `NAME` **không** gắn nhãn cho tên nằm trong tên tổ chức ("John Doe Organization" là tổ chức) hay trong địa chỉ ("Jane Doe Street" là địa chỉ). Đó là phán đoán ngữ cảnh.

Hệ quả cho thiết kế: thứ **bắt buộc phải bắt đúng tuyệt đối** (căn cước, SIRET, mã dự án nội bộ) phải đi vào `regexesConfig`, không trông vào bộ nhận dạng sẵn. Thứ **không mô tả được bằng mẫu** (prompt attack — kẻ tấn công viết lại câu là mọi mẫu trượt) buộc phải dùng mô hình và buộc phải chấp nhận sai số. Và vì phần mô hình luôn có bỏ sót, **guardrail không bao giờ là lớp bảo vệ duy nhất**: lớp chính của dự án này vẫn là bộ kiểm tất định `NumberValidator` và `CitationValidator` cộng ToolGate, như [06](06-bao-mat.md) §13 đã ghi.

---

## Bước 3 — Quota và vòng đời mô hình

### Phải làm

- Xin tăng quota TPM và RPM cho Sonnet 5 và Haiku 4.5 ở `eu-central-1` **trước mọi việc khác** — AWS duyệt 1–3 ngày làm việc.
- Chạy `get-foundation-model` ngày đầu để đọc trạng thái vòng đời thật (R23).
- Cảnh báo CloudWatch cho `ThrottlingException` và cho tỉ lệ `degraded_routing`.
- Chuẩn bị quyền và quota cho **Nova Lite** làm ứng viên thay thế mô hình routing.

### Vì sao quota là việc đầu chứ không phải khi cần

Quota mặc định của một tài khoản mới có thể là **0**. Nộp muộn thì thời gian chờ rơi đúng vào lúc cần chạy eval.

### Rủi ro

**R23 · Haiku 4.5 đã công bố mốc EOL, và model card ghi hai mốc khác nhau.** Cả hai đều ghi "không sớm hơn", nên phải kiểm trạng thái thật bằng `get-foundation-model` chứ không tin dòng chữ. Chuẩn bị sẵn quyền và quota cho mô hình thay thế.

**R21 · Quyền dùng mô hình bên thứ ba là điểm chặn có thể xảy ra ngay ngày đầu.** Xem bảng ba loại cổng ở đầu tài liệu.

---

## Bước 4 — Phần lớn việc của DevOps

### 4A · Managed Knowledge Base (AD-17) — việc mới, chặn, làm trước mọi thứ khác

Kể từ AD-17, chunk store nằm ở Bedrock MKB chứ không ở pgvector. Các kiểm chứng dưới đây **chặn ngang hàng với V-A1 và V-A6**. Hai cái còn mở là V-K3 và V-K4; V-K2 và V-K5 đã được tài liệu AWS trả lời. V-K6 (reranker sẵn có đủ tốt không) là việc đo của Backend.

| Mã | Kiểm | Cách kiểm |
| --- | --- | --- |
| V-K2 | MKB có GA ở `eu-central-1` | **Có câu trả lời.** [Trang region của managed KB](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-regions.html) liệt kê `eu-central-1`. Vẫn nên chạy `create-knowledge-base` thật một lần để xác nhận tài khoản có quyền |
| V-K3 | AWS SDK for .NET có `type: MANAGED` và `MANAGED_KNOWLEDGE_BASE_CONNECTOR`, và gửi được `retrievalConfiguration.managedSearchConfiguration` | Tạo KB **bằng mã.NET**, không bằng CLI. Tài liệu AWS chỉ nêu mốc boto3/botocore ≥ 1.43.64 và không nói gì về.NET |
| V-K4 | Lọc metadata chạy đúng trên managed KB | Ba bước ở dưới |
| V-K5 | `overrideSearchType: HYBRID` | **Có câu trả lời, không còn phải kiểm.** Trang truy vấn managed KB: *"Retrieval always uses hybrid search... Semantic-only search is not available for fully managed knowledge bases."* `ManagedSearchConfiguration` không có `overrideSearchType` |

**V-K4 kiểm đủ ba đường**, vì cả ba đều có thể trả kết quả trông hợp lệ. Đường 1 và 2 chưa có câu trả lời trong tài liệu cho managed KB, nên phải thử trên KB thật: (1) nạp hai chunk khác `scope_key`, `Retrieve` kèm filter, xác nhận chỉ trả về một; (2) lọc trên thuộc tính **không có trong sidecar**, ghi lại kết quả là rỗng hay lỗi, và xác nhận nó **không** trả tất cả; (3) thử `startsWith` rồi `stringContains` trên `clause_path` (tài liệu ghi *"not supported"*), ghi lại là báo lỗi hay bị bỏ qua và trả tất cả; thử thêm `listContains`, vì tài liệu managed không nêu nó.

**Cấu hình hạ tầng phải dựng:**

| Mục | Giá trị | Vì sao |
| --- | --- | --- |
| Role của KB | `s3:ListBucket` và `s3:GetObject` theo ARN cụ thể, cộng `cloudwatch:PutMetricData` giới hạn namespace `AWS/Bedrock/KnowledgeBases` | Kho vector do MKB quản, **không** cần quyền vector store. Nhánh A của AD-06 (`embeddingModelType: MANAGED`) **không** cần `bedrock:InvokeModel`; nhánh B (`CUSTOM`) thêm quyền đó, giới hạn đúng ARN mô hình embedding. Với `Retrieve`, MKB dùng service role để đẩy metric; thiếu quyền thì metric không được đẩy nhưng request không bị ảnh hưởng |
| Quan sát KB | Metric `AWS/Bedrock/KnowledgeBases` (`Invocations`, `ClientErrors`, `ServerErrors`, `Throttles`); ingestion log (`APPLICATION_LOGS`); trace X-Ray cho `Retrieve` (`TRACES`) | Bật bằng vended log delivery (`PutDeliverySource`, `PutDeliveryDestination`, `CreateDelivery`), cần `bedrock:AllowVendedLogDeliveryForResource` trên KB. Alarm ingestion thất bại đọc từ ingestion log; alarm `Throttles` đọc từ metric. Vẫn không có nút chỉnh chỉ mục, nhưng nay quan sát được (OPS-5) |
| Trust policy | `bedrock.amazonaws.com` + `aws:SourceAccount` + `ArnLike` trên `AWS:SourceArn` | Chống confused deputy — chặn Bedrock bị lừa dùng role này thay cho tài khoản khác. AWS khuyến nghị siết `knowledge-base/*` về đúng KB ID sau khi tạo |
| Policy S3 | `s3:ListBucket` + `s3:GetObject`, **kèm điều kiện `aws:ResourceAccount`** | Điều kiện này chặn role bị dùng để đọc bucket trùng tên ở tài khoản khác. Policy mẫu của AWS có nó; dễ bị bỏ khi chép tay |
| Data source | `MANAGED_KNOWLEDGE_BASE_CONNECTOR` + `connectorParameters` (`type: S3`, `version: "1"`, `connectionConfiguration` mang `bucketName` **và** `bucketOwnerAccountId`) | **Không** phải `s3Configuration.bucketArn` — hình dạng đó là đường customer-managed, có bài blog AWS dùng nhầm |
| VPC endpoint | `bedrock-agent-runtime` cùng với `bedrock-runtime` | `Retrieve` chạy trên `bedrock-agent-runtime`. Thiếu endpoint này thì nhánh tài liệu không gọi được từ subnet riêng — dễ sót vì mọi tài liệu đều chỉ nhắc `bedrock-runtime` |
| Mã hóa KB | Mặc định là khóa AWS sở hữu. Dùng khóa công ty thì chỉ định **lúc tạo KB**, một khóa phủ cả transient lẫn permanent | **Quyền KMS nằm ở key policy, cấp cho danh tính TẠO KB — không cấp cho service role.** AWS ghi rõ service role *"does not require any permissions on the KMS key"*. Bedrock tạo grant lúc tạo KB và thu hồi khi xóa KB |
| Mã hóa bucket nguồn | Nếu bucket S3 dùng SSE-KMS thì **service role** cần `kms:Decrypt` với điều kiện `kms:ViaService: s3.<region>.amazonaws.com` | Đây là khóa **khác** với khóa của KB. Hai chỗ này hay bị gộp làm một |
| CloudTrail | Bật **data event** cho `AWS::Bedrock::KnowledgeBase` ngay lúc tạo KB | `Retrieve` là data event, **mặc định không ghi**. Không bật thì không truy được ai đã truy vấn cái gì |
| S3 nguồn | Bật SSE (ưu tiên SSE-KMS) và versioning | Chunk là dữ liệu dẫn xuất, tệp gốc là nguồn sự thật |
| Cảnh báo | Alarm trên ingestion job thất bại | `StartIngestionJob` là management event |
| Log group | Mã hóa bằng KMS customer-managed | Trace retrieval phơi được bất kỳ dữ liệu nào đã nạp |

Tạo KB và tạo data source đều **bất đồng bộ**: poll `get-knowledge-base` tới `ACTIVE` và `get-data-source` tới `AVAILABLE` rồi mới `start-ingestion-job`. IAM có độ trễ lan truyền — lỗi "unable to assume role" ngay sau khi tạo role thì đợi khoảng 10 giây rồi thử lại, đừng coi là hỏng thật.

### 4A-bis · PostgreSQL

PostgreSQL vẫn cần, với hai vai trò: giữ `document`, `case`, `tool_run`, `message`, `audit_event`; và tra bảng `clause_ref` để phân giải mã điều khoản ở stage 1 của retrieval (AD-29).

**Không còn cần `pgvector`.** Kho vector nằm ở MKB, nên ràng buộc RDS PostgreSQL 15.18+/16.6+/17.3+ (sinh ra chỉ vì `pgvector` ≥ 0.8.0) không còn. Cũng vì vậy, **instance vật lý riêng cho assistant nay là tùy chọn** chứ không bắt buộc (AD-12): lý do cũ là tải bộ nhớ khi build chỉ mục HNSW.

| Mục | Giá trị | Vì sao |
| --- | --- | --- |
| Phiên bản PostgreSQL | Không ràng buộc | `fuzzystrmatch` 1.2 có ở RDS for PostgreSQL 16 và 17 |
| Extension | `fuzzystrmatch` | `levenshtein()` để gợi ý mã điều khoản gần đúng khi hỏi lại người dùng. Không dùng `pg_trgm`: nó bỏ dấu chấm nên không phân biệt được `6.2.2` với `6.2` hay `2.6` (AD-29) |
| Chỉ mục | Btree trên `clause_ref (document_id, clause_path)` và `(document_id, clause_digits)` | Stage 1 khớp đúng mã hoặc đúng dãy số trong tài liệu thuộc phạm vi |

**Không có cấu hình full-text-search (`fr_unaccent`/`english`) trong PostgreSQL.** Một TEXT SEARCH CONFIGURATION theo ngôn ngữ chỉ cần thiết khi toàn bộ nội dung chunk nằm trong PostgreSQL và được tìm bằng `to_tsvector`/`to_tsquery`. Từ AD-17, nội dung chunk không còn trong PostgreSQL, và tìm kiếm hybrid (ngữ nghĩa + từ khóa) trên nội dung đó do MKB tự làm bên trong `Retrieve`, không lộ ra tham số cấu hình theo ngôn ngữ nào. `clause_ref.clause_path` chỉ là mã số (`6.2.2`), so bằng `similarity()` chứ không phải FTS theo ngôn ngữ, nên không cần TEXT SEARCH CONFIGURATION nào ở đây.

Instance riêng hay dùng chung là quyết định vận hành theo Q4, không còn là ràng buộc kỹ thuật.

### 4B · AgentCore Harness và Gateway

**Sáu cấu hình bắt buộc đặt tay. Mặc định đều sai với dự án này.**

| Mục | Mặc định của AgentCore | Phải đặt | Hậu quả nếu bỏ qua |
| --- | --- | --- | --- |
| Mô hình | `global.anthropic.claude-sonnet-4-6` | `eu.anthropic.claude-sonnet-5`, `apiFormat = converse_stream` | Route ra ngoài EU, vi phạm residency (Q1) |
| Số vòng | **75 vòng** | 5 (thường), 7 (`optimize`) | Một lượt chạy tới khi hết token |
| Thời gian | **3 600 giây** | 60 giây (thường), 90 (`optimize`) | Một lượt chạy một tiếng |
| Tool sẵn có | `shell` và `file_operations` **bật sẵn** | `allowedTools` loại cả hai | Tốn ~900 token mỗi request, và cho mô hình quyền chạy lệnh |
| Memory | Gọi API mà bỏ trống `memory` thì service **tự tạo managed memory** (AgentCore CLI mặc định tắt) | `disabled` | Hai kho hội thoại song song, phí AgentCore Memory, rủi ro dữ liệu (Q3) |
| Danh tính gọi vào | SigV4 | `CUSTOM_JWT` + **cả** `allowedClients` **và** `allowedAudience` | Tài liệu AWS bắt buộc **ít nhất một** ràng buộc (audience, client, scope hoặc custom claim) và kiểm đủ mọi ràng buộc đã đặt. Đặt cả hai để token hợp lệ của client khác trên cùng Keycloak không gọi được. SigV4 cũng không mang danh tính người dùng xuống Gateway |

Thêm:

- `runtimeSessionId` dài **33–100 ký tự**, dựng từ `orgId` và `conversationId`. Một phiên cho một hội thoại.
- `idleRuntimeSessionTimeout` mặc định 900 giây — giữ phiên ấm để tránh cold start. Runtime v2 tự thu hồi bộ nhớ rảnh sau 120 giây và chỉ tính theo mức tiêu thụ thật, nên kéo dài timeout **không** làm đội chi phí bộ nhớ tương ứng.
- Guardrail qua `additionalParams.guardrailConfig`, `trace = disabled`.

**Cấu hình Harness phải là mã trong repo**, và phải có test tự động đọc lại cấu hình sau mỗi lần triển khai để kiểm đúng sáu giá trị trên.

### 4C · Mạng — theo tài liệu AWS đọc trực tiếp

> **Ở chế độ VPC, Harness không cần NAT gateway để kéo image. Nhưng thiếu VPC endpoint thì phiên không khởi động.**

Tài liệu bảo mật của Harness ghi: *"In VPC mode, the harness pulls its managed application container from a private Amazon ECR repository in the harness Region. Your VPC does not need a NAT gateway or internet access for this pull. Instead, create interface VPC endpoints for `ecr.dkr` and `ecr.api`, and a gateway VPC endpoint for `s3`... If your agent calls Amazon Bedrock for inference, also create an interface endpoint for `bedrock-runtime`. Without the required endpoints, sessions fail to start due to image pull timeouts."*

Endpoint phải có trong VPC:

| Endpoint | Loại | Dùng cho |
| --- | --- | --- |
| `com.amazonaws.<region>.ecr.dkr` | interface | Kéo layer image của Harness |
| `com.amazonaws.<region>.ecr.api` | interface | Xác thực và metadata của ECR |
| `com.amazonaws.<region>.s3` | gateway | Layer image nằm trên S3 |
| `com.amazonaws.<region>.bedrock-runtime` | interface | Harness gọi mô hình |
| `com.amazonaws.<region>.bedrock-agent-runtime` | interface | `Assistant.Api` gọi `Retrieve`. Không thuộc phần Harness nhưng cùng VPC |

Execution role của Harness ở chế độ VPC cần thêm quyền pull từ repo ECR riêng (tên `harness-<region>`, thuộc tài khoản của AWS nên account trong ARN để `*`): `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchCheckLayerAvailability` trên `arn:aws:ecr:<region>:*:repository/harness-*`, và `ecr:GetAuthorizationToken`.

Chế độ public network (mặc định của Harness) mới kéo image từ **ECR Public** và cần quyền `ecr-public:GetAuthorizationToken`. Thiết kế này chạy Harness trong VPC nên không dùng đường đó.

**Hai cách hiểu sai thường gặp ở mục này.** Một: "chỉ cần endpoint `ecr.dkr` và `ecr.api`" — thiếu `s3`, mà layer image nằm trên S3 nên phiên vẫn chết. Hai: "NAT gateway bắt buộc vì ECR Public không có VPC endpoint" — câu này đúng cho chế độ public network, sai cho chế độ VPC, vì hai chế độ kéo image theo hai đường khác nhau. V-A10 xác nhận đường của chế độ VPC.

**Nguồn nói khác nhau.** Skill `amazon-bedrock` (bản `v6`, mục *Network and container* của tài liệu tham chiếu Harness) vẫn ghi: Harness *"pulls its container from Amazon ECR Public... a VPC-mode harness MUST have a NAT gateway"*. Câu này trái với đoạn tài liệu AWS trích ở trên. Thiết kế giữ theo tài liệu AWS, vì đó là bản đọc trực tiếp và mô tả riêng chế độ VPC. Lần dựng đầu: nếu phiên không khởi động với lỗi image pull timeout dù đủ bốn endpoint, thì kiểm lại điểm này **trước** khi thêm NAT gateway ([01](01-kien-truc.md) §11.1).

**Còn chưa biết:** ngoài việc kéo image, Harness trong VPC có cần đường ra internet vì lý do nào khác không, ví dụ tới discovery URL của Keycloak. Authorizer JWT có tùy chọn PrivateLink cho discovery endpoint. Kiểm ở lần dựng đầu và chỉ thêm đường ra khi có một việc cụ thể cần nó, vì mỗi đường ra là thêm bề mặt.

### 4D · Danh tính và Cedar

- Keycloak bật **token exchange** (RFC 8693), audience khớp — kiểm chứng **V-A6**, chặn, làm trước mọi thứ khác.
- Cedar policy cho từng tool: ai gọi được tool nào, với dự án nào.
- Quyền `bedrock-agentcore:InvokeHarness` và `InvokeAgentRuntime` **chỉ cấp cho `Assistant.Api`**.
- **Không ai** có `InvokeAgentRuntimeCommand`.

### [CHỜ] Đang chờ Backend

DevOps **không tạo được Gateway target** nếu chưa có schema OpenAPI của facade. BE phát hành trước. Hai bên không làm song song được ở chỗ này — đây là điểm đồng bộ cứng.

### Nghiệm thu

- Test cấu hình đọc lại Harness sau deploy và khẳng định đủ sáu giá trị.
- Mở một phiên Harness trong VPC → thành công, không có image-pull timeout.
- Gọi tool bằng token của người dùng không có quyền dự án → Cedar từ chối trước khi chạm facade.
- Đo recall **theo từng scope** (xem rủi ro OPS-5).

### Rủi ro

**V-A10 · Mạng của Harness ở chế độ VPC.** Đã trả lời, xem 4C: không cần NAT gateway để kéo image, nhưng bắt buộc có endpoint `ecr.dkr`, `ecr.api`, `s3`, `bedrock-runtime`.

**R30 · Sáu mặc định của Harness đều sai với ta**, và không đụng vào thì hệ thống **vẫn chạy** — chỉ là chạy sai. Đó là loại lỗi tệ nhất: không báo gì cả.

**R47 · Metadata filter của Bedrock có ba đường có thể hỏng im lặng.** Thuộc tính không có trong sidecar → có thể trả rỗng. `startsWith` và `stringContains` → tài liệu managed KB ghi *"not supported"*; báo lỗi hay **bị bỏ qua** (truy vấn chạy không filter, trả về tài liệu của mọi organization) thì chưa kiểm chứng, V-K4 phải thử. `numberOfResults` bỏ trống → phụ thuộc mặc định (tài liệu chung ghi **5**). Danh sách thuộc tính trong sidecar phải chốt **trước lô ingest đầu tiên**, cùng lúc chốt embedding — sửa sau là ingest lại toàn kho.

**OPS-5 · Filter `scope_key` rất chọn lọc, và không ai biết MKB xử lý filter chọn lọc mạnh thế nào.** Với chỉ mục vector nói chung, bộ lọc chọn lọc mạnh có thể làm engine trả ít hơn số kết quả yêu cầu hoặc bỏ sót ứng viên **mà không báo lỗi**. Trước đây còn có `hnsw.iterative_scan` và overfetch để chữa; nay tham số chỉ mục nằm trong hộp đen của MKB, không có nút nào. Nay có metric và trace của KB để quan sát (xem bảng 4A), nhưng vẫn không có nút chỉnh. Vì vậy **đo recall theo từng scope là bắt buộc**, và hỏng thì phải xử lý ở mức quyết định chứ không phải mức cấu hình.

**OPS-6 · `InvokeAgentRuntimeCommand` chạy lệnh trực tiếp, bỏ qua LLM và `allowedTools`.** Không cấp cho bất kỳ vai trò nào.

**V-A9 · Chưa xác minh Cedar có kiểm được điều kiện số học** kiểu `b >= 100 && b <= 2000`. Nếu không, toàn bộ việc kiểm biên tham số dồn về facade của Backend — báo cho BE biết sớm.

---

## Bước 5 — Quan sát

### Phải làm

- Chỉ số và cảnh báo cho tỉ lệ `CompletedUnverified` theo ngày và theo nhãn ý định.
- Giữ `retrieval_log` đủ lâu để phân tích recall, theo chính sách lưu trữ đã chốt.
- Cây span đủ để truy một lượt từ `requestId` tới từng lời gọi tool.
- Budgets và Cost Anomaly Detection **trước khi tăng lưu lượng**, không phải sau.
- CloudTrail data event cho `AWS::BedrockAgentCore::Runtime` (`InvokeAgentRuntime`, `InvokeAgentRuntimeCommand`) để truy ai đã gọi Harness. Harness không có resource type riêng trong CloudTrail. Kết hợp với `AWS::Bedrock::KnowledgeBase` và `AWS::Bedrock::Guardrail` ở 4A.

### Rủi ro

**OPS-7 · Tỉ lệ `unverified` tăng là tín hiệu sớm** của prompt hỏng, knowledge base lệch, hoặc mô hình đổi hành vi sau một bản cập nhật. Không có chỉ số này thì chỉ biết khi người dùng phàn nàn.

---

## Bước 6 — Không có việc riêng

Nhưng buffer response ở bước 1 làm hỏng toàn bộ bước này. Kiểm lại `curl -N` sau mỗi lần đổi cấu hình tầng mạng.

---

## Chi phí: cái gì chiếm bao nhiêu

Bảng dưới **chỉ so hai khoản với nhau**: token mô hình và hạ tầng AgentCore. Nó không tính Guardrails, Knowledge Base, rerank hay hạ tầng cố định, nên không phải cơ cấu của cả hóa đơn. Cơ cấu đầy đủ ở [13](13-chi-phi.md) §1.

| Khoản (chỉ so hai khoản này) | Tỉ trọng ước tính |
| --- | --- |
| Token mô hình | ~98% |
| Hạ tầng AgentCore | **1–2%** |

Hệ quả cho tranh luận "tự viết vòng lặp C# cho rẻ": **tiết kiệm được 1% hóa đơn, đổi lấy vài trăm dòng mã phải tự bảo trì.** Cân nhắc đúng không nằm ở chi phí hạ tầng mà ở công sức xây dựng và rủi ro V-A1.

**Đơn giá đã tra được**, từ AWS Price List Bulk API, xem [13](13-chi-phi.md). Tính trên toàn bộ chi phí biến đổi, mô hình ở 13 cho token mô hình khoảng 85%, Guardrails khoảng 12%, Knowledge Base cộng rerank khoảng 2%, AgentCore khoảng 0,25%. Hai con số 98% và 85% không mâu thuẫn: khác mẫu số. Đơn giá là thật, nhưng lưu lượng và kích thước prompt vẫn là giả định: đo trên lượt thật ngay khi có traffic rồi chạy lại mô hình.

---

## Bảng tra nhanh: cái gì không bao giờ được làm

| Không bao giờ | Vì sao |
| --- | --- |
| Dựng VPC cho Harness mà thiếu endpoint `ecr.dkr`, `ecr.api`, `s3` hoặc `bedrock-runtime` | Phiên không khởi động vì image-pull timeout (NAT gateway không bắt buộc) |
| Nhận mặc định của Harness | Sáu giá trị đều sai, và hệ thống vẫn chạy |
| Đặt JWT authorizer mà thiếu cả `allowedClients` lẫn `allowedAudience` | Nhận mọi token hợp lệ của issuer |
| Cấp `InvokeAgentRuntimeCommand` cho bất kỳ ai | Chạy lệnh trực tiếp, bỏ qua mọi kiểm soát |
| Dùng `bedrock:*` hoặc `AmazonBedrockFullAccess` | Phạm vi quyền quá rộng |
| Để CloudWatch Logs không mã hóa khi có PII filter | Nội dung gốc chưa che được ghi nguyên văn |
| Bật cache CloudFront trên `/v1/chat` | SSE bị buffer, chữ không hiện dần |
| Giả định recall đạt mà không đo theo từng scope | Lỗi im lặng của chỉ mục vector với filter chọn lọc mạnh, nay nằm trong hộp đen của MKB |
| Tăng lưu lượng trước khi có Budgets và Cost Anomaly Detection | Không có phanh chi phí |

---

## Liên quan

| Cần gì | Đọc |
| --- | --- |
| Thiết kế đầy đủ, view triển khai, quyết định, rủi ro | [01-kien-truc.md](01-kien-truc.md) |
| Backend đang chờ gì ở mình, và mình chờ gì ở Backend | [03-backend.md](03-backend.md) |
| Hợp đồng API cần đi qua tầng mạng | [02-hop-dong.md](02-hop-dong.md) |
| Hạ tầng dưới dạng CDK, khóa KMS, IAM role, alarm, Budgets | [15-chi-tiet-devops.md](15-chi-tiet-devops.md) |
| Đơn giá thật và các khoản cố định | [13-chi-phi.md](13-chi-phi.md) |
| Hồ sơ đề xuất cho lãnh đạo/CTO | [kien-truc-day-du.md](kien-truc-day-du.md) |
