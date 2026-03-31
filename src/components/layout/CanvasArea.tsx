import { useRef, useEffect, useCallback, useState } from "react";
import { Renderer } from "../../engine";
import { useEditorStore } from "../../store/editorStore";
import { useToolStore } from "../../store/toolStore";
import { useColorStore } from "../../store/colorStore";
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

type TransformHandle = "move" | "nw" | "ne" | "sw" | "se" | "rotate";

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
  angle: number,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(docWidth * docHeight * 4);
  const targetWidth = Math.max(1, Math.round(targetBounds.width));
  const targetHeight = Math.max(1, Math.round(targetBounds.height));
  const centerX = targetBounds.x + targetBounds.width / 2;
  const centerY = targetBounds.y + targetBounds.height / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const halfWidth = targetWidth / 2;
  const halfHeight = targetHeight / 2;
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: -halfWidth, y: halfHeight },
    { x: halfWidth, y: halfHeight },
  ].map(({ x, y }) => ({
    x: centerX + x * cos - y * sin,
    y: centerY + x * sin + y * cos,
  }));

  const minX = Math.max(
    0,
    Math.floor(Math.min(...corners.map((corner) => corner.x))),
  );
  const maxX = Math.min(
    docWidth - 1,
    Math.ceil(Math.max(...corners.map((corner) => corner.x))),
  );
  const minY = Math.max(
    0,
    Math.floor(Math.min(...corners.map((corner) => corner.y))),
  );
  const maxY = Math.min(
    docHeight - 1,
    Math.ceil(Math.max(...corners.map((corner) => corner.y))),
  );

  for (let destY = minY; destY <= maxY; destY++) {
    for (let destX = minX; destX <= maxX; destX++) {
      const relX = destX + 0.5 - centerX;
      const relY = destY + 0.5 - centerY;
      const localX = relX * cos + relY * sin + halfWidth;
      const localY = -relX * sin + relY * cos + halfHeight;

      if (localX < 0 || localX >= targetWidth || localY < 0 || localY >= targetHeight) {
        continue;
      }

      const srcX = Math.min(
        sourceWidth - 1,
        Math.max(0, Math.floor((localX / targetWidth) * sourceWidth)),
      );
      const srcY = Math.min(
        sourceHeight - 1,
        Math.max(0, Math.floor((localY / targetHeight) * sourceHeight)),
      );

      const srcIdx = (srcY * sourceWidth + srcX) * 4;
      const destIdx = (destY * docWidth + destX) * 4;

      output[destIdx] = sourcePixels[srcIdx];
      output[destIdx + 1] = sourcePixels[srcIdx + 1];
      output[destIdx + 2] = sourcePixels[srcIdx + 2];
      output[destIdx + 3] = sourcePixels[srcIdx + 3];
    }
  }

  return output;
}

function rotateVector(x: number, y: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function translatePixels(
  sourcePixels: Uint8ClampedArray,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    const destY = y + offsetY;
    if (destY < 0 || destY >= height) continue;

    for (let x = 0; x < width; x++) {
      const destX = x + offsetX;
      if (destX < 0 || destX >= width) continue;

      const srcIdx = (y * width + x) * 4;
      const destIdx = (destY * width + destX) * 4;
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
  const movePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const transformPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const frameRef = useRef<number>(0);
  const movePreviewFrameRef = useRef<number>(0);
  const transformPreviewFrameRef = useRef<number>(0);
  const panningRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const transformBoundsRef = useRef<Bounds | null>(null);
  const transformAngleRef = useRef(0);
  const previousToolRef = useRef<Tool>(Tool.Brush);
  const pendingTransformPreviewRef = useRef<{
    bounds: Bounds;
    angle: number;
  } | null>(null);
  const pendingMovePreviewRef = useRef<{
    offsetX: number;
    offsetY: number;
  } | null>(null);
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
    startAngle: number;
  } | null>(null);
  const moveDragRef = useRef<{
    layerId: string;
    startPoint: { x: number; y: number };
    sourcePixels: Uint8ClampedArray;
    originalTransformSource: Layer["transformSource"];
    currentOffset: { x: number; y: number };
    previewSourcePixels: Uint8ClampedArray;
    previewSourceWidth: number;
    previewSourceHeight: number;
    previewBounds: Bounds;
    previewAngle: number;
  } | null>(null);
  const [transformBounds, setTransformBounds] = useState<Bounds | null>(null);
  const [transformAngle, setTransformAngle] = useState(0);
  const [isTransformDragging, setIsTransformDragging] = useState(false);
  const [isMoveDragging, setIsMoveDragging] = useState(false);
  const [movePreviewOffset, setMovePreviewOffset] = useState({ x: 0, y: 0 });

  const movePreviewTransformSource = moveDragRef.current?.originalTransformSource ?? null;

  const { activeTool, transformActive, setTool, setTransformActive, setZoom, setPan, setViewport, setRendererRef, zoom, pan } =
    useEditorStore();

  const endTransformSession = useCallback(() => {
    const activeSession = transformSessionRef.current;
    const renderer = rendererRef.current;
    if (activeSession && renderer) {
      const layer = renderer.getLayerStack().getLayer(activeSession.layerId);
      if (layer && !layer.visible) {
        layer.visible = true;
        layer.dirty = true;
        renderer.scheduleRender();
      }
    }

    setTransformActive(false);
    transformSessionRef.current = null;
    transformBoundsRef.current = null;
    transformAngleRef.current = 0;
    transformDragRef.current = null;
    pendingTransformPreviewRef.current = null;
    if (transformPreviewFrameRef.current !== 0) {
      cancelAnimationFrame(transformPreviewFrameRef.current);
      transformPreviewFrameRef.current = 0;
    }
    setTransformBounds(null);
    setTransformAngle(0);
    setIsTransformDragging(false);
  }, [setTransformActive]);
  const brushSettings = useToolStore((state) => state.brush);
  const pencilSettings = useToolStore((state) => state.pencil);
  const eraserSettings = useToolStore((state) => state.eraser);
  const fillSettings = useToolStore((state) => state.fill);
  const selectionSettings = useToolStore((state) => state.selection);
  const setFillTolerance = useToolStore((state) => state.setFillTolerance);
  const setFillContiguous = useToolStore((state) => state.setFillContiguous);
  const foregroundColor = useColorStore((state) => state.foregroundColor);
  const { setDocument, document: doc, undo, redo, commitHistory, syncPixels, updateLayer, activeLayerId, setSelection, clearSelection } = useDocumentStore();

  const isSelectingRef = useRef(false);
  const lastBrushPointRef = useRef<{ x: number, y: number } | null>(null);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const selectionPointsRef = useRef<{ x: number, y: number }[]>([]);
  const selectionModeRef = useRef<import("../../types/editor").SelectionMode>("replace");

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const r = rendererRef.current;
    const vp = vpRef.current;
    if (!r || !vp) return null;
    const { left, top } = vp.getBoundingClientRect();
    return r.screenToCanvasPrecise(clientX - left, clientY - top);
  }, []);

  const ensureRenderLoop = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer || frameRef.current !== 0 || !renderer.needsAnimationFrame()) {
      return;
    }

    const tick = () => {
      const activeRenderer = rendererRef.current;
      if (!activeRenderer) {
        frameRef.current = 0;
        return;
      }

      activeRenderer.render();

      if (activeRenderer.needsAnimationFrame()) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = 0;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const buildTransformPixels = useCallback((bounds: Bounds, angle: number) => {
    const renderer = rendererRef.current;
    const docState = useDocumentStore.getState().document;
    const session = transformSessionRef.current;
    if (!renderer || !docState || !session) return null;

    return renderTransformedPixels(
      session.sourcePixels,
      session.sourceWidth,
      session.sourceHeight,
      docState.width,
      docState.height,
      bounds,
      angle,
    );
  }, []);

  const scheduleMovePreview = useCallback((offsetX: number, offsetY: number) => {
    pendingMovePreviewRef.current = { offsetX, offsetY };
    if (movePreviewFrameRef.current !== 0) return;

    movePreviewFrameRef.current = requestAnimationFrame(() => {
      movePreviewFrameRef.current = 0;
      const pending = pendingMovePreviewRef.current;
      if (!pending) return;
      pendingMovePreviewRef.current = null;
      setMovePreviewOffset({ x: pending.offsetX, y: pending.offsetY });
    });
  }, []);

  const scheduleTransformPreview = useCallback((bounds: Bounds, angle: number) => {
    pendingTransformPreviewRef.current = { bounds, angle };
    if (transformPreviewFrameRef.current !== 0) return;

    transformPreviewFrameRef.current = requestAnimationFrame(() => {
      transformPreviewFrameRef.current = 0;
      const pending = pendingTransformPreviewRef.current;
      if (!pending) return;

      pendingTransformPreviewRef.current = null;
      transformBoundsRef.current = pending.bounds;
      transformAngleRef.current = pending.angle;
      setTransformBounds(pending.bounds);
      setTransformAngle(pending.angle);
    });
  }, []);

  const syncLayerPixelsIfNeeded = useCallback((layerId: string, pixels: Uint8ClampedArray) => {
    const currentDoc = useDocumentStore.getState().document;
    const currentLayer = currentDoc?.layers.find((layer) => layer.id === layerId);
    if (!currentLayer) return;
    if (currentLayer.pixels === pixels && currentLayer.transformSource === null) {
      return;
    }
    syncPixels(layerId, pixels);
  }, [syncPixels]);

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
        startAngle: transformAngleRef.current,
      };
      setIsTransformDragging(true);

      const layer = rendererRef.current?.getLayerStack().getLayer(session.layerId);
      if (layer && layer.visible) {
        layer.visible = false;
        layer.dirty = true;
        rendererRef.current?.scheduleRender();
      }

      const onMove = (event: MouseEvent) => {
        const currentPoint = getCanvasPoint(event.clientX, event.clientY);
        const dragState = transformDragRef.current;
        if (!currentPoint || !dragState) return;

        let nextBounds: Bounds = dragState.startBounds;
        let nextAngle = dragState.startAngle;

        if (dragState.handle === "move") {
          nextBounds = {
            ...dragState.startBounds,
            x: dragState.startBounds.x + (currentPoint.x - dragState.startPoint.x),
            y: dragState.startBounds.y + (currentPoint.y - dragState.startPoint.y),
          };
        } else if (dragState.handle === "rotate") {
          const centerX = dragState.startBounds.x + dragState.startBounds.width / 2;
          const centerY = dragState.startBounds.y + dragState.startBounds.height / 2;
          const startRotation = Math.atan2(
            dragState.startPoint.y - centerY,
            dragState.startPoint.x - centerX,
          );
          const currentRotation = Math.atan2(
            currentPoint.y - centerY,
            currentPoint.x - centerX,
          );
          nextAngle = dragState.startAngle + (currentRotation - startRotation);
        } else {
          const start = dragState.startBounds;
          const startCenterX = start.x + start.width / 2;
          const startCenterY = start.y + start.height / 2;
          const handleSigns =
            dragState.handle === "nw"
              ? { x: -1, y: -1 }
              : dragState.handle === "ne"
                ? { x: 1, y: -1 }
                : dragState.handle === "sw"
                  ? { x: -1, y: 1 }
                  : { x: 1, y: 1 };

          const anchorOffset = rotateVector(
            -handleSigns.x * start.width / 2,
            -handleSigns.y * start.height / 2,
            dragState.startAngle,
          );
          const anchorPoint = {
            x: startCenterX + anchorOffset.x,
            y: startCenterY + anchorOffset.y,
          };

          const localDiff = rotateVector(
            currentPoint.x - anchorPoint.x,
            currentPoint.y - anchorPoint.y,
            -dragState.startAngle,
          );

          const nextWidth = Math.max(1, Math.abs(localDiff.x));
          const nextHeight = Math.max(1, Math.abs(localDiff.y));
          const movingOffset = rotateVector(
            handleSigns.x * nextWidth,
            handleSigns.y * nextHeight,
            dragState.startAngle,
          );
          const nextCenter = {
            x: anchorPoint.x + movingOffset.x / 2,
            y: anchorPoint.y + movingOffset.y / 2,
          };

          nextBounds = {
            x: nextCenter.x - nextWidth / 2,
            y: nextCenter.y - nextHeight / 2,
            width: nextWidth,
            height: nextHeight,
          };
        }

        scheduleTransformPreview(nextBounds, nextAngle);
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);

        if (transformPreviewFrameRef.current !== 0) {
          cancelAnimationFrame(transformPreviewFrameRef.current);
          transformPreviewFrameRef.current = 0;
        }

        const activeSession = transformSessionRef.current;
        const pendingPreview = pendingTransformPreviewRef.current;
        const currentBounds = pendingPreview?.bounds ?? transformBoundsRef.current;
        const currentAngle = pendingPreview?.angle ?? transformAngleRef.current;
        const previewPixels =
          currentBounds ? buildTransformPixels(currentBounds, currentAngle) : null;
        if (previewPixels && activeSession && currentBounds) {
          updateLayer(activeSession.layerId, {
            pixels: previewPixels,
            transformSource: {
              pixels: activeSession.sourcePixels,
              width: activeSession.sourceWidth,
              height: activeSession.sourceHeight,
              angle: currentAngle,
              bounds: {
                x: currentBounds.x,
                y: currentBounds.y,
                width: currentBounds.width,
                height: currentBounds.height,
              },
            },
          });
        }

        const layer = rendererRef.current?.getLayerStack().getLayer(activeSession?.layerId ?? "");
        if (layer && !layer.visible) {
          layer.visible = true;
          layer.dirty = true;
          rendererRef.current?.scheduleRender();
        }

        transformDragRef.current = null;
        pendingTransformPreviewRef.current = null;
        setIsTransformDragging(false);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [buildTransformPixels, getCanvasPoint, scheduleTransformPreview, updateLayer],
  );

  const applyToolStroke = useCallback((x: number, y: number, fromX: number, fromY: number) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const px = Math.round(x);
    const py = Math.round(y);
    const fX = Math.round(fromX);
    const fY = Math.round(fromY);

    switch (activeTool) {
      case Tool.Brush:
        renderer.drawBrushStroke(fX, fY, px, py, foregroundColor, {
          size: brushSettings.size,
          hardness: brushSettings.hardness,
          opacity: brushSettings.opacity,
          flow: brushSettings.flow,
          spacing: 25 // standard photoshop spacing
        });
        break;
      case Tool.Pencil:
        renderer.drawBrushStroke(fX, fY, px, py, foregroundColor, {
          size: pencilSettings.size,
          hardness: 100, // pencil is always hard-edge
          opacity: pencilSettings.opacity,
          flow: pencilSettings.flow,
          spacing: 15
        });
        break;
      case Tool.Eraser:
        renderer.drawBrushStroke(fX, fY, px, py, { r: 0, g: 0, b: 0, a: 0 }, {
          size: eraserSettings.size,
          hardness: eraserSettings.hardness,
          opacity: eraserSettings.opacity,
          flow: 100, // standard eraser flow
          spacing: 25
        });
        break;
      case Tool.Fill:
        renderer.fill(
          px,
          py,
          foregroundColor,
          fillSettings.tolerance,
          fillSettings.contiguous,
        );
        break;
      default:
        break;
    }
  }, [activeTool, fillSettings.contiguous, fillSettings.tolerance, foregroundColor, brushSettings, pencilSettings, eraserSettings]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key.toLowerCase() === "t") {
        e.preventDefault();
        if (doc && activeLayerId && activeLayerId !== "layer-bg") {
          setTransformActive(true);
          setTool(Tool.Move);
        }
      } else if (e.key === "Enter" && transformActive) {
        e.preventDefault();
        endTransformSession();
        setTool(previousToolRef.current);
      } else if (e.key === "Escape" || (isMod && e.key === "d")) {
        e.preventDefault();
        if (transformActive) {
          endTransformSession();
          setTool(previousToolRef.current);
        } else {
          clearSelection();
        }
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
  }, [activeLayerId, clearSelection, doc, endTransformSession, redo, setTool, setTransformActive, transformActive, undo]);

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
      ensureRenderLoop();
    }
  }, [doc, activeLayerId, ensureRenderLoop]);

  useEffect(() => {
    if (
      !transformActive ||
      activeTool !== Tool.Move ||
      !doc ||
      !activeLayerId ||
      transformDragRef.current
    ) {
      if (!transformActive || activeTool !== Tool.Move) {
        endTransformSession();
      }
      return;
    }

    const activeLayer = doc.layers.find((layer) => layer.id === activeLayerId);
    if (!activeLayer?.pixels || activeLayer.id === "layer-bg") {
      endTransformSession();
      return;
    }

    const bounds = activeLayer.transformSource?.bounds ??
      getLayerBounds(activeLayer.pixels, doc.width, doc.height);
    if (!bounds) {
      endTransformSession();
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
    transformAngleRef.current = activeLayer.transformSource?.angle ?? 0;
    transformBoundsRef.current = bounds;
    setTransformAngle(transformAngleRef.current);
    setTransformBounds(bounds);
  }, [activeLayerId, activeTool, doc, endTransformSession, transformActive]);

  useEffect(() => {
    const previewCanvas = transformPreviewCanvasRef.current;
    const session = transformSessionRef.current;
    if (!previewCanvas || !session) return;

    previewCanvas.width = session.sourceWidth;
    previewCanvas.height = session.sourceHeight;
    const ctx = previewCanvas.getContext("2d");
    if (!ctx) return;

    const imageData = new ImageData(
      new Uint8ClampedArray(session.sourcePixels),
      session.sourceWidth,
      session.sourceHeight,
    );
    ctx.clearRect(0, 0, session.sourceWidth, session.sourceHeight);
    ctx.putImageData(imageData, 0, 0);
  }, [activeLayerId, doc, isTransformDragging, transformActive]);

  useEffect(() => {
    const previewCanvas = movePreviewCanvasRef.current;
    const drag = moveDragRef.current;
    if (!previewCanvas || !drag || !isMoveDragging || !doc) return;

    previewCanvas.width = drag.previewSourceWidth;
    previewCanvas.height = drag.previewSourceHeight;
    const ctx = previewCanvas.getContext("2d");
    if (!ctx) return;

    const imageData = new ImageData(
      new Uint8ClampedArray(drag.previewSourcePixels),
      drag.previewSourceWidth,
      drag.previewSourceHeight,
    );
    ctx.clearRect(0, 0, drag.previewSourceWidth, drag.previewSourceHeight);
    ctx.putImageData(imageData, 0, 0);
  }, [doc, isMoveDragging]);

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
      renderer.syncDocument(newDoc, "layer-bg");

      renderer.fitToViewport(w, h);
      renderer.forceRender();

      rendererRef.current = renderer;
      setRendererRef(renderer);
      setZoom(renderer.getZoom() * 100);
      setPan(renderer.getPan());
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
      cancelAnimationFrame(movePreviewFrameRef.current);
      cancelAnimationFrame(transformPreviewFrameRef.current);
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
        if (transformActive) {
          panningRef.current = false;
          return;
        }

        const activeLayer = r.getLayerStack().getActiveLayer();
        if (!activeLayer || activeLayer.id === "layer-bg" || activeLayer.locked || !activeLayer.pixelBuffer) {
          panningRef.current = false;
          return;
        }

        commitHistory();
        const originalTransformSource =
          useDocumentStore.getState().document?.layers.find((layer) => layer.id === activeLayer.id)?.transformSource ?? null;
        const previewBounds = originalTransformSource?.bounds ?? {
          x: 0,
          y: 0,
          width: r.getDocWidth(),
          height: r.getDocHeight(),
        };
        moveDragRef.current = {
          layerId: activeLayer.id,
          startPoint: cp,
          sourcePixels: new Uint8ClampedArray(activeLayer.pixelBuffer),
          originalTransformSource,
          currentOffset: { x: 0, y: 0 },
          previewSourcePixels: new Uint8ClampedArray(
            originalTransformSource?.pixels ?? activeLayer.pixelBuffer,
          ),
          previewSourceWidth: originalTransformSource?.width ?? r.getDocWidth(),
          previewSourceHeight: originalTransformSource?.height ?? r.getDocHeight(),
          previewBounds,
          previewAngle: originalTransformSource?.angle ?? 0,
        };
        activeLayer.visible = false;
        activeLayer.dirty = true;
        r.scheduleRender();
        setMovePreviewOffset({ x: 0, y: 0 });
        setIsMoveDragging(true);
        panningRef.current = false;
        return;
      }
      if (activeTool === Tool.Fill) {
        commitHistory();
        applyToolStroke(cp.x, cp.y, cp.x, cp.y);
        const activeLayer = r.getLayerStack().getActiveLayer();
        if (activeLayer && activeLayer.pixelBuffer) {
          syncLayerPixelsIfNeeded(activeLayer.id, activeLayer.pixelBuffer);
        }
        panningRef.current = false;
        return;
      }
      // Before starting to paint, sync current engine pixels to store and commit history
      const activeLayer = r.getLayerStack().getActiveLayer();
      if (activeLayer && activeLayer.pixelBuffer) {
        syncLayerPixelsIfNeeded(activeLayer.id, activeLayer.pixelBuffer);
      }
      commitHistory();

      applyToolStroke(cp.x, cp.y, cp.x, cp.y);
      panningRef.current = false;
      lastBrushPointRef.current = { x: cp.x, y: cp.y };
      lastRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [activeTool, applyToolStroke, commitHistory, doc?.selection?.mask, syncLayerPixelsIfNeeded, transformActive]);

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const r = rendererRef.current;
      const vp = vpRef.current;
      if (!r || !vp) return;

      const { left, top } = vp.getBoundingClientRect();
      const cp = r.screenToCanvasPrecise(e.clientX - left, e.clientY - top);
      const cxEl = document.getElementById("cx");
      if (cxEl) cxEl.textContent = Math.round(cp.x).toString();
      const cyEl = document.getElementById("cy");
      if (cyEl) cyEl.textContent = Math.round(cp.y).toString();

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
          r.updateSelectionEllipseDraft(rx + w / 2, ry + h / 2, w / 2, h / 2, mode);
        } else if (activeTool === Tool.Lasso) {
          selectionPointsRef.current.push(cp);
          r.updateSelectionPolygonDraft(selectionPointsRef.current, mode);
        } else if (activeTool === Tool.QuickSelection) {
          r.updateSelectionQuickDraft(Math.round(cp.x), Math.round(cp.y), 10, 32, mode);
        }
      } else if (e.buttons === 1 && activeTool === Tool.Move && !transformActive && moveDragRef.current) {
        const offsetX = Math.round(cp.x - moveDragRef.current.startPoint.x);
        const offsetY = Math.round(cp.y - moveDragRef.current.startPoint.y);
        moveDragRef.current.currentOffset = { x: offsetX, y: offsetY };
        scheduleMovePreview(offsetX, offsetY);
      } else if (e.buttons === 1 && activeTool !== Tool.Fill && activeTool !== Tool.Move) {
        const fromPoint = lastBrushPointRef.current || cp;
        applyToolStroke(cp.x, cp.y, fromPoint.x, fromPoint.y);
        lastBrushPointRef.current = { x: cp.x, y: cp.y };
      }
    },
    [activeTool, applyToolStroke, scheduleMovePreview, setPan, transformActive],
  );

  const onUp = useCallback(() => {
    panningRef.current = false;
    lastBrushPointRef.current = null;
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
    } else if (r && moveDragRef.current) {
      if (movePreviewFrameRef.current !== 0) {
        cancelAnimationFrame(movePreviewFrameRef.current);
        movePreviewFrameRef.current = 0;
      }

      const drag = moveDragRef.current;

      const pendingMove = pendingMovePreviewRef.current;
      if (pendingMove) {
        drag.currentOffset = {
          x: pendingMove.offsetX,
          y: pendingMove.offsetY,
        };
        setMovePreviewOffset({ x: pendingMove.offsetX, y: pendingMove.offsetY });
        pendingMovePreviewRef.current = null;
      }

      const activeLayer = r.getLayerStack().getLayer(drag.layerId);
      if (activeLayer?.pixelBuffer) {
        const currentDoc = useDocumentStore.getState().document;
        const currentLayer = currentDoc?.layers.find((layer) => layer.id === drag.layerId);
        const baseTransformSource =
          currentLayer?.transformSource ?? drag.originalTransformSource;
        const translatedPixels = baseTransformSource
          ? renderTransformedPixels(
            baseTransformSource.pixels,
            baseTransformSource.width,
            baseTransformSource.height,
            r.getDocWidth(),
            r.getDocHeight(),
            {
              x: baseTransformSource.bounds.x + drag.currentOffset.x,
              y: baseTransformSource.bounds.y + drag.currentOffset.y,
              width: baseTransformSource.bounds.width,
              height: baseTransformSource.bounds.height,
            },
            baseTransformSource.angle,
          )
          : translatePixels(
            drag.sourcePixels,
            r.getDocWidth(),
            r.getDocHeight(),
            drag.currentOffset.x,
            drag.currentOffset.y,
          );

        updateLayer(drag.layerId, {
          pixels: translatedPixels,
          transformSource: baseTransformSource
            ? {
              pixels: baseTransformSource.pixels,
              width: baseTransformSource.width,
              height: baseTransformSource.height,
              angle: baseTransformSource.angle,
              bounds: {
                x: baseTransformSource.bounds.x + drag.currentOffset.x,
                y: baseTransformSource.bounds.y + drag.currentOffset.y,
                width: baseTransformSource.bounds.width,
                height: baseTransformSource.bounds.height,
              },
            }
            : null,
        });

        activeLayer.visible = true;
        activeLayer.dirty = true;
        r.scheduleRender();
      }
      moveDragRef.current = null;
      setMovePreviewOffset({ x: 0, y: 0 });
      setIsMoveDragging(false);
    } else if (r && activeTool !== Tool.Move) {
      // After finishing a paint stroke, sync the final pixels back to the store.
      // Move/transform manage their own commit paths and should not clear transformSource here.
      const activeLayer = r.getLayerStack().getActiveLayer();
      if (activeLayer && activeLayer.pixelBuffer) {
        syncLayerPixelsIfNeeded(activeLayer.id, activeLayer.pixelBuffer);
      }
    }
  }, [clearSelection, setSelection, syncLayerPixelsIfNeeded, updateLayer]);

  const handleInvert = () => {
    const r = rendererRef.current;
    if (!r) return;

    // Sync BEFORE action
    const activeLayer = r.getLayerStack().getActiveLayer();
    if (activeLayer && activeLayer.pixelBuffer) {
      syncLayerPixelsIfNeeded(activeLayer.id, activeLayer.pixelBuffer);
    }
    commitHistory();

    r.invertLayer();

    // Sync AFTER action
    if (activeLayer && activeLayer.pixelBuffer) {
      syncLayerPixelsIfNeeded(activeLayer.id, activeLayer.pixelBuffer);
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
  const transformRotation = `rotate(${transformAngle}rad)`;
  const isSelectionTool =
    activeTool === Tool.SelectionRect ||
    activeTool === Tool.SelectionEllipse ||
    activeTool === Tool.Lasso ||
    activeTool === Tool.QuickSelection;

  return (
    <main className="canvas-area">
      <div className="opts">
        {activeTool === Tool.Fill ? (
          <>
            <div className="og">
              <span className="ol">Tolerance</span>
              <input
                type="range"
                className="osl"
                min="0"
                max="255"
                value={fillSettings.tolerance}
                onChange={(e) => setFillTolerance(parseInt(e.target.value, 10) || 0)}
              />
              <span className="ov">{fillSettings.tolerance}</span>
            </div>
            <div className="osep"></div>
            <div className="og">
              <span className="ol">Contiguous</span>
              <button
                className={`ob ${fillSettings.contiguous ? "active" : ""}`}
                onClick={() => setFillContiguous(!fillSettings.contiguous)}
              >
                {fillSettings.contiguous ? "ON" : "OFF"}
              </button>
            </div>
          </>
        ) : isSelectionTool ? (
          <>
            <div className="og">
              <span className="ol">Mode</span>
              <button className="ob active">
                {activeTool === Tool.SelectionEllipse
                  ? "Ellipse"
                  : activeTool === Tool.Lasso
                    ? "Lasso"
                    : activeTool === Tool.QuickSelection
                      ? "Quick"
                      : "Rectangle"}
              </button>
            </div>
            <div className="osep"></div>
            <div className="og">
              <span className="ol">Feather</span>
              <input type="range" className="osl" min="0" max="100" value={selectionSettings.feather} readOnly />
              <span className="ov">{selectionSettings.feather}px</span>
            </div>
            <div className="osep"></div>
            <div className="og">
              <span className="ol">AA</span>
              <button className={`ob ${selectionSettings.antiAlias ? "active" : ""}`}>
                {selectionSettings.antiAlias ? "ON" : "OFF"}
              </button>
            </div>
            <div className="osep"></div>
            <div className="og">
              <button className="ob d" onClick={clearSelection}>✕ Deselect</button>
              <button className="ob" onClick={handleInvert} style={{ marginLeft: 3 }}>Invert</button>
            </div>
          </>
        ) : activeTool === Tool.Brush || activeTool === Tool.Pencil ? (
          <>
            <div className="og">
              <span className="ol">{activeTool === Tool.Brush ? "Brush" : "Pencil"}</span>
            </div>
            <div className="osep"></div>
            <div className="og">
              <span className="ol">Size</span>
              <input type="range" className="osl" min="1" max="500" value={activeTool === Tool.Brush ? brushSettings.size : pencilSettings.size} onChange={(e) => useToolStore.getState().setBrushSize(parseInt(e.target.value) || 1)} />
              <input type="number" className="osl" style={{ width: 40, background: 'transparent', color: 'var(--mist)', border: 'none', borderBottom: '1px solid var(--cinder)', padding: 0 }} min="1" max="500" value={activeTool === Tool.Brush ? brushSettings.size : pencilSettings.size} onChange={(e) => useToolStore.getState().setBrushSize(parseInt(e.target.value) || 1)} />
              <span className="ov">px</span>
            </div>
            <div className="osep"></div>
            <div className="og">
              <span className="ol">Hardness</span>
              <input type="range" className="osl" min="0" max="100" value={activeTool === Tool.Brush ? brushSettings.hardness : 100} onChange={(e) => useToolStore.getState().setBrushHardness(parseInt(e.target.value) || 0)} disabled={activeTool === Tool.Pencil} />
              <input type="number" className="osl" style={{ width: 40, background: 'transparent', color: 'var(--mist)', border: 'none', borderBottom: '1px solid var(--cinder)', padding: 0 }} min="0" max="100" value={activeTool === Tool.Brush ? brushSettings.hardness : 100} onChange={(e) => useToolStore.getState().setBrushHardness(parseInt(e.target.value) || 0)} disabled={activeTool === Tool.Pencil} />
              <span className="ov">%</span>
            </div>
            <div className="osep"></div>
            <div className="og">
              <span className="ol">Opacity</span>
              <input type="range" className="osl" min="0" max="100" value={activeTool === Tool.Brush ? brushSettings.opacity : pencilSettings.opacity} onChange={(e) => useToolStore.getState().setBrushOpacity(parseInt(e.target.value) || 0)} />
              <input type="number" className="osl" style={{ width: 40, background: 'transparent', color: 'var(--mist)', border: 'none', borderBottom: '1px solid var(--cinder)', padding: 0 }} min="0" max="100" value={activeTool === Tool.Brush ? brushSettings.opacity : pencilSettings.opacity} onChange={(e) => useToolStore.getState().setBrushOpacity(parseInt(e.target.value) || 0)} />
              <span className="ov">%</span>
            </div>
            <div className="osep"></div>
            <div className="og">
              <span className="ol">Flow</span>
              <input type="range" className="osl" min="0" max="100" value={activeTool === Tool.Brush ? brushSettings.flow : pencilSettings.flow} onChange={(e) => useToolStore.getState().setBrushFlow(parseInt(e.target.value) || 0)} />
              <input type="number" className="osl" style={{ width: 40, background: 'transparent', color: 'var(--mist)', border: 'none', borderBottom: '1px solid var(--cinder)', padding: 0 }} min="0" max="100" value={activeTool === Tool.Brush ? brushSettings.flow : pencilSettings.flow} onChange={(e) => useToolStore.getState().setBrushFlow(parseInt(e.target.value) || 0)} />
              <span className="ov">%</span>
            </div>
          </>
        ) : activeTool === Tool.Eraser ? (
          <>
            <div className="og">
              <span className="ol">Eraser</span>
            </div>
            <div className="osep"></div>
            <div className="og">
              <span className="ol">Size</span>
              <input type="range" className="osl" min="1" max="500" value={eraserSettings.size} onChange={(e) => useToolStore.getState().setEraserSize(parseInt(e.target.value) || 1)} />
              <input type="number" className="osl" style={{ width: 40, background: 'transparent', color: 'var(--mist)', border: 'none', borderBottom: '1px solid var(--cinder)', padding: 0 }} min="1" max="500" value={eraserSettings.size} onChange={(e) => useToolStore.getState().setEraserSize(parseInt(e.target.value) || 1)} />
              <span className="ov">px</span>
            </div>
          </>
        ) : (
          <div className="og">
            <span className="ol">Tool</span>
            <span className="ov" style={{ minWidth: 120 }}>
              {activeTool === Tool.Move
                ? transformActive
                  ? "Transform"
                  : "Move"
                : activeTool}
            </span>
          </div>
        )}
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
          {isMoveDragging && doc && (
            <canvas
              ref={movePreviewCanvasRef}
              style={{
                position: "absolute",
                left: ((movePreviewTransformSource?.bounds.x ?? 0) + movePreviewOffset.x) * (zoom / 100) + pan.x,
                top: ((movePreviewTransformSource?.bounds.y ?? 0) + movePreviewOffset.y) * (zoom / 100) + pan.y,
                width: Math.max((movePreviewTransformSource?.bounds.width ?? doc.width) * (zoom / 100), 1),
                height: Math.max((movePreviewTransformSource?.bounds.height ?? doc.height) * (zoom / 100), 1),
                transform: movePreviewTransformSource ? `rotate(${movePreviewTransformSource.angle}rad)` : undefined,
                transformOrigin: movePreviewTransformSource ? "center center" : undefined,
                pointerEvents: "none",
                imageRendering: "auto",
              }}
            />
          )}
          {transformActive && activeTool === Tool.Move && transformScreenBounds && isTransformDragging && (
            <canvas
              ref={transformPreviewCanvasRef}
              style={{
                position: "absolute",
                left: transformScreenBounds.left,
                top: transformScreenBounds.top,
                width: Math.max(transformScreenBounds.width, 1),
                height: Math.max(transformScreenBounds.height, 1),
                transform: transformRotation,
                transformOrigin: "center center",
                pointerEvents: "none",
                imageRendering: "auto",
              }}
            />
          )}
          {transformActive && activeTool === Tool.Move && transformScreenBounds && (
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
                transform: transformRotation,
                transformOrigin: "center center",
              }}
            >
              <div
                onMouseDown={(e) => beginTransformDrag("rotate", e)}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: -24,
                  width: 12,
                  height: 12,
                  marginLeft: -6,
                  borderRadius: "50%",
                  background: "#ffffff",
                  border: "1px solid #4aa3ff",
                  boxSizing: "border-box",
                  cursor: "grab",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: -12,
                  width: 1,
                  height: 12,
                  marginLeft: -0.5,
                  background: "#4aa3ff",
                }}
              />
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
