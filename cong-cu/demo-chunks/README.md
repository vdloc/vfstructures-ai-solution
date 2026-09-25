# Chunk demo để nạp vào Knowledge Base

Sáu chunk dựng sẵn để thử đường **tự parse, tự chunk**: data source loại `Custom`, chunking strategy `NONE`. Dùng để kiểm hành vi của KB trước khi viết mã thật.

**Nội dung là văn bản bịa, không phải nguyên văn tiêu chuẩn.** Mỗi chunk mở đầu bằng `[VĂN BẢN DEMO`. Câu hỏi bản quyền corpus thật là Q2, chưa trả lời — đừng thay bằng nguyên văn NF EN hay DTU cho tới khi Q2 xong.

## Chạy

```bash
python3 cong-cu/demo-chunks/build-ingest-payload.py
```

Đọc `chunks.json`, ghi ra `out/`:

| Đường dẫn | Dùng làm gì |
| --- | --- |
| `out/ingest-payload.json` | Thân lời gọi `IngestKnowledgeBaseDocuments`. Thay `<KB_ID>` và `<DATA_SOURCE_ID>` rồi gửi |
| `out/txt/<id>.txt` | Nội dung một chunk, để kéo thả trên console |
| `out/txt/<id>.metadata.json` | Sidecar có kiểu đi kèm file txt cùng tên |

Script kiểm hai trần mà Bedrock KB áp khi kho vector là S3 Vectors — **1 KB metadata tuỳ biến và 35 khoá mỗi vector** — và chặn trùng `id`, vì **trùng `id` là ghi đè, không báo trước**. Hai trần này chặt hơn trần của riêng S3 Vectors (40 KB, 50 khoá); vượt là ingestion job ném lỗi. Sáu chunk hiện tại dùng 309–370 B và 13–16 khoá.

## Sáu chunk dựng để kiểm cái gì

| id | Kiểm |
| --- | --- |
| `demo-EN1992-1-1_6.2.2_c01` | Đường cơ bản: chunk vào nguyên vẹn, không bị cắt lại |
| `demo-EN1992-1-1_6.2.3_c02` | Hai chunk cùng tài liệu, khác `clause_path` — lọc theo điều khoản |
| `demo-EN1993-1-1_6.2.6_c03` | Khác `scope_key`, khác tiêu chuẩn |
| `demo-EN1993-1-1_6.2.6_c04-superseded` | `status: superseded` và `effective_to` đã qua — bộ lọc phải loại nó |
| `demo-scope-khac_c05` | `scope_key` ngoài quyền người dùng — không được lọt vào kết quả |
| `demo-app-help_c06` | `doc_type: app_help` — intent `doc_qa` không được trộn nó vào |

Nạp cả sáu rồi `Retrieve` với filter `scope_key IN ["org-42/EN1992", "org-42/EN1993"]` và `status = active`: đúng ba chunk đầu được trả về. Chunk 4, 5, 6 lọt ra là bộ lọc hỏng.

## Nạp lên bằng console

KB → chọn data source → **Documents** → **Add documents** → *Add documents directly*. Console nhận tối đa **10 tài liệu một lần**; API cho 25.

## Nạp lên bằng CLI

```bash
aws bedrock-agent ingest-knowledge-base-documents \
  --region eu-central-1 \
  --cli-input-json file://cong-cu/demo-chunks/out/ingest-payload.json
```

Data source loại `Custom` **không có** `StartIngestionJob`: nạp xong là tài liệu thuộc luôn cả data source lẫn KB.

## Số trang

Chọn `NONE` là mất số trang trong citation của Bedrock, nên `page` ở đây là khoá metadata **do mình ghi**, không phải của AWS. `CitationValidator` đọc khoá này. Xem [16 §B.3](../../ship/16-huong-dan-console.md).
