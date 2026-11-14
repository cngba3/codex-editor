import { useEffect, useRef, useState } from "react"
import { ArrowDownToLine, ArrowRight, Film } from "lucide-react"
import { editStyles } from "./styles"

type HistoryVideo = {
  id: string
  title: string
  style: string
  kind: "preview" | "full"
  createdAt: number
  completedAt?: number
  durationMs?: number
  output: string
}

type Props = { onOpenJob: (jobId: string) => void }

const styleNames = new Map(editStyles.map(style => [style.id, style.name]))
const styleName = (id: string) => styleNames.get(id) || id
const kindName = (kind: HistoryVideo["kind"]) => kind === "full" ? "Video đầy đủ" : "Bản nháp 15 giây"
const savedAt = (timestamp: number) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(timestamp)

function renderTime(durationMs?: number) {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0) return "Chưa ghi nhận"
  const seconds = Math.round(durationMs / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds % 3600 / 60)
  const rest = seconds % 60
  return [hours && `${hours} giờ`, (minutes || hours) && `${minutes} phút`, `${rest} giây`].filter(Boolean).join(" ")
}

function HistoryCard({ video, onOpenJob }: { video: HistoryVideo; onOpenJob: Props["onOpenJob"] }) {
  const coverRef = useRef<HTMLDivElement>(null)
  const [nearView, setNearView] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const cover = coverRef.current
    if (!cover) return
    if (typeof IntersectionObserver === "undefined") {
      setNearView(true)
      return
    }
    const observer = new IntersectionObserver(entries => {
      setNearView(entries.some(entry => entry.isIntersecting))
    }, { rootMargin: "80px 0px" })
    observer.observe(cover)
    return () => observer.disconnect()
  }, [])

  return <article className="history-card">
    <div ref={coverRef} className={playing ? "history-card-cover history-video-cover is-playing" : "history-card-cover history-video-cover"}>
      <video
        src={nearView || playing ? video.output : undefined}
        controls
        preload={nearView ? "metadata" : "none"}
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={event => {
          const duration = event.currentTarget.duration
          if (Number.isFinite(duration) && duration > 0) event.currentTarget.currentTime = Math.min(0.12, duration / 2)
        }}
      />
    </div>
    <div className="history-card-body">
      <div>
        <h3 title={video.title}>{video.title}</h3>
        <div className="history-card-meta">
          <span>{styleName(video.style)} · {kindName(video.kind)}</span>
          <span>Hoàn tất: {savedAt(video.completedAt || video.createdAt)}</span>
          <span>Thời gian dựng: {renderTime(video.durationMs)}</span>
        </div>
      </div>
      <div className="history-card-actions">
        <button type="button" onClick={() => onOpenJob(video.id)}><ArrowRight size={14}/> Mở trong Studio</button>
        <a href={video.output} download={`${video.title || "video"}.mp4`}><ArrowDownToLine size={14}/> Tải xuống</a>
      </div>
    </div>
  </article>
}

export default function HistoryPage({ onOpenJob }: Props) {
  const [videos, setVideos] = useState<HistoryVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    fetch("/api/jobs", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Không tải được lịch sử video.")
        return await response.json() as HistoryVideo[]
      })
      .then(async items => {
        const detailed = await Promise.all(items.map(async item => {
          try {
            const response = await fetch("/api/jobs/" + item.id, { cache: "no-store" })
            if (!response.ok) return item
            const detail = await response.json() as { completedAt?: number }
            return { ...item, completedAt: detail.completedAt }
          } catch { return item }
        }))
        if (active) setVideos(detailed.sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt)))
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được lịch sử video.") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return <div className="page secondary-page history-page">
    {error && <div className="history-message" role="alert">{error}</div>}
    {loading && !videos.length && <div className="history-message">Đang tải lịch sử...</div>}
    {!loading && !error && !videos.length && <div className="empty-state"><Film size={34}/><h2>Chưa có video đã dựng</h2><p>Video hoàn tất sẽ xuất hiện ở đây.</p></div>}
    {!!videos.length && <div className="history-list-head"><h2>Video đã tạo</h2><span>{videos.length} video</span></div>}
    {!!videos.length && <div className="history-grid">{videos.map(video => <HistoryCard key={video.id} video={video} onOpenJob={onOpenJob}/>)}</div>}
  </div>
}
