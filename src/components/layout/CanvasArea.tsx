import { useRef, useEffect, useCallback, useState } from "react";
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

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TransformHandle = "move" | "nw" | "ne" | "sw" | "se";

function getLayerBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 0) {
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

function renderTransformedPixels(
  sourcePixels: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  docWidth: number,
  docHeight: number,
  targetBounds: Bounds,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(docWidth * docHeight * 4);
  const targetWidth = Math.max(1, Math.round(targetBounds.width));
  const targetHeight = Math.max(1, Math.round(targetBounds.height));
  const targetX = Math.round(targetBounds.x);
  const targetY = Math.round(targetBounds.y);

  for (let y = 0; y < targetHeight; y++) {
    const destY = targetY + y;
    if (destY < 0 || destY >= docHeight) continue;

    const srcY = Math.min(
      sourceHeight - 1,
      Math.max(0, Math.floor((y / targetHeight) * sourceHeight)),
    );

    for (let x = 0; x < targetWidth; x++) {
      const destX = targetX + x;
      if (destX < 0 || destX >= docWidth) continue;

      const srcX = Math.min(
        sourceWidth - 1,
        Math.max(0, Math.floor((x / targetWidth) * sourceWidth)),
      );

      const srcIdx =
        (srcY * sourceWidth + srcX) * 4;
      const destIdx = (destY * docWidth + destX) * 4;

      output[destIdx] = sourcePixels[srcIdx];
      output[destIdx + 1] = sourcePixels[srcIdx + 1];
      output[destIdx + 2] = sourcePixels[srcIdx + 2];
      output[destIdx + 3] = sourcePixels[srcIdx + 3];
    }
  }

  return output;
}

export function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vpRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const frameRef = useRef<number>(0);
  const panningRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const transformPreviewRef = useRef<Uint8ClampedArray | null>(null);
  const transformBoundsRef = useRef<Bounds | null>(null);
  const previousToolRef = useRef<Tool>(Tool.Brush);
  const transformSessionRef = useRef<{
    layerId: string;
    sourcePixels: Uint8ClampedArray;
    sourceWidth: number;
    sourceHeight: number;
  } | null>(null);
  const transformDragRef = useRef<{
    handle: TransformHandle;
    startPoint: { x: number; y: number };
    startBounds: Bounds;
  } | null>(null);
  const [transformBounds, setTransformBounds] = useState<Bounds | null>(null);

  const { activeTool, setTool, setZoom, setPan, setCursor, setViewport, setRendererRef, zoom, pan } =
    useEditorStore();
  const fillSettings = useToolStore((state) => state.fill);
  const { setDocument, document: doc, undo, redo, commitHistory, syncPixels, updateLayer, activeLayerId, setSelection, clearSelection } = useDocumentStore();

  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const selectionPointsRef = useRef<{x: number, y: number}[]>([]);
  const selectionModeRef = useRef<import("../../types/editor").SelectionMode>("replace");

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const r = rendererRef.current;
    const vp = vpRef.current;
    if (!r || !vp) return null;
    const { left, top } = vp.getBoundingClientRect();
    return r.screenToCanvasPrecise(clientX - left, clientY - top);
  }, []);

  const previewTransform = useCallback((bounds: Bounds) => {
    const renderer = rendererRef.current;
    const docState = useDocumentStore.getState().document;
    const session = transformSessionRef.current;
    if (!renderer || !docState || !session) return;

    const nextPixels = renderTransformedPixels(
      session.sourcePixels,
      session.sourceWidth,
      session.sourceHeight,
      docState.width,
      docState.height,
      bounds,
    );

    const layer = renderer.getLayerStack().getLayer(session.layerId);
    if (!layer) return;

    layer.pixelBuffer = nextPixels;
    layer.width = docState.width;
    layer.height = docState.height;
    layer.dirty = true;
    transformPreviewRef.current = nextPixels;
    renderer.forceRender();
  }, []);

  const beginTransformDrag = useCallback(
    (handle: TransformHandle, e: React.MouseEvent) => {
      const session = transformSessionRef.current;
      const bounds = transformBoundsRef.current;
      if (!session || !bounds) return;

      const startPoint = getCanvasPoint(e.clientX, e.clientY);
      if (!startPoint) return;

      e.preventDefault();
      e.stopPropagation();

      transformDragRef.current = {
        handle,
        startPoint,
        startBounds: bounds,
      };

      const onMove = (event: MouseEvent) => {
        const currentPoint = getCanvasPoint(event.clientX, event.clientY);
        const dragState = transformDragRef.current;
        if (!currentPoint || !dragState) return;

        let nextBounds: Bounds;

        if (dragState.handle === "move") {
          nextBounds = {
            ...dragState.startBounds,
            x: dragState.startBounds.x + (currentPoint.x - dragState.startPoint.x),
            y: dragState.startBounds.y + (currentPoint.y - dragState.startPoint.y),
          };
        } else {
          const start = dragState.startBounds;
          const right = start.x + start.width;
          const bottom = start.y + start.height;

          switch (dragState.handle) {
            case "nw":
              nextBounds = {
                x: Math.min(currentPoint.x, right - 1),
                y: Math.min(currentPoint.y, bottom - 1),
                width: Math.max(1, right - currentPoint.x),
                height: Math.max(1, bottom - currentPoint.y),
              };
              break;
            case "ne":
              nextBounds = {
                x: start.x,
                y: Math.min(currentPoint.y, bottom - 1),
                width: Math.max(1, currentPoint.x - start.x),
                height: Math.max(1, bottom - currentPoint.y),
              };
              break;
            case "sw":
              nextBounds = {
                x: Math.min(currentPoint.x, right - 1),
                y: start.y,
                width: Math.max(1, right - currentPoint.x),
                height: Math.max(1, currentPoint.y - start.y),
              };
              break;
            case "se":
            default:
              nextBounds = {
                x: start.x,
                y: start.y,
                width: Math.max(1, currentPoint.x - start.x),
                height: Math.max(1, currentPoint.y - start.y),
              };
              break;
          }
        }

        transformBoundsRef.current = nextBounds;
        setTransformBounds(nextBounds);
        previewTransform(nextBounds);
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);

        const previewPixels = transformPreviewRef.current;
        const activeSession = transformSessionRef.current;
        const currentBounds = transformBoundsRef.current;
        if (previewPixels && activeSession && currentBounds) {
          updateLayer(activeSession.layerId, {
            pixels: new Uint8ClampedArray(previewPixels),
            transformSource: {
              pixels: new Uint8ClampedArray(activeSession.sourcePixels),
              width: activeSession.sourceWidth,
              height: activeSession.sourceHeight,
              bounds: {
                x: currentBounds.x,
                y: currentBounds.y,
                width: currentBounds.width,
                height: currentBounds.height,
              },
            },
          });
        }

        transformDragRef.current = null;
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [getCanvasPoint, previewTransform, updateLayer],
  );

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
      if (isMod && e.key.toLowerCase() === "t") {
        e.preventDefault();
        if (doc && activeLayerId && activeLayerId !== "layer-bg") {
          setTool(Tool.Move);
        }
      } else if (e.key === "Enter" && activeTool === Tool.Move) {
        e.preventDefault();
        setTool(previousToolRef.current);
      } else if (e.key === "Escape" || (isMod && e.key === "d")) {
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
  }, [activeLayerId, activeTool, clearSelection, doc, redo, setTool, undo]);

  useEffect(() => {
    if (activeTool !== Tool.Move) {
      previousToolRef.current = activeTool;
    }
  }, [activeTool]);

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

  useEffect(() => {
    if (
      activeTool !== Tool.Move ||
      !doc ||
      !activeLayerId ||
      transformDragRef.current
    ) {
      if (activeTool !== Tool.Move) {
        transformSessionRef.current = null;
        transformPreviewRef.current = null;
        transformBoundsRef.current = null;
        setTransformBounds(null);
      }
      return;
    }

    const activeLayer = doc.layers.find((layer) => layer.id === activeLayerId);
    if (!activeLayer?.pixels || activeLayer.id === "layer-bg") {
      transformSessionRef.current = null;
      transformPreviewRef.current = null;
      transformBoundsRef.current = null;
      setTransformBounds(null);
      return;
    }

    const bounds = activeLayer.transformSource?.bounds ??
      getLayerBounds(activeLayer.pixels, doc.width, doc.height);
    if (!bounds) {
      transformSessionRef.current = null;
      transformPreviewRef.current = null;
      transformBoundsRef.current = null;
      setTransformBounds(null);
      return;
    }

    transformSessionRef.current = {
      layerId: activeLayer.id,
      sourcePixels: new Uint8ClampedArray(
        activeLayer.transformSource?.pixels ?? activeLayer.pixels,
      ),
      sourceWidth: activeLayer.transformSource?.width ?? doc.width,
      sourceHeight: activeLayer.transformSource?.height ?? doc.height,
    };
    transformPreviewRef.current = null;
    transformBoundsRef.current = bounds;
    setTransformBounds(bounds);
  }, [activeLayerId, activeTool, doc]);

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

      const bgLayerForStore: Layer = {
        id: "layer-bg",
        name: "Background",
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal",
        pixels: (() => {
          const pixels = new Uint8ClampedArray(DEFAULT_W * DEFAULT_H * 4);
          for (let i = 0; i < pixels.length; i += 4) {
            pixels[i] = 255;
            pixels[i + 1] = 255;
            pixels[i + 2] = 255;
            pixels[i + 3] = 255;
          }
          return pixels;
        })(),
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
      if (activeTool === Tool.Move) {
        panningRef.current = false;
        return;
      }
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
      } else if (e.buttons === 1 && activeTool !== Tool.Fill && activeTool !== Tool.Move) {
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

  const transformScreenBounds = transformBounds
    ? {
        left: transformBounds.x * (zoom / 100) + pan.x,
        top: transformBounds.y * (zoom / 100) + pan.y,
        width: transformBounds.width * (zoom / 100),
        height: transformBounds.height * (zoom / 100),
      }
    : null;

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
          {activeTool === Tool.Move && transformScreenBounds && (
            <div
              onMouseDown={(e) => beginTransformDrag("move", e)}
              style={{
                position: "absolute",
                left: transformScreenBounds.left,
                top: transformScreenBounds.top,
                width: Math.max(transformScreenBounds.width, 1),
                height: Math.max(transformScreenBounds.height, 1),
                border: "1px solid #4aa3ff",
                boxShadow: "0 0 0 1px rgba(74,163,255,0.25)",
                cursor: "move",
                boxSizing: "border-box",
              }}
            >
              {(["nw", "ne", "sw", "se"] as const).map((handle) => {
                const positionStyle =
                  handle === "nw"
                    ? { left: -5, top: -5, cursor: "nwse-resize" }
                    : handle === "ne"
                      ? { right: -5, top: -5, cursor: "nesw-resize" }
                      : handle === "sw"
                        ? { left: -5, bottom: -5, cursor: "nesw-resize" }
                        : { right: -5, bottom: -5, cursor: "nwse-resize" };

                return (
                  <div
                    key={handle}
                    onMouseDown={(e) => beginTransformDrag(handle, e)}
                    style={{
                      position: "absolute",
                      width: 10,
                      height: 10,
                      background: "#ffffff",
                      border: "1px solid #4aa3ff",
                      boxSizing: "border-box",
                      ...positionStyle,
                    }}
                  />
                );
              })}
            </div>
          )}
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
