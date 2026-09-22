import { useRef, useState, useEffect } from 'react'

export default function DrawingCanvas({ onClose }) {
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#007aff')
  const [lineWidth, setLineWidth] = useState(3)
  const [tool, setTool] = useState('draw') // draw, eraser, line, arrow, rect, circle, ellipse, triangle, right-triangle, axes
  const [startPos, setStartPos] = useState(null)
  const [showShapes, setShowShapes] = useState(false)
  const savedImageData = useRef(null)
  
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const ctx = canvas.getContext('2d')
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctxRef.current = ctx

    const handleResize = () => {
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      const tCtx = tempCanvas.getContext('2d')
      tCtx.drawImage(canvas, 0, 0)

      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.drawImage(tempCanvas, 0, 0)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!ctxRef.current) return
    ctxRef.current.strokeStyle = color
    ctxRef.current.lineWidth = tool === 'eraser' ? 20 : lineWidth
    ctxRef.current.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
  }, [color, lineWidth, tool])

  const getCoordinates = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    return { x: e.clientX, y: e.clientY }
  }

  const startDrawing = (e) => {
    if (e.target.closest('.draw-toolbar')) return // Prevent drawing when clicking toolbar
    setIsDrawing(true)
    setShowShapes(false) // Close shapes dropdown if open
    const { x, y } = getCoordinates(e)
    setStartPos({ x, y })
    
    if (tool === 'draw' || tool === 'eraser') {
      ctxRef.current.beginPath()
      ctxRef.current.moveTo(x, y)
    } else {
      savedImageData.current = ctxRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
    if (e.cancelable) e.preventDefault()
  }

  const draw = (e) => {
    if (!isDrawing) return
    const { x, y } = getCoordinates(e)
    
    if (tool === 'draw' || tool === 'eraser') {
      ctxRef.current.lineTo(x, y)
      ctxRef.current.stroke()
    } else if (startPos && savedImageData.current) {
      const ctx = ctxRef.current
      ctx.putImageData(savedImageData.current, 0, 0)
      ctx.beginPath()
      
      const width = x - startPos.x
      const height = y - startPos.y

      if (tool === 'line') {
        ctx.moveTo(startPos.x, startPos.y)
        ctx.lineTo(x, y)
      } else if (tool === 'arrow') {
        const headlen = 15
        const angle = Math.atan2(y - startPos.y, x - startPos.x)
        ctx.moveTo(startPos.x, startPos.y)
        ctx.lineTo(x, y)
        ctx.lineTo(x - headlen * Math.cos(angle - Math.PI / 6), y - headlen * Math.sin(angle - Math.PI / 6))
        ctx.moveTo(x, y)
        ctx.lineTo(x - headlen * Math.cos(angle + Math.PI / 6), y - headlen * Math.sin(angle + Math.PI / 6))
      } else if (tool === 'rect') {
        ctx.rect(startPos.x, startPos.y, width, height)
      } else if (tool === 'circle') {
        const radius = Math.sqrt(width * width + height * height)
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI)
      } else if (tool === 'ellipse') {
        const midX = startPos.x + width / 2
        const midY = startPos.y + height / 2
        ctx.ellipse(midX, midY, Math.abs(width / 2), Math.abs(height / 2), 0, 0, 2 * Math.PI)
      } else if (tool === 'triangle') {
        ctx.moveTo(startPos.x + width / 2, startPos.y)
        ctx.lineTo(x, y)
        ctx.lineTo(startPos.x, y)
        ctx.closePath()
      } else if (tool === 'right-triangle') {
        ctx.moveTo(startPos.x, startPos.y)
        ctx.lineTo(startPos.x, y)
        ctx.lineTo(x, y)
        ctx.closePath()
      } else if (tool === 'axes') {
        const midX = startPos.x + width / 2
        const midY = startPos.y + height / 2
        ctx.moveTo(startPos.x, midY)
        ctx.lineTo(x, midY)
        ctx.moveTo(midX, startPos.y)
        ctx.lineTo(midX, y)
      }
      ctx.stroke()
    }
    if (e.cancelable) e.preventDefault()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    if (tool === 'draw' || tool === 'eraser') {
      ctxRef.current.closePath()
    } else {
      savedImageData.current = null
      setStartPos(null)
    }
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    if (!canvasRef.current || !ctxRef.current) return
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  const ShapeButton = ({ t, icon, title }) => (
    <button 
      onClick={() => { setTool(t); setShowShapes(false) }} 
      style={{
        background: tool === t ? 'rgba(0,122,255,0.15)' : 'transparent',
        border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer',
        color: tool === t ? '#007aff' : '#a1a1aa',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s'
      }} 
      title={title}
    >
      {icon}
    </button>
  )

  const isShapeTool = ['line', 'arrow', 'rect', 'circle', 'ellipse', 'triangle', 'right-triangle', 'axes'].includes(tool)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, touchAction: 'none', pointerEvents: 'auto', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        onTouchCancel={stopDrawing}
      />
      
      <div 
        className="draw-toolbar"
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: mounted ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(40px)',
          opacity: mounted ? 1 : 0,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(24, 24, 27, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '12px 20px',
          borderRadius: '100px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
          pointerEvents: 'auto',
          color: '#fff'
        }}
      >
        {/* Colors */}
        <div style={{ display: 'flex', gap: '8px', paddingRight: '12px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
          {['#ffffff', '#000000', '#ff3b30', '#34c759', '#007aff'].map(c => (
            <button 
              key={c}
              onClick={() => setColor(c)} 
              style={{ 
                width: '24px', height: '24px', borderRadius: '50%', background: c, 
                border: color === c ? '2px solid #007aff' : c === '#000000' ? '1px solid #333' : '1px solid rgba(0,0,0,0.1)',
                transform: color === c ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.2s', cursor: 'pointer' 
              }} 
            />
          ))}
        </div>

        {/* Tools */}
        <button onClick={() => { setTool('draw'); setShowShapes(false) }} style={{ background: tool === 'draw' ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', color: tool === 'draw' ? '#fff' : '#a1a1aa' }} title="Draw">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        </button>

        {/* Shapes Menu */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowShapes(!showShapes)} 
            style={{ background: isShapeTool ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', color: isShapeTool ? '#fff' : '#a1a1aa', display: 'flex' }} 
            title="Shapes"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12A10 10 0 1 0 12 2v10z"/>
              <path d="M12 2A10 10 0 1 1 2 12h10z"/>
            </svg>
          </button>

          {showShapes && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '16px',
              background: 'rgba(24, 24, 27, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '12px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              animation: 'fadeInUp 0.2s ease-out forwards'
            }}>
              <style>{`
                @keyframes fadeInUp { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
              `}</style>
              <ShapeButton t="line" title="Line" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5"/></svg>} />
              <ShapeButton t="arrow" title="Arrow" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>} />
              <ShapeButton t="rect" title="Rectangle" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>} />
              <ShapeButton t="circle" title="Circle" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>} />
              <ShapeButton t="ellipse" title="Ellipse" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg>} />
              <ShapeButton t="triangle" title="Triangle" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>} />
              <ShapeButton t="right-triangle" title="Right Triangle" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18L3 3v18z"/></svg>} />
              <ShapeButton t="axes" title="XY Axes" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20M12 2l-4 4M12 2l4 4M22 12l-4-4M22 12l-4 4"/></svg>} />
            </div>
          )}
        </div>

        <button onClick={() => { setTool('eraser'); setShowShapes(false) }} style={{ background: tool === 'eraser' ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', color: tool === 'eraser' ? '#fff' : '#a1a1aa' }} title="Eraser">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20H20V20Z"/></svg>
        </button>
        <button onClick={clearCanvas} style={{ background: 'transparent', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', color: '#ff453a' }} title="Clear All">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>

        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

        <button 
          onClick={() => { setMounted(false); setTimeout(onClose, 400) }} 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ff453a', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', width: '36px', height: '36px', boxShadow: '0 4px 12px rgba(255, 69, 58, 0.4)' }} 
          title="Close Drawing Mode"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  )
}
