import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { jobStatusText } from './job-status'
import './studio-progress.css'

type Job = { id: string; stage: string; progress: number; status: 'running' | 'done' | 'error' | 'cancelled'; output?: string; warning?: string; qualityRound?: number }
type Detail = { transcript: { start: number; end: number; text: string }[]; takes: { a: number; b: number }[]; beats: { at: number; to: number; text?: string; type?: string }[]; music: boolean; previewFrames: number[]; previewAvailable: boolean; messages: { role: 'user' | 'agent'; text: string; createdAt: number; queuedForRevision?: boolean }[] }
const empty: Detail = { transcript: [], takes: [], beats: [], music: false, previewFrames: [], previewAvailable: false, messages: [] }
const fmt = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`

export function useStudioDetail(job: Job | null): Detail {
  const [detail, setDetail] = useState<Detail>(empty)
  useEffect(() => {
    if (!job) { setDetail(empty); return }
    setDetail(empty)
    let active = true
    const load = async () => {
      try {
        const response = await fetch(`/api/jobs/${job.id}/studio`, { cache: 'no-store' })
        if (response.ok && active) setDetail(await response.json() as Detail)
      } catch { /* Keep the last known snapshot while the server is busy. */ }
    }
    void load()
    const timer = setInterval(load, job.status === 'running' ? 1000 : 10000)
    return () => { active = false; clearInterval(timer) }
  }, [job?.id, job?.status])
  return detail
}

export function StudioProgress({ job, detail }: { job: Job | null; detail: Detail }) {
  const [selectedTake, setSelectedTake] = useState(0)
  return <section className="studio-progress" aria-label="Chi tiết bản dựng">
    {job?.qualityRound && job.status === 'running' && <p className="studio-qa-label">Đang xem lại bản dựng · lần {job.qualityRound}/3</p>}
    {job && detail.takes.length > 0 && <details className="studio-transcript studio-cut-review"><summary>Xem {detail.takes.length} đoạn video đã chọn</summary><video controls preload="metadata" src={`/api/jobs/${job.id}/source`} onLoadedMetadata={event => { event.currentTarget.currentTime = detail.takes[selectedTake]?.a || 0 }}/><div className="studio-take-list">{detail.takes.map((take, i) => <button type="button" key={i} className={selectedTake === i ? 'selected' : ''} onClick={event => { setSelectedTake(i); const video = event.currentTarget.closest('.studio-cut-review')?.querySelector('video'); if (video) { video.currentTime = take.a; void video.play().catch(() => {}) } }}>Cảnh {i + 1} · {fmt(take.a)}–{fmt(take.b)}</button>)}</div></details>}
    {detail.transcript.length > 0 && <details className="studio-transcript"><summary>Lời nói đã tách · {detail.transcript.length} đoạn</summary><div>{detail.transcript.map((segment, i) => <p key={i}><time>{fmt(segment.start)}</time>{segment.text}</p>)}</div></details>}
  </section>
}

export function AgentChat({ job, detail, onBeforeStart, onRevised }: { job: Job | null; detail: Detail; onBeforeStart: (text: string) => void; onRevised: (job: Job) => void }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState<Detail['messages'] | null>(null)
  const [error, setError] = useState('')
  const chatLog = useRef<HTMLDivElement>(null)
  const chatPinnedToBottom = useRef(true)
  const [activity, setActivity] = useState<{ jobId: string; items: { key: string; text?: string; frame?: number; video?: boolean }[] }>({ jobId: '', items: [] })
  useEffect(() => { setLocal(null); setDraft(''); setError('') }, [job?.id])
  useEffect(() => {
    if (!job) return
    setActivity(current => {
      const items = current.jobId === job.id ? [...current.items] : []
      const stageKey = `stage:${job.stage}`
      if (!items.some(item => item.key === stageKey)) items.push({ key: stageKey, text: `${job.stage} · ${job.progress}%` })
      for (const frame of detail.previewFrames || []) {
        const key = `frame:${frame}`
        if (!items.some(item => item.key === key)) items.push({ key, frame })
      }
      if (detail.previewAvailable && !items.some(item => item.key === 'video')) items.push({ key: 'video', video: true })
      if (current.jobId === job.id && items.length === current.items.length) return current
      return { jobId: job.id, items }
    })
  }, [job?.id, job?.stage, job?.progress, detail.previewFrames, detail.previewAvailable])
  useEffect(() => { chatPinnedToBottom.current = true }, [job?.id])
  useEffect(() => {
    const log = chatLog.current
    if (log && chatPinnedToBottom.current) log.scrollTop = log.scrollHeight
  }, [activity.items.length, local?.length, detail.messages.length, job?.id])
  const messages = local || detail.messages
  async function send() {
    if (!draft.trim() || busy) return
    if (!job) {
      onBeforeStart(draft.trim())
      setLocal(current => [...(current || []), { role: 'user', text: draft.trim(), createdAt: Date.now() }, { role: 'agent', text: 'Đã thêm yêu cầu vào ghi chú. Mình sẽ dùng khi bắt đầu dựng.', createdAt: Date.now() }])
      setDraft('')
      return
    }
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/jobs/${job.id}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: draft.trim() }) })
      const result = await response.json() as { messages?: Detail['messages']; replacementJob?: Job; error?: string }
      if (!response.ok) throw new Error(result.error || 'Không gửi được yêu cầu.')
      setLocal(result.messages || []); setDraft('')
      if (result.replacementJob) onRevised(result.replacementJob)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không gửi được yêu cầu.') }
    finally { setBusy(false) }
  }
  async function revise() {
    if (!job || busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/jobs/${job.id}/revise`, { method: 'POST' })
      const result = await response.json() as Job & { error?: string }
      if (!response.ok) throw new Error(result.error || 'Không bắt đầu được bản sửa.')
      onRevised(result)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không bắt đầu được bản sửa.') }
    finally { setBusy(false) }
  }
  return <div className="agent-chat"><h3><MessageCircle size={16}/> Agent</h3>{detail.transcript.length > 0 && <details className="agent-transcript" open><summary>Lời nói đã tách · {detail.transcript.length} đoạn</summary><div>{detail.transcript.map((segment, i) => <p key={i}><time>{fmt(segment.start)}</time><span>{segment.text}</span></p>)}</div></details>}<div className="agent-chat-log" ref={chatLog} onScroll={event => { const log = event.currentTarget; chatPinnedToBottom.current = log.scrollHeight - log.scrollTop - log.clientHeight < 48 }} aria-live="polite"><div className="agent-bubble agent">{job ? `${jobStatusText(job)} · ${job.progress}%` : 'Video đã được chọn. Bạn có thể gửi yêu cầu trước khi dựng.'}</div>{messages.map((message, i) => <div key={i} className={`agent-bubble ${message.role}`}>{message.text}</div>)}{job && activity.jobId === job.id && activity.items.map(item => item.frame !== undefined ? <div className="agent-preview-message" key={item.key}><span>Đã chụp ảnh xem trước {item.frame + 1}/3</span><img src={`/api/jobs/${job.id}/preview-frame/${item.frame}`} alt={`Khung hình xem trước ${item.frame + 1}`}/></div> : item.video ? <div className="agent-preview-message" key={item.key}><span>Đã có video xem trước</span><video controls preload="metadata" src={`/api/jobs/${job.id}/preview`}/></div> : <div className="agent-bubble agent" key={item.key}>{item.text}</div>)}</div>{job?.status === 'done' && messages.some(message => message.queuedForRevision) && <button className="agent-revise" type="button" disabled={busy} onClick={() => void revise()}>Dựng bản sửa theo yêu cầu</button>}{error && <p className="agent-chat-error">{error}</p>}<div className="agent-chat-compose"><textarea value={draft} onChange={event => { setDraft(event.target.value) }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} placeholder="Nhắn cho Agent…" disabled={busy} maxLength={1000}/><button type="button" onClick={() => void send()} disabled={!draft.trim() || busy} aria-label="Gửi yêu cầu"><Send size={16}/></button></div></div>
}
