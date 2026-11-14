import { useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { jobStatusText } from './job-status'
import './studio-progress.css'

type Job = { id: string; stage: string; progress: number; status: 'running' | 'done' | 'error' | 'cancelled'; output?: string; warning?: string; qualityRound?: number }
type Detail = { transcript: { start: number; end: number; text: string }[]; takes: { a: number; b: number }[]; beats: { at: number; to: number; text?: string; type?: string }[]; music: boolean; previewAvailable: boolean; messages: { role: 'user' | 'agent'; text: string; createdAt: number; queuedForRevision?: boolean }[] }
const empty: Detail = { transcript: [], takes: [], beats: [], music: false, previewAvailable: false, messages: [] }
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
    const timer = setInterval(load, job.status === 'running' ? 2500 : 10000)
    return () => { active = false; clearInterval(timer) }
  }, [job?.id, job?.status])
  return detail
}

export function StudioProgress({ job, detail }: { job: Job | null; detail: Detail }) {
  const [selectedTake, setSelectedTake] = useState(0)
  const duration = detail.takes.reduce((total, take) => total + Math.max(0, take.b - take.a), 0)
  const max = Math.max(duration, 1)
  let offset = 0
  return <section className="studio-progress" aria-label="Tiến độ bản dựng">
    <div className="studio-progress-head"><div><strong>Bản dựng đang hình thành</strong><span>{job ? jobStatusText(job) : 'Tải video và bắt đầu dựng để xem từng bước tại đây.'}</span></div>{job && <b>{job.progress}%</b>}</div>
    <div className="studio-progress-checks">
      <span className={detail.transcript.length ? 'ready' : ''}>Chép lời <b>{detail.transcript.length ? `${detail.transcript.length} đoạn` : 'Đang chờ'}</b></span>
      <span className={detail.takes.length ? 'ready' : ''}>Chọn cảnh <b>{detail.takes.length ? `${detail.takes.length} cảnh` : 'Đang chờ'}</b></span>
      <span className={detail.beats.length ? 'ready' : ''}>Chữ & đồ họa <b>{detail.beats.length ? `${detail.beats.length} lớp` : 'Đang chờ'}</b></span>
      <span className={job?.output ? 'ready' : ''}>Xuất video <b>{job?.output ? 'Đã xong' : job?.status === 'running' ? `${job.progress}%` : 'Đang chờ'}</b></span>
    </div>
    {job?.qualityRound && job.status === 'running' && <p className="studio-qa-label">Đang xem lại bản dựng · lần {job.qualityRound}/3</p>}
    {detail.takes.length ? <div className="studio-timeline" aria-label="Các lớp của video">
      <div className="studio-timeline-ruler"><span>0:00</span><span>{fmt(duration)}</span></div>
      <div className="studio-track"><label>Chữ</label><div className="studio-track-lane">{detail.beats.filter(beat => Number.isFinite(beat.at) && Number.isFinite(beat.to)).map((beat, i) => <span key={i} className="studio-beat" style={{ left: `${Math.min(100, Math.max(0, beat.at / max * 100))}%`, width: `${Math.max(2, (beat.to - beat.at) / max * 100)}%` }} title={`${fmt(beat.at)} · ${beat.text || beat.type || 'Đồ họa'}`}>{beat.text || beat.type || 'Chữ'}</span>)}</div></div>
      <div className="studio-track"><label>Video</label><div className="studio-track-lane studio-cut-lane">{detail.takes.map((take, i) => { const left = offset / max * 100; offset += Math.max(0, take.b - take.a); return <span key={i} className="studio-cut" style={{ left: `${left}%`, width: `${Math.max(0, take.b - take.a) / max * 100}%` }} title={`Cảnh ${i + 1}: nguồn ${fmt(take.a)}–${fmt(take.b)}`}>Cảnh {i + 1}</span> })}</div></div>
      <div className="studio-track"><label>Âm thanh</label><div className="studio-track-lane studio-audio-lane"><span>{detail.music ? 'Giọng nói + nhạc nền' : 'Giọng nói'}</span></div></div>
      {job?.status === 'running' && job.progress >= 75 && <div className="studio-render-marker" style={{ left: `calc(75px + (100% - 75px) * ${Math.min(1, Math.max(0, (job.progress - 75) / 24))})` }} title={`Đã render khoảng ${Math.round(Math.min(1, Math.max(0, (job.progress - 75) / 24)) * 100)}% khung hình`}/>}
    </div> : <div className="studio-progress-wait">Các đoạn cắt và lớp chữ sẽ xuất hiện sau khi Agent phân tích video.</div>}
    {job && detail.takes.length > 0 && <details className="studio-transcript studio-cut-review"><summary>Xem {detail.takes.length} cảnh đã chọn từ video nguồn</summary><video controls preload="metadata" src={`/api/jobs/${job.id}/source`} onLoadedMetadata={event => { event.currentTarget.currentTime = detail.takes[selectedTake]?.a || 0 }}/><div className="studio-take-list">{detail.takes.map((take, i) => <button type="button" key={i} className={selectedTake === i ? 'selected' : ''} onClick={event => { setSelectedTake(i); const video = event.currentTarget.closest('.studio-cut-review')?.querySelector('video'); if (video) { video.currentTime = take.a; void video.play().catch(() => {}) } }}>Cảnh {i + 1} · {fmt(take.a)}–{fmt(take.b)}</button>)}</div></details>}
    {detail.transcript.length > 0 && <details className="studio-transcript"><summary>Lời nói đã tách · {detail.transcript.length} đoạn</summary><div>{detail.transcript.map((segment, i) => <p key={i}><time>{fmt(segment.start)}</time>{segment.text}</p>)}</div></details>}
    {job && !job.output && detail.previewAvailable && <div className="studio-output"><strong>Xem bản nháp</strong><video controls preload="metadata" src={`/api/jobs/${job.id}/preview`}/><small>Bản nháp có thể thay đổi trước khi video hoàn thành.</small></div>}
  </section>
}

export function AgentChat({ job, detail, onBeforeStart, onRevised }: { job: Job | null; detail: Detail; onBeforeStart: (text: string) => void; onRevised: (job: Job) => void }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState<Detail['messages'] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { setLocal(null); setDraft(''); setError('') }, [job?.id])
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
  return <div className="agent-chat"><h3><MessageCircle size={16}/> Agent</h3>{detail.transcript.length > 0 && <details className="agent-transcript" open><summary>Lời nói đã tách · {detail.transcript.length} đoạn</summary><div>{detail.transcript.map((segment, i) => <p key={i}><time>{fmt(segment.start)}</time><span>{segment.text}</span></p>)}</div></details>}<div className="agent-chat-log" aria-live="polite"><div className="agent-bubble agent">{job ? `${jobStatusText(job)} · ${job.progress}%. ${detail.transcript.length ? `Đã ghi ${detail.transcript.length} đoạn lời nói.` : ''} ${detail.takes.length ? `Đã chọn ${detail.takes.length} cảnh.` : ''}` : 'Video đã được chọn. Bạn có thể gửi yêu cầu trước khi dựng.'}</div>{messages.map((message, i) => <div key={i} className={`agent-bubble ${message.role}`}>{message.text}</div>)}</div>{job?.status === 'done' && messages.some(message => message.queuedForRevision) && <button className="agent-revise" type="button" disabled={busy} onClick={() => void revise()}>Dựng bản sửa theo yêu cầu</button>}{error && <p className="agent-chat-error">{error}</p>}<div className="agent-chat-compose"><textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} placeholder="Nhắn cho Agent…" disabled={busy} maxLength={1000}/><button type="button" onClick={() => void send()} disabled={!draft.trim() || busy} aria-label="Gửi yêu cầu"><Send size={16}/></button></div></div>
}
