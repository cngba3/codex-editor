import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowRight, Check, ChevronDown, Clapperboard, Clock3, CloudUpload, FileVideo2, Film, FolderOpen, HardDrive, ImagePlus, LayoutGrid, Menu, Play, Plus, Settings2, Sparkles, Trash2, WandSparkles, X } from 'lucide-react'
import { deleteProject, listProjects, saveProject, type Project } from './store'
import { editStyles } from './styles'
import './render.css'

type Section = 'studio' | 'projects' | 'styles' | 'settings'
type Mode = 'preset' | 'reference'
type CodexState = { installed: boolean; connected: boolean; detail: string }
type RenderJob = { id: string; stage: string; progress: number; status: 'running' | 'done' | 'error'; error?: string; warning?: string; output?: string; kind?: 'preview' | 'full'; parentId?: string; asrModel?: string }
const runnableStyleIds = new Set(['clean', 'editorial', 'meme', 'cinematic', 'launch', 'kinetic', 'pop'])
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
  const [raw, setRaw] = useState<File | null>(null)
  const [reference, setReference] = useState<File | null>(null)
  const [duration, setDuration] = useState(0)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [codex, setCodex] = useState<CodexState | null>(null)
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null)
  const [previewOutput, setPreviewOutput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)
  const rawInput = useRef<HTMLInputElement>(null)
  const referenceInput = useRef<HTMLInputElement>(null)
  const rawUrl = useObjectUrl(raw)
  const referenceUrl = useObjectUrl(reference)
  const chosen = editStyles.find(item => item.id === styleId) ?? editStyles[0]

  useEffect(() => { if (renderJob?.status === 'done' && renderJob.kind !== 'full' && renderJob.output) setPreviewOutput(renderJob.output) }, [renderJob])
  useEffect(() => { listProjects().then(setProjects).catch(() => setNotice('Không thể đọc bộ nhớ trình duyệt.')); void refreshCodex() }, [])
  useEffect(() => {
    const id = localStorage.getItem('ai-editor-last-job')
    if (!id) return
    fetch(`/api/jobs/${id}`, { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(data => { if (data) setRenderJob(data as RenderJob) }).catch(() => {})
  }, [])
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer) }, [notice])
  useEffect(() => {
    if (!renderJob || renderJob.status !== 'running') return
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${renderJob.id}`, { cache: 'no-store' })
        if (response.ok) setRenderJob(await response.json() as RenderJob)
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

  function accept(file: File | undefined, kind: 'raw' | 'reference') {
    if (!file) return
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)) { setNotice('Hãy chọn tệp video.'); return }
    setActiveId(null)
    if (kind === 'raw') { setRaw(file); setDuration(0); if (!title) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')) }
    else setReference(file)
  }

  function navigate(next: Section) { setSection(next); setMobileMenu(false) }
  function reset() { setRaw(null); setReference(null); setDuration(0); setTitle(''); setNotes(''); setMode('preset'); setStyleId('clean'); setActiveId(null); setRenderJob(null); setPreviewOutput(''); localStorage.removeItem('ai-editor-last-job'); navigate('studio') }

  async function save() {
    if (!raw) { rawInput.current?.click(); return }
    if (mode === 'reference' && !reference) { referenceInput.current?.click(); return }
    const project: Project = {
      id: activeId ?? crypto.randomUUID(), title: title.trim() || raw.name.replace(/\.[^.]+$/, ''), createdAt: Date.now(),
      mode, style: mode === 'preset' ? styleId : 'reference', notes: notes.trim(), rawName: raw.name,
      referenceName: mode === 'reference' ? reference?.name : undefined, raw,
      reference: mode === 'reference' ? reference ?? undefined : undefined,
      duration, size: raw.size + (mode === 'reference' ? reference?.size ?? 0 : 0),
    }
    try { await saveProject(project); setProjects(await listProjects()); setActiveId(project.id); setNotice('Đã lưu dự án trên máy này.') }
    catch { setNotice('Không lưu được. Video có thể vượt dung lượng trình duyệt.') }
  }

  function openProject(project: Project) {
    setRaw(new File([project.raw], project.rawName, { type: project.raw.type || 'video/mp4' }))
    setReference(project.reference ? new File([project.reference], project.referenceName || 'reference.mp4', { type: project.reference.type || 'video/mp4' }) : null)
    setTitle(project.title); setNotes(project.notes); setDuration(project.duration); setMode(project.mode)
    if (project.mode === 'preset') setStyleId(project.style)
    setActiveId(project.id); navigate('studio')
  }

  async function removeProject(project: Project) {
    if (!confirm(`Xóa dự án “${project.title}” cùng video đã lưu?`)) return
    await deleteProject(project.id); setProjects(await listProjects())
    if (activeId === project.id) reset()
    setNotice('Đã xóa dự án.')
  }

  function exportBrief() {
    if (!raw) { setNotice('Hãy chọn video raw trước.'); return }
    const data = { schema: 'frameflow-edit-brief-v1', title: title.trim() || raw.name, raw: { name: raw.name, size: raw.size, duration }, reference: mode === 'reference' && reference ? { name: reference.name, size: reference.size } : null, mode, style: mode === 'preset' ? styleId : null, notes, engine: 'ghost-editor / HyperFrames', status: 'brief-only' }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'video-edit-brief.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function startPreview() {
    if (!raw) { rawInput.current?.click(); return }
    if (!codex?.connected) { setNotice('Hãy đăng nhập Codex trong Thiết lập trước.'); return }
    if (mode === 'reference' && !reference) { referenceInput.current?.click(); return }
    if (mode === 'preset' && !['clean', 'editorial', 'meme', 'cinematic', 'launch', 'kinetic', 'pop'].includes(styleId)) {
      setNotice('Bản nháp hiện hỗ trợ 7 preset ở cuối danh sách style.'); return
    }
    const form = new FormData()
    form.append('source', raw)
    if (mode === 'reference' && reference) form.append('reference', reference)
    form.append('style', mode === 'reference' ? 'reference' : styleId)
    form.append('title', title)
    form.append('notes', notes)
    setUploading(true); setRenderJob(null); setPreviewOutput('')
    try {
      const response = await fetch('/api/jobs', { method: 'POST', body: form })
      const data = await response.json() as RenderJob & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Không gửi được video.')
      setRenderJob(data)
      localStorage.setItem('ai-editor-last-job', data.id)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không gửi được video.') }
    finally { setUploading(false) }
  }

  async function startFull() {
    if (!renderJob || renderJob.status !== 'done' || renderJob.kind === 'full') return
    if (renderJob.output) setPreviewOutput(renderJob.output)
    setUploading(true)
    try {
      const response = await fetch(`/api/jobs/${renderJob.id}/full`, { method: 'POST' })
      const data = await response.json() as RenderJob & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Không tạo được bản đầy đủ.')
      setRenderJob(data)
      localStorage.setItem('ai-editor-last-job', data.id)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không tạo được bản đầy đủ.') }
    finally { setUploading(false) }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-icon"><Film size={21}/></div><div><strong>frameflow<span>.</span></strong><small>AI VIDEO STUDIO</small></div></div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="navigation">
        <button className={section === 'studio' ? 'active' : ''} onClick={() => navigate('studio')}><LayoutGrid size={18}/> Studio</button>
        <button className={section === 'projects' ? 'active' : ''} onClick={() => navigate('projects')}><Clapperboard size={18}/> Dự án <span className="nav-count">{projects.length}</span></button>
        <button className={section === 'styles' ? 'active' : ''} onClick={() => navigate('styles')}><Sparkles size={18}/> Thư viện style</button>
      </nav>
      <div className="sidebar-label tools-label">HỆ THỐNG</div>
      <nav className="navigation"><button className={section === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings2 size={18}/> Thiết lập</button></nav>
      <div className="sidebar-bottom"><div className="engine-card"><div className="engine-top"><span className="engine-orbit"><Sparkles size={16}/></span><span className={`engine-dot ${codex?.connected ? 'connected' : ''}`}/></div><strong>Codex {codex?.connected ? 'đã kết nối' : 'chưa kết nối'}</strong><p>{codex?.connected ? 'Đã nhận phiên ChatGPT trên máy. Bản nháp 15 giây đã chạy được trên Windows.' : 'Mở Thiết lập để kết nối Codex.'}</p><button onClick={() => navigate('settings')}>Xem trạng thái <ArrowRight size={15}/></button></div><div className="side-footer">Bản dùng thử <span>v0.2</span></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={20}/></button><span>Workspace</span><span className="slash">/</span><strong>{section === 'studio' ? 'Studio' : section === 'projects' ? 'Dự án' : section === 'styles' ? 'Thư viện style' : 'Thiết lập'}</strong></div><div className="top-actions"><button className={`codex-top-status ${codex?.connected ? 'is-connected' : ''}`} onClick={() => navigate('settings')}><span/> {codex?.connected ? 'Codex đã kết nối' : 'Kết nối Codex'}</button><span className="local-badge"><span/> Lưu trên máy</span><div className="avatar">AI</div></div></header>

      {section === 'studio' && <div className="page studio-page"><div className="page-heading"><div><div className="eyebrow"><span/> STUDIO / TẠO VIDEO MỚI</div><h1>Video thô vào.<br/><em>Ý tưởng thành hình.</em></h1><p>Chọn video, chọn phong cách và chuẩn bị bản dựng của bạn.</p></div><div className="heading-art" aria-hidden="true"><span className="art-orbit orbit-one"/><span className="art-orbit orbit-two"/><span className="art-play"><Play size={21} fill="currentColor"/></span><span className="art-spark spark-one">✦</span></div></div><div className="workflow"><span className="workflow-active"><b>01</b> Video nguồn</span><i/><span className={raw ? 'workflow-active' : ''}><b>02</b> Phong cách</span><i/><span className={raw && (mode === 'preset' || reference) ? 'workflow-active' : ''}><b>03</b> Chuẩn bị dựng</span></div>
        <div className="studio-grid"><div className="studio-main">
          <section className="surface source-section"><div className="section-head"><div className="number">01</div><div><h2>Video nguồn</h2><p>Tải video gốc bạn muốn biên tập</p></div><span className="section-mark">BẮT BUỘC</span></div><input ref={rawInput} type="file" accept="video/*,.mov,.mkv,.avi" hidden onChange={event => accept(event.target.files?.[0], 'raw')}/>{raw ? <div className="uploaded-video"><div className="video-frame"><video src={rawUrl} controls preload="metadata" onLoadedMetadata={event => setDuration(event.currentTarget.duration)}/></div><div className="file-strip"><div className="file-icon"><FileVideo2 size={20}/></div><div className="file-detail"><strong>{raw.name}</strong><span>{size(raw.size)} · {time(duration)}</span></div><button className="icon-button" onClick={() => rawInput.current?.click()} title="Đổi video"><FolderOpen size={18}/></button><button className="icon-button" onClick={() => setRaw(null)} title="Xóa video"><X size={18}/></button></div></div> : <div className="upload-zone" role="button" tabIndex={0} onClick={() => rawInput.current?.click()} onKeyDown={event => { if (event.key === 'Enter') rawInput.current?.click() }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); accept(event.dataTransfer.files[0], 'raw') }}><div className="upload-icon"><CloudUpload size={26}/></div><strong>Kéo thả video vào đây</strong><span>hoặc <b>chọn tệp từ máy tính</b></span><small>MP4, MOV, WebM và các định dạng trình duyệt hỗ trợ</small></div>}</section>
          <section className="surface style-section"><div className="section-head"><div className="number">02</div><div><h2>Chọn phong cách</h2><p>Chọn style có sẵn hoặc video tham chiếu</p></div></div><div className="mode-switch"><button className={mode === 'preset' ? 'selected' : ''} onClick={() => setMode('preset')}><LayoutGrid size={17}/> Style có sẵn</button><button className={mode === 'reference' ? 'selected' : ''} onClick={() => setMode('reference')}><Film size={17}/> Theo video mẫu</button></div>{mode === 'preset' ? <><div className="style-grid">{editStyles.filter(style => ['clean', 'editorial', 'meme', 'cinematic', 'launch', 'kinetic', 'pop'].includes(style.id)).map(style => <button key={style.id} className={`style-card ${styleId === style.id ? 'selected' : ''}`} onClick={() => setStyleId(style.id)}><div className={`style-visual visual-${style.visual}`}><span className="visual-decoration"/><span className="visual-word">{style.name.split(' ')[0]}</span><span className="visual-line"/></div><div className="style-copy"><strong>{style.name}</strong><span>{style.category}</span></div>{styleId === style.id && <div className="style-check"><Check size={12}/></div>}</button>)}</div><div className="recipe-overview"><strong>Recipe riêng từ ghost-editor</strong><p>Đã có source của 18 recipe. Các bộ dựng này cần nối theo đầu vào và quy trình riêng; hai mục chỉ có tài liệu. Bạn có thể xem toàn bộ danh mục bên dưới, còn nút dựng hiện dùng 7 preset phía trên.</p><div className="recipe-grid">{editStyles.filter(style => !runnableStyleIds.has(style.id)).map(style => <article className="recipe-tile" key={style.id}><strong>{style.name}</strong><span>{style.category}</span><small>Chưa nối bộ dựng</small></article>)}</div></div></> : <div className="reference-panel"><input ref={referenceInput} type="file" accept="video/*,.mov,.mkv,.avi" hidden onChange={event => accept(event.target.files?.[0], 'reference')}/>{reference ? <div className="reference-loaded"><div className="reference-preview"><video src={referenceUrl} controls/></div><div><strong>{reference.name}</strong><span>{size(reference.size)} · Video mẫu</span><button onClick={() => referenceInput.current?.click()}>Đổi video mẫu <ArrowRight size={15}/></button></div><button className="icon-button" onClick={() => setReference(null)}><X size={18}/></button></div> : <div className="reference-drop" role="button" tabIndex={0} onClick={() => referenceInput.current?.click()} onKeyDown={event => { if (event.key === 'Enter') referenceInput.current?.click() }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); accept(event.dataTransfer.files[0], 'reference') }}><div><ImagePlus size={25}/></div><strong>Thêm reel làm mẫu</strong><span>Codex xem các khung hình mẫu để chọn bố cục, màu và caption phù hợp.</span><b>Chọn video mẫu <ArrowRight size={15}/></b></div>}</div>}</section>
          <section className="surface details-section"><div className="section-head"><div className="number">03</div><div><h2>Chi tiết dự án</h2><p>Để lại chỉ dẫn cho bản dựng</p></div></div><div className="field-grid"><label><span>Tên dự án</span><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Ví dụ: Reel giới thiệu sản phẩm"/></label><label><span>Tỉ lệ đầu ra</span><div className="select-look">9:16 · Video dọc <ChevronDown size={16}/></div></label></div><label className="notes-field"><span>Ghi chú cho Codex <small>TÙY CHỌN</small></span><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ví dụ: Caption tiếng Việt, nhịp dựng nhanh ở 3 giây đầu..." rows={4}/><small>Muốn nhận đúng tên riêng hoặc thuật ngữ, thêm một dòng: Thuật ngữ: cửa khẩu, giá cả, tên sản phẩm...</small></label></section>
        </div><aside className="right-rail"><div className="summary-card"><div className="summary-label"><Sparkles size={16}/> TỔNG QUAN</div><div className="summary-poster"><div className={`poster-inner ${mode === 'preset' ? `visual-${chosen.visual}` : 'visual-reference'}`}><span>{mode === 'preset' ? chosen.name : 'YOUR STYLE'}</span><span className="poster-play"><Play size={19} fill="currentColor"/></span><small>9:16 REEL</small></div></div><div className="summary-row"><span>Video nguồn</span><strong>{raw ? 'Đã chọn' : 'Chưa chọn'}</strong></div><div className="summary-row"><span>Phong cách</span><strong>{mode === 'preset' ? chosen.name : reference ? 'Video mẫu' : 'Chưa chọn'}</strong></div><div className="summary-row"><span>Độ dài nguồn</span><strong>{time(duration)}</strong></div><div className="summary-row"><span>Codex</span><strong>{codex?.connected ? 'Đã kết nối' : 'Chưa kết nối'}</strong></div><div className="summary-divider"/><button className="primary-button" onClick={save}>{activeId ? 'Cập nhật dự án' : 'Lưu dự án'} <ArrowRight size={18}/></button><button className="primary-button render-button" disabled={uploading || renderJob?.status === 'running'} onClick={startPreview}>{uploading ? 'Đang tải video...' : renderJob?.status === 'running' ? 'Đang dựng...' : 'Dựng bản nháp 15 giây'} <Film size={18}/></button>{renderJob?.status === 'done' && renderJob.kind !== 'full' && <button className="primary-button render-button" disabled={uploading} onClick={startFull}>Dựng bản đầy đủ <Film size={18}/></button>}{renderJob?.kind === 'full' && previewOutput && <a href={previewOutput} target="_blank" rel="noreferrer">Xem lại bản nháp 15 giây</a>}<button className="secondary-button" onClick={exportBrief}><ArrowDownToLine size={16}/> Xuất brief JSON</button>{renderJob && <div className="render-status"><strong>{renderJob.stage}</strong><span>{renderJob.progress}%</span>{renderJob.asrModel && <small>Chép lời: faster-whisper {renderJob.asrModel}</small>}<div className="render-progress"><i style={{ width: `${renderJob.progress}%` }}/></div>{renderJob.status === 'error' && <p>{renderJob.error}</p>}{renderJob.warning && <p>{renderJob.warning}</p>}{renderJob.status === 'done' && renderJob.output && <><video src={renderJob.output} controls preload="metadata"/><a href={renderJob.output} download={renderJob.kind === 'full' ? 'reel-full.mp4' : 'reel-preview.mp4'}>{renderJob.kind === 'full' ? 'Tải MP4 đầy đủ' : 'Tải MP4'}</a></>}</div>}</div><div className="rail-hint"><div><WandSparkles size={19}/></div><p><strong>Trạng thái engine</strong><br/>Bản nháp 15 giây dùng Codex chọn đoạn và ghost-editor dựng bằng HyperFrames.</p></div></aside></div></div>}

      {section === 'projects' && <div className="page secondary-page"><div className="eyebrow"><span/> WORKSPACE / DỰ ÁN</div><div className="secondary-heading"><div><h1>Dự án của bạn<span>.</span></h1><p>Video và thiết lập lưu trong trình duyệt trên máy này.</p></div><button className="primary-button small" onClick={reset}><Plus size={17}/> Dự án mới</button></div>{projects.length ? <div className="project-grid">{projects.map(project => <article className="project-card" key={project.id}><div className={`project-cover ${project.mode === 'preset' ? `visual-${editStyles.find(style => style.id === project.style)?.visual || 'clean'}` : 'visual-reference'}`}><Film size={31}/><span>{project.mode === 'preset' ? editStyles.find(style => style.id === project.style)?.name || project.style : 'VIDEO MẪU'}</span></div><div className="project-info"><div><small><Clock3 size={13}/> {new Intl.DateTimeFormat('vi-VN').format(project.createdAt)}</small><button className="icon-button" onClick={() => removeProject(project)} title="Xóa dự án"><Trash2 size={16}/></button></div><h3>{project.title}</h3><p>{project.rawName}</p><div className="project-meta"><span>{time(project.duration)}</span><span>{size(project.size)}</span></div><button className="open-project" onClick={() => openProject(project)}>Mở dự án <ArrowRight size={16}/></button></div></article>)}</div> : <div className="empty-state"><FolderOpen size={34}/><h2>Chưa có dự án nào</h2><p>Bắt đầu với video raw đầu tiên của bạn.</p><button onClick={reset}>Tạo dự án <ArrowRight size={16}/></button></div>}</div>}

      {section === 'styles' && <div className="page secondary-page"><div className="eyebrow"><span/> WORKSPACE / STYLE</div><div className="secondary-heading"><div><h1>Thư viện style<span>.</span></h1><p>Các công thức dựng từ ghost-editor.</p></div></div><div className="library-grid">{editStyles.map(style => <article className="library-card" key={style.id}><div className={`library-visual visual-${style.visual}`}><span>{style.name}</span><i/></div><div className="library-body"><small>{style.category}</small><h3>{style.name}</h3><p>{style.description}</p><div className="tags">{style.tags.map(tag => <span key={tag}>{tag}</span>)}</div><button disabled={!runnableStyleIds.has(style.id)} onClick={() => { setStyleId(style.id); setMode('preset'); navigate('studio') }}>{runnableStyleIds.has(style.id) ? 'Dùng style này' : 'Chưa nối bộ dựng'} <ArrowRight size={16}/></button></div></article>)}</div></div>}

      {section === 'settings' && <div className="page secondary-page"><div className="eyebrow"><span/> WORKSPACE / THIẾT LẬP</div><div className="secondary-heading"><div><h1>Thiết lập<span>.</span></h1><p>Trạng thái các thành phần trên Windows.</p></div></div><div className="codex-connection surface"><div className="connection-symbol"><WandSparkles size={24}/></div><div className="connection-copy"><div className="connection-heading"><h2>Kết nối Codex trên máy</h2><span className={`connection-pill ${codex?.connected ? 'online' : ''}`}>{codex?.connected ? 'ĐÃ KẾT NỐI' : 'CHƯA KẾT NỐI'}</span></div><p>{codex?.detail || 'Đang kiểm tra đăng nhập...'}</p>{!codex?.connected && <small>Nếu trình duyệt không tự mở, chạy <code>codex login</code> trong PowerShell rồi nhấn “Kiểm tra lại”.</small>}</div><div className="connection-buttons">{!codex?.connected && <button className="connection-test" onClick={loginCodex} disabled={!codex?.installed || loginBusy}>{loginBusy ? 'Đang chờ đăng nhập...' : 'Đăng nhập ChatGPT'} <ArrowRight size={15}/></button>}<button className="connection-refresh" onClick={refreshCodex}>Kiểm tra lại</button></div></div><div className="settings-layout"><div className="surface settings-card"><h2>Trạng thái hệ thống</h2><div className="status-row"><div className="status-icon good"><Check size={18}/></div><div><strong>Giao diện Studio</strong><span>Đang chạy</span></div><b className="status-ready">SẴN SÀNG</b></div><div className="status-row"><div className="status-icon good"><HardDrive size={18}/></div><div><strong>Lưu dự án cục bộ</strong><span>IndexedDB</span></div><b className="status-ready">SẴN SÀNG</b></div><div className="status-row"><div className="status-icon good"><FolderOpen size={18}/></div><div><strong>Mã nguồn ghost-editor</strong><span>Thư mục ghost-editor/</span></div><b className="status-ready">ĐÃ TẢI</b></div><div className="status-row"><div className="status-icon good"><Settings2 size={18}/></div><div><strong>Pipeline dựng Windows</strong><span>Bản nháp 15 giây đã chạy trên Windows</span></div><b className="status-ready">SẴN SÀNG</b></div><div className="status-row"><div className={codex?.connected ? 'status-icon good' : 'status-icon pending'}><WandSparkles size={18}/></div><div><strong>Codex agent</strong><span>{codex?.connected ? 'Phiên ChatGPT đã sẵn sàng' : 'Cần đăng nhập Codex CLI'}</span></div><b className={codex?.connected ? 'status-ready' : 'status-pending'}>{codex?.connected ? 'ĐÃ KẾT NỐI' : 'CHƯA KẾT NỐI'}</b></div></div><div className="settings-side"><Sparkles size={24}/><h3>Bản dùng thử</h3><p>Codex đã kết nối qua backend cục bộ. Chọn một trong 7 preset ở Studio để dựng và xem bản nháp MP4 khoảng 15 giây.</p><button onClick={() => navigate('studio')}>Quay lại Studio <ArrowRight size={16}/></button></div></div></div>}
    </main>
    {notice && <div className="toast"><span>{notice}</span><button onClick={() => setNotice('')}><X size={16}/></button></div>}
    {mobileMenu && <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="Đóng menu"/>}
  </div>
}
