export function jobStatusText(job: { status: string; stage?: string; progress: number }) {
  if (job.status === 'done') return 'Video đã sẵn sàng'
  if (job.status === 'cancelled') return 'Đã hủy video'
  if (job.status === 'error') return 'Cần kiểm tra video'
  if (job.stage?.includes('hủy')) return 'Đang hủy video'
  if (job.stage?.includes('video mẫu')) return 'Đang học phong cách mẫu'
  if (job.progress < 10) return 'Đang chuẩn bị video'
  if (job.progress < 35) return 'Đang ghi lại lời nói'
  if (job.progress < 50) return 'Đang chọn đoạn hay nhất'
  if (job.progress < 70) return 'Đang thêm chữ và hình'
  if (job.progress < 84) return 'Đang xem bản nháp'
  if (job.progress < 94) return 'Đang xuất video'
  return 'Đang kiểm tra video'
}
