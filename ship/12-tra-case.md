# 12 · Tra case — tìm cấu hình đã tính đạt tương tự (AD-28)

> **Mục này trả lời:** case là gì, sinh ra thế nào, tra thế nào, lưu ở đâu, và vì sao **không** dùng OpenSearch hay Elasticsearch.
>
> **Thay thế:** AD-09 (case ghi nhận khi kỹ sư bấm Duyệt). Chỗ nào trong bộ tài liệu còn nói "case đã duyệt" thì file này thắng về định nghĩa case; [01](01-kien-truc.md) §6.5, §6.10 đã trỏ sang đây.
>
> **Ai đọc:** Backend (bắt buộc), DevOps (mục 6, 7), Frontend (mục 9).

---

## 1. Case là gì

**Case là bộ thông số JSON hợp lệ của một cấu kiện, sau khi engine đã tính và kết luận đạt.** Không có bước duyệt, không có văn bản tóm tắt, không có vector.

Việc cần làm khi tra case chỉ có một: **người dùng đưa vào một bộ thông số, hệ thống tìm những bộ thông số đã từng tính đạt gần giống nhất.** Kỹ sư dùng kết quả đó làm điểm xuất phát, ví dụ "dầm nhịp 12 m, C30/37 thì trước đây công ty hay chọn tiết diện nào".

Một case trông như sau:

```json
{
  "tool_id": "calc.beam.flexure",
  "tool_version": "3.2.0",
  "element_type": "beam",
  "params": { "span": 12.0, "fck": 30.0, "b": 300, "h": 650, "cover": 30 },
  "units":  { "span": "m",  "fck": "MPa", "b": "mm", "h": "mm", "cover": "mm" },
  "result": { "MEd": 212.4, "MRd": 248.9, "utilization": 0.853 },
  "verdict": "pass",
  "standard_ref": "EN 1992-1-1:2004+NA-FR",
  "use_count": 7
}
```

`params` đã chuẩn hóa về đơn vị khai trong `tools.manifest.yaml`. `verdict` lấy thẳng từ engine theo AD-24, không do mô hình suy ra.

---

## 2. Thay đổi so với AD-09

| | AD-09 (cũ) | AD-28 (mới) |
| --- | --- | --- |
| Điều kiện thành case | Kỹ sư bấm Duyệt trên thẻ kết quả | Engine tính xong, qua đủ 6 lớp ToolGate, `ApiResult.Code` hợp lệ, `verdict = pass` |
| Ai ghi | `POST /v1/approvals/{toolRunId}` | Tool facade, trong **cùng transaction** ghi `tool_run` |
| Trạng thái | `Proposed`, `Approved`, `Dismissed`, `Withdrawn` | `active`, `withdrawn` |
| Tóm tắt văn bản | `summary` sinh bằng template, có vector để tie-break | **Bỏ.** Không có `summary`, không có vector |
| Tie-break | Cosine giữa vector câu hỏi và vector `summary` | `use_count` giảm dần, rồi `last_seen_at` giảm dần |
| Tần suất | Mỗi case ghi một lần | Cùng cấu hình tính đạt lần nữa thì `use_count + 1` |
| Event `approval_required`, endpoint `/v1/approvals` | Dùng | **Không phát, không gọi** cho case. Vẫn giữ trong hợp đồng [02](02-hop-dong.md) để không đổi nghĩa đường dẫn đã công bố |
| Nhãn khi trình bày | "Kinh nghiệm nội bộ, không phải tiêu chuẩn" | "Cấu hình đã từng tính đạt trong công ty, không phải khuyến nghị" |

**Vì sao đổi.** Thứ kỹ sư cần tra là **thông số**, không phải ý kiến. Thông số đã qua ToolGate (đúng schema, có đơn vị, trong khoảng hợp lệ) và engine đã kết luận đạt thì đủ điều kiện để làm điểm tham chiếu. Bước duyệt thêm một cú bấm mà không thêm thông tin kỹ thuật nào engine chưa kiểm, và làm kho case rỗng nếu kỹ sư không có thói quen bấm (R11).

**Quyết định mở vừa được đóng.** [01](01-kien-truc.md) §6.10 ghi mâu thuẫn "vector của `summary` nằm ở đâu" giữa tie-break bằng vector và việc PostgreSQL không cần `pgvector`. AD-28 bỏ `summary` và bỏ tie-break bằng vector, nên mâu thuẫn không còn. **PostgreSQL vẫn không cần `pgvector`.**

---

## 3. Ghi case

```
Tool facade C#
│  Engine trả kết quả cho một tool calc.*
▼
1. ĐỌC KẾT QUẢ
│  ToolGate lớp 6 đọc ApiResult.Code. Lỗi thì dừng, không có case
│  Đọc verdict theo trường khai trong manifest (AD-24)
▼
2. QUYẾT ĐỊNH CÓ GHI CASE KHÔNG
│  Chỉ ghi khi: tool thuộc nhóm B (calc.*)
│               manifest đánh dấu tool là case_source: true
│               verdict = pass
│               element_type và mọi similarity_keys bắt buộc có giá trị
│  Không thỏa → chỉ ghi tool_run
▼
3. CHUẨN HÓA
│  params theo đơn vị khai trong manifest
│  dedupe_key = sha256(tool_id, tool_version, params đã chuẩn hóa, sắp khóa)
▼
4. GHI TRONG CÙNG TRANSACTION VỚI tool_run
   INSERT tool_run …
   INSERT case … ON CONFLICT (org_id, dedupe_key)
     DO UPDATE SET use_count = case.use_count + 1, last_seen_at = now()
```

**Vì sao ghi ở facade, trong cùng transaction.** Facade là chỗ duy nhất đã có đủ ba thứ: input đã qua ToolGate, output của engine, và mã lỗi thật. Ghi cùng transaction thì không có trạng thái "có `tool_run` nhưng mất case". `ON CONFLICT` làm lần ghi này idempotent: facade chạy lại theo `toolUseId` (AD-27) thì `use_count` chỉ tăng khi đó là lần tính mới, vì bản ghi `tool_run` trùng `tool_use_id` đã bị chặn trước.

**Case là bản sao, không phải view trên `tool_run`.** `tool_run` theo retention của hội thoại và bị xóa cứng khi hết hạn ([06](06-bao-mat.md) §6). Case sống theo vòng đời organization. Case chỉ đọc từ `tool_run` lúc ghi; sau đó hai bảng độc lập.

**Giả định cần công ty xác nhận.** Chỉ cấu hình **đạt** mới thành case. Cấu hình không đạt vẫn là input hợp lệ theo nghĩa engine chấp nhận, nhưng không phải điểm tham chiếu tốt, và lưu cả hai loại thì kỹ sư phải tự lọc. Nếu công ty muốn tra cả cấu hình không đạt, ví dụ để thấy "trước đây ai chọn 300×500 cho nhịp này và không đạt", thì bỏ điều kiện `verdict = pass` ở bước 2 và thêm bộ lọc `verdict` ở bước tra.

---

## 4. Tra case

```
Bước 5 · IntentRouter (Haiku)
│  intent = case_lookup, case_hints = [{span 12 m}, {fck 30 MPa}]
▼
6c.1 GOM THAM SỐ                                Assistant.Api · ChatOrchestrator
│  tool_run lượt trước > pageContext > case_hints, ghi đè theo từng key (AD-16)
│  Key chỉ có từ case_hints → chip cho kỹ sư xác nhận
│  Dưới 2 key → hỏi lại, dừng
▼
6c.2 LỌC CỨNG                                   PostgreSQL · bảng case, RLS
│  org_id (RLS), status = active, verdict = pass,
│  tool_id hoặc element_type khớp
│  → tối đa 200 ứng viên
▼
6c.3 CHẤM ĐIỂM                                  Assistant.Api · CaseSimilarityScorer
│  Chuẩn hóa từng key về [0, 1] theo dải hợp lệ trong manifest
│  distance = trung bình |q − c| trên các key có ở cả hai phía
│  coverage = số key khớp / tổng similarity_keys của tool
│  điểm = distance / coverage, nhỏ là giống
│  Tie-break: use_count giảm dần, rồi last_seen_at giảm dần
│  → top 5
▼
Bước 7 · Sonnet 5
   Trình bày 5 case: params, result, verdict, số lần dùng, lần gần nhất,
   tiêu chuẩn đã dùng. Nhãn "Cấu hình đã từng tính đạt, không phải khuyến nghị"
```

**Vì sao chấm điểm bằng code chứ không bằng tìm kiếm vector.** Hàm xếp hạng chỉ tính trên các key có ở **cả hai** phía, rồi chia cho độ phủ. Mỗi cặp câu hỏi và case có một tập key chung khác nhau, nên đây không phải khoảng cách giữa hai vector cố định. Một chỉ mục k-NN (HNSW) chỉ tìm được láng giềng theo một metric cố định trên vector đầy đủ chiều. Key thiếu phải điền bằng một giá trị giả, và giá trị giả đó làm sai khoảng cách.

**Vì sao `use_count` là tie-break tốt hơn vector.** Hai case cùng điểm thì case được nhiều lần tính đạt lặp lại là cấu hình công ty đang thật sự dùng. Đây là tín hiệu có sẵn, tất định, không tốn một lời gọi embedding nào.

---

## 5. Mô hình dữ liệu

```sql
CREATE TABLE "case" (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         text        NOT NULL,
  project_id     text,                          -- định danh, không lưu tên dự án
  tool_id        text        NOT NULL,
  tool_version   text        NOT NULL,
  element_type   text        NOT NULL,
  params         jsonb       NOT NULL,          -- đã chuẩn hóa đơn vị theo manifest
  units          jsonb       NOT NULL,
  result         jsonb       NOT NULL,
  verdict        text        NOT NULL CHECK (verdict IN ('pass','fail')),
  standard_ref   text        NOT NULL,
  dedupe_key     text        NOT NULL,
  use_count      integer     NOT NULL DEFAULT 1,
  first_tool_run_id uuid     NOT NULL,          -- tool_run sẽ bị xóa theo retention; cột này chỉ để truy vết khi còn
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  status         text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','withdrawn')),
  project_deleted boolean    NOT NULL DEFAULT false,
  UNIQUE (org_id, dedupe_key)
);

-- Lọc cứng ở 6c.2
CREATE INDEX case_lookup_idx ON "case" (org_id, tool_id, element_type)
  WHERE status = 'active' AND verdict = 'pass';

-- Cách ly organization: mọi truy vấn đều bị lọc, kể cả truy vấn viết sai
ALTER TABLE "case" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case" FORCE ROW LEVEL SECURITY;
CREATE POLICY case_org_isolation ON "case"
  USING (org_id = current_setting('app.org_id', true));
```

Bảng `case_standard` giữ nguyên (`case_id`, `standard_code`, `edition`, `clause`). Bảng `case_approval` **không còn cần**. Việc rút case (`status = withdrawn`) ghi vào `audit_event`.

`app.org_id` đặt bằng `SET LOCAL` ở đầu mỗi transaction, lấy từ `AccessScopeResolver`, không lấy từ request. Role kết nối của ứng dụng không phải owner của bảng và không có `BYPASSRLS`; `FORCE ROW LEVEL SECURITY` phòng trường hợp role đó vô tình thành owner.

---

## 6. Có dùng OpenSearch hay Elasticsearch không — **Không**

### Đối chiếu

| Tiêu chí | PostgreSQL `assistant` (đã có) | OpenSearch Serverless / Elasticsearch |
| --- | --- | --- |
| Hình dạng dữ liệu | JSON thông số có cấu trúc, vài chục key | Thiết kế cho văn bản và vector |
| Hàm xếp hạng `distance / coverage` trên key chung | Code C#, khoảng 50 dòng, test được | k-NN theo metric cố định không biểu diễn được. Collection vector Classic của OpenSearch Serverless **không hỗ trợ inline script hay stored script**, nên không viết được hàm chấm điểm riêng trong index |
| Cách ly organization | RLS: mọi truy vấn đều bị lọc, kể cả truy vấn viết sai | Filter trong từng truy vấn, quên là lộ, đúng loại rủi ro R46 đang phải canh ở MKB |
| Đồng bộ dữ liệu | Không cần: case ghi cùng transaction với `tool_run` | Phải đồng bộ PostgreSQL → index, thêm một đường có thể lệch |
| Đọc ngay sau khi ghi | Có | NextGen vector collection: `refresh_interval` 10 giây; Classic: 60 giây |
| Hạ tầng mới | Không | Collection, collection group, encryption policy, network policy, data access policy, khóa KMS, VPC endpoint riêng |
| Chi phí tăng thêm (mục 6.2) | Khoảng $0,23/tháng cho 1 triệu case | $495/tháng để giữ ấm 2 OCU search; $990/tháng nếu giữ ấm cả indexing |

### Căn cứ

**Sách.**
- *Vector Databases: A Practical Introduction* ch01 xếp việc **lưu metadata dưới dạng vector** vào anti-pattern: mất khả năng lọc, sắp xếp và mất ràng buộc toàn vẹn. Thông số của case chính là metadata có cấu trúc. Cũng chương đó xếp PostgreSQL kèm extension là mặc định cho ứng dụng quy mô nhỏ và vừa, kho vector chuyên dụng chỉ khi tới quy mô hàng tỉ vector.
- *AI Agents on AWS* ch03 tách bộ nhớ dài hạn làm hai loại: **có cấu trúc → Aurora**, **ngữ nghĩa → OpenSearch, pgvector, Bedrock Knowledge Bases**. Case là bộ nhớ có cấu trúc.
- *Engineering Generative AI-Based Software* ch07: dữ liệu dạng hàng có cấu trúc → SQL; vector database dành cho tìm theo nghĩa, không phải khớp chính xác.

**Tài liệu AWS, đọc trực tiếp.**
- [OpenSearch Serverless · Managing capacity limits](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-scaling.html): mỗi OCU gồm 6 GiB bộ nhớ kèm vCPU; tối thiểu OCU của collection group có thể là 0, nhưng khi đó phải chịu cold start; OCU cấu hình theo 2, 4, 8, 16 hoặc bội số của 16.
- [OpenSearch Serverless · Vector search collections](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-vector-search.html): NextGen `refresh_interval` 10 giây; Classic không hỗ trợ inline hoặc stored script, refresh 60 giây.
- Skill `aws-database`, card Aurora PostgreSQL: Aurora có Zero-ETL sang OpenSearch. Nếu sau này thật sự cần tìm kiếm toàn văn trên case, có đường nối sẵn mà không phải tự viết đồng bộ.

### 6.2 Chi phí so sánh

Tính bằng `cong-cu/cost_model.py` trên giá on-demand `eu-central-1` từ AWS Price List Bulk API. OCU của OpenSearch Serverless $0,339/giờ cho search và cho indexing; lưu trữ Aurora $0,119/GB-tháng.

| Phương án | USD/tháng |
| --- | --- |
| OpenSearch Serverless giữ ấm: search 2 OCU, indexing 0 | 494,94 |
| OpenSearch Serverless giữ ấm: search 2 OCU + indexing 2 OCU | 989,88 |
| Aurora: thêm 10 000 case × 2 KB | ~0,00 |
| Aurora: thêm 100 000 case × 2 KB | 0,02 |
| Aurora: thêm 1 000 000 case × 2 KB | 0,23 |

Đặt tối thiểu 0 OCU thì OpenSearch không tốn tiền khi rảnh, nhưng lượt tra đầu tiên sau lúc rảnh phải chờ cold start, và tra case nằm trên đường trả lời người dùng.

### Khi nào thì nên xem lại

| Tín hiệu | Ngưỡng gợi ý | Hướng xử lý |
| --- | --- | --- |
| Số case trong một `(org_id, tool_id, element_type)` | Vượt vài chục nghìn, và lọc cứng trả nhiều hơn 200 ứng viên thường xuyên | Lối thoát trong PostgreSQL, mục 7, chưa cần OpenSearch |
| Cần tìm toàn văn trên ghi chú tự do của kỹ sư đính kèm case | Có yêu cầu thật | Zero-ETL Aurora → OpenSearch, chỉ cho phần văn bản |
| Cần tra chéo nhiều organization | **Không bao giờ** | Case là bộ nhớ episodic của một organization, scope không rộng hơn `org:{id}` |

---

## 7. Khi kho case lớn lên — lối thoát vẫn trong PostgreSQL

Không làm ngay. Ghi ra để khi cần thì không phải thiết kế lại.

1. **Lọc thô theo key phân biệt nhất.** Mỗi tool khai trong manifest một `primary_key` (ví dụ `span` cho dầm). Thêm expression index và lấy 200 ứng viên gần nhất theo key đó trước khi chấm điểm:

   ```sql
   CREATE INDEX case_span_idx ON "case" (org_id, tool_id, ((params->>'span')::numeric))
     WHERE status = 'active' AND verdict = 'pass';

   SELECT * FROM "case"
   WHERE org_id = current_setting('app.org_id') AND tool_id = @tool_id
     AND status = 'active' AND verdict = 'pass'
     AND (params->>'span')::numeric BETWEEN @span * 0.7 AND @span * 1.3
   ORDER BY abs((params->>'span')::numeric - @span)
   LIMIT 200;
   ```

2. **Đo trước khi làm.** Ghi `candidate_count` và thời gian chấm điểm của mỗi lần tra vào `audit_event`. Chỉ bật bước 1 khi p95 `candidate_count` chạm trần 200.

3. **`pgvector` trên vector thông số đã chuẩn hóa** chỉ là phương án cuối, và chỉ cho tool có mọi `similarity_keys` bắt buộc. Tool có key tùy chọn thì không dùng được vì lý do ở mục 4.

---

## 8. Rủi ro và điều khiển (R26 viết lại cho AD-28)

| Rủi ro | Điều khiển |
| --- | --- |
| Cấu hình chạy thử, tính cho vui, cũng thành case | Chỉ `verdict = pass`; hiện `use_count` để kỹ sư thấy cấu hình nào được dùng lặp lại; quản trị organization rút case được |
| Engine hoặc manifest đổi phiên bản, case cũ tính theo logic cũ | Lưu `tool_version`; `standard_ref` khác ấn bản hiện hành thì thẻ case mang cảnh báo "có thể theo tiêu chuẩn cũ"; đổi major version của tool thì case cũ chỉ hiện khi không còn case nào của version mới |
| Kỹ sư coi case là khuyến nghị | Nhãn "đã từng tính đạt, không phải khuyến nghị"; hệ thống không tự áp case vào form tính; R34 và R37 giữ nguyên |
| Lộ case sang organization khác | RLS + `FORCE ROW LEVEL SECURITY`; test tích hợp hai organization khẳng định chỉ thấy case của mình |
| Kho phình to | `dedupe_key` gộp cấu hình trùng; lưu trữ chỉ khoảng 2 KB mỗi case |
| Xóa theo yêu cầu | Xóa cứng theo `org_id`; dự án bị xóa ở Main API thì `project_deleted = true` và xóa theo retention; ghi `audit_event` |

---

## 9. Việc cho từng đội

| Đội | Việc |
| --- | --- |
| Backend | Upsert case trong facade (mục 3); bỏ `POST /v1/approvals` khỏi luồng case; `CaseSimilarityScorer` đổi tie-break sang `use_count`, `last_seen_at`; bỏ lời gọi embedding khi ghi case; test idempotent: chạy lại cùng `toolUseId` không tăng `use_count` |
| DevOps | Không có hạ tầng mới. Không bật `pgvector`. Role ứng dụng không phải owner bảng `case`, không có `BYPASSRLS` |
| Frontend | Bỏ nút Duyệt và hộp xác nhận trên thẻ kết quả tính; thẻ case hiện `use_count`, `last_seen_at`, nhãn mới. Event `approval_required` không còn phát cho case; code xử lý event vẫn giữ, vì hợp đồng 11 event không đổi |
| Kỹ sư phụ trách manifest (E) | Khai `case_source`, `similarity_keys`, dải hợp lệ, `primary_key` cho từng tool `calc.*` |

---

## Chưa rõ

| Điểm | Cần ai trả lời |
| --- | --- |
| Có lưu cấu hình **không đạt** để tra không (mục 3) | Công ty, kỹ sư E |
| Nguồn case ngoài trợ lý: các phép tính kỹ sư tự làm trong ứng dụng nằm ở database VFSoftware. Đưa vào kho case thì cần endpoint đọc kết quả theo dự án và cấu kiện ở Main API (R35) | Main API |
| Ngưỡng số case để bật lối thoát ở mục 7 | Đo khi có dữ liệu thật |

---

## Bảng tra nhanh: cái gì không bao giờ được làm

| Không bao giờ | Vì sao |
| --- | --- |
| Tạo case từ số mô hình đọc được trong câu chữ | Case chỉ sinh từ output của engine; `case_hints` chỉ để lọc và chấm điểm |
| Tạo case khi `ApiResult.Code` báo lỗi hoặc `verdict` khác `pass` | Case là cấu hình đã tính đạt |
| Để case là view trên `tool_run` | `tool_run` bị xóa theo retention, kho case sẽ rỗng dần |
| Tra case chéo organization | Case là bộ nhớ của một organization |
| Dựng OpenSearch hay Elasticsearch chỉ để tra case | Không biểu diễn được hàm xếp hạng, thêm đường đồng bộ và một biên phân quyền dễ quên |
| Lưu thông số case dưới dạng vector để tìm | Anti-pattern "metadata as vectors"; key thiếu làm sai khoảng cách |
| Cho role ứng dụng là owner bảng `case` | Owner bỏ qua RLS |

---

## Liên quan

| Cần gì | Đọc |
| --- | --- |
| Luồng tổng, AD-28, mô hình dữ liệu chung | [01-kien-truc.md](01-kien-truc.md) §6.5, §6.10, §8.1, §9 |
| Hợp đồng: `approval_required`, `/v1/approvals` sau AD-28 | [02-hop-dong.md](02-hop-dong.md) |
| Cài đặt chi tiết phía Backend | [14-chi-tiet-backend.md](14-chi-tiet-backend.md) |
| Chi phí | [13-chi-phi.md](13-chi-phi.md) |
