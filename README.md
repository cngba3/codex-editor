# AI Editor Studio

**Từ video raw đến reel hoàn chỉnh với Codex agent.** App tự chép lời, chọn đoạn, dựng phụ đề, đồ họa, nhạc và xuất MP4. Có **hơn 20 phong cách** để chọn hoặc tạo style từ video mẫu. Một video ngắn có thể hoàn thành trong khoảng **15 phút**; thời gian thực tế phụ thuộc máy, độ dài video và lần tải model đầu tiên.

## Build và cài app

Cần Node.js 24 trên máy build. Bộ cài dành cho **Windows 10/11 x64** hoặc **macOS 14+**; máy dùng app không cần cài Node.js hay Python.

**Windows** (PowerShell):

```powershell
npm ci
npm run dist:win
```

Mở `release/AI-Editor-Studio-Setup-*.exe` và làm theo trình cài đặt.

**macOS** (build trên chính máy Mac, đúng kiến trúc Apple Silicon hoặc Intel):

```sh
npm ci
npm run dist:mac
```

Mở `release/AI-Editor-Studio-*-mac-*.dmg`, kéo **AI Editor Studio** vào **Applications**. Lần mở đầu, app cần Internet và vài GB dung lượng để tải môi trường, model và trình duyệt. Nếu macOS chặn bản DMG chưa notarize, vào **System Settings → Privacy & Security → Open Anyway**.

## Codex CLI

Bộ cài app **đã kèm Codex CLI**: mở **Thiết lập → Đăng nhập ChatGPT** trong app. Nếu cần cài CLI riêng để chạy từ mã nguồn hoặc dùng trong terminal:

```sh
npm install -g @openai/codex
codex login
codex login status
```

Xem [hướng dẫn Codex CLI](https://learn.chatgpt.com/docs/codex/cli) khi cần. Sau khi đăng nhập, chạy bản phát triển bằng `npm run app:dev`.

## Dùng nhanh

1. Mở app, chờ thiết lập lần đầu hoàn tất và đăng nhập Codex trong **Thiết lập**.
2. Tải video raw lên **Studio**; chọn style hoặc thêm video mẫu. Có thể nhập ghi chú, tên riêng và thuật ngữ.
3. Bấm **Dựng bản nháp 15 giây**. Xem kết quả, rồi bấm **Dựng bản đầy đủ** nếu muốn reel dài hơn (hiện tối đa 60 giây).
4. Rà lại lời chép và video, sau đó tải MP4.

Dự án, model và video được lưu trên máy. Một số style cần footage bổ sung đúng nội dung.
