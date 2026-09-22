# Sơ đồ luồng một lượt hỏi

Trang HTML giải thích từng bước của một lượt hỏi: tab Mental model, tab bước 1–10, tab AWS · Bedrock & KMS. Bản đang chạy: https://vfstructures-luong-mot-luot-hoi.surge.sh

Nội dung lấy từ bộ `ship/`. Khi `ship/` đổi, sửa file md ở đây trước rồi mới dựng lại HTML.

| File | Nội dung |
| --- | --- |
| `mental-model-luong.md` | Luồng mental model, tab đầu tiên |
| `giai-thich-non-tech.md` | Giải thích cho người không làm kỹ thuật, nằm cuối tab Mental model |
| `buoc-N-kien-truc.md` | Tab bước N: luồng, ví dụ, thẻ từ khóa (tooltip) |
| `aws-bedrock-kms-kien-truc.md` | Tab AWS |
| `so-do-cac-buoc.md` | Sơ đồ ở đầu mỗi tab, cú pháp ghi ở đầu file |
| `build_html.py`, `template.html` | Dựng `luong-mot-luot-hoi.html` |

Thẻ từ khóa phải đủ bốn dòng `Là gì`, `Ở kiến trúc này`, `Vì sao`, `Nguồn`, kèm dòng `<!-- alias: … -->`. Script dừng với lỗi nếu thiếu.

## Dựng và đẩy lên surge

```bash
python3 build_html.py
mkdir -p /tmp/surge-site && cp luong-mot-luot-hoi.html /tmp/surge-site/index.html
surge /tmp/surge-site vfstructures-luong-mot-luot-hoi.surge.sh
```

Link surge là công khai: ai có link đều xem được.
