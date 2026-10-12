import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Math Helper
function distToSegment(p, v, w) {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y)
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y)
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)))
}

function normalizeRect(x1, y1, x2, y2) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.max(Math.abs(x2 - x1), 8),
    height: Math.max(Math.abs(y2 - y1), 8)
  }
}

const IconWrapper = ({ active, onClick, children, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={active || undefined}
    className={`draw-tool-button${active ? ' active' : ''}`}
  >
    {children}
  </button>
);

export default function DrawingCanvas({ isOpen, onClose, pageId = 'default' }) {
  const canvasRef = useRef(null);

  // State for UI (mirrors refs for drawing)
  const [tool, setTool] = useState('draw'); // 'select', 'draw', 'eraser', 'shape'
  const [color, setColor] = useState('#007aff');
  const [lineWidth] = useState(3);
  const [shapeType, setShapeType] = useState('cube');
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [shapeMenuPosition, setShapeMenuPosition] = useState({ left: 12, bottom: 80 });
  const [uiSelectedId, setUiSelectedId] = useState(null);
  const [canvasBounds, setCanvasBounds] = useState({ top: 56, left: 0, width: window.innerWidth, height: Math.max(0, window.innerHeight - 112), toolbarBottom: 68 });

  // Persistent data refs
  const elementsRef = useRef([]);
  const historyRef = useRef([]);

  // Interaction refs
  const stateRefs = useRef({ tool, color, lineWidth, shapeType });
  const interactionMode = useRef(null);
  const isInteracting = useRef(false);
  const dragStart = useRef({x: 0, y: 0});
  const currentDrag = useRef({x: 0, y: 0});
  const passThroughTarget = useRef(null);
  const passThroughStart = useRef(null);

  const activeStroke = useRef(null);
  const activeShape = useRef(null);
  const dragElementInit = useRef(null);
  const dragElementTemp = useRef(null);
  const selectedId = useRef(null);
  const previousPageId = useRef(pageId);

  // Sync state to refs to avoid closure staleness
  useEffect(() => {
    stateRefs.current = { tool, color, lineWidth, shapeType };
  }, [tool, color, lineWidth, shapeType]);

  // Load from session storage
  useEffect(() => {
    if (previousPageId.current !== pageId) {
      try {
        sessionStorage.removeItem('satap_draw_' + previousPageId.current);
        sessionStorage.removeItem('satap_draw_' + pageId);
      } catch {
        // Clearing the in-memory drawing still works when storage is unavailable.
      }
      previousPageId.current = pageId;
      elementsRef.current = [];
      historyRef.current = [];
      selectedId.current = null;
      setUiSelectedId(null);
      setShowShapeMenu(false);
      setTool('draw');
      return;
    }
    try {
      const saved = sessionStorage.getItem('satap_draw_' + pageId);
      if (saved) {
        elementsRef.current = JSON.parse(saved);
      }
    } catch {
      // The drawing tool can still be used when browser storage is unavailable.
    }
  }, [pageId]);



  const saveElements = useCallback(() => {
    try {
      sessionStorage.setItem('satap_draw_' + pageId, JSON.stringify(elementsRef.current));
    } catch {
      // Keep the drawing session usable when storage is unavailable or full.
    }
  }, [pageId]);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return {x: 0, y: 0};
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width ? (canvas.width / rect.width) : 1;
    const scaleY = rect.height ? (canvas.height / rect.height) : 1;

    if (e.touches && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    elementsRef.current.forEach(el => {
      // skip original if dragging
      if (interactionMode.current === 'drag' && dragElementTemp.current && el.id === dragElementTemp.current.id) return;
      renderElement(ctx, el);
      if (el.id === selectedId.current && interactionMode.current !== 'drag') {
        drawSelectionBox(ctx, el);
      }
    });

    if (activeStroke.current) renderElement(ctx, activeStroke.current);
    if (activeShape.current) renderElement(ctx, activeShape.current, true);
    if (interactionMode.current === 'drag' && dragElementTemp.current) {
      renderElement(ctx, dragElementTemp.current);
    }
  }, []);

  // Redraw when isOpen changes (e.g. reopening panel)
  useEffect(() => {
    if (isOpen) {
      setTimeout(redraw, 10);
    }
  }, [isOpen, pageId, redraw]);

  const getHitElement = (x, y) => {
    for (let i = elementsRef.current.length - 1; i >= 0; i--) {
      if (isPointInsideElement(x, y, elementsRef.current[i])) {
        return elementsRef.current[i];
      }
    }
    return null;
  };

  const eraseAt = (x, y) => {
    const hit = getHitElement(x, y);
    if (hit) {
      historyRef.current.push([...elementsRef.current]);
      elementsRef.current = elementsRef.current.filter(e => e.id !== hit.id);
      if (selectedId.current === hit.id) {
        selectedId.current = null;
        setUiSelectedId(null);
      }
      saveElements();
      redraw();
    }
  };

  const onPointerDown = (e) => {
    if (e.target.closest('.draw-toolbar') || e.target.closest('.shape-picker-menu')) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const { clientX, clientY } = e.touches?.[0] || e;
      canvas.style.pointerEvents = 'none';
      const underneath = document.elementFromPoint(clientX, clientY);
      canvas.style.pointerEvents = 'auto';
      const interactive = underneath?.closest('button, a, input, textarea, select, [role="button"], .bb-choice');
      if (interactive) {
        isInteracting.current = true;
        interactionMode.current = 'pass-through';
        passThroughTarget.current = interactive;
        passThroughStart.current = { x: clientX, y: clientY };
        if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
        return;
      }
    }
    const {x, y} = getCoords(e);
    isInteracting.current = true;
    dragStart.current = {x, y};
    currentDrag.current = {x, y};

    const { tool: currentTool, color: c, lineWidth: lw, shapeType: st } = stateRefs.current;

    if (currentTool === 'eraser') {
      interactionMode.current = 'erase';
      eraseAt(x, y);
    } else if (currentTool === 'select') {
      const hit = getHitElement(x, y);
      if (hit) {
        selectedId.current = hit.id;
        setUiSelectedId(hit.id);
        interactionMode.current = 'drag';
        dragElementInit.current = JSON.parse(JSON.stringify(hit));
        dragElementTemp.current = JSON.parse(JSON.stringify(hit));
      } else {
        selectedId.current = null;
        setUiSelectedId(null);
        interactionMode.current = null;
      }
    } else if (currentTool === 'draw') {
      interactionMode.current = 'draw';
      activeStroke.current = { id: 'st_' + Date.now(), type: 'draw', points: [{x, y}], color: c, lineWidth: lw };
      selectedId.current = null;
      setUiSelectedId(null);
    } else if (currentTool === 'shape') {
      interactionMode.current = 'shape';
      activeShape.current = { id: 'sh_' + Date.now(), type: st, x1: x, y1: y, x2: x, y2: y, color: c, lineWidth: lw };
      selectedId.current = null;
      setUiSelectedId(null);
    }
    redraw();
    if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!isInteracting.current) return;
    const {x, y} = getCoords(e);
    currentDrag.current = {x, y};

    if (interactionMode.current === 'erase') {
      eraseAt(x, y);
    } else if (interactionMode.current === 'drag' && dragElementInit.current) {
      const dx = x - dragStart.current.x;
      const dy = y - dragStart.current.y;
      dragElementTemp.current = applyOffsetToElement(dragElementInit.current, dx, dy);
      redraw();
    } else if (interactionMode.current === 'draw' && activeStroke.current) {
      activeStroke.current.points.push({x, y});
      redraw();
    } else if (interactionMode.current === 'shape' && activeShape.current) {
      activeShape.current.x2 = x;
      activeShape.current.y2 = y;
      redraw();
    }
    if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
  };

  const onPointerUp = (e) => {
    if (!isInteracting.current) return;
    isInteracting.current = false;

    if (interactionMode.current === 'pass-through') {
      const point = e.changedTouches?.[0] || e;
      const start = passThroughStart.current;
      const target = passThroughTarget.current;
      if (e.type !== 'mouseleave' && target?.isConnected && start && Math.hypot(point.clientX - start.x, point.clientY - start.y) < 10) target.click();
      passThroughTarget.current = null;
      passThroughStart.current = null;
      interactionMode.current = null;
      return;
    }

    if (interactionMode.current === 'draw' && activeStroke.current) {
      if (activeStroke.current.points.length > 1) {
        historyRef.current.push([...elementsRef.current]);
        elementsRef.current.push(activeStroke.current);
        saveElements();
      }
      activeStroke.current = null;
    } else if (interactionMode.current === 'shape' && activeShape.current) {
      const s = activeShape.current;
      const dx = Math.abs(s.x2 - s.x1);
      const dy = Math.abs(s.y2 - s.y1);
      if (dx > 5 || dy > 5) {
        let fs;
        if (s.type === 'line' || s.type === 'arrow') {
          fs = { ...s };
        } else {
          const norm = normalizeRect(s.x1, s.y1, s.x2, s.y2);
          fs = { id: s.id, type: s.type, x: norm.x, y: norm.y, width: norm.width, height: norm.height, color: s.color, lineWidth: s.lineWidth };
        }
        historyRef.current.push([...elementsRef.current]);
        elementsRef.current.push(fs);
        selectedId.current = fs.id;
        setUiSelectedId(fs.id);
        setTool('select');
        saveElements();
      }
      activeShape.current = null;
    } else if (interactionMode.current === 'drag' && dragElementTemp.current) {
      const dx = currentDrag.current.x - dragStart.current.x;
      const dy = currentDrag.current.y - dragStart.current.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        historyRef.current.push([...elementsRef.current]);
        const sid = selectedId.current;
        elementsRef.current = elementsRef.current.map(el => el.id === sid ? dragElementTemp.current : el);
        saveElements();
      }
      dragElementInit.current = null;
      dragElementTemp.current = null;
    }

    interactionMode.current = null;
    redraw();
  };

  const undo = () => {
    if (historyRef.current.length > 0) {
      elementsRef.current = historyRef.current.pop();
      selectedId.current = null;
      setUiSelectedId(null);
      saveElements();
      redraw();
    }
  };

  const clearAll = () => {
    if (elementsRef.current.length > 0) {
      historyRef.current.push([...elementsRef.current]);
      elementsRef.current = [];
      selectedId.current = null;
      setUiSelectedId(null);
      saveElements();
      redraw();
    }
  };

  const deleteSelected = useCallback(() => {
    if (selectedId.current) {
      historyRef.current.push([...elementsRef.current]);
      elementsRef.current = elementsRef.current.filter(e => e.id !== selectedId.current);
      selectedId.current = null;
      setUiSelectedId(null);
      saveElements();
      redraw();
    }
  }, [redraw, saveElements]);

  useEffect(() => {
    const handleKey = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId.current) {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, deleteSelected]);

  // ResizeObserver for canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        redraw();
      }
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redraw]);

  // Keep the drawing surface inside the question area so the test header and
  // navigation remain usable. The toolbar sits just above the bottom bar.
  useEffect(() => {
    if (!isOpen) return undefined;
    const updateBounds = () => {
      const body = canvasRef.current?.closest('.bb')?.querySelector('.bb-body');
      if (!body) return;
      const rect = body.getBoundingClientRect();
      setCanvasBounds({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, toolbarBottom: Math.max(8, window.innerHeight - rect.bottom + 8) });
    };
    updateBounds();
    const body = canvasRef.current?.closest('.bb')?.querySelector('.bb-body');
    const observer = body ? new ResizeObserver(updateBounds) : null;
    if (body) observer.observe(body);
    window.addEventListener('resize', updateBounds);
    window.addEventListener('scroll', updateBounds, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateBounds);
      window.removeEventListener('scroll', updateBounds, true);
    };
  }, [isOpen]);

  const textSelectionMode = tool === 'text';

  const shapeGroups = [
    { label: 'BASIC SHAPES', shapes: [['line', 'Line'], ['arrow', 'Arrow'], ['rect', 'Rectangle'], ['circle', 'Circle'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['right-triangle', 'Right triangle'], ['axes', 'Coordinate axes']] },
    { label: '3D SHAPES', shapes: [['cube', 'Cube'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['sphere', 'Sphere'], ['pyramid', 'Pyramid'], ['prism', 'Prism']] },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: canvasBounds.top, left: canvasBounds.left, width: canvasBounds.width, height: canvasBounds.height, touchAction: 'none', display: isOpen && !textSelectionMode ? 'block' : 'none', pointerEvents: isOpen && !textSelectionMode ? 'auto' : 'none', cursor: tool === 'draw' ? 'crosshair' : tool === 'eraser' ? 'cell' : 'default' }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        onTouchCancel={onPointerUp}
      />

      {isOpen && (
        <div className="draw-toolbar" role="toolbar" aria-label="Drawing tools" style={{ pointerEvents: 'auto', bottom: `calc(${canvasBounds.toolbarBottom}px + env(safe-area-inset-bottom, 0px))` }}>
          {/* Colors */}
          <div className="draw-color-group" aria-label="Drawing color">
            {['#007aff', '#ff3b30', '#34c759', '#ffcc00', '#1c1c1e'].map((c, index) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                title={`${['Blue', 'Red', 'Green', 'Yellow', 'Black'][index]} color`}
                aria-label={`${['Blue', 'Red', 'Green', 'Yellow', 'Black'][index]} color`}
                aria-pressed={color === c}
                className={`draw-color-button${color === c ? ' selected' : ''}`}
                style={{ '--draw-color': c }}
              />
            ))}
          </div>

          <div className="draw-toolbar-separator" aria-hidden="true" />

          <IconWrapper active={tool === 'select'} onClick={() => setTool('select')} title="Select">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
          </IconWrapper>
          <IconWrapper active={tool === 'draw'} onClick={() => setTool('draw')} title="Draw">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </IconWrapper>
          <IconWrapper active={textSelectionMode} onClick={() => { setTool('text'); setShowShapeMenu(false); }} title="Highlight text">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/><path d="m5 20 3-7h8l3 7"/></svg>
          </IconWrapper>
          <div className="draw-shape-control">
            <IconWrapper active={tool === 'shape'} onClick={event => {
              const anchor = event.currentTarget.getBoundingClientRect();
              const menuWidth = Math.min(330, window.innerWidth - 24);
              setShapeMenuPosition({
                left: Math.max(12, Math.min(window.innerWidth - menuWidth - 12, anchor.left)),
                bottom: Math.max(12, window.innerHeight - anchor.top + 8),
              });
              setTool('shape');
              setShowShapeMenu(value => !value);
            }} title="Basic and 3D shapes">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
            </IconWrapper>
          </div>
          <IconWrapper active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
          </IconWrapper>

          <div className="draw-toolbar-separator" aria-hidden="true" />

          <IconWrapper onClick={undo} title="Undo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          </IconWrapper>
          <IconWrapper onClick={clearAll} title="Clear All">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </IconWrapper>

          {uiSelectedId && (
            <IconWrapper onClick={deleteSelected} title="Delete Selected">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </IconWrapper>
          )}
          {onClose && (
            <IconWrapper onClick={onClose} title="Close drawing tools">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 6-12 12M6 6l12 12"/></svg>
            </IconWrapper>
          )}
        </div>
      )}
      {isOpen && showShapeMenu && tool === 'shape' && createPortal(
        <div className="shape-picker-menu" role="group" aria-label="Choose a shape" style={shapeMenuPosition}>
          {shapeGroups.map(group => (
            <div className="shape-picker-group" key={group.label}>
              <div className="shape-picker-heading">{group.label}</div>
              <div className="shape-picker-options">
                {group.shapes.map(([value, label]) => (
                  <button type="button" key={value} aria-pressed={shapeType === value} className={shapeType === value ? 'selected' : ''} onClick={() => { setShapeType(value); setShowShapeMenu(false); setTool('shape'); }} title={label}>
                    <span className="shape-picker-symbol" aria-hidden="true">{label.slice(0, 1)}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ==========================================
// PURE FUNCTIONS EXTRACTED FROM OLD FILE
// ==========================================

function renderElement(ctx, el, isPreview = false) {
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
