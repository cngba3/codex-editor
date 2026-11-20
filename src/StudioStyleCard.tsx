import { Check, Star } from 'lucide-react'
import type { EditStyle } from './styles'

type Props = {
  style: EditStyle
  previewSrc: string | null
  videoPreviewSrc: string | null
  selected: boolean
  favorite: boolean
  onChoose: () => void
  onToggleFavorite: () => void
}

export default function StudioStyleCard({ style, previewSrc, videoPreviewSrc, selected, favorite, onChoose, onToggleFavorite }: Props) {
  return <div className="studio-style-card">
    <button type="button" className={`style-card ${selected ? 'selected' : ''}`} onClick={onChoose} aria-pressed={selected}>
      <div className={`style-visual visual-${style.visual} ${previewSrc ? 'has-preview' : ''}`}>
        {videoPreviewSrc ? <video className="style-preview-video" src={videoPreviewSrc} poster={previewSrc || undefined} autoPlay muted loop playsInline preload="metadata" aria-hidden="true"/> : previewSrc ? <>
          <img className="preview-backdrop" src={previewSrc} alt="" aria-hidden="true" loading="lazy"/>
          <img className="style-preview-image" src={previewSrc} alt={style.name} loading="lazy"/>
        </> : <>
          <span className="visual-decoration"/>
          <span className="visual-word">{style.name.split(' ')[0]}</span>
          <span className="visual-line"/>
        </>}
      </div>
      <div className="style-copy" data-category={style.category.trim().toLocaleLowerCase('vi-VN')}>
        <strong>{style.name}</strong>
        <span>{style.category}</span>
      </div>
      {selected && <div className="style-check"><Check size={12}/></div>}
    </button>
    <button
      type="button"
      className={`studio-style-favorite ${favorite ? 'is-favorite' : ''}`}
      aria-label={favorite ? `Bỏ yêu thích ${style.name}` : `Yêu thích ${style.name}`}
      aria-pressed={favorite}
      title={favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
      onClick={onToggleFavorite}
    ><Star size={14} fill={favorite ? 'currentColor' : 'none'}/></button>
  </div>
}
