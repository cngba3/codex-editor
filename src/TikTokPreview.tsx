import { useEffect, useRef, useState } from 'react'

type Props = { playerUrl: string; title: string }

export default function TikTokPreview({ playerUrl, title }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let seeking = false
    let attempts = 0
    let playing = false
    const timeout = setTimeout(() => setError(true), 20000)
    const send = (type: 'play' | 'mute' | 'seekTo', value?: number) => {
      iframeRef.current?.contentWindow?.postMessage({ type, value, 'x-tiktok-player': true }, 'https://www.tiktok.com')
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.tiktok.com' || event.source !== iframeRef.current?.contentWindow) return
      const message = event.data as { type?: string; value?: { currentTime?: number } | boolean | number } | null
      if (!message || typeof message !== 'object' || !('x-tiktok-player' in message)) return
      if (message.type === 'onPlayerReady') { send('mute'); send('play') }
      if (message.type === 'onMute' && message.value === false) send('mute')
      if (message.type === 'onPlayerError') { clearTimeout(timeout); setError(true) }
      if (message.type === 'onCurrentTime') {
        const currentTime = typeof message.value === 'object' ? message.value?.currentTime : undefined
        if (typeof currentTime !== 'number') return
        clearTimeout(timeout)
        if (currentTime > 0) { playing = true; setStarted(true) }
        if (currentTime < 1) seeking = false
        if (currentTime >= 3 && !seeking) { seeking = true; send('seekTo', 0); send('play') }
      }
    }
    setStarted(false)
    window.addEventListener('message', onMessage)
    const retry = window.setInterval(() => {
      if (playing || ++attempts > 8) { window.clearInterval(retry); return }
      send('mute'); send('play')
    }, 1500)
    return () => { clearTimeout(timeout); window.clearInterval(retry); window.removeEventListener('message', onMessage) }
  }, [playerUrl, retryKey])

  return error ? <div className="style-video-fallback"><p>TikTok chưa phát được video này trong app.</p><button type="button" onClick={() => { setError(false); setRetryKey(current => current + 1) }}>Thử lại</button></div> : <iframe ref={iframeRef} className={started ? 'is-playing' : ''} src={`${playerUrl}?embed_from=oembed&music_info=1&description=1&autoplay=1&muted=1`} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin"/>
}
