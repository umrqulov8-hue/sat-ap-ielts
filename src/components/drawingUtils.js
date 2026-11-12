export function drawCube(ctx, x, y, w, h, color, lineWidth) {
  const depthX = Math.round(w * 0.28)
  const depthY = Math.round(h * 0.25)
  const fw = w - depthX
  const fh = h - depthY
  const fx = x
  const fy = y + depthY

  // Dashed hidden back edges
  ctx.save()
  ctx.setLineDash([5, 5])
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(fx + depthX, fy - depthY + fh)
  ctx.lineTo(fx + fw + depthX, fy - depthY + fh)
  ctx.moveTo(fx + depthX, fy - depthY + fh)
  ctx.lineTo(fx + depthX, fy - depthY)
  ctx.moveTo(fx + depthX, fy - depthY + fh)
  ctx.lineTo(fx, fy + fh)
  ctx.stroke()
  ctx.restore()

  // Visible front, top, and right faces
  ctx.beginPath()
  // Front face rectangle
  ctx.rect(fx, fy, fw, fh)

  // Top face
  ctx.moveTo(fx, fy)
  ctx.lineTo(fx + depthX, fy - depthY)
  ctx.lineTo(fx + fw + depthX, fy - depthY)
  ctx.lineTo(fx + fw, fy)

  // Right face
  ctx.moveTo(fx + fw, fy + fh)
  ctx.lineTo(fx + fw + depthX, fy - depthY + fh)
  ctx.lineTo(fx + fw + depthX, fy - depthY)
  ctx.stroke()
}

export function drawCylinder(ctx, x, y, w, h, color, lineWidth) {
  const cx = x + w / 2
  const rx = w / 2
  const ry = Math.min(h * 0.2, rx * 0.45)
  const topY = y + ry
  const botY = y + h - ry

  // Hidden rear curve of bottom ellipse
  ctx.save()
  ctx.setLineDash([5, 5])
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.ellipse(cx, botY, rx, ry, 0, Math.PI, 2 * Math.PI)
  ctx.stroke()
  ctx.restore()

  // Visible lines
  ctx.beginPath()
  // Top full ellipse
  ctx.ellipse(cx, topY, rx, ry, 0, 0, 2 * Math.PI)
  // Left vertical edge
  ctx.moveTo(cx - rx, topY)
  ctx.lineTo(cx - rx, botY)
  // Right vertical edge
  ctx.moveTo(cx + rx, topY)
  ctx.lineTo(cx + rx, botY)
  // Bottom front visible half ellipse
  ctx.ellipse(cx, botY, rx, ry, 0, 0, Math.PI)
  ctx.stroke()
}

export function drawCone(ctx, x, y, w, h, color, lineWidth) {
  const cx = x + w / 2
  const apexX = cx
  const apexY = y
  const rx = w / 2
  const ry = Math.min(h * 0.22, rx * 0.45)
  const botY = y + h - ry

  // Hidden rear arc of base & dashed height axis
  ctx.save()
  ctx.setLineDash([5, 5])
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.ellipse(cx, botY, rx, ry, 0, Math.PI, 2 * Math.PI)
  ctx.moveTo(apexX, apexY)
  ctx.lineTo(cx, botY)
  ctx.stroke()
  ctx.restore()

  // Visible sides & front arc
  ctx.beginPath()
  ctx.moveTo(apexX, apexY)
  ctx.lineTo(cx - rx, botY)
  ctx.moveTo(apexX, apexY)
  ctx.lineTo(cx + rx, botY)
  ctx.ellipse(cx, botY, rx, ry, 0, 0, Math.PI)
  ctx.stroke()
}

export function drawSphere(ctx, x, y, w, h, color, lineWidth) {
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) / 2
  const ry = r * 0.35

  // Hidden rear equator & meridian curves
  ctx.save()
  ctx.setLineDash([5, 5])
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, ry, 0, Math.PI, 2 * Math.PI)
  ctx.ellipse(cx, cy, ry, r, 0, Math.PI / 2, (3 * Math.PI) / 2)
  ctx.stroke()
  ctx.restore()

  // Visible outer circle & front arcs
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, 2 * Math.PI)
  ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI)
  ctx.ellipse(cx, cy, ry, r, 0, -Math.PI / 2, Math.PI / 2)
  ctx.stroke()
}

export function drawPyramid(ctx, x, y, w, h, color, lineWidth) {
  const apexX = x + w / 2
  const apexY = y
  const p1 = { x: x, y: y + h * 0.85 }             // front-left
  const p2 = { x: x + w * 0.65, y: y + h }         // front-right
  const p3 = { x: x + w, y: y + h * 0.72 }         // back-right
  const p4 = { x: x + w * 0.35, y: y + h * 0.58 }  // back-left (hidden)

  // Hidden back base edges & hidden apex edge
  ctx.save()
  ctx.setLineDash([5, 5])
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p4.x, p4.y)
  ctx.lineTo(p3.x, p3.y)
  ctx.moveTo(apexX, apexY)
  ctx.lineTo(p4.x, p4.y)
  ctx.stroke()
  ctx.restore()

  // Visible edges
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.lineTo(p3.x, p3.y)

  ctx.moveTo(apexX, apexY)
  ctx.lineTo(p1.x, p1.y)
  ctx.moveTo(apexX, apexY)
  ctx.lineTo(p2.x, p2.y)
  ctx.moveTo(apexX, apexY)
  ctx.lineTo(p3.x, p3.y)
  ctx.stroke()
}

export function drawPrism(ctx, x, y, w, h, color, lineWidth) {
  const dx = w * 0.35
  const dy = h * 0.28
  const f1 = { x: x, y: y + h }
  const f2 = { x: x + w - dx, y: y + h }
  const f3 = { x: x + (w - dx) * 0.5, y: y + dy }

  const b1 = { x: f1.x + dx, y: f1.y - dy }
  const b2 = { x: f2.x + dx, y: f2.y - dy }
  const b3 = { x: f3.x + dx, y: f3.y - dy }

  // Hidden rear edges
  ctx.save()
  ctx.setLineDash([5, 5])
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(f1.x, f1.y)
  ctx.lineTo(b1.x, b1.y)
  ctx.lineTo(b2.x, b2.y)
  ctx.moveTo(b1.x, b1.y)
  ctx.lineTo(b3.x, b3.y)
  ctx.stroke()
  ctx.restore()

  // Visible edges
  ctx.beginPath()
  ctx.moveTo(f1.x, f1.y)
  ctx.lineTo(f2.x, f2.y)
  ctx.lineTo(f3.x, f3.y)
  ctx.closePath()

  ctx.moveTo(b3.x, b3.y)
  ctx.lineTo(b2.x, b2.y)

  ctx.moveTo(f2.x, f2.y)
  ctx.lineTo(b2.x, b2.y)
  ctx.moveTo(f3.x, f3.y)
  ctx.lineTo(b3.x, b3.y)
  ctx.stroke()
}

/* =========================================================================
   ELEMENT MODEL
   draw:        { points: [{x, y}] }
   line/arrow:  { x1, y1, x2, y2 }
   everything else (shapes + solids): { x, y, width, height }
   ========================================================================= */

export const MIN_SIZE = 8
export const HANDLE_PAD = 6
// These shapes must stay perfectly round, so they resize with a locked aspect.
export const LOCK_ASPECT = new Set(['circle', 'sphere'])
const SOLID_TYPES = new Set(['cube', 'cylinder', 'cone', 'sphere', 'pyramid', 'prism'])

export const isLineType = type => type === 'line' || type === 'arrow'

export function normalizeRect(x1, y1, x2, y2) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.max(Math.abs(x2 - x1), MIN_SIZE),
    height: Math.max(Math.abs(y2 - y1), MIN_SIZE),
  }
}

// Builds the stored element for a shape dragged from (x1,y1) to (x2,y2).
export function makeShape(type, id, x1, y1, x2, y2, color, lineWidth) {
  if (isLineType(type)) return { id, type, x1, y1, x2, y2, color, lineWidth }
  if (LOCK_ASPECT.has(type)) {
    const size = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), MIN_SIZE)
    const x = x2 >= x1 ? x1 : x1 - size
    const y = y2 >= y1 ? y1 : y1 - size
    return { id, type, x, y, width: size, height: size, color, lineWidth }
  }
  const r = normalizeRect(x1, y1, x2, y2)
  return { id, type, x: r.x, y: r.y, width: r.width, height: r.height, color, lineWidth }
}

export function getBounds(el) {
  if (el.type === 'draw') {
    if (!el.points || el.points.length === 0) return { x: 0, y: 0, width: MIN_SIZE, height: MIN_SIZE }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of el.points) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    return { x: minX, y: minY, width: Math.max(maxX - minX, MIN_SIZE), height: Math.max(maxY - minY, MIN_SIZE) }
  }
  if (isLineType(el.type)) {
    const x = Math.min(el.x1, el.x2)
    const y = Math.min(el.y1, el.y2)
    return { x, y, width: Math.abs(el.x2 - el.x1), height: Math.abs(el.y2 - el.y1) }
  }
  if (el.width === undefined) return normalizeRect(el.x1, el.y1, el.x2, el.y2)
  return { x: el.x, y: el.y, width: el.width, height: el.height }
}

/* =========================================================================
   RENDERING
   ========================================================================= */

function strokeSmooth(ctx, pts) {
  if (pts.length === 1) {
    ctx.beginPath()
    ctx.arc(pts[0].x, pts[0].y, (ctx.lineWidth || 3) / 2, 0, Math.PI * 2)
    ctx.fillStyle = ctx.strokeStyle
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y)
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2
      const my = (pts[i].y + pts[i + 1].y) / 2
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
    }
    const last = pts[pts.length - 1]
    ctx.lineTo(last.x, last.y)
  }
  ctx.stroke()
}

export function renderElement(ctx, el, isPreview = false) {
  ctx.save()
  ctx.strokeStyle = el.color
  ctx.lineWidth = el.lineWidth || 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (isPreview) ctx.globalAlpha = 0.75

  const { type } = el
  const b = type === 'draw' ? null : getBounds(el)

  if (type === 'draw') {
    if (el.points && el.points.length > 0) strokeSmooth(ctx, el.points)
  } else if (type === 'line') {
    ctx.beginPath()
    ctx.moveTo(el.x1, el.y1)
    ctx.lineTo(el.x2, el.y2)
    ctx.stroke()
  } else if (type === 'arrow') {
    const headlen = 16
    const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1)
    ctx.beginPath()
    ctx.moveTo(el.x1, el.y1)
    ctx.lineTo(el.x2, el.y2)
    ctx.moveTo(el.x2, el.y2)
    ctx.lineTo(el.x2 - headlen * Math.cos(angle - Math.PI / 6), el.y2 - headlen * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(el.x2, el.y2)
    ctx.lineTo(el.x2 - headlen * Math.cos(angle + Math.PI / 6), el.y2 - headlen * Math.sin(angle + Math.PI / 6))
    ctx.stroke()
  } else if (type === 'rect') {
    ctx.beginPath()
    ctx.rect(b.x, b.y, b.width, b.height)
    ctx.stroke()
  } else if (type === 'circle' || type === 'ellipse') {
    // The shape always fills its box, so the box is exactly what the user sees and grabs.
    ctx.beginPath()
    ctx.ellipse(b.x + b.width / 2, b.y + b.height / 2, b.width / 2, b.height / 2, 0, 0, 2 * Math.PI)
    ctx.stroke()
  } else if (type === 'triangle') {
    ctx.beginPath()
    ctx.moveTo(b.x + b.width / 2, b.y)
    ctx.lineTo(b.x + b.width, b.y + b.height)
    ctx.lineTo(b.x, b.y + b.height)
    ctx.closePath()
    ctx.stroke()
  } else if (type === 'right-triangle') {
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(b.x, b.y + b.height)
    ctx.lineTo(b.x + b.width, b.y + b.height)
    ctx.closePath()
    ctx.stroke()
    const mark = Math.min(14, b.width * 0.2, b.height * 0.2)
    ctx.beginPath()
    ctx.moveTo(b.x, b.y + b.height - mark)
    ctx.lineTo(b.x + mark, b.y + b.height - mark)
    ctx.lineTo(b.x + mark, b.y + b.height)
    ctx.stroke()
  } else if (type === 'axes') {
    const midX = b.x + b.width / 2
    const midY = b.y + b.height / 2
    ctx.beginPath()
    ctx.moveTo(b.x, midY)
    ctx.lineTo(b.x + b.width, midY)
    ctx.moveTo(midX, b.y + b.height)
    ctx.lineTo(midX, b.y)
    ctx.stroke()
    const a = Math.min(8, b.width / 4, b.height / 4)
    ctx.beginPath()
    ctx.moveTo(b.x + b.width - a, midY - a * 0.6)
    ctx.lineTo(b.x + b.width, midY)
    ctx.lineTo(b.x + b.width - a, midY + a * 0.6)
    ctx.moveTo(midX - a * 0.6, b.y + a)
    ctx.lineTo(midX, b.y)
    ctx.lineTo(midX + a * 0.6, b.y + a)
    ctx.stroke()
  } else if (type === 'cube') {
    drawCube(ctx, b.x, b.y, b.width, b.height, el.color, el.lineWidth || 3)
  } else if (type === 'cylinder') {
    drawCylinder(ctx, b.x, b.y, b.width, b.height, el.color, el.lineWidth || 3)
  } else if (type === 'cone') {
    drawCone(ctx, b.x, b.y, b.width, b.height, el.color, el.lineWidth || 3)
  } else if (type === 'sphere') {
    drawSphere(ctx, b.x, b.y, b.width, b.height, el.color, el.lineWidth || 3)
  } else if (type === 'pyramid') {
    drawPyramid(ctx, b.x, b.y, b.width, b.height, el.color, el.lineWidth || 3)
  } else if (type === 'prism') {
    drawPrism(ctx, b.x, b.y, b.width, b.height, el.color, el.lineWidth || 3)
  }

  ctx.restore()
}

/* =========================================================================
   HIT-TESTING
   ========================================================================= */

function distToSegment(px, py, ax, ay, bx, by) {
  const l2 = (ax - bx) ** 2 + (ay - by) ** 2
  if (l2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2))
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)))
}

function distToPolyline(px, py, pts, closed) {
  let best = Infinity
  const n = closed ? pts.length : pts.length - 1
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    best = Math.min(best, distToSegment(px, py, a.x, a.y, b.x, b.y))
  }
  return best
}

function pointInPolygon(px, py, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function polygonOf(el, b) {
  if (el.type === 'triangle') {
    return [{ x: b.x + b.width / 2, y: b.y }, { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height }]
  }
  if (el.type === 'right-triangle') {
    return [{ x: b.x, y: b.y }, { x: b.x, y: b.y + b.height }, { x: b.x + b.width, y: b.y + b.height }]
  }
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x + b.width, y: b.y + b.height },
    { x: b.x, y: b.y + b.height },
  ]
}

// `tol` is the reach in px around the visible lines. With `fill`, the inside of
// closed shapes counts too (click inside a circle to select it); erasing only
// reaches the outline so it never wipes a shape by brushing its empty middle.
export function hitTest(el, px, py, tol, fill = true) {
  const t = tol + (el.lineWidth || 3) / 2
  const type = el.type
  if (type === 'draw') {
    const pts = el.points || []
    if (pts.length === 0) return false
    if (pts.length === 1) return Math.hypot(px - pts[0].x, py - pts[0].y) <= t
    const b = getBounds(el)
    if (px < b.x - t || px > b.x + b.width + t || py < b.y - t || py > b.y + b.height + t) return false
    return distToPolyline(px, py, pts, false) <= t
  }
  if (isLineType(type)) return distToSegment(px, py, el.x1, el.y1, el.x2, el.y2) <= t

  const b = getBounds(el)
  if (type === 'rect' || type === 'triangle' || type === 'right-triangle') {
    const poly = polygonOf(el, b)
    if (fill && pointInPolygon(px, py, poly)) return true
    return distToPolyline(px, py, poly, true) <= t
  }
  if (type === 'circle' || type === 'ellipse') {
    const rx = b.width / 2
    const ry = b.height / 2
    const r = Math.hypot((px - (b.x + rx)) / rx, (py - (b.y + ry)) / ry)
    if (fill && r <= 1) return true
    return Math.abs(r - 1) * Math.min(rx, ry) <= t
  }
  if (type === 'axes') {
    const midX = b.x + b.width / 2
    const midY = b.y + b.height / 2
    return distToSegment(px, py, b.x, midY, b.x + b.width, midY) <= t || distToSegment(px, py, midX, b.y, midX, b.y + b.height) <= t
  }
  if (SOLID_TYPES.has(type)) {
    if (!fill) {
      return distToPolyline(px, py, polygonOf({ type: 'rect' }, b), true) <= t
    }
    return px >= b.x - t && px <= b.x + b.width + t && py >= b.y - t && py <= b.y + b.height + t
  }
  return false
}

/* =========================================================================
   SELECTION HANDLES, MOVE & RESIZE
   ========================================================================= */

export function getHandles(el) {
  if (isLineType(el.type)) return [{ id: 'p1', x: el.x1, y: el.y1 }, { id: 'p2', x: el.x2, y: el.y2 }]
  const b = getBounds(el)
  const l = b.x - HANDLE_PAD
  const r = b.x + b.width + HANDLE_PAD
  const t = b.y - HANDLE_PAD
  const bt = b.y + b.height + HANDLE_PAD
  const cx = (l + r) / 2
  const cy = (t + bt) / 2
  const corners = [{ id: 'nw', x: l, y: t }, { id: 'ne', x: r, y: t }, { id: 'se', x: r, y: bt }, { id: 'sw', x: l, y: bt }]
  if (LOCK_ASPECT.has(el.type)) return corners
  return [...corners, { id: 'n', x: cx, y: t }, { id: 'e', x: r, y: cy }, { id: 's', x: cx, y: bt }, { id: 'w', x: l, y: cy }]
}

export function hitHandle(el, px, py, radius) {
  let best = null
  let bestDist = radius
  for (const h of getHandles(el)) {
    const d = Math.hypot(px - h.x, py - h.y)
    if (d <= bestDist) {
      best = h.id
      bestDist = d
    }
  }
  return best
}

export const HANDLE_CURSORS = {
  nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', p1: 'crosshair', p2: 'crosshair',
}

export function applyOffsetToElement(el, dx, dy) {
  const clone = JSON.parse(JSON.stringify(el))
  if (clone.type === 'draw') {
    clone.points = clone.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
  } else if (isLineType(clone.type)) {
    clone.x1 += dx
    clone.y1 += dy
    clone.x2 += dx
    clone.y2 += dy
  } else {
    clone.x += dx
    clone.y += dy
  }
  return clone
}

function mapToBounds(el, from, to) {
  const clone = JSON.parse(JSON.stringify(el))
  if (clone.type === 'draw') {
    const sx = to.width / from.width
    const sy = to.height / from.height
    clone.points = clone.points.map(p => ({ x: to.x + (p.x - from.x) * sx, y: to.y + (p.y - from.y) * sy }))
  } else {
    clone.x = to.x
    clone.y = to.y
    clone.width = to.width
    clone.height = to.height
  }
  return clone
}

// Resizes `init` by dragging `handle` to the pointer position (px, py).
export function resizeElement(init, handle, px, py) {
  if (isLineType(init.type)) {
    const clone = JSON.parse(JSON.stringify(init))
    if (handle === 'p1') { clone.x1 = px; clone.y1 = py } else { clone.x2 = px; clone.y2 = py }
    return clone
  }
  const b = getBounds(init)
  let l = b.x
  let r = b.x + b.width
  let t = b.y
  let bt = b.y + b.height
  if (handle.includes('w')) l = Math.min(px + HANDLE_PAD, r - MIN_SIZE)
  if (handle.includes('e')) r = Math.max(px - HANDLE_PAD, l + MIN_SIZE)
  if (handle.includes('n')) t = Math.min(py + HANDLE_PAD, bt - MIN_SIZE)
  if (handle.includes('s')) bt = Math.max(py - HANDLE_PAD, t + MIN_SIZE)

  if (LOCK_ASPECT.has(init.type)) {
    const scale = Math.max((r - l) / b.width, (bt - t) / b.height, MIN_SIZE / Math.min(b.width, b.height))
    const w = b.width * scale
    const h = b.height * scale
    if (handle.includes('w')) l = r - w; else r = l + w
    if (handle.includes('n')) t = bt - h; else bt = t + h
  }
  return mapToBounds(init, b, { x: l, y: t, width: r - l, height: bt - t })
}

export function drawSelection(ctx, el) {
  ctx.save()
  ctx.strokeStyle = '#007aff'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = 1.5
  if (!isLineType(el.type)) {
    const b = getBounds(el)
    ctx.setLineDash([5, 4])
    ctx.strokeRect(b.x - HANDLE_PAD, b.y - HANDLE_PAD, b.width + HANDLE_PAD * 2, b.height + HANDLE_PAD * 2)
    ctx.setLineDash([])
  }
  for (const h of getHandles(el)) {
    ctx.beginPath()
    if (isLineType(el.type)) ctx.arc(h.x, h.y, 5.5, 0, Math.PI * 2)
    else ctx.rect(h.x - 4.5, h.y - 4.5, 9, 9)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}
