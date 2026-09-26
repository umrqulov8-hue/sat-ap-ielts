import React, { useRef, useState, useEffect, useCallback } from 'react'

// Global cache so drawn items survive unmounting/remounting
let persistedElementsCache = []
try {
  const saved = sessionStorage.getItem('satap_drawing_elements')
  if (saved) {
    persistedElementsCache = JSON.parse(saved)
  }
} catch (e) {
  console.error('Failed to load drawing cache', e)
}

function distToSegment(p, v, w) {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y)
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y)
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)))
}

function normalizeRect(x1, y1, x2, y2) {
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const width = Math.max(Math.abs(x2 - x1), 8)
  const height = Math.max(Math.abs(y2 - y1), 8)
  return { x, y, width, height }
}

export default function DrawingCanvas({ isOpen = true, onClose, onOpen }) {
  const canvasRef = useRef(null)
  const [elements, setElements] = useState(() => persistedElementsCache)
  const [history, setHistory] = useState([])
  const [tool, setTool] = useState('select') // select, draw, eraser, shapes
  const [shapeCategory, setShapeCategory] = useState('3d') // '2d' | '3d'
  const [currentShape, setCurrentShape] = useState('cube')
  const [color, setColor] = useState('#007aff')
  const [lineWidth, setLineWidth] = useState(3)
  const [showShapes, setShowShapes] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  
  // Dragging / Drawing state refs to avoid state sync lag
  const isInteracting = useRef(false)
  const interactionMode = useRef(null) // 'draw' | 'create-shape' | 'drag-element' | 'erasing'
  const dragStartPos = useRef({ x: 0, y: 0 })
  const currentDragPos = useRef({ x: 0, y: 0 })
  const activeStrokeRef = useRef(null)
  const tempShapeRef = useRef(null)
  const draggedElementInitial = useRef(null)

  // Sync to cache and session storage
  useEffect(() => {
    persistedElementsCache = elements
    try {
      sessionStorage.setItem('satap_drawing_elements', JSON.stringify(elements))
    } catch (e) {
      // storage error ignore
    }
  }, [elements])

  // Canvas redraw trigger
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Render all committed elements
    elements.forEach(el => {
      renderElement(ctx, el, el.id === selectedId)
    })

    // Render in-progress drawing stroke
    if (activeStrokeRef.current) {
      renderElement(ctx, activeStrokeRef.current, false)
    }

    // Render in-progress shape preview
    if (tempShapeRef.current) {
      renderElement(ctx, tempShapeRef.current, false, true)
    }

    // Draw selection highlight if in select mode
    if (selectedId && isOpen) {
      const selectedEl = elements.find(e => e.id === selectedId)
      if (selectedEl) {
        drawSelectionBox(ctx, selectedEl)
      }
    }
  }, [elements, selectedId, isOpen])

  // Resize listener
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      redrawCanvas()
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [redrawCanvas])

  useEffect(() => {
    redrawCanvas()
  }, [redrawCanvas])

  // Keyboard shortcut: Delete / Backspace removes selected element
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Prevent deleting if focus is inside an input/textarea
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
        setHistory(prev => [...prev, elements])
        setElements(prev => prev.filter(el => el.id !== selectedId))
        setSelectedId(null)
      }
      if (e.key === 'Escape') {
        setSelectedId(null)
        setShowShapes(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedId, elements])

  // Hit-testing helper
  const getElementAtPosition = useCallback((x, y) => {
    // Reverse order so topmost element is selected first
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i]
      if (isPointInsideElement(x, y, el)) {
        return el
      }
    }
    return null
  }, [elements])

  // Mouse / Touch coordinate getter
  const getCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  // Pointer interactions
  const handlePointerDown = (e) => {
    if (!isOpen) return
    if (e.target.closest('.draw-toolbar') || e.target.closest('.shape-picker-menu') || e.target.closest('.draw-quick-actions')) {
      return
    }

    const { x, y } = getCoords(e)
    isInteracting.current = true
    dragStartPos.current = { x, y }
    currentDragPos.current = { x, y }

    if (tool === 'eraser') {
      interactionMode.current = 'erasing'
      eraseAtPoint(x, y)
    } else if (tool === 'select') {
      const hit = getElementAtPosition(x, y)
      if (hit) {
        setSelectedId(hit.id)
        interactionMode.current = 'drag-element'
        draggedElementInitial.current = JSON.parse(JSON.stringify(hit))
      } else {
        setSelectedId(null)
        interactionMode.current = null
      }
    } else if (tool === 'draw') {
      interactionMode.current = 'draw'
      activeStrokeRef.current = {
        id: 'stroke_' + Date.now(),
        type: 'draw',
        points: [{ x, y }],
        color,
        lineWidth
      }
      setSelectedId(null)
    } else if (tool === 'shape') {
      interactionMode.current = 'create-shape'
      tempShapeRef.current = {
        id: 'shape_' + Date.now(),
        type: currentShape,
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        color,
        lineWidth
      }
      setSelectedId(null)
    }

    redrawCanvas()
    if (e.cancelable && e.type.startsWith('touch')) e.preventDefault()
  }

  const handlePointerMove = (e) => {
    if (!isOpen) return
    const { x, y } = getCoords(e)
    currentDragPos.current = { x, y }

    // Hover effect when in select mode
    if (tool === 'select' && !isInteracting.current) {
      const hit = getElementAtPosition(x, y)
      setHoveredId(hit ? hit.id : null)
    }

    if (!isInteracting.current) return

    if (interactionMode.current === 'erasing') {
      eraseAtPoint(x, y)
    } else if (interactionMode.current === 'drag-element') {
      const dx = x - dragStartPos.current.x
      const dy = y - dragStartPos.current.y
      if (selectedId && draggedElementInitial.current) {
        const init = draggedElementInitial.current
        setElements(prev => prev.map(el => {
          if (el.id !== selectedId) return el
          return applyOffsetToElement(init, dx, dy)
        }))
      }
    } else if (interactionMode.current === 'draw') {
      if (activeStrokeRef.current) {
        activeStrokeRef.current.points.push({ x, y })
        redrawCanvas()
      }
    } else if (interactionMode.current === 'create-shape') {
      if (tempShapeRef.current) {
        tempShapeRef.current.x2 = x
        tempShapeRef.current.y2 = y
        redrawCanvas()
      }
    }

    if (e.cancelable && e.type.startsWith('touch')) e.preventDefault()
  }

  const handlePointerUp = () => {
    if (!isInteracting.current) return
    isInteracting.current = false

    if (interactionMode.current === 'draw' && activeStrokeRef.current) {
      if (activeStrokeRef.current.points.length > 1) {
        setHistory(prev => [...prev, elements])
        setElements(prev => [...prev, activeStrokeRef.current])
      }
      activeStrokeRef.current = null
    } else if (interactionMode.current === 'create-shape' && tempShapeRef.current) {
      const shape = tempShapeRef.current
      const dx = Math.abs(shape.x2 - shape.x1)
      const dy = Math.abs(shape.y2 - shape.y1)
      
      // Ensure shape has meaningful size
      if (dx > 5 || dy > 5) {
        let finalShape = null
        if (shape.type === 'line' || shape.type === 'arrow') {
          finalShape = {
            id: shape.id,
            type: shape.type,
            x1: shape.x1,
            y1: shape.y1,
            x2: shape.x2,
            y2: shape.y2,
            color: shape.color,
            lineWidth: shape.lineWidth
          }
        } else {
          const norm = normalizeRect(shape.x1, shape.y1, shape.x2, shape.y2)
          finalShape = {
            id: shape.id,
            type: shape.type,
            x: norm.x,
            y: norm.y,
            width: norm.width,
            height: norm.height,
            color: shape.color,
            lineWidth: shape.lineWidth
          }
        }
        setHistory(prev => [...prev, elements])
        setElements(prev => [...prev, finalShape])
        // Automatically switch to select tool to allow immediate moving
        setSelectedId(finalShape.id)
        setTool('select')
      }
      tempShapeRef.current = null
    } else if (interactionMode.current === 'drag-element') {
      if (draggedElementInitial.current) {
        setHistory(prev => [...prev, elements])
      }
      draggedElementInitial.current = null
    }

    interactionMode.current = null
    redrawCanvas()
  }

  const eraseAtPoint = (x, y) => {
    const hit = getElementAtPosition(x, y)
    if (hit) {
      setHistory(prev => [...prev, elements])
      setElements(prev => prev.filter(el => el.id !== hit.id))
      if (selectedId === hit.id) setSelectedId(null)
    }
  }

  const handleUndo = () => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, h.length - 1))
    setElements(prev)
    setSelectedId(null)
  }

  const handleClearAll = () => {
    if (elements.length === 0) return
    if (window.confirm("Barcha chizilgan shakllar va chiziqlarni tozalashni xohlaysizmi?")) {
      setHistory(prev => [...prev, elements])
      setElements([])
      setSelectedId(null)
    }
  }

  const handleDeleteSelected = () => {
    if (!selectedId) return
    setHistory(prev => [...prev, elements])
    setElements(prev => prev.filter(el => el.id !== selectedId))
    setSelectedId(null)
  }

  // Quick color change for selected element
  const handleColorChange = (c) => {
    setColor(c)
    if (selectedId) {
      setElements(prev => prev.map(el => el.id === selectedId ? { ...el, color: c } : el))
    }
  }

  // Get cursor based on active tool and state
  let canvasCursor = 'crosshair'
  if (!isOpen) {
    canvasCursor = 'default'
  } else if (tool === 'eraser') {
    canvasCursor = 'not-allowed'
  } else if (tool === 'select') {
    canvasCursor = hoveredId ? 'move' : 'default'
  }

  // Get selected element coordinates for floating badge
  const selectedElement = elements.find(e => e.id === selectedId)
  const selectedBounds = selectedElement ? getElementBounds(selectedElement) : null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      {/* FULLSCREEN CANVAS — ALWAYS PRESENT TO KEEP DRAWINGS VISIBLE */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          touchAction: 'none',
          pointerEvents: isOpen ? 'auto' : 'none',
          cursor: canvasCursor
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
      />

      {/* FLOATING RESTORE PILL WHEN DRAW TOOL IS CLOSED (X CLICKED) */}
      {!isOpen && (
        <button
          onClick={() => {
            if (onOpen) onOpen()
          }}
          style={{
            position: 'absolute',
            top: '16px',
            right: '180px',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(26, 31, 54, 0.92)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: '8px 16px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            animation: 'fadeInDown 0.25s ease-out'
          }}
          title="Chizish panelini ochish"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
          <span>Chizish paneli ({elements.length})</span>
        </button>
      )}

      {/* FLOATING ACTION TOOLTIP FOR SELECTED ELEMENT */}
      {isOpen && selectedBounds && (
        <div
          className="draw-quick-actions"
          style={{
            position: 'absolute',
            left: `${selectedBounds.x + selectedBounds.width / 2}px`,
            top: `${Math.max(20, selectedBounds.y - 42)}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: '#141829',
            padding: '4px 8px',
            borderRadius: '16px',
            boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.15)',
            zIndex: 10000,
            fontSize: '11px',
            color: '#cbd5e1',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ opacity: 0.8, marginRight: '4px' }}>✥ Surish mumkin</span>
          <button
            onClick={handleDeleteSelected}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '3px 8px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Ushbu shaklni o'chirish"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            O'chirish
          </button>
        </div>
      )}

      {/* MAIN DRAW TOOLBAR */}
      {isOpen && (
        <div
          className="draw-toolbar"
          style={{
            position: 'absolute',
            top: '18px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(26, 31, 54, 0.95)',
            padding: '8px 16px',
            borderRadius: '32px',
            boxShadow: '0 10px 32px rgba(0,0,0,0.45)',
            pointerEvents: 'auto',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#fff',
            backdropFilter: 'blur(12px)',
            userSelect: 'none',
            zIndex: 10000
          }}
        >
          {/* LOGO / LABEL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.8px', color: '#007aff' }}>DRAW</span>
          </div>

          {/* COLOR PALETTE */}
          <div style={{ display: 'flex', gap: '6px', paddingRight: '10px', borderRight: '1px solid rgba(255,255,255,0.12)' }}>
            {['#007aff', '#ff3b30', '#34c759', '#af52de', '#ffffff', '#000000'].map(c => (
              <button
                key={c}
                onClick={() => handleColorChange(c)}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: c,
                  border: color === c ? '2.5px solid #fff' : c === '#000000' ? '1px solid #555' : '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.15s ease'
                }}
                title={`Rang: ${c}`}
              />
            ))}
          </div>

          {/* SELECT & MOVE TOOL */}
          <button
            onClick={() => {
              setTool('select')
              setShowShapes(false)
            }}
            style={{
              background: tool === 'select' ? '#007aff' : 'transparent',
              color: tool === 'select' ? '#fff' : '#cbd5e1',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
            title="Tanlash va surish (har qanday shakl yoki chiziqni siljitish)"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
            </svg>
            <span>Surish</span>
          </button>

          {/* FREEHAND DRAW TOOL */}
          <button
            onClick={() => {
              setTool('draw')
              setSelectedId(null)
              setShowShapes(false)
            }}
            style={{
              background: tool === 'draw' ? '#007aff' : 'transparent',
              color: tool === 'draw' ? '#fff' : '#cbd5e1',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
            title="Erkin chizish (qalam)"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            <span>Chizish</span>
          </button>

          {/* SHAPES DROPDOWN (2D & 3D) */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowShapes(!showShapes)}
              style={{
                background: tool === 'shape' ? '#007aff' : showShapes ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: tool === 'shape' ? '#fff' : '#cbd5e1',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.15s ease'
              }}
              title="Shakllar (3D va 2D shakllar)"
            >
              {/* Active shape preview icon */}
              <ShapeIcon shape={currentShape} size={17} />
              <span style={{ textTransform: 'capitalize' }}>
                {getShapeName(currentShape)}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* SHAPES PICKER POPOVER */}
            {showShapes && (
              <div
                className="shape-picker-menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 12px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#161b2e',
                  border: '1px solid rgba(255,255,255,0.16)',
                  borderRadius: '16px',
                  padding: '14px',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
                  width: '320px',
                  zIndex: 10001,
                  animation: 'fadeInDown 0.18s ease-out'
                }}
              >
                {/* CATEGORY TABS (3D vs 2D) */}
                <div
                  style={{
                    display: 'flex',
                    background: 'rgba(0,0,0,0.25)',
                    padding: '3px',
                    borderRadius: '10px',
                    marginBottom: '12px'
                  }}
                >
                  <button
                    onClick={() => setShapeCategory('3d')}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      border: 'none',
                      borderRadius: '8px',
                      background: shapeCategory === '3d' ? '#007aff' : 'transparent',
                      color: shapeCategory === '3d' ? '#fff' : '#94a3b8',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>🧊 3D Shakllar</span>
                  </button>
                  <button
                    onClick={() => setShapeCategory('2d')}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      border: 'none',
                      borderRadius: '8px',
                      background: shapeCategory === '2d' ? '#007aff' : 'transparent',
                      color: shapeCategory === '2d' ? '#fff' : '#94a3b8',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>📐 2D Shakllar</span>
                  </button>
                </div>

                {/* 3D SHAPES GRID */}
                {shapeCategory === '3d' && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
                      SAT/Math 3D Geometrik Shakllar:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {[
                        { id: 'cube', label: 'Kub (Box)', icon: 'cube' },
                        { id: 'cylinder', label: 'Silindr', icon: 'cylinder' },
                        { id: 'cone', label: 'Konus', icon: 'cone' },
                        { id: 'sphere', label: 'Sfera', icon: 'sphere' },
                        { id: 'pyramid', label: 'Piramida', icon: 'pyramid' },
                        { id: 'prism', label: 'Prizma', icon: 'prism' }
                      ].map(s => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setCurrentShape(s.id)
                            setTool('shape')
                            setSelectedId(null)
                            setShowShapes(false)
                          }}
                          style={{
                            background: currentShape === s.id && tool === 'shape' ? '#007aff' : 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px',
                            padding: '10px 4px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '6px',
                            color: '#fff',
                            transition: 'all 0.15s'
                          }}
                        >
                          <ShapeIcon shape={s.id} size={26} />
                          <span style={{ fontSize: '11px', fontWeight: 500 }}>{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2D SHAPES GRID */}
                {shapeCategory === '2d' && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
                      2D Geometriya va Chiziqlar:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      {[
                        { id: 'line', label: 'Chiziq' },
                        { id: 'arrow', label: 'Strelka' },
                        { id: 'rect', label: 'To\'rtburchak' },
                        { id: 'circle', label: 'Aylana' },
                        { id: 'ellipse', label: 'Ellips' },
                        { id: 'triangle', label: 'Uchburchak' },
                        { id: 'right-triangle', label: 'To\'g\'ri burchak' },
                        { id: 'axes', label: 'XY O\'qlari' }
                      ].map(s => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setCurrentShape(s.id)
                            setTool('shape')
                            setSelectedId(null)
                            setShowShapes(false)
                          }}
                          style={{
                            background: currentShape === s.id && tool === 'shape' ? '#007aff' : 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px',
                            padding: '8px 2px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#fff',
                            transition: 'all 0.15s'
                          }}
                        >
                          <ShapeIcon shape={s.id} size={20} />
                          <span style={{ fontSize: '10px', textAlign: 'center', lineHeight: 1.2 }}>{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STROKE WIDTH TOGGLE */}
          <div style={{ display: 'flex', gap: '3px', paddingLeft: '4px', paddingRight: '10px', borderRight: '1px solid rgba(255,255,255,0.12)' }}>
            {[2, 4, 7].map(w => (
              <button
                key={w}
                onClick={() => setLineWidth(w)}
                style={{
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: lineWidth === w ? 'rgba(255,255,255,0.2)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
                title={`Qalinlik: ${w}px`}
              >
                <div style={{ width: `${w * 2 + 2}px`, height: `${w * 2 + 2}px`, borderRadius: '50%', background: '#fff' }} />
              </button>
            ))}
          </div>

          {/* UNDO BUTTON */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 8px',
              cursor: history.length === 0 ? 'not-allowed' : 'pointer',
              color: history.length === 0 ? '#64748b' : '#cbd5e1'
            }}
            title="Orqaga qaytarish (Undo)"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </button>

          {/* ERASER BUTTON */}
          <button
            onClick={() => {
              setTool('eraser')
              setSelectedId(null)
              setShowShapes(false)
            }}
            style={{
              background: tool === 'eraser' ? '#ff3b30' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 8px',
              cursor: 'pointer',
              color: tool === 'eraser' ? '#fff' : '#cbd5e1'
            }}
            title="O'chirg'ich (ustiga bosib o'chirish)"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20H20V20Z" />
            </svg>
          </button>

          {/* CLEAR ALL (TRASH CAN) — ONLY THIS WILL CLEAR ALL DRAWINGS */}
          <button
            onClick={handleClearAll}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 8px',
              cursor: 'pointer',
              color: '#ef4444'
            }}
            title="Hammasini tozalash (faqat shuni bosganda o'chadi)"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

          {/* CLOSE (X) BUTTON — WILL NEVER DELETE DRAWINGS! */}
          <button
            onClick={() => {
              setShowShapes(false)
              setSelectedId(null)
              if (onClose) onClose()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              width: '26px',
              height: '26px',
              transition: 'transform 0.15s ease'
            }}
            title="Chizish rejimini yopish (chizilganlar saqlanib qoladi)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   ELEMENT RENDERING FUNCTIONS
   ========================================================================= */

function renderElement(ctx, el, isSelected = false, isPreview = false) {
  ctx.save()
  ctx.strokeStyle = el.color
  ctx.lineWidth = el.lineWidth || 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (isPreview) {
    ctx.globalAlpha = 0.7
  }

  const { type } = el

  if (type === 'draw') {
    if (el.points && el.points.length > 0) {
      ctx.beginPath()
      ctx.moveTo(el.points[0].x, el.points[0].y)
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo(el.points[i].x, el.points[i].y)
      }
      ctx.stroke()
    }
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
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(el.x2, el.y2)
    ctx.lineTo(el.x2 - headlen * Math.cos(angle - Math.PI / 6), el.y2 - headlen * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(el.x2, el.y2)
    ctx.lineTo(el.x2 - headlen * Math.cos(angle + Math.PI / 6), el.y2 - headlen * Math.sin(angle + Math.PI / 6))
    ctx.stroke()
  } else if (type === 'rect') {
    const norm = el.width !== undefined ? el : normalizeRect(el.x1, el.y1, el.x2, el.y2)
    ctx.beginPath()
    ctx.rect(norm.x, norm.y, norm.width, norm.height)
    ctx.stroke()
  } else if (type === 'circle') {
    const norm = el.width !== undefined ? el : normalizeRect(el.x1, el.y1, el.x2, el.y2)
    const radius = Math.min(norm.width, norm.height) / 2
    ctx.beginPath()
    ctx.arc(norm.x + norm.width / 2, norm.y + norm.height / 2, radius, 0, 2 * Math.PI)
    ctx.stroke()
  } else if (type === 'ellipse') {
    const norm = el.width !== undefined ? el : normalizeRect(el.x1, el.y1, el.x2, el.y2)
    ctx.beginPath()
    ctx.ellipse(norm.x + norm.width / 2, norm.y + norm.height / 2, norm.width / 2, norm.height / 2, 0, 0, 2 * Math.PI)
    ctx.stroke()
  } else if (type === 'triangle') {
    const norm = el.width !== undefined ? el : normalizeRect(el.x1, el.y1, el.x2, el.y2)
    ctx.beginPath()
    ctx.moveTo(norm.x + norm.width / 2, norm.y)
    ctx.lineTo(norm.x + norm.width, norm.y + norm.height)
    ctx.lineTo(norm.x, norm.y + norm.height)
    ctx.closePath()
    ctx.stroke()
  } else if (type === 'right-triangle') {
    const norm = el.width !== undefined ? el : normalizeRect(el.x1, el.y1, el.x2, el.y2)
    ctx.beginPath()
    ctx.moveTo(norm.x, norm.y)
    ctx.lineTo(norm.x, norm.y + norm.height)
    ctx.lineTo(norm.x + norm.width, norm.y + norm.height)
    ctx.closePath()
    ctx.stroke()

    // Right angle corner symbol
    const markSize = Math.min(14, norm.width * 0.2, norm.height * 0.2)
    ctx.beginPath()
    ctx.moveTo(norm.x, norm.y + norm.height - markSize)
    ctx.lineTo(norm.x + markSize, norm.y + norm.height - markSize)
    ctx.lineTo(norm.x + markSize, norm.y + norm.height)
    ctx.stroke()
  } else if (type === 'axes') {
    const norm = el.width !== undefined ? el : normalizeRect(el.x1, el.y1, el.x2, el.y2)
    const midX = norm.x + norm.width / 2
    const midY = norm.y + norm.height / 2
    ctx.beginPath()
    // X axis
    ctx.moveTo(norm.x, midY)
    ctx.lineTo(norm.x + norm.width, midY)
    // Y axis
    ctx.moveTo(midX, norm.y + norm.height)
    ctx.lineTo(midX, norm.y)
    ctx.stroke()

    // Arrowheads for axes
    const aLen = 8
    ctx.beginPath()
    // X arrow
    ctx.moveTo(norm.x + norm.width - aLen, midY - 5)
    ctx.lineTo(norm.x + norm.width, midY)
    ctx.lineTo(norm.x + norm.width - aLen, midY + 5)
    // Y arrow
    ctx.moveTo(midX - 5, norm.y + aLen)
    ctx.lineTo(midX, norm.y)
    ctx.lineTo(midX + 5, norm.y + aLen)
    ctx.stroke()
  } 
  /* --- 3D SHAPES --- */
  else if (type === 'cube') {
    const norm = el.width !== undefined ? el : normalizeRect(el.x1, el.y1, el.x2, el.y2)
    drawCube(ctx, norm.x, norm.y, norm.width, norm.height, el.color, el.lineWidth)
  } else if (type === 'cylinder') {
    const norm = el.width !== undefined ? el : normalizeRect(el.x1, el.y1, el.x2, el.y2)
    drawCylinder(ctx, norm.x, norm.y, norm.width, norm.height, el.color, el.lineWidth)
  } else if (type === 'cone') {
    const norm = el.width !== undefined ? el : normalizeRect(el.x1, el.y1, el.x2, el.y2)
    drawCone(ctx, norm.x, norm.y, norm.width, norm.height, el.color, el.lineWidth)
  } else if (type === 'sphere') {
    const norm = el.width !== undefined ? el : normalizeRect(el.x1, el.y1, el.x2, el.y2)
    drawSphere(ctx, norm.x, norm.y, norm.width, norm.height, el.color, el.lineWidth)
  } else if (type === 'pyramid') {
    const norm = el.width !== undefined ? el : normalizeRect(el.x1, el.y1, el.x2, el.y2)
    drawPyramid(ctx, norm.x, norm.y, norm.width, norm.height, el.color, el.lineWidth)
  } else if (type === 'prism') {
    const norm = el.width !== undefined ? el : normalizeRect(el.x1, el.y1, el.x2, el.y2)
    drawPrism(ctx, norm.x, norm.y, norm.width, norm.height, el.color, el.lineWidth)
  }

  ctx.restore()
}

/* =========================================================================
   3D RENDERING IMPLEMENTATIONS
   ========================================================================= */

function drawCube(ctx, x, y, w, h, color, lineWidth) {
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

function drawCylinder(ctx, x, y, w, h, color, lineWidth) {
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

function drawCone(ctx, x, y, w, h, color, lineWidth) {
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

function drawSphere(ctx, x, y, w, h, color, lineWidth) {
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

function drawPyramid(ctx, x, y, w, h, color, lineWidth) {
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

function drawPrism(ctx, x, y, w, h, color, lineWidth) {
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

function isPointInsideElement(px, py, el) {
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

function applyOffsetToElement(el, dx, dy) {
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

function drawSelectionBox(ctx, el) {
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

function ShapeIcon({ shape, size = 20 }) {
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

function getShapeName(shape) {
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
