import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ShapeIcon from './ShapeIcon';
import {
  makeShape, renderElement, hitTest, hitHandle, resizeElement, applyOffsetToElement,
  drawSelection, isLineType, HANDLE_CURSORS,
} from './drawingUtils';

const HISTORY_LIMIT = 100;
const TAP_SLOP = 5; // px of movement that still counts as a click, not a drag
const INTERACTIVE = 'button, a[href], input, textarea, select, label, summary, [role="button"], [role="radio"], [role="tab"], .bb-choice';

const COLORS = [
  ['#007aff', 'Blue'],
  ['#ff3b30', 'Red'],
  ['#34c759', 'Green'],
  ['#ffcc00', 'Yellow'],
  ['#1c1c1e', 'Black'],
];

const SHAPE_GROUPS = [
  { label: 'BASIC SHAPES', shapes: [['line', 'Line'], ['arrow', 'Arrow'], ['rect', 'Rectangle'], ['circle', 'Circle'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['right-triangle', 'Right triangle'], ['axes', 'Coordinate axes']] },
  { label: '3D SHAPES', shapes: [['cube', 'Cube'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['sphere', 'Sphere'], ['pyramid', 'Pyramid'], ['prism', 'Prism']] },
];

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

const clone = value => JSON.parse(JSON.stringify(value));

// The page element under a screen point, ignoring our own canvas.
function interactiveUnder(canvas, clientX, clientY) {
  const prev = canvas.style.pointerEvents;
  canvas.style.pointerEvents = 'none';
  const under = document.elementFromPoint(clientX, clientY);
  canvas.style.pointerEvents = prev;
  const target = under?.closest(INTERACTIVE);
  return target && !target.closest('.draw-toolbar, .shape-picker-menu') ? target : null;
}

function scrollableAncestor(node) {
  let el = node;
  while (el && el !== document.body) {
    const overflowY = getComputedStyle(el).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return document.scrollingElement;
}

export default function DrawingCanvas({ isOpen, onClose, pageId = 'default' }) {
  const canvasRef = useRef(null);

  const [tool, setTool] = useState('draw'); // 'select', 'draw', 'eraser', 'shape', 'text'
  const [color, setColor] = useState('#007aff');
  const [lineWidth] = useState(3);
  const [shapeType, setShapeType] = useState('cube');
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [shapeMenuPosition, setShapeMenuPosition] = useState({ left: 12, bottom: 80 });
  const [uiSelectedId, setUiSelectedId] = useState(null);
  const [canvasBounds, setCanvasBounds] = useState({ top: 56, left: 0, width: window.innerWidth, height: Math.max(0, window.innerHeight - 112), toolbarBottom: 68 });

  // Drawing data lives in refs so pointer handlers never read stale state.
  const elementsRef = useRef([]);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const stateRefs = useRef({ tool, color, lineWidth, shapeType });
  const selectedId = useRef(null);
  const previousPageId = useRef(pageId);

  // One gesture at a time: { mode, ... } or null.
  const gesture = useRef(null);
  const activeStroke = useRef(null);
  const activeShape = useRef(null);
  const editTemp = useRef(null); // element currently being moved / resized

  useEffect(() => {
    stateRefs.current = { tool, color, lineWidth, shapeType };
  }, [tool, color, lineWidth, shapeType]);

  const saveElements = useCallback(() => {
    try {
      sessionStorage.setItem('satap_draw_' + pageId, JSON.stringify(elementsRef.current));
    } catch {
      // Keep the drawing session usable when storage is unavailable or full.
    }
  }, [pageId]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const temp = editTemp.current;
    let selected = null;
    for (const el of elementsRef.current) {
      const shown = temp && temp.id === el.id ? temp : el;
      renderElement(ctx, shown);
      if (el.id === selectedId.current) selected = shown;
    }
    if (activeStroke.current) renderElement(ctx, activeStroke.current);
    if (activeShape.current) renderElement(ctx, activeShape.current, true);
    if (selected && stateRefs.current.tool === 'select') drawSelection(ctx, selected);
  }, []);

  // Keep the bitmap crisp on high-DPI screens and in step with the CSS size.
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    redraw();
  }, [redraw]);

  const selectElement = useCallback(id => {
    selectedId.current = id;
    setUiSelectedId(id);
  }, []);

  // Load / reset drawings when the question changes.
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
      redoRef.current = [];
      gesture.current = null;
      activeStroke.current = null;
      activeShape.current = null;
      editTemp.current = null;
      selectElement(null);
      setShowShapeMenu(false);
      setTool('draw');
      redraw();
      return;
    }
    try {
      const saved = sessionStorage.getItem('satap_draw_' + pageId);
      if (saved) elementsRef.current = JSON.parse(saved);
    } catch {
      // The drawing tool can still be used when browser storage is unavailable.
    }
    redraw();
  }, [pageId, redraw, selectElement]);

  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(syncCanvasSize, 10);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [isOpen, pageId, syncCanvasSize]);

  // Leaving the select tool drops the selection box.
  useEffect(() => {
    if (tool !== 'select' && selectedId.current) selectElement(null);
    redraw();
  }, [tool, redraw, selectElement]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ro = new ResizeObserver(syncCanvasSize);
    ro.observe(canvas);
    window.addEventListener('resize', syncCanvasSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncCanvasSize);
    };
  }, [syncCanvasSize]);

  // Keep the drawing surface inside the question area so the test header and
  // navigation remain usable. The toolbar sits just above the bottom bar.
  useEffect(() => {
    if (!isOpen) return undefined;
    const updateBounds = () => {
      const body = canvasRef.current?.closest('.bb')?.querySelector('.bb-body');
      if (!body) return;
      const rect = body.getBoundingClientRect();
      setCanvasBounds(prev => {
        const next = { top: rect.top, left: rect.left, width: rect.width, height: rect.height, toolbarBottom: Math.max(8, window.innerHeight - rect.bottom + 8) };
        return prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height && prev.toolbarBottom === next.toolbarBottom ? prev : next;
      });
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

  // The canvas sits above the question, so mouse-wheel / trackpad scrolling
  // is handed to whatever scrollable area is underneath.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const onWheel = e => {
      const prev = canvas.style.pointerEvents;
      canvas.style.pointerEvents = 'none';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      canvas.style.pointerEvents = prev;
      const scroller = scrollableAncestor(under);
      if (scroller) {
        scroller.scrollBy({ left: e.deltaX, top: e.deltaY });
        e.preventDefault();
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  /* ---------- history ---------- */

  const pushHistory = () => {
    historyRef.current.push(elementsRef.current);
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
    redoRef.current = [];
  };

  const commit = nextElements => {
    pushHistory();
    elementsRef.current = nextElements;
    saveElements();
  };

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    redoRef.current.push(elementsRef.current);
    elementsRef.current = historyRef.current.pop();
    selectElement(null);
    saveElements();
    redraw();
  }, [redraw, saveElements, selectElement]);

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    historyRef.current.push(elementsRef.current);
    elementsRef.current = redoRef.current.pop();
    selectElement(null);
    saveElements();
    redraw();
  }, [redraw, saveElements, selectElement]);

  const clearAll = () => {
    if (elementsRef.current.length === 0) return;
    commit([]);
    selectElement(null);
    redraw();
  };

  const deleteSelected = useCallback(() => {
    const id = selectedId.current;
    if (!id) return;
    pushHistory();
    elementsRef.current = elementsRef.current.filter(e => e.id !== id);
    selectElement(null);
    saveElements();
    redraw();
  }, [redraw, saveElements, selectElement]);

  const chooseColor = c => {
    setColor(c);
    const id = selectedId.current;
    if (id && stateRefs.current.tool === 'select') {
      commit(elementsRef.current.map(el => (el.id === id ? { ...el, color: c } : el)));
      redraw();
    }
  };

  useEffect(() => {
    const handleKey = e => {
      if (!isOpen) return;
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if (e.key === 'Escape') {
        if (selectedId.current) {
          selectElement(null);
          redraw();
        } else {
          onClose?.();
        }
        return;
      }
      if (typing) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId.current) {
        e.preventDefault();
        deleteSelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, deleteSelected, undo, redo, redraw, selectElement]);

  /* ---------- pointer handling ---------- */

  const getCoords = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const reach = e => (e.pointerType === 'touch' ? 16 : 10);

  const topHit = (x, y, tol, fill) => {
    const list = elementsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      if (hitTest(list[i], x, y, tol, fill)) return list[i];
    }
    return null;
  };

  const selectedElement = () => elementsRef.current.find(el => el.id === selectedId.current) || null;

  const eraseAt = (x, y, tol) => {
    const hit = topHit(x, y, tol, false);
    if (!hit) return false;
    if (!gesture.current.erased) {
      pushHistory();
      gesture.current.erased = true;
    }
    elementsRef.current = elementsRef.current.filter(el => el.id !== hit.id);
    if (selectedId.current === hit.id) selectElement(null);
    saveElements();
    redraw();
    return true;
  };

  const onPointerDown = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const canvas = canvasRef.current;
    const { x, y } = getCoords(e);
    const { tool: currentTool, color: c, lineWidth: lw, shapeType: st } = stateRefs.current;

    const g = {
      mode: null,
      id: e.pointerId,
      startX: x, startY: y,
      downClientX: e.clientX, downClientY: e.clientY,
      moved: false,
      acted: false,
      tapTarget: interactiveUnder(canvas, e.clientX, e.clientY),
    };
    gesture.current = g;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* capture is best effort */ }

    if (currentTool === 'eraser') {
      g.mode = 'erase';
      g.acted = eraseAt(x, y, reach(e));
    } else if (currentTool === 'select') {
      const sel = selectedElement();
      const handle = sel ? hitHandle(sel, x, y, reach(e) + 2) : null;
      if (sel && handle) {
        g.mode = 'resize';
        g.handle = handle;
        g.init = clone(sel);
        g.acted = true;
      } else {
        const hit = topHit(x, y, reach(e) - 2, true);
        if (hit) {
          selectElement(hit.id);
          g.mode = 'move';
          g.init = clone(hit);
          g.acted = true;
        } else {
          selectElement(null);
        }
      }
    } else if (currentTool === 'draw') {
      g.mode = 'draw';
      selectElement(null);
      activeStroke.current = { id: 'st_' + Date.now(), type: 'draw', points: [{ x, y }], color: c, lineWidth: lw };
    } else if (currentTool === 'shape') {
      g.mode = 'shape';
      selectElement(null);
      activeShape.current = makeShape(st, 'sh_' + Date.now(), x, y, x, y, c, lw);
    }
    redraw();
  };

  const updateHoverCursor = e => {
    const canvas = canvasRef.current;
    const { tool: currentTool } = stateRefs.current;
    if (!canvas || currentTool !== 'select') return;
    const { x, y } = getCoords(e);
    const sel = selectedElement();
    const handle = sel ? hitHandle(sel, x, y, reach(e) + 2) : null;
    if (handle) canvas.style.cursor = HANDLE_CURSORS[handle];
    else canvas.style.cursor = topHit(x, y, reach(e) - 2, true) ? 'move' : 'default';
  };

  const onPointerMove = e => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) {
      updateHoverCursor(e);
      return;
    }
    const { x, y } = getCoords(e);
    if (!g.moved && Math.hypot(e.clientX - g.downClientX, e.clientY - g.downClientY) > TAP_SLOP) g.moved = true;

    if (g.mode === 'erase') {
      if (eraseAt(x, y, reach(e))) g.acted = true;
    } else if (g.mode === 'move') {
      editTemp.current = applyOffsetToElement(g.init, x - g.startX, y - g.startY);
      redraw();
    } else if (g.mode === 'resize') {
      editTemp.current = resizeElement(g.init, g.handle, x, y);
      redraw();
    } else if (g.mode === 'draw' && activeStroke.current) {
      const events = e.nativeEvent?.getCoalescedEvents?.() || [];
      const rect = canvasRef.current.getBoundingClientRect();
      const samples = events.length ? events : [e];
      const pts = activeStroke.current.points;
      for (const s of samples) {
        const px = s.clientX - rect.left;
        const py = s.clientY - rect.top;
        const last = pts[pts.length - 1];
        if (Math.hypot(px - last.x, py - last.y) >= 1.2) pts.push({ x: px, y: py });
      }
      redraw();
    } else if (g.mode === 'shape' && activeShape.current) {
      const a = activeShape.current;
      activeShape.current = makeShape(a.type, a.id, g.startX, g.startY, x, y, a.color, a.lineWidth);
      redraw();
    }
  };

  const finishGesture = (e, cancelled) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* already released */ }

    if (g.mode === 'draw' && activeStroke.current) {
      const stroke = activeStroke.current;
      if (!cancelled && g.moved && stroke.points.length > 1) {
        commit([...elementsRef.current, stroke]);
        g.acted = true;
      }
    } else if (g.mode === 'shape' && activeShape.current) {
      const s = activeShape.current;
      const long = isLineType(s.type)
        ? Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 6
        : g.moved && Math.max(Math.abs(e.clientX - g.downClientX), Math.abs(e.clientY - g.downClientY)) > 6;
      if (!cancelled && long) {
        commit([...elementsRef.current, s]);
        selectElement(s.id);
        setTool('select'); // lets the user resize or move the new shape right away
        g.acted = true;
      }
    } else if ((g.mode === 'move' || g.mode === 'resize') && editTemp.current) {
      if (!cancelled && g.moved) {
        const next = editTemp.current;
        commit(elementsRef.current.map(el => (el.id === next.id ? next : el)));
      }
    }

    activeStroke.current = null;
    activeShape.current = null;
    editTemp.current = null;
    redraw();

    // A plain tap that did not draw or edit anything is meant for the page underneath.
    if (!cancelled && !g.moved && !g.acted && g.tapTarget?.isConnected) {
      g.tapTarget.focus?.({ preventScroll: true });
      g.tapTarget.click();
    }
  };

  const textSelectionMode = tool === 'text';
  const drawingActive = isOpen && !textSelectionMode;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: canvasBounds.top,
          left: canvasBounds.left,
          width: canvasBounds.width,
          height: canvasBounds.height,
          touchAction: 'none',
          display: isOpen ? 'block' : 'none',
          pointerEvents: drawingActive ? 'auto' : 'none',
          cursor: tool === 'draw' || tool === 'shape' ? 'crosshair' : tool === 'eraser' ? 'cell' : 'default',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={e => finishGesture(e, false)}
        onPointerCancel={e => finishGesture(e, true)}
        onLostPointerCapture={e => finishGesture(e, true)}
      />

      {isOpen && (
        <div className="draw-toolbar" role="toolbar" aria-label="Drawing tools" style={{ pointerEvents: 'auto', bottom: `calc(${canvasBounds.toolbarBottom}px + env(safe-area-inset-bottom, 0px))` }}>
          <div className="draw-color-group" aria-label="Drawing color">
            {COLORS.map(([c, name]) => (
              <button
                type="button"
                key={c}
                onClick={() => chooseColor(c)}
                title={`${name} color`}
                aria-label={`${name} color`}
                aria-pressed={color === c}
                className={`draw-color-button${color === c ? ' selected' : ''}`}
                style={{ '--draw-color': c }}
              />
            ))}
          </div>

          <div className="draw-toolbar-separator" aria-hidden="true" />

          <IconWrapper active={tool === 'select'} onClick={() => { setTool('select'); setShowShapeMenu(false); }} title="Select, move and resize">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /></svg>
          </IconWrapper>
          <IconWrapper active={tool === 'draw'} onClick={() => { setTool('draw'); setShowShapeMenu(false); }} title="Draw">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
          </IconWrapper>
          <IconWrapper active={textSelectionMode} onClick={() => { setTool('text'); setShowShapeMenu(false); }} title="Highlight text">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /><path d="m5 20 3-7h8l3 7" /></svg>
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
              setShowShapeMenu(value => (tool === 'shape' ? !value : true));
            }} title="Basic and 3D shapes">
              <ShapeIcon shape={shapeType} />
            </IconWrapper>
          </div>
          <IconWrapper active={tool === 'eraser'} onClick={() => { setTool('eraser'); setShowShapeMenu(false); }} title="Eraser">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>
          </IconWrapper>

          <div className="draw-toolbar-separator" aria-hidden="true" />

          <IconWrapper onClick={undo} title="Undo (Ctrl+Z)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
          </IconWrapper>
          <IconWrapper onClick={redo} title="Redo (Ctrl+Y)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
          </IconWrapper>
          <IconWrapper onClick={clearAll} title="Clear All">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
          </IconWrapper>

          {uiSelectedId && (
            <IconWrapper onClick={deleteSelected} title="Delete Selected">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </IconWrapper>
          )}
          {onClose && (
            <IconWrapper onClick={onClose} title="Close drawing tools">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 6-12 12M6 6l12 12" /></svg>
            </IconWrapper>
          )}
        </div>
      )}
      {isOpen && showShapeMenu && tool === 'shape' && createPortal(
        <div className="shape-picker-menu" role="group" aria-label="Choose a shape" style={shapeMenuPosition}>
          {SHAPE_GROUPS.map(group => (
            <div className="shape-picker-group" key={group.label}>
              <div className="shape-picker-heading">{group.label}</div>
              <div className="shape-picker-options">
                {group.shapes.map(([value, label]) => (
                  <button type="button" key={value} aria-pressed={shapeType === value} className={shapeType === value ? 'selected' : ''} onClick={() => { setShapeType(value); setShowShapeMenu(false); setTool('shape'); }} title={label}>
                    <span className="shape-picker-symbol" aria-hidden="true"><ShapeIcon shape={value} size={18} /></span>
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
