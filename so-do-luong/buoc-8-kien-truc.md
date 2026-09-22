# Bước 8 — Soát lại câu trả lời

Chữ đã hiện xong trên màn hình. Code tất định soát lại: số có nguồn không, citation có thật không, có khẳng định "đạt" mà không có lần tính nào không. Trượt thì gắn cờ, không xóa chữ.

Nguồn: `/home/vdloc/Downloads/vfstructures-ai-assistant (1)/vfstructures-ai-assistant/vfstructures-ai-solution/`

## Luồng của bước 8

```
Assistant.Api · ChatOrchestrator
│  Stream đã kết thúc. Chữ đã hiện trên màn hình
│  Validator tất định, không dùng AI chấm AI
▼
8.1 SOÁT SỐ                                     Assistant.Api · NumberValidator
│  Làm gì:     Mỗi con số phải có nguồn
│  Làm thế nào: Khớp tool_run với relTol 0.005,
│              hoặc có nguyên văn trong đoạn trích của chunk đã retrieval
│              ✗ → warning unverified_number
▼
8.2 SOÁT CITATION                               Assistant.Api · CitationValidator
│  Làm gì:     Mỗi [n] phải trỏ về chunk thật
│  Làm thế nào: Phân giải [n] về chunk_id đã retrieval ở CHÍNH lượt này
│              ✗ → warning unverified_citation
▼
8.3 SOÁT NHÃN "ĐẠT"                             Assistant.Api · VerificationValidator
│  Làm gì:     Không nói "đạt" khi chưa tính
│  Làm thế nào: "đạt", "thỏa mãn" gắn với mã phương án [P1]
│              phải có tool_run khớp tham số
│              ✗ → đánh dấu unverified
▼
8.4 SOÁT PHIÊN BẢN TIÊU CHUẨN                   Assistant.Api
│  Làm gì:     Engine và tài liệu cùng một bản tiêu chuẩn
│  Làm thế nào: standardRef của engine so với edition của chunk
│              ✗ → warning standard_version_mismatch
▼
8.5 GROUNDING  (lớp phụ)                        Bedrock Guardrails · ApplyGuardrail
│  Làm gì:     Kiểm câu trả lời có bám tài liệu không
│  Làm thế nào: Chỉ khi câu trả lời ≤ 5 000 ký tự. Chỉ gắn cờ
▼
Kết quả
   Đạt hết      → Completed
   Có cảnh báo  → CompletedUnverified, KHÔNG xóa chữ đã hiện
   → SSE citation, rồi warning nếu có
```

## Ví dụ

```
Câu trả lời:  "Theo EN 1992-1-1 §6.2.2 [1], VRd,c tối thiểu là 0,035 k^1,5 fck^0,5.
               Dầm B12 có VRd = 184,2 kN [2], đạt."

8.1  184,2    khớp tool_run.outputs.VRd = 184.2               đạt
     0,035    có nguyên văn trong đoạn trích của chunk [1]    đạt
8.2  [1]      chunk_id c-771, đã retrieval ở lượt này         đạt
     [2]      không có chunk nào ứng với [2]                  ✗ unverified_citation
8.3  "đạt"    có tool_run calc.beam.shear khớp b, h            đạt

→ CompletedUnverified. Banner "Một citation chưa xác minh được" chèn lên
  câu trả lời đã hiện, không xóa chữ.
```

## Từ khóa

**Validator tất định**
<!-- alias: Validator tất định -->
- Là gì: Validator viết bằng code so khớp, cùng đầu vào luôn ra cùng kết quả. Không dùng mô hình AI làm giám khảo.
- Ở kiến trúc này: Ba validator chạy trong `Assistant.Api` sau khi stream xong: `NumberValidator`, `CitationValidator`, `VerificationValidator`.
- Vì sao: Dùng mô hình chấm mô hình thì lại gặp đúng bài toán cũ: không biết khi nào giám khảo sai. Code tất định thì viết test được.
- Nguồn: `ship/00-thuat-ngu-va-nguon.md` · `04-tool-calling.md` §3

**NumberValidator**
<!-- alias: NumberValidator -->
- Là gì: Validator kiểm từng con số trong câu trả lời.
- Ở kiến trúc này: Hai nguồn hợp lệ: `tool_run` (số tính ra) và đoạn trích của chunk (số của tiêu chuẩn). Bản đầu chỉ nhận `tool_run`, và câu trả lời nêu giá trị giới hạn của tiêu chuẩn bị gắn cờ oan.
- Vì sao: Thực thi nguyên tắc P2: mô hình không bao giờ tự tính một con số nào. Tool phải trả nguyên JSON; tóm tắt output tool là tự bịt mắt validator này (BE-7).
- Nguồn: `04-tool-calling.md` §3, §11 · `ship/03-backend.md`

**relTol**
<!-- alias: relTol -->
- Là gì: Sai số tương đối cho phép khi so hai số: |a − b| / |b|.
- Ở kiến trúc này: 0.005, tức 0,5%. 1234,567 viết thành 1235 vẫn đạt.
- Vì sao: Mô hình làm tròn khi viết. Không cho sai số thì số đúng cũng bị gắn cờ.
- Nguồn: `19-dac-ta-kien-truc.md` §8.6

**CitationValidator**
<!-- alias: CitationValidator -->
- Là gì: Validator kiểm từng dấu trích dẫn `[1]`, `[2]` trong câu trả lời.
- Ở kiến trúc này: Mỗi `[n]` phải trỏ về một chunk **đã retrieval ở chính lượt này**, không phải một chunk có tồn tại đâu đó trong kho. Tra bằng bảng `chunk` trong PostgreSQL.
- Vì sao: Chặn kiểu hallucination khó thấy nhất: câu trả lời có citation trông rất chuyên nghiệp nhưng citation không có thật.
- Nguồn: `02-assistant-service.md` §3 · `22-thuyet-minh-toan-bo-kien-truc.md`

**VerificationValidator**
<!-- alias: VerificationValidator -->
- Là gì: Validator tìm các nhãn kết luận như "đạt", "thỏa mãn".
- Ở kiến trúc này: Nhãn gắn với mã phương án `[P1]` thì phải có `tool_run` khớp tham số. Kiểm bằng mã phương án nên chính xác hơn tìm từ khóa trơn.
- Vì sao: Một câu "dầm đạt" không có lần tính nào chứng minh là lỗi nguy hiểm nhất với kỹ sư kết cấu. Cách diễn đạt lạ vẫn có thể lọt, nên eval có nhóm riêng (nhóm J).
- Nguồn: `04-tool-calling.md` §10

**standardRef và edition**
<!-- alias: standardRef -->
- Là gì: `standardRef` là phiên bản tiêu chuẩn engine dùng để tính. `edition` là ấn bản của tài liệu chứa chunk.
- Ở kiến trúc này: Hai giá trị khác nhau thì phát `standard_version_mismatch`, ví dụ "Bộ tính dùng EC2:2004, citation từ bản 2023".
- Vì sao: Kết quả tính theo bản cũ mà trích điều khoản bản mới thì câu trả lời mâu thuẫn mà người đọc không nhận ra.
- Nguồn: `04-tool-calling.md` §11 · `ship/02-hop-dong.md` §5

**Contextual grounding**
<!-- alias: GROUNDING -->
- Là gì: Tính năng của Bedrock Guardrails chấm xem câu trả lời có bám vào tài liệu nguồn không.
- Ở kiến trúc này: Chỉ là lớp phụ: chỉ gắn cờ, chỉ với câu trả lời ≤ 5 000 ký tự.
- Vì sao: AWS ghi rõ tính năng này không hỗ trợ chatbot hội thoại, và khi stream thì chỉ đánh dấu sau khi đã stream hết. Không thay được validator tất định (BE-9).
- Nguồn: `06-tang-bedrock.md` §4 · `ship/03-backend.md` BE-9

**warning**
<!-- alias: warning -->
- Là gì: Event SSE báo câu trả lời có điểm chưa kiểm chứng được. Mã: `unverified_number`, `unverified_citation`, `standard_version_mismatch`, `degraded_retrieval_only`, `truncated`.
- Ở kiến trúc này: Luôn đến **sau** chữ. Giao diện chèn banner lên câu trả lời đã đầy đủ.
- Vì sao: Xóa chữ giữa chừng làm người dùng mất niềm tin vào cả những lượt đúng. Hệ thống chọn nói rõ "phần này chưa kiểm được".
- Nguồn: `ship/02-hop-dong.md` §5 · `22-thuyet-minh-toan-bo-kien-truc.md`

**CompletedUnverified**
<!-- alias: CompletedUnverified -->
- Là gì: Trạng thái kết thúc của lượt: đã trả lời xong nhưng có điểm chưa kiểm chứng được.
- Ở kiến trúc này: Một trong các trạng thái cuối của state machine, cùng với `Completed`, `Refused`, `Rejected`.
- Vì sao: Tách riêng trạng thái này để đo được tỉ lệ câu trả lời có cảnh báo, và để eval bắt khi tỉ lệ đó tăng.
- Nguồn: `02-assistant-service.md` §5

## Chưa rõ trong tài liệu

- Cách bóc số từ văn bản chưa được đặc tả: định dạng số tiếng Việt và tiếng Pháp (`1.234,56`), số trong mã điều khoản, năm, số thứ tự danh sách. Bóc sai là gắn cờ oan hàng loạt, và `ship/03-backend.md` BE-8 ghi đây là cách hỏng tệ hơn không có cảnh báo.
- "Trích nguyên văn từ chunk" chưa có định nghĩa thao tác: so trên cả chunk hay chỉ đoạn trích, có chuẩn hóa khoảng trắng không.
- Ví dụ ở trên là minh họa do mình dựng, không lấy từ tài liệu.
