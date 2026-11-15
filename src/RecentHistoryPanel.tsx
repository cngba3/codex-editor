import { useEffect, useState } from "react"
import { ArrowRight, Film, History, LoaderCircle } from "lucide-react"
import { editStyles } from "./styles"
import { jobStatusText } from './job-status'

type VideoHistoryEntry = {
  id: string
  title: string
  style: string
  kind: "preview" | "full"
  createdAt: number
  durationMs?: number
}

type ActiveJob = { id: string; title?: string; style?: string; stage: string; progress: number }
type RecentJob = ActiveJob & { status: "running" | "done" | "error" | "cancelled" }
type Props = { onOpen: () => void; onOpenJob: (jobId: string) => void; activeJob: ActiveJob | null; refreshKey: string }

const styleNames = new Map(editStyles.map(style => [style.id, style.name]))

export default function RecentHistoryPanel({ onOpen, onOpenJob, activeJob, refreshKey }: Props) {
  const [videos, setVideos] = useState<VideoHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [recoveredJob, setRecoveredJob] = useState<RecentJob | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    fetch("/api/jobs", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Không tải được lịch sử video.")
        return await response.json() as VideoHistoryEntry[]
      })
      .then(items => { if (active) setVideos(items.slice(0, 8)) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được lịch sử video.") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshKey])

  useEffect(() => {
    let mounted = true
    let timer: number | undefined
    const jobId = activeJob?.id || new URLSearchParams(window.location.search).get("job") || localStorage.getItem("ai-editor-last-job")
    if (!jobId) { setRecoveredJob(null); return }
    const refreshJob = async () => {
      try {
        const response = await fetch("/api/jobs/" + jobId, { cache: "no-store" })
        if (!response.ok) return
        const job = await response.json() as RecentJob
        if (!mounted) return
        if (job.status === "running") {
          setRecoveredJob(job)
          if (timer === undefined) timer = window.setInterval(() => { void refreshJob() }, 2000)
          return
        }
        setRecoveredJob(null)
        if (timer !== undefined) { window.clearInterval(timer); timer = undefined }
        if (job.status === "done") {
          const historyResponse = await fetch("/api/jobs", { cache: "no-store" })
          if (historyResponse.ok && mounted) setVideos((await historyResponse.json() as VideoHistoryEntry[]).slice(0, 8))
        }
      } catch { /* Keep the last visible job while the server responds. */ }
    }
    void refreshJob()
    return () => { mounted = false; if (timer !== undefined) window.clearInterval(timer) }
  }, [activeJob?.id])

  const visibleJob = activeJob || recoveredJob

  return <aside className="recent-history-panel" aria-label="Lịch sử video gần đây">
    <div className="editor-panel-heading">
      <div><History size={15}/><span>Gần đây</span></div>
      <button className="panel-open-all" onClick={onOpen} aria-label="Mở lịch sử video"><ArrowRight size={14}/></button>
    </div>
    {loading && !videos.length && !visibleJob ? <div className="recent-empty"><History size={22}/><span>Đang tải lịch sử...</span></div>
      : error && !visibleJob ? <div className="recent-empty"><History size={22}/><span>{error}</span></div>
        : visibleJob || videos.length ? <div className="recent-project-list">
          {visibleJob && <button type="button" className="recent-project recent-project-running" onClick={() => onOpenJob(visibleJob.id)} title={jobStatusText({ ...visibleJob, status: 'running' })} aria-label={"Mở video " + (visibleJob.title || "Video")}>
            <span className="recent-project-icon"><LoaderCircle size={15}/></span>
            <span className="recent-project-copy"><strong>{visibleJob.title || "Video đang dựng"}</strong><small>{jobStatusText({ ...visibleJob, status: 'running' })}</small><small>{visibleJob.progress}% hoàn thành</small></span>
            <span className="recent-progress" aria-hidden="true"><i style={{ width: visibleJob.progress + "%" }}/></span>
          </button>}
          {videos.map(video => <button type="button" className="recent-project" key={video.id} title={video.title + " - " + (styleNames.get(video.style) || video.style)} onClick={() => onOpenJob(video.id)}>
            <span className="recent-project-icon"><Film size={15}/></span>
            <span className="recent-project-copy"><strong>{video.title || "Video"}</strong><small>{styleNames.get(video.style) || video.style}</small><small>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(video.createdAt)}</small></span>
          </button>)}
        </div>
        : <div className="recent-empty"><History size={22}/><strong>Chưa có video đã tạo</strong><span>Video hoàn tất sẽ xuất hiện ở đây.</span></div>}
  </aside>
}
