import { useEffect, useState } from 'react'

export default function PexelsSettings() {
  const [connected, setConnected] = useState(false)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void fetch('/api/stock/pexels').then(response => response.json()).then(data => setConnected(Boolean(data.connected))).catch(() => setMessage('Chưa kiểm tra được Pexels.'))
  }, [])

  async function save() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/stock/pexels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không lưu được API key.')
      setConnected(Boolean(data.connected))
      setKey('')
      setMessage(data.connected ? 'Đã lưu Pexels trên máy này.' : 'Đã xóa API key đã lưu.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không lưu được API key.') }
    finally { setBusy(false) }
  }

  return <div className="surface pexels-settings">
    <div><h2>Tư liệu Pexels</h2><p>Style Review BĐS tìm ảnh hoặc video theo từng ý trong lời nói, ví dụ nhà đất, công trường hay trung tâm thương mại.</p><small>{connected ? 'Đã kết nối Pexels trên máy này.' : 'Cần API key Pexels để tìm tư liệu khi dựng video.'} <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer">Lấy API key tại Pexels</a></small></div>
    <div className="pexels-settings-controls"><input type="password" value={key} onChange={event => setKey(event.target.value)} placeholder="Pexels API key" autoComplete="off" aria-label="Pexels API key"/><button type="button" onClick={() => void save()} disabled={busy || !key.trim()}>Lưu key</button>{message && <small role="status">{message}</small>}</div>
  </div>
}
