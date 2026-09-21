import { useRef, useState, useEffect } from 'react'

export default function DrawingCanvas({ onClose }) {
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#000000')
  const [lineWidth, setLineWidth] = useState(3)
  const [isEraser, setIsEraser] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const ctx = canvas.getContext('2d')
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctxRef.current = ctx

    const handleResize = () => {
      // Create a temporary canvas to save drawing
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      const tCtx = tempCanvas.getContext('2d')
      tCtx.drawImage(canvas, 0, 0)

      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color
      ctx.lineWidth = lineWidth
      ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
      ctx.drawImage(tempCanvas, 0, 0)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!ctxRef.current) return
    ctxRef.current.strokeStyle = color
    ctxRef.current.lineWidth = isEraser ? 20 : lineWidth
    ctxRef.current.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
  }, [color, lineWidth, isEraser])

  const getCoordinates = (e) => {
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      }
    }
    return {
      x: e.clientX,
      y: e.clientY
    }
  }

  const startDrawing = (e) => {
    setIsDrawing(true)
    const { x, y } = getCoordinates(e)
    ctxRef.current.beginPath()
    ctxRef.current.moveTo(x, y)
    if (e.cancelable) e.preventDefault() // Prevent scrolling on touch
  }

  const draw = (e) => {
    if (!isDrawing) return
    const { x, y } = getCoordinates(e)
    ctxRef.current.lineTo(x, y)
    ctxRef.current.stroke()
    if (e.cancelable) e.preventDefault()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    ctxRef.current.closePath()
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    if (!canvasRef.current || !ctxRef.current) return
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, touchAction: 'none', pointerEvents: 'auto', cursor: isEraser ? 'cell' : 'crosshair' }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        onTouchCancel={stopDrawing}
      />
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: '#fff',
        padding: '10px 16px',
        borderRadius: '30px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        pointerEvents: 'auto',
        border: '1px solid #eaeaea'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginRight: '4px' }}>DRAW</div>
        
        <button 
          onClick={() => { setIsEraser(false); setColor('#000000') }}
          style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#000', border: (!isEraser && color === '#000000') ? '3px solid #ccc' : 'none', cursor: 'pointer' }}
          title="Black"
        />
        <button 
          onClick={() => { setIsEraser(false); setColor('#ff3b30') }}
          style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#ff3b30', border: (!isEraser && color === '#ff3b30') ? '3px solid #ccc' : 'none', cursor: 'pointer' }}
          title="Red"
        />
        <button 
          onClick={() => { setIsEraser(false); setColor('#007aff') }}
          style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#007aff', border: (!isEraser && color === '#007aff') ? '3px solid #ccc' : 'none', cursor: 'pointer' }}
          title="Blue"
        />

        <div style={{ width: '1px', height: '20px', background: '#ddd', margin: '0 4px' }} />

        <button 
          onClick={() => setIsEraser(true)}
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isEraser ? '#f0f0f0' : 'transparent',
            border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer',
            color: isEraser ? '#000' : '#666'
          }}
          title="Eraser"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20H20V20Z"/></svg>
        </button>

        <button 
          onClick={clearCanvas}
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent',
            border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer',
            color: '#666'
          }}
          title="Clear All"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>

        <div style={{ width: '1px', height: '20px', background: '#ddd', margin: '0 4px' }} />

        <button 
          onClick={onClose}
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#ff3b30', color: '#fff',
            border: 'none', borderRadius: '50%', padding: '4px', cursor: 'pointer',
            width: '24px', height: '24px'
          }}
          title="Close Drawing Mode"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  )
}
