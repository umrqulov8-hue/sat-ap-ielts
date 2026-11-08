import { supabase } from './supabaseClient'

export const IMAGE_BUCKET = 'avav2'
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

// Validate an image the admin picked, before any network call.
export function validateImage(file) {
  if (!file) return 'No file selected'
  if (!MIME_EXT[file.type]) return 'Only PNG, JPG, WEBP or GIF images are allowed'
  if (file.size > MAX_IMAGE_BYTES) return `Image is too large (${(file.size / 1048576).toFixed(1)} MB). Max 5 MB`
  return null
}

/**
 * Upload an image to Storage and return its public URL.
 * Resolves { url, path, error } — never throws. The extension comes from the
 * MIME type (not the file name) and the name is unique, so uploads cannot
 * collide or smuggle in a non-image extension.
 */
export async function uploadImage(file, folder = 'question-images') {
  const problem = validateImage(file)
  if (problem) return { url: '', path: '', error: { message: problem } }

  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) return { url: '', path: '', error: { message: 'You are signed out. Sign in again and retry.' } }

  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${uid}/${folder}/${Date.now()}-${rand}.${MIME_EXT[file.type]}`
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type })
  if (error) return { url: '', path: '', error }

  const { data: { publicUrl } } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
  return { url: publicUrl, path, error: null }
}

// "https://<ref>.supabase.co/storage/v1/object/public/avav2/<path>" -> "<path>" (null for foreign URLs).
export function storagePathFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return null
  try { return decodeURIComponent(url.slice(i + marker.length).split('?')[0]) } catch { return null }
}
