import { ArrowRight, Star } from 'lucide-react'
import { styleDetails, type EditStyle } from './styles'

const sampleText: Record<string, string> = {
  'amber-talk': 'Một ý tưởng đáng thử',
  'clean-os': 'tập trung vào điều quan trọng',
  'result-podcast': 'chuyện đó đã thay đổi tôi',
  'face-result': 'câu chuyện của mình',
  'caption-news': 'điều bạn cần biết',
  whiteboard: 'ý tưởng thành hành động',
  'kinetic-doc': 'chuyện gì đã xảy ra?',
  'step-deck': '3 bước để bắt đầu',
  'seoul-list': 'những nơi đáng đi',
  'data-story': 'con số biết nói',
  'explainer-vector': 'mọi thứ đều có lý do',
  'halftone-dossier': 'hồ sơ: sự thật phía sau',
  'hologram-hud': 'giải mã từng chi tiết',
  'news-package': 'câu chuyện hôm nay',
  'pov-montage': 'một ngày qua góc nhìn tôi',
  'product-page': 'đây là cách nó hoạt động',
  'stan-style': 'làm theo từng bước',
  'swiss-grid': 'ý tưởng số 01',
  'tactile-paper': 'lật lại câu chuyện',
  telestrator: 'nhìn kỹ điểm này',
  pop: 'hãy thử điều mới',
  clean: 'nói thẳng vào vấn đề',
  editorial: 'một góc nhìn khác',
  meme: 'khoan, thật sao?',
  cinematic: 'mọi chuyện bắt đầu từ đây',
  launch: 'một cách làm mới',
  kinetic: 'bắt đầu ngay hôm nay',
}

type Props = { style: EditStyle; previewSrc: string | null; favorite: boolean; onChoose: () => void; onToggleFavorite: () => void }

export default function StyleReelCard({ style, previewSrc, favorite, onChoose, onToggleFavorite }: Props) {
  const details = styleDetails[style.id]
  return <article className={`library-card style-reel-card reel-${style.id}`} tabIndex={0} aria-label={`${style.name}. ${style.description}`}>
    <div className="style-reel-frame">
      <button
        type="button"
        className={`style-reel-favorite ${favorite ? 'is-favorite' : ''}`}
        aria-label={favorite ? `Bỏ yêu thích ${style.name}` : `Yêu thích ${style.name}`}
        aria-pressed={favorite}
        title={favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
      onClick={event => { event.stopPropagation(); onToggleFavorite() }}
      ><Star size={16} fill={favorite ? 'currentColor' : 'none'}/></button>
      {previewSrc ? <img className="style-reel-image" src={previewSrc} alt="" loading="lazy"/> : <div className={`style-reel-fallback visual-${style.visual}`}/>}
      <div className="style-reel-sample" aria-hidden="true">{sampleText[style.id] || style.name}</div>
      <span className="style-reel-name">{style.name}</span>
      <div className="style-reel-detail">
        <small>{style.category}</small>
        <h3>{style.name}</h3>
        <p>{style.description}</p>
        {details?.bestFor && <p>Phù hợp với: {details.bestFor}</p>}
        {details?.preparation && <p>Cần chuẩn bị: {details.preparation}</p>}
        <button type="button" onClick={onChoose}>Dùng style này <ArrowRight size={16}/></button>
      </div>
    </div>
  </article>
}
