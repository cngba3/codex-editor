import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Clapperboard, Clock3, FileVideo2, Film, FolderOpen, HardDrive, History, ImagePlus, LayoutGrid, Play, Plus, Search, Settings2, Sparkles, Trash2, WandSparkles, X } from 'lucide-react'
import { deleteProject, listProjects, saveProject, type Project } from './store'
import { editStyles, styleDetails, type EditStyle } from './styles'
import recipeCatalog from '../server/recipe-catalog.json'
import HistoryPage from './HistoryPage'
import RecentHistoryPanel from './RecentHistoryPanel'
import StyleReelCard from './StyleReelCard'
import './render.css'
import './editor.css'

type Section = 'studio' | 'projects' | 'history' | 'styles' | 'settings'
type Mode = 'preset' | 'reference'
type CodexState = { installed: boolean; connected: boolean; detail: string; models?: { id: string; name: string }[]; model?: string }
type RenderJob = { id: string; title?: string; style?: string; stage: string; progress: number; status: 'running' | 'done' | 'error' | 'cancelled'; cancelSupported?: boolean; cancelRequested?: boolean; error?: string; warning?: string; output?: string; kind?: 'preview' | 'full'; parentId?: string; asrModel?: string; createdStyleId?: string; createdStyleName?: string; recipe?: string; recipeVersion?: string; qualityRound?: number }
const runnableStyleIds = new Set(['clean', 'editorial', 'meme', 'cinematic', 'launch', 'kinetic', 'pop', 'amber-talk', 'stan-style', 'explainer-vector', 'pov-montage', ...recipeCatalog.map(recipe => recipe.id)])
const previewStyleIds = new Set(editStyles.map(style => style.id))
const previewFor = (id: string) => previewStyleIds.has(id) ? `/style-previews/${id}.webp` : /^ref-[a-f0-9]{8}$/.test(id) ? `/api/styles/${id}/preview` : null
const hiddenStyleIds = new Set(['stan-style', 'seoul-list'])
const ignoredStyleSearchWords = new Set(['ban', 'cua', 'de', 'gi', 'la', 'lam', 'minh', 'mot', 'muon', 'nao', 'toi', 'va', 've', 'video', 'style', 'mau'])
const normalizeStyleSearch = (value: string) => value.toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
function searchStyles(styles: EditStyle[], query: string) {
  const normalizedQuery = normalizeStyleSearch(query).trim()
  const terms = normalizedQuery.split(/[^a-z0-9]+/).filter(term => term.length > 1 && !ignoredStyleSearchWords.has(term))
  if (!terms.length) return styles
  if (normalizedQuery.includes('ban hang')) terms.push('kinh', 'doanh')
  return styles.map((style, index) => {
    const details = styleDetails[style.id]
    const searchable = normalizeStyleSearch([style.name, style.category, style.description, ...style.tags, details?.bestFor, details?.preparation].filter(Boolean).join(' '))
    const score = terms.reduce((total, term) => total + (searchable.includes(term) ? 1 : 0), 0)
    return { style, score, index }
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.style)
}
const noResultText = 'Chưa có video cho phong cách này. Nhấn nút dựng để tạo kết quả mới.'
const size = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`
const time = (seconds: number) => Number.isFinite(seconds) && seconds > 0 ? `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}` : '—'

function useObjectUrl(file: Blob | null) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!file) { setUrl(''); return }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url
}

export default function App() {
  const [section, setSection] = useState<Section>('studio')
  const [mode, setMode] = useState<Mode>('preset')
  const [styleId, setStyleId] = useState('clean')
  const [styleSearch, setStyleSearch] = useState('')
  const [createdStyles, setCreatedStyles] = useState<EditStyle[]>([])
  const [raw, setRaw] = useState<File | null>(null)
  const [reference, setReference] = useState<File | null>(null)
  const [supporting, setSupporting] = useState<File[]>([])
  const [duration, setDuration] = useState(0)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [codex, setCodex] = useState<CodexState | null>(null)
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSaved, setFeedbackSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)
  const [modelBusy, setModelBusy] = useState(false)
  const rawInput = useRef<HTMLInputElement>(null)
  const referenceInput = useRef<HTMLInputElement>(null)
  const displayedJobId = useRef<string | null>(null)
  const rawUrl = useObjectUrl(raw)
  const referenceUrl = useObjectUrl(reference)
  useEffect(() => { setFeedbackText(''); setFeedbackSaved(false) }, [renderJob?.id])
  const allStyles = [...createdStyles, ...editStyles].filter(style => !hiddenStyleIds.has(style.id))
  const chosen = allStyles.find(item => item.id === styleId) ?? editStyles[0]
  const canRunStyle = (id: string) => !hiddenStyleIds.has(id) && (runnableStyleIds.has(id) || createdStyles.some(item => item.id === id))
  const matchingStyles = searchStyles(allStyles.filter(style => canRunStyle(style.id)), styleSearch)
  const styleSearchBar = <div className="style-search"><Search size={16} aria-hidden="true"/><input aria-label="Tìm style theo chủ đề video" placeholder="Bạn muốn làm video về chủ đề gì?" value={styleSearch} onChange={event => setStyleSearch(event.target.value)}/>{styleSearch && <button type="button" onClick={() => setStyleSearch('')} aria-label="Xóa nội dung tìm kiếm"><X size={14}/></button>}</div>

  useEffect(() => { if (hiddenStyleIds.has(styleId)) { setStyleId('amber-talk'); setSupporting([]) } }, [styleId])

  useEffect(() => { listProjects().then(setProjects).catch(() => setNotice('Không thể đọc bộ nhớ trình duyệt.')); void refreshCodex(); void refreshStyles() }, [])
  useEffect(() => { if (renderJob?.status === 'done' && renderJob.createdStyleId) { setStyleId(renderJob.createdStyleId); void refreshStyles() } }, [renderJob?.id, renderJob?.status, renderJob?.createdStyleId])
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('job') || localStorage.getItem('ai-editor-last-job')
    if (!id) return
    displayedJobId.current = id
    fetch(`/api/jobs/${id}`, { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(data => {
      if (!data || displayedJobId.current !== id) return
      const restored = data as RenderJob
      setRenderJob(restored)
      localStorage.setItem('ai-editor-last-job', id)
      if (restored.style && !hiddenStyleIds.has(restored.style) && restored.style !== 'reference') setStyleId(restored.style)
      if (restored.style === 'reference') setMode('reference')
    }).catch(() => {})
  }, [])
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer) }, [notice])
  useEffect(() => {
    if (!renderJob || (renderJob.status !== 'running' && !(renderJob.status === 'error' && renderJob.error?.startsWith('Chưa đạt kiểm tra sau 3 vòng sửa.')))) return
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${renderJob.id}`, { cache: 'no-store' })
        if (response.ok) {
          const latest = await response.json() as RenderJob
          if (displayedJobId.current === renderJob.id) setRenderJob(latest)
        }
      } catch { /* Keep the last visible stage until the server responds. */ }
    }, 2000)
    return () => clearInterval(timer)
  }, [renderJob?.id, renderJob?.status])

  async function refreshCodex() {
    try {
      const response = await fetch('/api/codex/status', { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const current = await response.json() as CodexState
      setCodex(current)
      return current
    } catch { setCodex({ installed: false, connected: false, detail: 'Backend cục bộ chưa chạy. Dùng npm run dev.' }); return null }
  }

  async function refreshStyles() {
    try {
      const response = await fetch('/api/styles', { cache: 'no-store' })
      if (response.ok) setCreatedStyles(await response.json() as EditStyle[])
    } catch { /* Keep built-in styles available while the backend reloads. */ }
  }

  async function loginCodex() {
    setLoginBusy(true)
    try {
      const response = await fetch('/api/codex/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const result = await response.json() as { connected?: boolean; started?: boolean; detail?: string; error?: string }
      if (!response.ok) throw new Error(result.error || 'Không mở được đăng nhập Codex.')
      if (result.connected) { await refreshCodex(); return }
      setNotice(result.detail || 'Hoàn tất đăng nhập trong trình duyệt.')
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        const current = await refreshCodex()
        if (current?.connected) { setNotice('Đã kết nối Codex.'); return }
      }
      setNotice('Chưa thấy phiên đăng nhập. Chạy codex login trong PowerShell rồi nhấn Kiểm tra lại.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể kết nối Codex.') }
    finally { setLoginBusy(false) }
  }

  async function chooseCodexModel(model: string) {
    setModelBusy(true)
    try {
      const response = await fetch('/api/codex/model', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Không lưu được model Codex.')
      setCodex(current => current ? { ...current, model } : current)
      setNotice(model ? `Đã chọn ${model} cho các lần dựng tiếp theo.` : 'Codex sẽ dùng model mặc định của tài khoản.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không lưu được model Codex.') }
    finally { setModelBusy(false) }
  }

  function clearRenderResult() {
    displayedJobId.current = null
    setRenderJob(null)
    localStorage.removeItem('ai-editor-last-job')
    const url = new URL(window.location.href)
    if (url.searchParams.has('job')) {
      url.searchParams.delete('job')
      window.history.replaceState(null, '', url)
    }
  }

  function chooseStyle(id: string) {
    setStyleId(id)
    setMode('preset')
  }

  function accept(file: File | undefined, kind: 'raw' | 'reference') {
    if (!file) return
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)) { setNotice('Hãy chọn tệp video.'); return }
    if (renderJob?.status !== 'running') clearRenderResult()
    setActiveId(null)
    if (kind === 'raw') { setRaw(file); setDuration(0); if (!title) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')) }
    else setReference(file)
  }

  function navigate(next: Section) { setSection(next); setMobileMenu(false) }

  async function openJobInStudio(jobId: string) {
    if (renderJob?.status === 'running' && renderJob.id !== jobId) { navigate('studio'); return }
    try {
      const response = await fetch('/api/jobs/' + jobId, { cache: 'no-store' })
      const data = await response.json() as RenderJob & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Could not open this job.')
      if (renderJob?.id !== data.id) {
        setRaw(null); setReference(null); setSupporting([]); setDuration(0); setActiveId(null); setNotes('')
      }
      setTitle(data.title || '')
      setRenderJob(data)
      displayedJobId.current = data.id
      localStorage.setItem('ai-editor-last-job', data.id)
      if (data.style === 'reference') setMode('reference')
      else if (data.style && !hiddenStyleIds.has(data.style)) { setMode('preset'); setStyleId(data.style) }
      navigate('studio')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not open this job.') }
  }
  function reset() { clearRenderResult(); setSupporting([]); setRaw(null); setReference(null); setDuration(0); setTitle(''); setNotes(''); setMode('preset'); setStyleId('clean'); setActiveId(null); navigate('studio') }

  async function save() {
    if (!raw) { rawInput.current?.click(); return }
    if (mode === 'reference' && !reference) { referenceInput.current?.click(); return }
    const project: Project = {
      id: activeId ?? crypto.randomUUID(), title: title.trim() || raw.name.replace(/\.[^.]+$/, ''), createdAt: Date.now(),
      mode, style: mode === 'preset' ? styleId : 'reference', notes: notes.trim(), rawName: raw.name,
      referenceName: mode === 'reference' ? reference?.name : undefined, raw,
      reference: mode === 'reference' ? reference ?? undefined : undefined,
      supporting: supporting.map(file => ({ name: file.name, blob: file })),
      duration, size: raw.size + (mode === 'reference' ? reference?.size ?? 0 : 0),
    }
    try { await saveProject(project); setProjects(await listProjects()); setActiveId(project.id); setNotice('Đã lưu dự án trên máy này.') }
    catch { setNotice('Không lưu được. Video có thể vượt dung lượng trình duyệt.') }
  }

  function openProject(project: Project) {
    clearRenderResult()
    setRaw(new File([project.raw], project.rawName, { type: project.raw.type || 'video/mp4' }))
    setReference(project.reference ? new File([project.reference], project.referenceName || 'reference.mp4', { type: project.reference.type || 'video/mp4' }) : null)
    setTitle(project.title); setNotes(project.notes); setDuration(project.duration); setMode(project.mode)
    setSupporting((project.supporting || []).map(item => new File([item.blob], item.name, { type: item.blob.type })))
    if (project.mode === 'preset') setStyleId(project.style)
    setActiveId(project.id); navigate('studio')
  }

  async function removeProject(project: Project) {
    if (!confirm(`Xóa dự án “${project.title}” cùng video đã lưu?`)) return
    await deleteProject(project.id); setProjects(await listProjects())
    if (activeId === project.id) reset()
    setNotice('Đã xóa dự án.')
  }

  async function startPreview(kind: 'preview' | 'full' = 'preview') {
    if (!raw) { rawInput.current?.click(); return }
    if (!codex?.connected) { setNotice('Hãy đăng nhập Codex trong Thiết lập trước.'); return }
    if (mode === 'reference' && !reference) { referenceInput.current?.click(); return }
    if (mode === 'preset' && !canRunStyle(styleId)) {
      setNotice('Style này chưa được nối bộ dựng.'); return
    }
    if (mode === 'preset' && ['stan-style', 'seoul-list', 'pov-montage'].includes(styleId) && !supporting.length) { setNotice('Mẫu này cần video bổ sung: quay màn hình cho Stan Style, footage/B-roll cho Seoul List.'); return }
    const form = new FormData()
    form.append('source', raw)
    if (mode === 'reference' && reference) form.append('reference', reference)
    form.append('style', mode === 'reference' ? 'reference' : styleId)
    form.append('kind', kind)
    form.append('title', title)
    form.append('notes', notes)
    supporting.forEach((file, index) => form.append(`support-${index + 1}`, file))
    setUploading(true); clearRenderResult()
    const pendingToken = crypto.randomUUID()
    displayedJobId.current = pendingToken
    try {
      const response = await fetch('/api/jobs', { method: 'POST', body: form })
      const data = await response.json() as RenderJob & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Không gửi được video.')
      if (displayedJobId.current !== pendingToken) return
      setRenderJob(data)
      displayedJobId.current = data.id
      localStorage.setItem('ai-editor-last-job', data.id)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không gửi được video.') }
    finally { setUploading(false) }
  }

  async function startFull() {
    if (!renderJob || renderJob.status !== 'done' || renderJob.kind === 'full') return
    const sourceJobId = renderJob.id
    setUploading(true)
    try {
      const response = await fetch(`/api/jobs/${renderJob.id}/full`, { method: 'POST' })
      const data = await response.json() as RenderJob & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Không tạo được bản đầy đủ.')
      if (displayedJobId.current !== sourceJobId) return
      setRenderJob(data)
      displayedJobId.current = data.id
      localStorage.setItem('ai-editor-last-job', data.id)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không tạo được bản đầy đủ.') }
    finally { setUploading(false) }
  }

  async function retryRender() {
    if (!renderJob || renderJob.status !== 'error') return
    const sourceJobId = renderJob.id
    setUploading(true)
    try {
      const response = await fetch(`/api/jobs/${renderJob.id}/retry`, { method: 'POST' })
      const data = await response.json() as RenderJob
      if (!response.ok) throw new Error(data.error || 'Không chạy lại được job.')
      if (displayedJobId.current !== sourceJobId) return
      setRenderJob(data)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không chạy lại được job.') }
    finally { setUploading(false) }
  }

  async function cancelRender() {
    if (!renderJob || renderJob.status !== 'running' || !renderJob.cancelSupported || renderJob.cancelRequested) return
    const jobId = renderJob.id
    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' })
      const data = await response.json() as RenderJob & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Không hủy được video đang sửa.')
      if (displayedJobId.current === jobId) setRenderJob(data)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không hủy được video đang sửa.') }
  }

  async function saveFeedback(liked: boolean) {
    if (!renderJob || renderJob.status !== 'done') return
    try {
      const response = await fetch(`/api/jobs/${renderJob.id}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ liked, comment: feedbackText }) })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error || 'Không lưu được đánh giá.')
      setFeedbackSaved(true)
      setNotice('Đã lưu ý kiến để áp dụng cho các video sau.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không lưu được đánh giá.') }
  }

  return <div className={`app-shell workspace-app ${section === 'studio' ? 'studio-app' : ''}`}>
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="brand"><img className="brand-logo" src="/igencut-logo-light.webp" alt="iGenCut"/></div>
      <div className="sidebar-label">Workspace</div>
      <nav className="navigation">
        <button className={section === 'studio' ? 'active' : ''} onClick={() => navigate('studio')}><LayoutGrid size={18}/> Studio</button>
        <button className={section === 'projects' ? 'active' : ''} onClick={() => navigate('projects')}><Clapperboard size={18}/> Dự án <span className="nav-count">{projects.length}</span></button>
        <button className={section === 'history' ? 'active' : ''} onClick={() => navigate('history')}><History size={18}/> Lịch sử</button>
        <button className={section === 'styles' ? 'active' : ''} onClick={() => navigate('styles')}><Sparkles size={18}/> Thư viện style</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="side-footer">Bản dùng thử <span>v0.2</span></div>
        <button className={`sidebar-settings ${section === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings2 size={16}/> Cài đặt</button>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar editor-menu">
        <div className="editor-menu-content">
          <img className="editor-menu-logo" src="/igencut-logo-light.webp" alt="iGenCut"/>
          <nav className="editor-menu-nav" aria-label="Menu chính">
            <button className={section === "studio" ? "editor-menu-item active" : "editor-menu-item"} onClick={() => navigate("studio")}><LayoutGrid size={16}/> Studio</button>
            <button className={section === "projects" ? "editor-menu-item active" : "editor-menu-item"} onClick={() => navigate("projects")}><Clapperboard size={16}/> Dự án</button>
            <button className={section === "history" ? "editor-menu-item active" : "editor-menu-item"} onClick={() => navigate("history")}><History size={16}/> Lịch sử</button>
            <button className={section === "styles" ? "editor-menu-item active" : "editor-menu-item"} onClick={() => navigate("styles")}><Sparkles size={16}/> Thư viện</button>
            <button className={section === "settings" ? "editor-menu-item active" : "editor-menu-item"} onClick={() => navigate("settings")}><Settings2 size={16}/> Cài đặt</button>
          </nav>
        </div>
        <div className="top-actions"><button className={codex?.connected ? 'codex-top-status is-connected' : 'codex-top-status'} onClick={() => navigate('settings')}><span/> {codex?.connected ? 'Codex đã kết nối' : 'Kết nối Codex'}</button><span className="local-badge"><span/> Lưu trên máy</span><div className="avatar">AI</div></div>
      </header>

      {section === 'studio' && <div className="page studio-page"><div className="workflow"><span className="workflow-active"><b>01</b> Video nguồn</span><i/><span className={raw ? 'workflow-active' : ''}><b>02</b> Phong cách</span><i/><span className={raw && (mode === 'preset' || reference) ? 'workflow-active' : ''}><b>03</b> Chuẩn bị dựng</span></div>
          <div className="editor-workspace">
            <RecentHistoryPanel onOpen={() => navigate('history')} onOpenJob={openJobInStudio} activeJob={renderJob?.status === 'running' ? renderJob : null} refreshKey={renderJob ? `${renderJob.id}:${renderJob.status}` : ''} />
            <aside className="editor-library-pane">
              <div className="editor-panel-heading"><div><ImagePlus size={15}/><span>Thư viện style</span></div><small>{matchingStyles.length}</small></div>
          {mode === 'preset' && styleSearchBar}<section className="surface style-section library-style-section"><div className="section-head"><div className="number">02</div><div><h2>Chọn phong cách</h2><p>Chọn một phong cách cho video</p></div></div>{mode === 'preset' ? <><div className="style-grid">{matchingStyles.length ? matchingStyles.map(style => <button key={style.id} className={`style-card ${styleId === style.id ? 'selected' : ''}`} onClick={() => chooseStyle(style.id)}><div className={`style-visual visual-${style.visual} ${previewFor(style.id) ? 'has-preview' : ''}`}>{previewFor(style.id) ? <><img className="preview-backdrop" src={previewFor(style.id)!} alt="" aria-hidden="true" loading="lazy"/><img className="style-preview-image" src={previewFor(style.id)!} alt={style.name} loading="lazy"/></> : <><span className="visual-decoration"/><span className="visual-word">{style.name.split(' ')[0]}</span><span className="visual-line"/></>}</div><div className="style-copy" data-category={style.category.trim().toLocaleLowerCase('vi-VN')}><strong>{style.name}</strong><span>{style.category}</span></div>{styleId === style.id && <div className="style-check"><Check size={12}/></div>}</button>) : <div className="style-search-empty">Không tìm thấy style phù hợp. Thử chủ đề khác.</div>}</div>{['stan-style', 'seoul-list', 'pov-montage'].includes(styleId) && <div className="recipe-assets"><strong>{styleId === 'stan-style' ? 'Thêm bản quay màn hình' : styleId === 'pov-montage' ? 'Thêm cảnh góc nhìn thứ nhất' : 'Thêm cảnh minh họa'}</strong><p>{styleId === 'stan-style' ? 'Mẫu này đặt màn hình công cụ phía trên người nói. Thêm bản quay màn hình đúng phần bạn đang giới thiệu.' : styleId === 'pov-montage' ? 'Thêm các clip POV thật; app chọn những cảnh khớp từng câu nói.' : 'Mẫu này dựng lời nói trên các cảnh quay. Thêm những cảnh phù hợp với nội dung video của bạn.'}</p><label className="supporting-upload">Chọn video<input type="file" multiple accept="video/*,.mov,.mkv" onChange={event => { const files = Array.from(event.target.files || []); if (files.length > 6 || files.some(f => f.size > 500 * 1024 * 1024)) { setNotice('Tối đa 6 video, mỗi video không quá 500 MB.'); return } setSupporting(files) }}/></label><p>{supporting.length ? supporting.map(file => file.name).join(' · ') : 'Chưa chọn video bổ sung'} · Tối đa 6 video, 500 MB mỗi tệp.</p>{supporting.length > 0 && <button onClick={() => setSupporting([])}>Bỏ các video này</button>}</div>}</> : <div className="reference-panel"><input ref={referenceInput} type="file" accept="video/*,.mov,.mkv,.avi" hidden onChange={event => accept(event.target.files?.[0], 'reference')}/>{reference ? <div className="reference-loaded"><div className="reference-preview"><video src={referenceUrl} controls/></div><div><strong>{reference.name}</strong><span>{size(reference.size)} · Video mẫu</span><button onClick={() => referenceInput.current?.click()}>Đổi video mẫu <ArrowRight size={15}/></button></div><button className="icon-button" onClick={() => setReference(null)}><X size={18}/></button></div> : <div className="reference-drop" role="button" tabIndex={0} onClick={() => referenceInput.current?.click()} onKeyDown={event => { if (event.key === 'Enter') referenceInput.current?.click() }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); accept(event.dataTransfer.files[0], 'reference') }}><div><ImagePlus size={25}/></div><strong>Thêm reel làm mẫu</strong><span>Codex phân tích từng giây của video mẫu, chép lời, học chữ và nhịp dựng rồi lưu thành style riêng.</span><b>Chọn video mẫu <ArrowRight size={15}/></b></div>}</div>}</section>
          </aside><div className="studio-main">
          <section className="surface source-section"><div className="section-head"><div className="number">01</div><div><h2>Video nguồn</h2></div><span className="section-mark">Bắt buộc</span></div><input ref={rawInput} type="file" accept="video/*,.mov,.mkv,.avi" hidden onChange={event => accept(event.target.files?.[0], 'raw')}/>{raw ? <div className="uploaded-video"><div className="video-frame"><video src={rawUrl} controls preload="metadata" onLoadedMetadata={event => setDuration(event.currentTarget.duration)}/></div><div className="file-strip"><div className="file-icon"><FileVideo2 size={20}/></div><div className="file-detail"><strong>{raw.name}</strong><span>{size(raw.size)} · {time(duration)}</span></div><button className="icon-button" onClick={() => rawInput.current?.click()} title="Đổi video"><FolderOpen size={18}/></button><button className="icon-button" onClick={() => { setRaw(null); clearRenderResult() }} title="Xóa video"><X size={18}/></button></div></div> : renderJob ? <div className="job-source-running"><strong>{renderJob.title || renderJob.style || "Video"}</strong><span>{renderJob.stage} - {renderJob.progress}%</span><div className="job-source-progress"><i style={{ width: renderJob.progress + "%" }}/></div>{renderJob.status !== "running" && <button className="job-source-upload" onClick={() => rawInput.current?.click()}>Tải video khác</button>}</div> : <div className="upload-zone" role="button" tabIndex={0} onClick={() => rawInput.current?.click()} onKeyDown={event => { if (event.key === 'Enter') rawInput.current?.click() }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); accept(event.dataTransfer.files[0], 'raw') }}><strong>Kéo thả video vào đây</strong><span>hoặc <b>chọn tệp từ máy tính</b></span><small>MP4, MOV, WebM và các định dạng trình duyệt hỗ trợ</small></div>}</section>
          <section className="surface details-section"><div className="section-head"><div className="number">03</div><div><h2>Chi tiết dự án</h2></div></div><div className="field-grid"><label><span>Tên dự án</span><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Ví dụ: Reel giới thiệu sản phẩm"/></label><label><span>Tỉ lệ đầu ra</span><div className="select-look">9:16 · Video dọc <ChevronDown size={16}/></div></label></div><label className="notes-field"><span>Ghi chú cho Codex <small>Tùy chọn</small></span><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ví dụ: Caption tiếng Việt, nhịp dựng nhanh ở 3 giây đầu..." rows={4}/></label></section>
        </div><aside className="right-rail ai-log-pane"><div className="ai-log-heading"><div><WandSparkles size={15}/><span>Tiến trình AI</span></div><small>{renderJob?.status === 'running' ? 'Đang chạy' : 'Sẵn sàng'}</small></div><div className="summary-card"><div className="summary-label"><Sparkles size={16}/> Tổng quan</div><div className="summary-poster"><div className={`poster-inner ${mode === 'preset' ? `visual-${chosen.visual}` : 'visual-reference'}`}>{mode === 'preset' && previewFor(chosen.id) && <img className="poster-preview-image" src={previewFor(chosen.id)!} alt=""/>}<span className="poster-title">{mode === 'preset' ? chosen.name : 'YOUR STYLE'}</span><span className="poster-play"><Play size={19} fill="currentColor"/></span><small>9:16 REEL</small></div></div><div className="summary-row"><span>Video nguồn</span><strong>{raw ? 'Đã chọn' : 'Chưa chọn'}</strong></div><div className="summary-row"><span>Phong cách</span><strong>{mode === 'preset' ? chosen.name : reference ? 'Video mẫu' : 'Chưa chọn'}</strong></div><div className="summary-row"><span>Độ dài nguồn</span><strong>{time(duration)}</strong></div><div className="summary-row"><span>Codex</span><strong>{codex?.connected ? 'Đã kết nối' : 'Chưa kết nối'}</strong></div><div className="summary-divider"/><button className="primary-button" onClick={save}>{activeId ? 'Cập nhật dự án' : 'Lưu dự án'} <ArrowRight size={18}/></button><button className="primary-button render-button" disabled={uploading || renderJob?.status === 'running'} onClick={() => startPreview('full')}>Dựng video hoàn chỉnh <Film size={18}/></button>{renderJob?.status === 'running' && renderJob.cancelSupported && <button className="secondary-button cancel-render-button" disabled={renderJob.cancelRequested} onClick={cancelRender}><X size={15}/>{renderJob.cancelRequested ? 'Đang hủy...' : 'Hủy video đang sửa'}</button>}{renderJob?.status === 'done' && renderJob.kind !== 'full' && <button className="primary-button render-button" disabled={uploading} onClick={startFull}>Dựng bản đầy đủ <Film size={18}/></button>}{raw && !renderJob && !uploading && <div className="render-empty">{noResultText}</div>}{renderJob && <div className="render-status"><div className="render-context">{renderJob.title || 'Video'} / {allStyles.find(style => style.id === renderJob.style)?.name || renderJob.style || 'Style'}</div><strong>{renderJob.stage}</strong><span>{renderJob.progress}%</span>{renderJob.recipe && <small>Recipe: {renderJob.recipe}{renderJob.qualityRound ? ` · Kiểm tra ${renderJob.qualityRound}/3` : ''}</small>}{renderJob.asrModel && <small>Chép lời: faster-whisper {renderJob.asrModel}</small>}<div className="render-progress"><i style={{ width: `${renderJob.progress}%` }}/></div>{renderJob.status === 'error' && <><p>{renderJob.error}</p><button className="secondary-button" disabled={uploading} onClick={retryRender}>Chạy lại từ dữ liệu đã xử lý</button></>}{renderJob.warning && <p>{renderJob.warning}</p>}{renderJob.createdStyleId && <p>Đã lưu style “{renderJob.createdStyleName || renderJob.createdStyleId}” vào thư viện. Bạn có thể dùng lại cho video khác.</p>}{renderJob.status === 'done' && renderJob.output && <><video src={renderJob.output} controls preload="metadata"/><a href={renderJob.output} download={renderJob.kind === 'full' ? 'reel-full.mp4' : 'reel-preview.mp4'}>{renderJob.kind === 'full' ? 'Tải MP4 đầy đủ' : 'Tải MP4'}</a></>}{renderJob.status === 'done' && <div className="feedback-box"><strong>Góp ý cho lần dựng sau</strong><textarea value={feedbackText} onChange={event => { setFeedbackText(event.target.value); setFeedbackSaved(false) }} placeholder="Bạn thích hoặc muốn sửa điều gì trong video này?" maxLength={500}/><div><button disabled={feedbackSaved} onClick={() => saveFeedback(true)}>Thích bản dựng</button><button disabled={feedbackSaved} onClick={() => saveFeedback(false)}>Cần sửa</button></div>{feedbackSaved && <small>Đã ghi nhớ ý kiến của bạn.</small>}</div>}</div>}</div><div className="rail-hint"><div><WandSparkles size={19}/></div><p><strong>Cách sử dụng</strong><br/>Chọn một mẫu dựng và tải video gốc. App tự chọn đoạn, thêm chữ, kiểm tra rồi xuất video.</p></div></aside></div></div>}

      {section === 'history' && <HistoryPage onOpenJob={openJobInStudio}/>}

      {section === 'projects' && <div className="page secondary-page"><div className="secondary-toolbar"><button className="primary-button small" onClick={reset}><Plus size={17}/> Dự án mới</button></div>{projects.length ? <div className="project-grid">{projects.map(project => <article className="project-card" key={project.id}><div className={`project-cover ${project.mode === 'preset' ? `visual-${allStyles.find(style => style.id === project.style)?.visual || 'clean'}` : 'visual-reference'}`}><Film size={31}/><span>{project.mode === 'preset' ? allStyles.find(style => style.id === project.style)?.name || project.style : 'VIDEO MẪU'}</span></div><div className="project-info"><div><small><Clock3 size={13}/> {new Intl.DateTimeFormat('vi-VN').format(project.createdAt)}</small><button className="icon-button" onClick={() => removeProject(project)} title="Xóa dự án"><Trash2 size={16}/></button></div><h3>{project.title}</h3><p>{project.rawName}</p><div className="project-meta"><span>{time(project.duration)}</span><span>{size(project.size)}</span></div><button className="open-project" onClick={() => openProject(project)}>Mở dự án <ArrowRight size={16}/></button></div></article>)}</div> : <div className="empty-state"><FolderOpen size={34}/><h2>Chưa có dự án nào</h2><p>Bắt đầu với video raw đầu tiên của bạn.</p><button onClick={reset}>Tạo dự án <ArrowRight size={16}/></button></div>}</div>}

      {section === 'styles' && <div className="page secondary-page">{styleSearchBar}<div className="library-grid">{!styleSearch.trim() && <article className="library-card library-copy-card"><div className="library-visual library-copy-visual"><ImagePlus size={34}/><span>Style của bạn</span></div><div className="library-body"><small>Style từ video mẫu</small><h3>Sao chép style từ video</h3><p>Chọn một video bạn thích. App phân tích cách dựng, chữ và nhịp cắt để tạo style dùng lại.</p><input ref={referenceInput} type="file" accept="video/*,.mov,.mkv,.avi" hidden onChange={event => { const file = event.target.files?.[0]; if (!file) return; setMode('reference'); accept(file, 'reference'); navigate('studio') }}/><button type="button" onClick={() => referenceInput.current?.click()}>Chọn video mẫu <ArrowRight size={16}/></button></div></article>}{matchingStyles.length ? matchingStyles.map(style => <StyleReelCard key={style.id} style={style} previewSrc={previewFor(style.id)} onChoose={() => { chooseStyle(style.id); navigate('studio') }}/>) : <div className="style-search-empty">Không tìm thấy style phù hợp. Thử chủ đề khác.</div>}</div></div>}

      {section === 'settings' && <div className="page secondary-page"><div className="codex-connection surface"><div className="connection-symbol"><WandSparkles size={24}/></div><div className="connection-copy"><div className="connection-heading"><h2>Kết nối Codex trên máy</h2><span className={`connection-pill ${codex?.connected ? 'online' : ''}`}>{codex?.connected ? 'ĐÃ KẾT NỐI' : 'CHƯA KẾT NỐI'}</span></div><p>{codex?.detail || 'Đang kiểm tra đăng nhập...'}</p>{!codex?.connected && <small>Nếu trình duyệt không tự mở, chạy <code>codex login</code> trong PowerShell rồi nhấn “Kiểm tra lại”.</small>}</div><div className="connection-buttons">{!codex?.connected && <button className="connection-test" onClick={loginCodex} disabled={!codex?.installed || loginBusy}>{loginBusy ? 'Đang chờ đăng nhập...' : 'Đăng nhập ChatGPT'} <ArrowRight size={15}/></button>}<button className="connection-refresh" onClick={refreshCodex}>Kiểm tra lại</button></div></div>{codex?.connected && <div className="codex-model surface"><div><h2>Model Codex</h2><p>Chọn model dùng cho các lần dựng video tiếp theo trong tài khoản đang đăng nhập.</p></div><label><span>Model đang dùng</span><select value={codex.model || ''} disabled={modelBusy} onChange={event => void chooseCodexModel(event.target.value)}><option value="">Mặc định của Codex</option>{codex.models?.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>{!codex.models?.length && <small>Chưa có danh sách model từ Codex CLI. Hãy nhấn “Kiểm tra lại” sau khi đăng nhập.</small>}</div>}<div className="settings-layout"><div className="surface settings-card"><h2>Trạng thái hệ thống</h2><div className="status-row"><div className="status-icon good"><Check size={18}/></div><div><strong>Giao diện Studio</strong><span>Đang chạy</span></div><b className="status-ready">SẴN SÀNG</b></div><div className="status-row"><div className="status-icon good"><HardDrive size={18}/></div><div><strong>Lưu dự án cục bộ</strong><span>IndexedDB</span></div><b className="status-ready">SẴN SÀNG</b></div><div className="status-row"><div className={codex?.connected ? 'status-icon good' : 'status-icon pending'}><WandSparkles size={18}/></div><div><strong>Codex agent</strong><span>{codex?.connected ? 'Phiên ChatGPT đã sẵn sàng' : 'Cần đăng nhập Codex CLI'}</span></div><b className={codex?.connected ? 'status-ready' : 'status-pending'}>{codex?.connected ? 'ĐÃ KẾT NỐI' : 'CHƯA KẾT NỐI'}</b></div></div></div></div>}
    </main>
    {notice && <div className="toast"><span>{notice}</span><button onClick={() => setNotice('')}><X size={16}/></button></div>}
    {mobileMenu && <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="Đóng menu"/>}
  </div>
}
