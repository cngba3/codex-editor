# AI Editor Studio

Ứng dụng Windows/macOS dùng [`ghost-editor/`](./ghost-editor) làm lõi dựng video và Codex CLI làm agent chọn đoạn, lập kế hoạch. Repo gốc được tải trực tiếp từ [kurbaitaev/ghost-editor](https://github.com/kurbaitaev/ghost-editor); không phụ thuộc `igen-editor`.

## Build bộ cài Windows

Trên Windows, cài Node.js rồi chạy:

```powershell
npm install
npm run dist:win
```

Electron Builder tạo bộ cài tại `release/AI-Editor-Studio-Setup-0.3.0.exe`, dành cho Windows 10/11 x64. Node.js, uv, Codex CLI (kèm helper Windows), FFmpeg/FFprobe và thư viện JavaScript được đóng gói sẵn. Không yêu cầu máy khách cài Node.js, npm, Python hoặc uv trước.

Khi mở lần đầu, cửa sổ thiết lập tự động chuẩn bị Python 3.11, thư viện Python CPU, Whisper `small`, YuNet, BiRefNet portrait, Chromium, phông chữ, GSAP và thư viện âm thanh. Cần Internet và dung lượng trống vài GB. Nếu máy thiếu Microsoft Visual C++ Runtime, app chạy bộ cài chính thức đi kèm; Windows có thể yêu cầu quyền quản trị. Thiết lập hiển thị bước đang làm, chi tiết tải, nút mở log và thử lại. App chỉ mở Studio sau khi kiểm tra thành công. Người dùng vẫn cần đăng nhập tài khoản Codex trong Studio.

Môi trường lưu riêng trong `%APPDATA%/ai-editor-studio/runtime`, dữ liệu job/model/media trong `%APPDATA%/ai-editor-studio/workspace`; log ở `%APPDATA%/ai-editor-studio/setup.log`. Lần sau tái sử dụng các thành phần đã cài. Dữ liệu nằm ngoài thư mục cài app để có thể ghi khi cài vào Program Files và giữ qua nâng cấp. Nếu job/model theo cấu trúc cũ còn trong thư mục cài đặt, app sao chép chúng khi mở lần đầu và giữ nguyên dữ liệu gốc.

`desktop/runtime-manifest.json` cố định phiên bản và checksum của công cụ theo từng hệ điều hành/CPU. `desktop/requirements.txt` khóa thư viện Python Windows cùng hash; cập nhật bằng `.runtime/win32-x64/uv/uv.exe pip compile desktop/requirements.in --python-version 3.11 --python-platform windows --generate-hashes --output-file desktop/requirements.txt`. `npm run app:dev` dùng cùng luồng thiết lập desktop. Các lệnh `npm run dev` và `npm run preview` vẫn dùng môi trường của lập trình viên.

## Build và cài trên macOS

Yêu cầu macOS 14 trở lên. Tạo riêng bản Apple Silicon (`arm64`, M1/M2/M3/M4…) và Intel (`x64`); không dùng bộ cài Windows trên Mac. Trên máy Mac có Node.js 24 cùng kiến trúc cần build:

```sh
npm ci
npm run dist:mac
```

Kết quả nằm tại `release/AI-Editor-Studio-0.3.0-mac-arm64.dmg` hoặc `release/AI-Editor-Studio-0.3.0-mac-x64.dmg`. Mở DMG, kéo **AI Editor Studio** vào **Applications**, rồi mở app từ Applications. Lần đầu cần mạng để tự chuẩn bị Python, thư viện, model và Chromium; chỉ đăng nhập Codex sau khi thiết lập xong. Máy người dùng không cần Homebrew, Node.js, Python hay uv cài sẵn.

Dữ liệu Mac nằm trong `~/Library/Application Support/ai-editor-studio/`. Python và công cụ tải về nằm ở `runtime/darwin-arm64` hoặc `runtime/darwin-x64`; workspace và model được giữ ngoài `.app`. Đóng cửa sổ thiết lập sẽ hủy việc đang chạy và có thể mở lại để tiếp tục. Sau khi Studio mở, nút Dock mở lại cửa sổ mà không cài lại môi trường.

Quy trình [macos.yml](.github/workflows/macos.yml) chạy trên runner Mac native cho từng CPU, build DMG và kiểm tra chính app đóng gói: thiết lập lần đầu với PATH chỉ có công cụ hệ thống, Codex chưa đăng nhập, ASR, MP4 và mở lại bằng cache khi chặn mạng tải xuống. Tải hai bộ cài cùng checksum trong mục **Artifacts** của lần chạy thành công. Không phát hành GitHub Release tự động.

Bản DMG hiện dùng chữ ký ad-hoc để thử nghiệm, chưa notarize bởi Apple; macOS có thể chặn lần mở đầu và cần xác nhận trong **System Settings → Privacy & Security → Open Anyway**. Phát hành chính thức cần Apple Developer ID và notarization. Không tắt Gatekeeper toàn hệ thống.

Hai lockfile `desktop/requirements-darwin-*.txt` được tạo từ `requirements-macos.in`, với `MACOSX_DEPLOYMENT_TARGET=14.0`, `--python-platform aarch64-apple-darwin` hoặc `x86_64-apple-darwin`, `--python-version 3.11 --only-binary :all: --generate-hashes`. Chỉ cài wheel đã biên dịch để không đòi Xcode trên máy khách. `npm run test:platform` kiểm tra cấu hình các nền tảng; `node scripts/smoke-macos.mjs` chạy kiểm tra thực tế trên Mac sau khi build.

## Chạy

### Recipe trong app (cập nhật 13/11/2026)

Mỗi job lưu `recipe.json`: quy tắc chọn đoạn, bố cục, chuyển động, âm thanh, tài nguyên, tiêu chí kiểm tra và fingerprint. Amber Talk có recipe riêng của app. Style học từ video mẫu được lưu thêm vào `ghost-editor/style-recipes/`; các style tham chiếu cũ được bổ sung recipe từ phần phân tích đã lưu. Mỗi lần dựng dùng bản chụp recipe của job đó.

App đã nối 17 lựa chọn recipe gốc, tính cả Face RESULT: 16 lựa chọn qua bộ dựng recipe (RESULT và Face RESULT dùng chung `faceresult.py`), Stan Style qua các beat gốc trong `scripts/lib/stan.mjs`. Codex trả kế hoạch khai báo các lời gọi API; adapter gọi bộ dựng thật, không chạy mã Python tùy ý do model sinh ra. Các recipe giữ kiểm tra bố cục/khuôn mặt của bộ dựng. Seoul List và Stan Style cần tải thêm footage hoặc bản quay màn hình thật trong mục **Video bổ sung cho recipe**. Explainer Vector dùng các cảnh SVG có đường vẽ, nhãn và camera chuyển động theo lời nói. POV Montage chọn cảnh từ video POV bổ sung và đặt lên câu nói tương ứng; cần ít nhất một clip POV thật.

Quy trình: chép lời → chọn đoạn theo recipe → chuẩn bị media/timestamp → dựng → lint → render → kiểm tra kỹ thuật và review ảnh bằng Codex → sửa và dựng lại tối đa ba vòng. Chỉ đánh dấu hoàn tất khi cả kiểm tra kỹ thuật và review hình đạt. Nếu vẫn lỗi, giữ job, báo cáo, kế hoạch và video để xem lại; nút chạy lại dùng dữ liệu đã xử lý. Tiến độ được ghi xuống đĩa và job bị ngắt do server dừng được báo đúng trạng thái.

Theo lựa chọn của người dùng, giao diện hiện ẩn Stan Style, Seoul List và ô tải video bổ sung. Hai backend vẫn được giữ để có thể dùng lại sau; danh sách mẫu hiện tại tập trung vào một video nguồn.

QA dùng `render_report.py`, `broll_qa.py`, kiểm tra SFX trên stem khi builder có bảng sự kiện, cùng contact sheet. Review ảnh không xác nhận được toàn bộ chuyển động, tính chính xác của ASR hay chất lượng nghe; các mục thiếu dữ liệu trong báo cáo vẫn được ghi là `skip`. Một recipe đã nối chưa có nghĩa mọi loại footage đã được kiểm thử hay chất lượng tự động bằng demo gốc.

Đã kiểm chứng: render Whiteboard 1080×1920; build/lint Caption News và Seoul List; chạy Astra lập kế hoạch Face RESULT, bị review từ chối vòng đầu, sửa và qua vòng hai. Các recipe khác dùng adapter và bộ dựng gốc nhưng chưa được nghiệm thu bằng video riêng. Các kiểm tra bổ sung lưu dưới `.cache/` để không đưa video người dùng vào git.

Kiểm tra code: `npm run build` kiểm tra cả frontend và server; `npm run test:recipes` kiểm tra ánh xạ timestamp, phiên bản recipe của style tham chiếu và việc không giao video khi QA thất bại. Các script `smoke-native.ts`, `smoke-builders.ts`, `smoke-agent-recipe.ts` dùng fixture video cục bộ; script có agent sử dụng phiên Codex đã đăng nhập.

```powershell
cd D:\iGen\ai-editor
npm install
npm run dev
```

Mở `http://127.0.0.1:5173/`. Trong **Studio**, tải video, chọn recipe hoặc preset rồi bấm **Dựng bản nháp 15 giây**. Tiến độ và nút tải MP4 xuất hiện bên phải. Dự án được lưu cục bộ bằng IndexedDB.

Máy chạy job cần Codex CLI đã đăng nhập, `uv` và Python 3.11 (`uv python install 3.11`). FFmpeg, FFprobe và HyperFrames được cài bằng npm. Tải model nhận dạng lời nói bằng `npm run setup:model` (mặc định `small`; thêm `-- tiny` để dùng bản nhẹ). Các file model nằm trong `.cache/` và không đưa vào git.

## Đã nối vào job Windows

- Nhận dạng lời nói bằng faster-whisper; Codex chọn các take và điểm nhấn từ transcript.
- Chuẩn hóa video/âm thanh, theo dõi khuôn mặt bằng script `face_track.py` của repo gốc.
- `reel.json` và `build.mjs` của `ghost-editor`: caption, beat đồ họa, preset style, nhạc nền và SFX.
- `transitions.py` của repo gốc tạo dissolve giữa các take; HyperFrames xuất MP4.
- `qa.py --no-stem` kiểm tra thời lượng, âm thanh, caption và chuyển cảnh sau render; Codex xem contact sheet và ghi lỗi hình nhìn thấy.
- Chế độ video mẫu trích 6 khung hình; Codex phân tích bố cục, màu và caption rồi chọn preset gần nhất. Phân tích từ ảnh tĩnh không thể xác định chính xác âm thanh hay nhịp cắt.
- Codex đề xuất minh họa; app tìm ảnh qua các nguồn đã tích hợp và lưu thông tin nguồn. Native recipe có thể dựng hình/đồ họa bằng API gốc khi phù hợp nội dung.

## Phần còn cần nâng cấp

Nhận dạng tiếng Việt vẫn có thể sai chữ và cần review. Các recipe đòi hỏi matte sẽ tải/chạy model CPU khi cần, có thể chậm. App chưa tự sản xuất mọi loại tài nguyên như quay màn hình sản phẩm, footage POV hay giọng đọc chuyên dụng. Recipe cần tài nguyên thật sẽ yêu cầu video bổ sung hoặc báo thiếu, thay vì báo đã dựng đúng style khi thiếu đầu vào.

Studio cho chạy Explainer Vector và POV Montage qua core renderer. Vector có các cảnh SVG riêng theo nội dung; POV cần video góc nhìn thứ nhất trong mục video bổ sung. Các mẫu khác đã nối bộ dựng theo danh mục `server/recipe-catalog.json` hoặc core recipe. Mức kiểm thử cụ thể được ghi ở phần Recipe phía trên.

## Nâng cấp biên tập

Lập kế hoạch cắt nay ghi `build/speech-candidates.json` gồm các cụm lời nói tách tại khoảng ngừng và nhóm câu gần lặp; Codex dùng đó để chọn lần nói tốt hơn. Mốc cắt được nắn ra mép từ. Với core renderer, `voice_smooth.py` tạo một track giọng đã làm mượt mối nối; nếu xử lý giọng lỗi, job báo cảnh báo và giữ audio nguồn.

Ảnh minh họa được tìm tối đa sáu ứng viên, gửi ảnh và metadata cho Codex chọn theo đúng câu nói, con người trong ảnh và chất lượng. Quyết định cùng nguồn ảnh lưu ở `build/illustration-source.json`; nếu không ảnh nào phù hợp, app bỏ qua cảnh ảnh. Nhạc được chọn từ thư viện theo style và sắc thái nội dung, tự giảm âm dưới giọng. SFX vẫn theo sự kiện thực của bộ dựng và QA stem.

Sau khi xem video hoàn thành, dùng ô **Góp ý cho lần dựng sau** để đánh dấu thích/cần sửa và ghi nhận xét. App lưu vào `jobs/taste.json`, đưa các nhận xét cùng style vào kế hoạch sau và để bộ dựng áp dụng các quy tắc đã ghi. Style học từ video mẫu còn lưu các motif hình/chuyển động quan sát được để Codex dùng tạo beat mới đúng nội dung video nguồn.

Output và dữ liệu job nằm ở `jobs/<id>/`; MP4 truy cập tại `/api/jobs/<id>/output`. Thư mục `jobs/` và `.cache/` không được đưa vào git.

## Bản đầy đủ và chép lời tiếng Việt

Sau khi bản nháp hoàn thành, nhấn **Dựng bản đầy đủ** trong Studio. App dùng lại video nguồn đã tải, chọn các câu rõ nghĩa và tạo một job mới; bản nháp vẫn có link riêng. Bản đầy đủ hiện giới hạn tối đa 60 giây đầu ra. Video render có phụ đề tự động; người dùng nên nghe và rà lại chữ trước khi phát hành.

ASR mặc định dùng faster-whisper `small` trên CPU. App ưu tiên `medium` nếu model này đã tải xong trong `.cache/`; `medium` cần khoảng 1,5 GB dung lượng và chạy chậm hơn. Cài bằng `npm run setup:model -- medium`. Muốn ép dùng model nhỏ, đặt `AI_EDITOR_ASR_MODEL=small` trước khi chạy `npm run dev`. ASR hiện dùng beam 5, giữ mọi khoảng lời nói để tránh bỏ câu, và ghi thời gian từng từ cho phụ đề. Trước khi chọn cảnh và xuất phụ đề, Codex rà soát chính tả, từ nhận dạng sai rõ ràng và cách viết thuật ngữ ngoại ngữ; các từ không chắc chắn được giữ nguyên để người dùng kiểm tra. Bản gốc và danh sách sửa được lưu trong `build/words.raw.json` và `build/transcript-audit.json` của job. Trong ô ghi chú của Studio, có thể thêm dòng `Thuật ngữ: cửa khẩu, 你好, tên sản phẩm` để giúp ASR và bước rà soát nhận tên riêng, từ chuyên môn.

`ghost-editor/` được đưa trực tiếp vào repo này như mã nguồn bình thường, không phải submodule. File media đã render, model ASR và thông tin đăng nhập Codex đều nằm ngoài git.
