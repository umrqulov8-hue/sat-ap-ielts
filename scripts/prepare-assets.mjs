// Prepares Orbi companion poses and background images.
//   node scripts/prepare-assets.mjs
// Drop source PNGs into public/companion/ (orbi-<pose>.png) and public/bg/ (bg-*.png),
// run this once, and commit the optimized outputs. The app reads the generated
// manifest.json files, so adding a new pose/background needs no code change.
import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
const companionDir = path.join(root, 'companion')
const bgDir = path.join(root, 'bg')

const list = async dir => (await readdir(dir).catch(() => [])).sort()

async function prepareCompanion() {
  const files = (await list(companionDir)).filter(f => /^orbi-[a-z]+\.png$/.test(f))
  // Trim every pose, then put it on one shared square canvas, bottom-centered at the
  // same character height, so swapping poses never makes Orbi jump.
  const trimmed = []
  for (const file of files) {
    const buf = await sharp(path.join(companionDir, file)).trim({ threshold: 8 }).toBuffer({ resolveWithObject: true })
    trimmed.push({ file, buf: buf.data, w: buf.info.width, h: buf.info.height })
  }
  if (!trimmed.length) return []
  const maxH = Math.max(...trimmed.map(t => t.h))
  const maxW = Math.max(...trimmed.map(t => t.w))
  const canvas = Math.ceil(Math.max(maxH, maxW) * 1.04)
  const poses = []
  for (const t of trimmed) {
    const pose = t.file.replace(/^orbi-|\.png$/g, '')
    const left = Math.round((canvas - t.w) / 2)
    const top = canvas - t.h - Math.round(canvas * 0.015)
    const base = sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: t.buf, left, top }])
      .png()
    const squared = await base.toBuffer()
    await sharp(squared).resize(640, 640).webp({ quality: 86 }).toFile(path.join(companionDir, `orbi-${pose}.webp`))
    await sharp(squared).resize(320, 320).webp({ quality: 84 }).toFile(path.join(companionDir, `orbi-${pose}@320.webp`))
    poses.push(pose)
  }
  return poses
}

async function prepareBackgrounds() {
  const files = (await list(bgDir)).filter(f => /^bg-[a-z0-9-]+\.png$/.test(f))
  const entries = []
  for (const file of files) {
    const name = file.replace(/\.png$/, '')
    const mobile = name.endsWith('-mobile')
    const widths = mobile ? [1080, 720] : [1920, 1280, 768]
    for (const w of widths) {
      const img = sharp(path.join(bgDir, file)).resize({ width: w, withoutEnlargement: true })
      await img.clone().avif({ quality: 55 }).toFile(path.join(bgDir, `${name}-${w}.avif`))
      await img.clone().webp({ quality: 78 }).toFile(path.join(bgDir, `${name}-${w}.webp`))
    }
    entries.push({ name, widths })
  }
  return entries
}

const poses = await prepareCompanion()
await writeFile(path.join(companionDir, 'manifest.json'), JSON.stringify({ poses }, null, 2) + '\n')

const backgrounds = await prepareBackgrounds()

// Single images (podium for the hero, optional pattern tile) become one WebP each.
const extras = []
for (const name of ['podium', 'pattern-tile']) {
  const src = path.join(bgDir, `${name}.png`)
  const ok = await sharp(src).metadata().then(() => true).catch(() => false)
  if (!ok) continue
  await sharp(src).trim({ threshold: 8 }).resize({ width: 720, withoutEnlargement: true }).webp({ quality: 84 }).toFile(path.join(bgDir, `${name}.webp`))
  extras.push(name)
}
await writeFile(path.join(bgDir, 'manifest.json'), JSON.stringify({ backgrounds, extras }, null, 2) + '\n')

console.log('poses:', poses.join(', ') || '(none)')
console.log('backgrounds:', backgrounds.map(b => b.name).join(', ') || '(none)')
if (extras.length) console.log('extras:', extras.join(', '))
