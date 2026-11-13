export type EditStyle = { id: string; name: string; category: string; description: string; visual: string; tags: string[] }

export const editStyles: EditStyle[] = [
  { id: 'clean-os', name: 'Clean OS', category: 'Talking head', description: 'Tối giản kiểu Apple: chữ sắc nét, giao diện điện thoại và các cú zoom gọn.', visual: 'clean', tags: ['Tối giản', 'Công nghệ'] },
  { id: 'result-podcast', name: 'RESULT', category: 'Talking head', description: 'Không khí podcast ấm với thẻ navy, ảnh polaroid và ghi chú viết tay.', visual: 'result', tags: ['Kể chuyện', 'Ấm áp'] },
  { id: 'face-result', name: 'Face RESULT', category: 'Talking head', description: 'Giữ khuôn mặt trong khung hình, bố trí giấy, ảnh và chữ quanh người nói.', visual: 'face', tags: ['Kể chuyện', 'Chân dung'] },
  { id: 'caption-news', name: 'Caption News', category: 'Talking head', description: 'Caption lớn theo nhịp nói, từ khóa vàng nổi bật và nhãn nguồn tin.', visual: 'news', tags: ['Tin tức', 'Caption'] },
  { id: 'whiteboard', name: 'Whiteboard', category: 'Talking head', description: 'Bảng vẽ tay giải thích ý tưởng bên trên khuôn mặt người nói.', visual: 'board', tags: ['Giải thích', 'Giáo dục'] },
  { id: 'kinetic-doc', name: 'Kinetic Doc', category: 'Documentary', description: 'Chất liệu phim tài liệu đen trắng với chữ chuyển động và điểm nhấn đỏ.', visual: 'kinetic', tags: ['Tài liệu', 'Mạnh mẽ'] },
  { id: 'step-deck', name: 'Step Deck', category: 'Talking head', description: 'Biến các ý chính thành một bộ thẻ đánh số giàu nhịp điệu.', visual: 'step', tags: ['Tips', 'Danh sách'] },
  { id: 'seoul-list', name: 'Seoul List', category: 'B-roll', description: 'Danh sách đọc lời trên chuỗi cảnh nhanh, collage và chữ lớn.', visual: 'seoul', tags: ['Du lịch', 'Lifestyle'] },
  { id: 'pop', name: 'Pop', category: 'Preset', description: 'Từ khóa khổng lồ phía sau người nói và các khối màu nổi bật.', visual: 'pop', tags: ['Năng lượng', 'Màu sắc'] },
  { id: 'clean', name: 'Clean', category: 'Preset', description: 'Caption đậm, zoom nhanh và ít thành phần phụ.', visual: 'base', tags: ['Nhanh', 'Gọn'] },
  { id: 'editorial', name: 'Editorial', category: 'Preset', description: 'Chữ mềm, nhãn nghiêng và các cảnh đồ họa có tiết tấu.', visual: 'editorial', tags: ['Tạp chí', 'Hiện đại'] },
  { id: 'meme', name: 'Meme', category: 'Preset', description: 'Reaction, emoji và âm thanh nhấn vào khoảnh khắc hài hước.', visual: 'meme', tags: ['Vui', 'Reaction'] },
  { id: 'cinematic', name: 'Cinematic', category: 'Preset', description: 'Cảm giác điện ảnh với grain và chữ serif phát sáng.', visual: 'cinema', tags: ['Điện ảnh', 'Mood'] },
  { id: 'launch', name: 'Launch', category: 'Preset', description: 'Cửa sổ UI tối, prompt đánh máy và các nhịp glitch.', visual: 'launch', tags: ['Sản phẩm', 'Công nghệ'] },
  { id: 'kinetic', name: 'Kinetic', category: 'Preset', description: 'Chữ toàn màn hình chuyển động theo từng lời nói.', visual: 'type', tags: ['Typography', 'Năng động'] },
]
