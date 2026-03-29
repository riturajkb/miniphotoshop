import { useRef, useEffect, useCallback } from "react";
import { Renderer } from "../../engine";
import { useEditorStore } from "../../store/editorStore";
import { useToolStore } from "../../store/toolStore";
import {
  useDocumentStore,
  createDefaultDocument,
} from "../../store/documentStore";
import type { Layer } from "../../types/editor";
import { Tool } from "../../types/editor";

const DEFAULT_W = 800;
const DEFAULT_H = 600;

function getSelectionBounds(mask: Uint8Array, width: number, height: number) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1 || maxY === -1) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vpRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const frameRef = useRef<number>(0);
  const panningRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });

  const { activeTool, setZoom, setPan, setCursor, setViewport, setRendererRef } =
    useEditorStore();
  const fillSettings = useToolStore((state) => state.fill);
  const { setDocument, document: doc, undo, redo, commitHistory, syncPixels, activeLayerId, setSelection, clearSelection } = useDocumentStore();

  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const selectionPointsRef = useRef<{x: number, y: number}[]>([]);
  const selectionModeRef = useRef<import("../../types/editor").SelectionMode>("replace");

  const applyToolStroke = useCallback((x: number, y: number) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const px = Math.round(x);
    const py = Math.round(y);

    switch (activeTool) {
      case Tool.Brush:
        renderer.drawBrush(px, py, { r: 50, g: 150, b: 250, a: 255 }, 20);
        break;
      case Tool.Pencil:
        renderer.drawBrush(px, py, { r: 50, g: 150, b: 250, a: 255 }, 6);
        break;
      case Tool.Eraser:
        renderer.drawBrush(px, py, { r: 0, g: 0, b: 0, a: 0 }, 20);
        break;
      case Tool.Fill:
        renderer.fill(
          px,
          py,
          { r: 50, g: 150, b: 250, a: 255 },
          fillSettings.tolerance,
          fillSettings.contiguous,
        );
        break;
      default:
        break;
    }
  }, [activeTool, fillSettings.contiguous, fillSettings.tolerance]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (e.key === "Escape" || (isMod && e.key === "d")) {
        e.preventDefault();
        clearSelection();
      } else if (isMod && e.key === "z") {
        e.preventDefault();
        undo();
      } else if (isMod && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, clearSelection]);

  // Sync engine when document changes (e.g. from undo/redo)
  useEffect(() => {
    const renderer = rendererRef.current;
    if (renderer && doc) {
      // Re-sync the entire document structure and pixels
      renderer.syncDocument(doc, activeLayerId);
      // Re-sync selection
      renderer.syncSelection(doc.selection ?? null);
    }
  }, [doc, activeLayerId]);

  // mount renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    const vp = vpRef.current;
    if (!canvas || !vp) return;

    const w = Math.max(10, vp.clientWidth);
    const h = Math.max(10, vp.clientHeight);
    setViewport(w, h);

    const renderer = new Renderer(DEFAULT_W, DEFAULT_H);
    let isDestroyed = false;

    renderer.init(canvas, w, h).then(() => {
      if (isDestroyed) return;
      
      // create default document in store
      const newDoc = createDefaultDocument(DEFAULT_W, DEFAULT_H, {
        r: 255,
        g: 255,
        b: 255,
        a: 0,
      });

      // Create the Background layer with solid white pixels (alpha=255)
      const layerStack = renderer.getLayerStack();
      const bgLayerData = layerStack.createLayer("Background", {
        r: 255,
        g: 255,
        b: 255,
        a: 255,
      }, "layer-bg");

      renderer.createBackgroundGraphics();
      const bgGraphics = renderer.getBackgroundGraphics();
      if (bgGraphics) {
        bgLayerData.graphics = bgGraphics;
      }

      const bgLayerForStore: Layer = {
        id: "layer-bg",
        name: "Background",
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal",
        pixels: null,
      };
      newDoc.layers.push(bgLayerForStore);
      setDocument(newDoc);

      renderer.fitToViewport(w, h);
      renderer.forceRender();

      rendererRef.current = renderer;
      setRendererRef(renderer);
      setZoom(renderer.getZoom() * 100);
      setPan(renderer.getPan());

      const loop = () => {
        if (!isDestroyed) {
          renderer.render();
          frameRef.current = requestAnimationFrame(loop);
        }
      };
      frameRef.current = requestAnimationFrame(loop);
    }).catch((err) => console.error(err));

    const rob = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (rendererRef.current && !isDestroyed) {
          const newW = Math.max(10, entry.contentRect.width);
          const newH = Math.max(10, entry.contentRect.height);
          rendererRef.current.resizeViewport(newW, newH);
          setViewport(newW, newH);
        }
      }
    });
    rob.observe(vp);

    return () => {
      isDestroyed = true;
      rob.disconnect();
      cancelAnimationFrame(frameRef.current);
      renderer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // zoom
  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const r = rendererRef.current;
      const vp = vpRef.current;
      if (!r || !vp) return;

      const cur = r.getZoom();
      const next = Math.max(
        0.05,
        Math.min(64, cur * (e.deltaY > 0 ? 0.9 : 1.1)),
      );

      const { left, top } = vp.getBoundingClientRect();
      const mx = e.clientX - left;
      const my = e.clientY - top;
      const p = r.getPan();
      const s = next / cur;

      r.setZoom(next);
      r.setPan(mx - (mx - p.x) * s, my - (my - p.y) * s);

      setZoom(next * 100);
      setPan(r.getPan());
    },
    [setZoom, setPan],
  );

  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // mouse
  const onDown = useCallback((e: React.MouseEvent) => {
    const r = rendererRef.current;
    const vp = vpRef.current;
    if (!r || !vp) return;

    if (e.button === 1 || e.altKey) {
      if (activeTool !== Tool.SelectionRect && activeTool !== Tool.SelectionEllipse && activeTool !== Tool.Lasso && activeTool !== Tool.QuickSelection) {
         panningRef.current = true;
         lastRef.current = { x: e.clientX, y: e.clientY };
         return;
      }
    }

    const { left, top } = vp.getBoundingClientRect();
    const cp = r.screenToCanvasPrecise(e.clientX - left, e.clientY - top);

    const isSelectionTool = activeTool === Tool.SelectionRect || activeTool === Tool.SelectionEllipse || activeTool === Tool.Lasso || activeTool === Tool.QuickSelection;

    if (isSelectionTool) {
      isSelectingRef.current = true;
      selectionStartRef.current = cp;
      selectionPointsRef.current = [cp];
      
      let mode: import("../../types/editor").SelectionMode = "replace";
      if (e.shiftKey) mode = "add";
      else if (e.altKey) mode = "subtract";
      selectionModeRef.current = mode;

      const currentMask = doc?.selection?.mask || null;
      r.beginSelectionDraft(mode === "replace" ? null : currentMask);

      if (activeTool === Tool.QuickSelection) {
        r.updateSelectionQuickDraft(Math.round(cp.x), Math.round(cp.y), 10, 32, mode);
      }
    } else {
      // Before starting to paint, sync current engine pixels to store and commit history
      const activeLayer = r.getLayerStack().getActiveLayer();
      if (activeLayer && activeLayer.pixelBuffer) {
        syncPixels(activeLayer.id, activeLayer.pixelBuffer);
      }
      commitHistory();

      applyToolStroke(cp.x, cp.y);
      panningRef.current = false;
      lastRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [activeTool, applyToolStroke, commitHistory, syncPixels, doc?.selection?.mask]);

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const r = rendererRef.current;
      const vp = vpRef.current;
      if (!r || !vp) return;

      const { left, top } = vp.getBoundingClientRect();
      const cp = r.screenToCanvasPrecise(e.clientX - left, e.clientY - top);
      setCursor(Math.round(cp.x), Math.round(cp.y));

      if (panningRef.current) {
        const dx = e.clientX - lastRef.current.x;
        const dy = e.clientY - lastRef.current.y;
        const p = r.getPan();
        r.setPan(p.x + dx, p.y + dy);
        setPan(r.getPan());
        lastRef.current = { x: e.clientX, y: e.clientY };
      } else if (isSelectingRef.current) {
        const mode = selectionModeRef.current;
        const startX = selectionStartRef.current.x;
        const startY = selectionStartRef.current.y;
        
        const wRaw = Math.abs(cp.x - startX);
        const hRaw = Math.abs(cp.y - startY);
        const w = e.shiftKey ? Math.max(wRaw, hRaw) : wRaw;
        const h = e.shiftKey ? Math.max(wRaw, hRaw) : hRaw;
        
        const rx = cp.x < startX ? startX - w : startX;
        const ry = cp.y < startY ? startY - h : startY;

        if (activeTool === Tool.SelectionRect) {
          r.updateSelectionRectDraft(rx, ry, w, h, mode);
        } else if (activeTool === Tool.SelectionEllipse) {
          r.updateSelectionEllipseDraft(rx + w/2, ry + h/2, w/2, h/2, mode);
        } else if (activeTool === Tool.Lasso) {
          selectionPointsRef.current.push(cp);
          r.updateSelectionPolygonDraft(selectionPointsRef.current, mode);
        } else if (activeTool === Tool.QuickSelection) {
          r.updateSelectionQuickDraft(Math.round(cp.x), Math.round(cp.y), 10, 32, mode);
        }
      } else if (e.buttons === 1 && activeTool !== Tool.Fill) {
        applyToolStroke(cp.x, cp.y);
      }
    },
    [activeTool, applyToolStroke, setCursor, setPan],
  );

  const onUp = useCallback(() => {
    panningRef.current = false;
    const r = rendererRef.current;

    if (isSelectingRef.current && r) {
      isSelectingRef.current = false;
      const finalMask = r.commitSelectionDraft();
      const bounds = getSelectionBounds(finalMask, r.getDocWidth(), r.getDocHeight());

      if (!bounds) {
        clearSelection();
        return;
      }

      setSelection({ mask: finalMask, bounds, isActive: true });
    } else if (r) {
      // After finishing a stroke, sync the final pixels back to the store
      const activeLayer = r.getLayerStack().getActiveLayer();
      if (activeLayer && activeLayer.pixelBuffer) {
        syncPixels(activeLayer.id, activeLayer.pixelBuffer);
      }
    }
  }, [clearSelection, setSelection, syncPixels]);

  const handleInvert = () => {
    const r = rendererRef.current;
    if (!r) return;
    
    // Sync BEFORE action
    const activeLayer = r.getLayerStack().getActiveLayer();
    if (activeLayer && activeLayer.pixelBuffer) {
      syncPixels(activeLayer.id, activeLayer.pixelBuffer);
    }
    commitHistory();
    
    r.invertLayer();
    
    // Sync AFTER action
    if (activeLayer && activeLayer.pixelBuffer) {
      syncPixels(activeLayer.id, activeLayer.pixelBuffer);
    }
  };

  return (
    <main className="canvas-area">
      <div className="opts">
        <div className="og">
          <span className="ol">Mode</span>
          <button className="ob active">Rectangle</button>
          <button className="ob">Fixed Ratio</button>
          <button className="ob">Fixed Size</button>
        </div>
        <div className="osep"></div>
        <div className="og">
          <span className="ol">Feather</span>
          <input type="range" className="osl" min="0" max="100" defaultValue="0" />
          <span className="ov">0px</span>
        </div>
        <div className="osep"></div>
        <div className="og">
          <span className="ol">AA</span>
          <button className="ob active">ON</button>
        </div>
        <div className="osep"></div>
        <div className="og">
          <button className="ob d">✕ Deselect</button>
          <button className="ob" onClick={handleInvert} style={{ marginLeft: 3 }}>Invert</button>
          <button className="ob" style={{ marginLeft: 3 }}>Grow</button>
        </div>
      </div>

      <div className="cwr">
        <div className="rc"></div>
        <div className="ruler rh"><div className="rt"></div></div>
        <div className="ruler rv"><div className="rt"></div></div>
        <div
          ref={vpRef}
          className="vp"
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        >
          <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, display: "block" }} />
          {doc && (
            <div className="clabel">
              <em>{doc.layers[0]?.name ?? "Untitled"}</em> — {doc.width} × {doc.height} px
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
