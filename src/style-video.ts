const localPreviews: Record<string, string> = {
  pop: '/style-videos/pop.mp4',
  'ref-b018836f': '/style-videos/interview.mp4',
  'amber-talk': '/style-videos/amber-talk.mp4',
  'clean-os': '/style-videos/clean-os.mp4',
  'review-bds': '/style-videos/review-bds.mp4',
}

export function localStyleVideoPreview(id: string): string | null {
  return localPreviews[id] || null
}
