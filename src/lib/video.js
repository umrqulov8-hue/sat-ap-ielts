// Helpers for video lessons: YouTube URLs and direct file URLs.

export function getYouTubeId(url) {
  if (!url) return null
  const u = String(url).trim()
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  ]
  for (const p of patterns) {
    const m = u.match(p)
    if (m) return m[1]
  }
  return null
}

export function detectVideoType(url) {
  return getYouTubeId(url) ? 'youtube' : 'file'
}

export function getEmbedUrl(url) {
  const id = getYouTubeId(url)
  if (!id) return null
  const p = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
  })
  return `https://www.youtube-nocookie.com/embed/${id}?${p.toString()}`
}

export function getThumbnail(url, custom) {
  if (custom) return custom
  const id = getYouTubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

export function isValidVideoUrl(url) {
  if (!url) return false
  const u = String(url).trim()
  if (getYouTubeId(u)) return true
  return /^(https?:\/\/)[^\s]+$/i.test(u)
}
