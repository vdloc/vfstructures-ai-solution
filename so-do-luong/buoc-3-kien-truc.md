# Bước 3 — Xác định phạm vi được đọc

Hệ thống lập danh sách phạm vi tài liệu người này được xem. Danh sách này đi theo cả lượt và quyết định bước 6 được tìm trong những tài liệu nào.

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/ship/`

## Luồng của bước 3

```
Assistant.Api · ChatOrchestrator
│  Request đã qua middleware (bước 2)
│  Task.WhenAll — ba việc chạy cùng lúc:
│    ├── AccessScopeResolver    (bước 3, tab này)
│    ├── ApplyGuardrail INPUT   (soát câu hỏi)
│    └── ConversationStore      (bước 4)
▼
3.1 TRA CACHE                                   AccessScopeResolver
│  Làm gì:     Có danh sách scope của người này từ lần trước chưa
│  Làm thế nào: Cache trong bộ nhớ tiến trình, TTL 60 giây, không có Redis
│              Có → dùng luôn, sang 3.4
▼
3.2 HỎI ORGANIZATION                            Payment API
│  Làm gì:     Người này thuộc công ty nào
│  Làm thế nào: Gọi Payment API bằng Bearer của người dùng → org_id
│              KHÔNG tin org_id do client gửi
▼
3.3 HỎI DỰ ÁN                                   Main API · Project
│  Làm gì:     Người này có quyền trên những dự án nào
│  Làm thế nào: Gọi Main API bằng Bearer của người dùng → danh sách project
▼
3.4 GỘP DANH SÁCH SCOPE                         AccessScopeResolver
│  Làm gì:     Một danh sách duy nhất cho cả lượt
│  Làm thế nào: public + org:{org_id} + project:{id} của từng dự án
│              Ví dụ: public, org:42, project:7
│              pageContext KHÔNG góp gì vào danh sách này
▼
Danh sách scope được dùng ở:
   6a  Retrieve: filter scope_key IN danh sách, ghép andAll với status
       dựng ở đúng một lớp ScopedKnowledgeBaseClient
       sau Retrieve kiểm lại scope_key của TỪNG chunk
   6c  Tra case: chỉ theo org_id, PostgreSQL ép bằng Row-Level Security
```

## Ba mức scope

| `scope_key` | Ai đọc được | Nguồn xác định |
| --- | --- | --- |
| `public` | Mọi người có module `Assistant.Use` | Tiêu chuẩn và tài liệu chung |
| `org:{id}` | Thành viên organization | Payment API |
| `project:{id}` | Người có quyền trên dự án | Main API |

Case không có mức `public`. Case của công ty nào chỉ công ty đó thấy.

## Từ khóa

**Task.WhenAll**
<!-- alias: Task.WhenAll -->
- Là gì: Hàm của .NET chạy nhiều việc bất đồng bộ cùng lúc và chờ tới khi tất cả xong.
- Ở kiến trúc này: Ba việc độc lập chạy song song: lấy scope, `ApplyGuardrail` soát câu hỏi, đọc lịch sử.
- Vì sao: Tổng thời gian bằng việc chậm nhất, không phải tổng ba việc. Nghiệm thu có test khẳng định điều này.
- Nguồn: `ship/03-backend.md` bước 2

**AccessScopeResolver**
<!-- alias: AccessScopeResolver -->
- Là gì: Thành phần trong `Assistant.Api` tính danh sách `scope_key` người dùng được đọc.
- Ở kiến trúc này: Chỉ lấy quyền từ JWT, qua Payment API và Main API. Kết quả cache 60 giây.
- Vì sao: Quyền phải đến từ nguồn server tin được. Lấy từ dữ liệu trình duyệt gửi lên thì ai cũng sửa được.
- Nguồn: `ship/01-kien-truc.md` §5.3 · `ship/06-bao-mat.md` §1

**Cache 60 giây trong tiến trình**
<!-- alias: TTL 60 giây -->
- Là gì: Kết quả scope giữ trong bộ nhớ của chính instance `Assistant.Api` trong 60 giây.
- Ở kiến trúc này: Không có Redis. Scale nhiều instance thì mỗi instance có cache riêng.
- Vì sao: Không phải gọi Payment API và Main API ở mọi lượt. Cái giá là **thu hồi quyền có độ trễ tới 60 giây**. Nghiệp vụ không chấp nhận thì giảm TTL hoặc bỏ cache cho `project:*`, và đó là việc phải bàn chứ không tự sửa.
- Nguồn: `ship/03-backend.md` BE-2 · `ship/06-bao-mat.md` §1

**Payment API và org_id**
<!-- alias: Payment API, org_id -->
- Là gì: Payment API là dịch vụ thanh toán hiện có, biết người dùng thuộc organization nào. `org_id` là mã organization đó.
- Ở kiến trúc này: Nguồn duy nhất của `org_id`. `org_id` quyết định scope `org:{id}` và phạm vi tra case.
- Vì sao: Giả `org_id` là cách đơn giản nhất để đọc tài liệu công ty khác. Không nhận `org_id` từ client thì cách này không dùng được.
- Nguồn: `ship/01-kien-truc.md` §8.9 · `ship/06-bao-mat.md` §10 (STRIDE)

**Main API**
<!-- alias: Main API -->
- Là gì: Backend chính của VF Structures: dự án, cấu kiện, engine tính toán.
- Ở kiến trúc này: Trả danh sách dự án người dùng có quyền. `Assistant.Api` gọi bằng chính Bearer của người dùng, không dùng service account, nên `[ApiAccess]` áp nguyên trạng.
- Vì sao: Trợ lý không bao giờ có quyền nhiều hơn người đang dùng nó.
- Nguồn: `ship/06-bao-mat.md` §1

**scope_key**
<!-- alias: scope_key -->
- Là gì: Trường metadata trên mỗi chunk tài liệu, ghi chunk thuộc phạm vi nào: `public`, `org:{id}`, hoặc `project:{id}`.
- Ở kiến trúc này: Worker tài liệu ghi `scope_key` vào sidecar khi nạp. Bước 6a lọc `scope_key IN` danh sách của bước 3.
- Vì sao: Từ AD-17, filter theo `scope_key` là lớp chặn duy nhất giữa các organization trong Knowledge Base (R46).
- Nguồn: `ship/01-kien-truc.md` §8.9 · `ship/06-bao-mat.md` §1

**ScopedKnowledgeBaseClient**
<!-- alias: ScopedKnowledgeBaseClient -->
- Là gì: Lớp duy nhất trong code được gọi `Retrieve` của Bedrock Knowledge Base.
- Ở kiến trúc này: Tự dựng filter từ danh sách scope, không nhận filter từ bên ngoài. Sau `Retrieve`, kiểm lại `scope_key` của từng chunk. Chunk ngoài danh sách bị loại, ghi `audit_event` loại `scope_violation` và bắn cảnh báo mức cao nhất.
- Vì sao: Quên filter thì Knowledge Base trả tài liệu của mọi organization mà không báo lỗi. Gom vào một lớp, cộng architecture test, thì không ai quên được. Lớp kiểm lại biến lỗi im lặng thành lỗi có cảnh báo.
- Nguồn: `ship/01-kien-truc.md` §8.9 · `ship/06-bao-mat.md` §1

**Row-Level Security**
<!-- alias: Row-Level Security -->
- Là gì: Tính năng của PostgreSQL: database tự lọc hàng theo policy, kể cả khi câu SQL của ứng dụng quên `WHERE`.
- Ở kiến trúc này: Bảng `case` bật RLS và FORCE RLS, policy so `org_id` với `current_setting('app.org_id', true)`. Role ứng dụng không phải owner và không có `BYPASSRLS`.
- Vì sao: Case nằm trong PostgreSQL, không qua Knowledge Base, nên cần một lớp chặn riêng do database ép, không dựa vào quy ước code.
- Nguồn: `ship/12-tra-case.md` · `ship/06-bao-mat.md` §1
