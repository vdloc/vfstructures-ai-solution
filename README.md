# AI Assistant cho VF Structures

Kiến trúc trợ lý AI cho phần mềm tính toán kết cấu `vfstructures-app`: hỏi đáp tiêu chuẩn có dẫn chứng, gọi engine tính toán, tra case đã tính.

**Bộ tài liệu chính thức nằm ở [`ship/`](ship/README.md).** Bắt đầu từ đó.

| Đường dẫn | Nội dung |
| --- | --- |
| [`ship/`](ship/README.md) | Bộ bàn giao: kiến trúc, hợp đồng API, thi công từng đội, bảo mật, chi phí, hướng dẫn thao tác trên console AWS |
| [`ship/kien-truc-day-du.md`](ship/kien-truc-day-du.md) | Hồ sơ đề xuất cho ban lãnh đạo và CTO |
| [`cong-cu/`](cong-cu/) | Script tính chi phí, tải đơn giá thật ở `eu-central-1`, và chunk demo để nạp vào Knowledge Base |
| [`mock-server/`](mock-server/README.md) | Server giả lập `Assistant.Api` `/v1` để Frontend dựng panel AI trước khi Backend chạy |
| [`so-do-luong/`](so-do-luong/README.md) | Nguồn của trang web giải thích một lượt hỏi theo 10 bước |
| `ho-so-de-xuat.html` | Bản HTML của hồ sơ đề xuất |

Bộ tài liệu bản 1.x (24 file ở thư mục gốc) đã được thay hẳn bằng `ship/` và gỡ khỏi cây làm việc; tra lại bằng `git log`.
