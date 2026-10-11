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
   BOUNDS, HIT-TESTING & TRANSLATION HELPERS
   ========================================================================= */

function getElementBounds(el) {
  if (el.type === 'draw') {
    if (!el.points || el.points.length === 0) return { x: 0, y: 0, width: 20, height: 20 }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of el.points) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    return { x: minX, y: minY, width: Math.max(maxX - minX, 10), height: Math.max(maxY - minY, 10) }
  } else if (el.type === 'line' || el.type === 'arrow') {
    const minX = Math.min(el.x1, el.x2)
    const minY = Math.min(el.y1, el.y2)
    const maxX = Math.max(el.x1, el.x2)
    const maxY = Math.max(el.y1, el.y2)
    return { x: minX, y: minY, width: Math.max(maxX - minX, 10), height: Math.max(maxY - minY, 10) }
  } else {
    return { x: el.x, y: el.y, width: el.width, height: el.height }
  }
}

function distToSegment(p, v, w) {
  const lengthSquared = (v.x - w.x) ** 2 + (v.y - w.y) ** 2
  if (lengthSquared === 0) return Math.hypot(p.x - v.x, p.y - v.y)
  const t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / lengthSquared))
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)))
}

export function isPointInsideElement(px, py, el) {
  const padding = 14
  if (el.type === 'draw') {
    if (!el.points || el.points.length < 2) return false
    const bounds = getElementBounds(el)
    if (px < bounds.x - padding || px > bounds.x + bounds.width + padding ||
        py < bounds.y - padding || py > bounds.y + bounds.height + padding) {
      return false
    }
    // Check distance to points/segments
    for (let i = 0; i < el.points.length - 1; i++) {
      const d = distToSegment({ x: px, y: py }, el.points[i], el.points[i + 1])
      if (d <= padding + (el.lineWidth || 3)) return true
    }
    return false
  } else if (el.type === 'line' || el.type === 'arrow') {
    const d = distToSegment({ x: px, y: py }, { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 })
    return d <= padding + (el.lineWidth || 3)
  } else {
    // Shapes and 3D shapes
    const bounds = getElementBounds(el)
    return (
      px >= bounds.x - padding &&
      px <= bounds.x + bounds.width + padding &&
      py >= bounds.y - padding &&
      py <= bounds.y + bounds.height + padding
    )
  }
}

export function applyOffsetToElement(el, dx, dy) {
  const clone = JSON.parse(JSON.stringify(el))
  if (clone.type === 'draw') {
    clone.points = clone.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
  } else if (clone.type === 'line' || clone.type === 'arrow') {
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

export function drawSelectionBox(ctx, el) {
  const bounds = getElementBounds(el)
  ctx.save()
  ctx.strokeStyle = '#007aff'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  ctx.strokeRect(bounds.x - 6, bounds.y - 6, bounds.width + 12, bounds.height + 12)

  // Draw 4 corner handles
  ctx.fillStyle = '#007aff'
  ctx.setLineDash([])
  const handleSize = 6
  const corners = [
    { x: bounds.x - 6, y: bounds.y - 6 },
    { x: bounds.x + bounds.width + 6, y: bounds.y - 6 },
    { x: bounds.x - 6, y: bounds.y + bounds.height + 6 },
    { x: bounds.x + bounds.width + 6, y: bounds.y + bounds.height + 6 }
  ]
  corners.forEach(c => {
    ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize)
  })

  ctx.restore()
}

/* =========================================================================
   SVG ICONS HELPER
   ========================================================================= */

export function ShapeIcon({ shape, size = 20 }) {
  if (shape === 'cube') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    )
  }
  if (shape === 'cylinder') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      </svg>
    )
  }
  if (shape === 'cone') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 L3 19 C3 20.5 7 21.5 12 21.5 C17 21.5 21 20.5 21 19 Z" />
      </svg>
    )
  }
  if (shape === 'sphere') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="9" ry="3.5" />
      </svg>
    )
  }
  if (shape === 'pyramid') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 L2 18 L16 22 L22 17 Z" />
        <line x1="12" y1="2" x2="16" y2="22" />
      </svg>
    )
  }
  if (shape === 'prism') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20 L16 20 L10 7 Z" />
        <path d="M10 7 L17 4 L22 16 L16 20" />
      </svg>
    )
  }
  if (shape === 'line') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="4" y1="20" x2="20" y2="4" />
      </svg>
    )
  }
  if (shape === 'arrow') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="19" x2="19" y2="5" />
        <polyline points="10 5 19 5 19 14" />
      </svg>
    )
  }
  if (shape === 'rect') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2" />
      </svg>
    )
  }
  if (shape === 'circle') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
      </svg>
    )
  }
  if (shape === 'ellipse') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="12" rx="10" ry="6" />
      </svg>
    )
  }
  if (shape === 'triangle') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      </svg>
    )
  }
  if (shape === 'right-triangle') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 20h16L4 4v16z" />
      </svg>
    )
  }
  if (shape === 'axes') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M22 12l-3-3M22 12l-3 3" />
      </svg>
    )
  }
  return null
}

export function getShapeName(shape) {
  const map = {
    cube: 'Kub',
    cylinder: 'Silindr',
    cone: 'Konus',
    sphere: 'Sfera',
    pyramid: 'Piramida',
    prism: 'Prizma',
    line: 'Chiziq',
    arrow: 'Strelka',
    rect: 'To\'rtburchak',
    circle: 'Aylana',
    ellipse: 'Ellips',
    triangle: 'Uchburchak',
    'right-triangle': 'To\'g\'ri burchak',
    axes: 'XY O\'qlari'
  }
  return map[shape] || shape
}
