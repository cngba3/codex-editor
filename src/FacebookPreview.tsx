import { useEffect, useRef, useState } from 'react'

type FacebookPlayer = {
  play: () => void
  pause: () => void
  seek: (seconds: number) => void
  mute: () => void
  isMuted: () => boolean
  getCurrentPosition: () => number
  subscribe: (event: string, callback: () => void) => { release: () => void }
}
type FacebookSdk = {
  init: (options: { xfbml: boolean; version: string }) => void
  Event: { subscribe: (event: string, callback: (message: { type?: string; id?: string; instance?: FacebookPlayer }) => void) => void; unsubscribe: (event: string, callback: (message: { type?: string; id?: string; instance?: FacebookPlayer }) => void) => void }
  XFBML: { parse: (element: HTMLElement) => void }
}
type FacebookWindow = Window & { FB?: FacebookSdk; fbAsyncInit?: () => void }

let sdkPromise: Promise<FacebookSdk> | null = null
function loadFacebookSdk(): Promise<FacebookSdk> {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const fbWindow = window as FacebookWindow
    if (fbWindow.FB) { resolve(fbWindow.FB); return }
    fbWindow.fbAsyncInit = () => {
      const sdk = fbWindow.FB
      if (!sdk) { reject(new Error('Không tải được Facebook Player.')); return }
      sdk.init({ xfbml: false, version: 'v27.0' })
      resolve(sdk)
    }
    const script = document.createElement('script')
    script.src = 'https://connect.facebook.net/vi_VN/sdk.js'
    script.async = true
    script.onerror = () => { sdkPromise = null; reject(new Error('Không tải được Facebook Player.')) }
    document.head.appendChild(script)
  })
  return sdkPromise
}

export default function FacebookPreview({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let sdk: FacebookSdk | null = null
    let player: FacebookPlayer | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let seeking = false
    let finished: { release: () => void } | null = null
    const onReady = (message: { type?: string; id?: string; instance?: FacebookPlayer }) => {
      if (!active || message.type !== 'video' || message.id !== 'style-facebook-preview' || !message.instance) return
      player = message.instance
      player.mute()
      player.play()
      finished = player.subscribe('finishedPlaying', () => { player?.seek(0); player?.play() })
      timer = setInterval(() => {
        if (!player) return
        if (!player.isMuted()) player.mute()
        const position = player.getCurrentPosition()
        if (position < 1) seeking = false
        if (position >= 3 && !seeking) { seeking = true; player.seek(0); player.play() }
      }, 100)
    }
    loadFacebookSdk().then(loaded => {
      if (!active || !containerRef.current) return
      sdk = loaded
      sdk.Event.subscribe('xfbml.ready', onReady)
      sdk.XFBML.parse(containerRef.current)
    }).catch(() => { if (active) setError('Không tải được video Facebook. Hãy mở link gốc để xem.') })
    return () => {
      active = false
      if (timer) clearInterval(timer)
      finished?.release()
      player?.pause()
      sdk?.Event.unsubscribe('xfbml.ready', onReady)
    }
  }, [url])

  return <div ref={containerRef} className="facebook-preview">
    <div id="style-facebook-preview" className="fb-video" data-href={url} data-width="300" data-show-text="false" data-autoplay="true"/>
    {error && <p role="alert">{error}</p>}
  </div>
}
