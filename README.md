# AI Editor Studio

Ứng dụng Windows dùng [`ghost-editor/`](./ghost-editor) làm lõi dựng video và Codex CLI làm agent chọn đoạn, lập kế hoạch. Repo gốc được tải trực tiếp từ [kurbaitaev/ghost-editor](https://github.com/kurbaitaev/ghost-editor); không phụ thuộc `igen-editor`.

## Chạy

```powershell
cd D:\iGen\ai-editor
npm install
npm run dev
```

Mở `http://127.0.0.1:5173/`. Trong **Studio**, tải video, chọn một trong 7 preset rồi bấm **Dựng bản nháp 15 giây**. Tiến độ và nút tải MP4 xuất hiện bên phải. Dự án được lưu cục bộ bằng IndexedDB.

Máy chạy job cần Codex CLI đã đăng nhập, `uv` và Python 3.11 (`uv python install 3.11`). FFmpeg, FFprobe và HyperFrames được cài bằng npm. Tải model nhận dạng lời nói bằng `npm run setup:model` (mặc định `small`; thêm `-- tiny` để dùng bản nhẹ). Các file model nằm trong `.cache/` và không đưa vào git.

## Đã nối vào job Windows

- Nhận dạng lời nói bằng faster-whisper; Codex chọn các take và điểm nhấn từ transcript.
- Chuẩn hóa video/âm thanh, theo dõi khuôn mặt bằng script `face_track.py` của repo gốc.
- `reel.json` và `build.mjs` của `ghost-editor`: caption, beat đồ họa, preset style, nhạc nền và SFX.
- `transitions.py` của repo gốc tạo dissolve giữa các take; HyperFrames xuất MP4.
- `qa.py --no-stem` kiểm tra thời lượng, âm thanh, caption và chuyển cảnh sau render; Codex xem contact sheet và ghi lỗi hình nhìn thấy.
- Chế độ video mẫu gọi `reference_study.py` của repo gốc khi máy có `GEMINI_API_KEY`; Codex dùng log phân tích để lập kế hoạch. Chưa kiểm thử chế độ này trên máy hiện tại vì chưa có key.
- Tạo ảnh minh họa bằng `broll_gen.py` khi có `GEMINI_API_KEY`. Khi chưa có key, app tạo hình vector cục bộ và báo rõ trong job.

## Phần còn cần nâng cấp

Repo gốc có nhiều recipe riêng và công cụ B-roll, matte, meme, kiểm duyệt người trong ảnh. Bản Windows hiện dùng 7 preset của `styles/`; các recipe riêng chưa tự động chạy từ giao diện. Tìm stock B-roll và tạo ảnh AI cần nguồn media hoặc Gemini key, nên bản thử không thể bảo đảm hình minh họa như mọi demo. Nhận dạng tiếng Việt vẫn có thể sai chữ và cần review. Script QA hiện chạy với `--no-stem`, chưa chạy bước render stem SFX riêng.

Output và dữ liệu job nằm ở `jobs/<id>/`; MP4 truy cập tại `/api/jobs/<id>/output`. Thư mục `jobs/` và `.cache/` không được đưa vào git.
