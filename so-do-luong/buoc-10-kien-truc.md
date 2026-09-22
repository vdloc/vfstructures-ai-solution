# Bước 10 — Ghi sổ

Lượt kết thúc theo đường nào cũng phải ghi lại: câu hỏi, câu trả lời, lần retrieval, lần tính, nhật ký. Sau đó trừ quota theo lượng token thật và mở khóa để người dùng hỏi câu tiếp.

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/`

## Luồng của bước 10

```
Mọi đường kết thúc
│  Completed, CompletedUnverified, Refused, Rejected, Degraded, lỗi, aborted
▼
10.1 GHI LƯỢT                                   Assistant.Api → PostgreSQL assistant
│  Làm gì:     Lưu mọi thứ đã xảy ra trong lượt
│  Làm thế nào: message: bản đã che PII, kèm expires_at
│              retrieval_log, tool_run
│              audit_event: ai, làm gì, khi nào, tool nào, guardrail nào
│              can thiệp. Không chứa nội dung câu hỏi
▼
10.2 TRỪ QUOTA                                  PostgreSQL · usage
│  Làm gì:     Trừ quota ngày theo token thực dùng
│  Làm thế nào: INSERT … ON CONFLICT (user_id, day)
│              DO UPDATE SET tokens = usage.tokens + @n
│              Cảnh báo ở 50%, 80%, 100%
▼
10.3 MỞ KHÓA LƯỢT                               PostgreSQL · active_turn
│  Làm gì:     Cho người dùng hỏi câu tiếp
│  Làm thế nào: Xóa hàng active_turn trong finally, trên mọi đường
▼
10.4 TELEMETRY                                  OTLP → CloudWatch
   Span mang correlation_id xuyên BFF → Assistant.Api → Main API

Chạy ngoài lượt:
   Job hằng ngày xóa cứng message, tool_run, retrieval_log quá expires_at
   Job quét active_turn quá started_at + timeout
   Người dùng chấm tốt/xấu → feedback → câu xấu vào bộ eval
```

## Từ khóa

**message và expires_at**
<!-- alias: expires_at -->
- Là gì: Bảng `message` lưu câu hỏi và câu trả lời. `expires_at` là ngày hết hạn của từng dòng: ngày tạo + retention.
- Ở kiến trúc này: Chỉ lưu bản đã che PII bằng `ApplyGuardrail` ANONYMIZE. Retention đề xuất 90 ngày, con số cuối do DPO quyết.
- Vì sao: Câu hỏi có thể chứa thông tin cá nhân hoặc bí mật của chủ đầu tư. Giữ mãi là giữ rủi ro mãi.
- Nguồn: `07-auth-bao-mat.md` §6

**audit_event**
<!-- alias: audit_event -->
- Là gì: Nhật ký kiểm toán: ai làm gì, khi nào, gọi tool nào, guardrail nào can thiệp.
- Ở kiến trúc này: Ghi trên **mọi** đường kết thúc, kể cả bị chặn ở cổng. Giữ lâu hơn `message`, và **không** chứa nội dung câu hỏi.
- Vì sao: Xóa `message` theo retention hoặc theo yêu cầu vẫn giữ được dấu vết kiểm toán, mà không giữ lại dữ liệu cá nhân.
- Nguồn: `07-auth-bao-mat.md` §6 · `02-assistant-service.md` §5

**retrieval_log và tool_run**
<!-- alias: retrieval_log, tool_run -->
- Là gì: Hai bảng ghi lần retrieval và lần gọi engine của lượt.
- Ở kiến trúc này: Xóa cùng `message` khi hết hạn hoặc khi người dùng xóa hội thoại.
- Vì sao: Là dữ liệu để truy vì sao câu trả lời như vậy, và nguồn đối chiếu cho validator ở bước 8.
- Nguồn: `07-auth-bao-mat.md` §6 · `19-dac-ta-kien-truc.md` §8.1

**Quota ngày theo token**
<!-- alias: TRỪ QUOTA -->
- Là gì: Hạn mức mỗi ngày cho từng user và từng organization, tính bằng số token.
- Ở kiến trúc này: Kiểm ở bước 2, trừ ở bước 10 theo token **thực dùng**, lấy từ `usage` của lượt.
- Vì sao: Một lượt có gọi tool tốn gấp nhiều lần lượt hỏi thường; đếm số lượt là đếm sai thứ đang tốn tiền. Có giới hạn một lượt chạy đồng thời nên trừ-sau không tạo kẽ hở để lách.
- Nguồn: `07-auth-bao-mat.md` §2a

**INSERT … ON CONFLICT**
<!-- alias: ON CONFLICT -->
- Là gì: Câu lệnh PostgreSQL "thêm dòng mới, trùng khóa thì cập nhật dòng cũ", chạy nguyên tử trong một câu.
- Ở kiến trúc này: Cộng dồn token vào dòng `(user_id, day)`.
- Vì sao: Đọc rồi ghi bằng hai câu riêng thì hai request cùng lúc có thể ghi đè nhau, mất số liệu.
- Nguồn: `07-auth-bao-mat.md` §2a

**active_turn và finally**
<!-- alias: active_turn, finally -->
- Là gì: Bảng giữ lượt đang chạy của từng user, khóa chính là `user_id`. `finally` là khối code luôn chạy dù có lỗi hay không.
- Ở kiến trúc này: Bước 2 chèn hàng; chèn không được thì trả `429 concurrent_turn`. Bước 10 xóa hàng trong `finally`.
- Vì sao: Xóa chỉ ở đường thành công thì một lượt lỗi khóa người dùng vĩnh viễn. Job quét dọn thêm các hàng quá hạn, phòng khi tiến trình chết giữa chừng.
- Nguồn: `07-auth-bao-mat.md` §2a

**correlation_id**
<!-- alias: correlation_id -->
- Là gì: Mã gắn vào mọi log và span của một request khi request đi qua nhiều service.
- Ở kiến trúc này: Mọi span mang `correlation_id` xuyên từ BFF sang `Assistant.Api` sang Main API.
- Vì sao: Một sự cố truy được từ giao diện tới tool mà không phải ghép log bằng tay.
- Nguồn: `09-eval-quan-sat.md`

**OTLP và CloudWatch**
<!-- alias: OTLP, CloudWatch -->
- Là gì: OTLP là giao thức chuẩn của OpenTelemetry để gửi log, metric, trace. CloudWatch là dịch vụ quan sát của AWS.
- Ở kiến trúc này: `Assistant.Api` và `Assistant.Worker` gửi telemetry qua OTLP về CloudWatch.
- Vì sao: Dùng chuẩn mở thì đổi nơi nhận telemetry không phải sửa code.
- Nguồn: `01-kien-truc-tong-the.md` §2

**Xóa cứng theo retention**
<!-- alias: xóa cứng -->
- Là gì: Xóa hẳn khỏi database, không khôi phục được.
- Ở kiến trúc này: Job hằng ngày xóa các dòng quá `expires_at`. Người dùng xóa hội thoại hoặc yêu cầu xóa dữ liệu cá nhân cũng dẫn tới xóa cứng. Chỉ giữ số liệu tổng hợp và `audit_event`.
- Vì sao: Xóa mềm (chỉ đánh dấu) vẫn để dữ liệu cá nhân nằm trong database.
- Nguồn: `07-auth-bao-mat.md` §6

**feedback và eval**
<!-- alias: feedback -->
- Là gì: Người dùng chấm tốt/xấu một câu trả lời. Eval là bộ câu hỏi chuẩn chạy tự động để đo chất lượng.
- Ở kiến trúc này: Câu bị chấm xấu được phân loại rồi đưa vào bộ eval (luồng F5). Eval gate trong CI chặn merge khi chất lượng giảm (luồng F6).
- Vì sao: Lỗi thật của người dùng thành test case, nên lần sửa prompt hay retrieval sau không làm hỏng lại chỗ đã sửa.
- Nguồn: `01-kien-truc-tong-the.md` §3

## Chưa rõ trong tài liệu

- Tài liệu chưa nói token "thực dùng" tính những phần nào: có tính token đọc cache không, tính token của Haiku và của vòng lặp Harness thế nào.
- Hạn mức token ngày chưa có con số, sẽ chốt ở M0 sau khi đo chi phí mỗi lượt.
