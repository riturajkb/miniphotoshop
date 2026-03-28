import { useRef, useEffect, useCallback } from "react";
import { Renderer } from "../../engine";
import { useEditorStore } from "../../store/editorStore";
import {
  useDocumentStore,
  createDefaultDocument,
  selectLayers,
} from "../../store/documentStore";
import type { Layer } from "../../types/editor";

const DEFAULT_W = 800;
const DEFAULT_H = 600;

export function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vpRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const frameRef = useRef<number>(0);
  const panningRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });

  const { setZoom, setPan, setCursor, setViewport, setRendererRef } =
    useEditorStore();
  const { setDocument, document: doc } = useDocumentStore();

  // mount renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    const vp = vpRef.current;
    if (!canvas || !vp) return;

    const w = Math.max(10, vp.clientWidth);
    const h = Math.max(10, vp.clientHeight);
    setViewport(w, h);

    console.log(`[CanvasArea] Mounting. vp size: ${w}x${h}`);

    const renderer = new Renderer(DEFAULT_W, DEFAULT_H);
    let isDestroyed = false;

    renderer.init(canvas, w, h).then(() => {
      if (isDestroyed) return;
      console.log(`[CanvasArea] Renderer.init() resolved! Canvas: ${canvas.width}x${canvas.height}`);
      
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

      // Create a real PixiJS Graphics object for the background
      renderer.createBackgroundGraphics();
      const bgGraphics = renderer.getBackgroundGraphics();
      if (bgGraphics) {
        bgLayerData.graphics = bgGraphics;
      }

      // Add the Background layer to the document store
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

      console.log(`[CanvasArea] forceRender done. Zoom: ${renderer.getZoom()}, Pan: ${JSON.stringify(renderer.getPan())}`);

      rendererRef.current = renderer;
      setRendererRef(renderer);
      setZoom(renderer.getZoom() * 100);
      setPan(renderer.getPan());

      // render loop
      const loop = () => {
        if (!isDestroyed) {
          renderer.render();
          frameRef.current = requestAnimationFrame(loop);
        }
      };
      frameRef.current = requestAnimationFrame(loop);
    }).catch((err: unknown) => {
      console.error("[CanvasArea] Renderer init FAILED:", err);
    });

    const rob = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (rendererRef.current && !isDestroyed) {
          const newW = Math.max(10, entry.contentRect.width);
          const newH = Math.max(10, entry.contentRect.height);
          rendererRef.current.resizeViewport(newW, newH);
          rendererRef.current.fitToViewport(newW, newH);
          setViewport(newW, newH);
          setZoom(rendererRef.current.getZoom() * 100);
          setPan(rendererRef.current.getPan());
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

  // Sync document store layer properties → engine LayerStack
  // This runs whenever layers in the store change (visibility, opacity, etc.)
  useEffect(() => {
    const unsubscribe = useDocumentStore.subscribe((state: any) => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      const storeLayers = selectLayers(state);
      const layerStack = renderer.getLayerStack();

      for (const storeLayer of storeLayers) {
        const engineLayer = layerStack.getLayer(storeLayer.id);
        if (!engineLayer) continue;

        // Sync visibility
        if (engineLayer.visible !== storeLayer.visible) {
          engineLayer.visible = storeLayer.visible;
          engineLayer.dirty = true;

          // Also toggle the PixiJS Graphics object if present (e.g., Background)
          if (engineLayer.graphics) {
            engineLayer.graphics.visible = storeLayer.visible;
          }
        }

        // Sync opacity
        if (engineLayer.opacity !== (storeLayer.opacity ?? 1)) {
          engineLayer.opacity = storeLayer.opacity ?? 1;
          engineLayer.dirty = true;
        }
      }

      renderer.forceRender();
    });

    return unsubscribe;
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
      panningRef.current = true;
      lastRef.current = { x: e.clientX, y: e.clientY };
    } else {
      const { left, top } = vp.getBoundingClientRect();
      const cp = r.screenToCanvas(e.clientX - left, e.clientY - top);
      
      // Basic painting for Brush tool
      r.drawBrush(cp.x, cp.y, { r: 50, g: 150, b: 250, a: 255 }, 20);
      panningRef.current = false;
      lastRef.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const r = rendererRef.current;
      const vp = vpRef.current;
      if (!r || !vp) return;

      const { left, top } = vp.getBoundingClientRect();
      const cp = r.screenToCanvas(e.clientX - left, e.clientY - top);
      setCursor(cp.x, cp.y);

      if (panningRef.current) {
        const dx = e.clientX - lastRef.current.x;
        const dy = e.clientY - lastRef.current.y;
        const p = r.getPan();
        r.setPan(p.x + dx, p.y + dy);
        setPan(r.getPan());
        lastRef.current = { x: e.clientX, y: e.clientY };
      } else if (e.buttons === 1) {
        // Continue painting if mouse button is held
        r.drawBrush(cp.x, cp.y, { r: 50, g: 150, b: 250, a: 255 }, 20);
      }
    },
    [setCursor, setPan],
  );

  const onUp = useCallback(() => {
    panningRef.current = false;
  }, []);

  const handleInvert = () => {
    rendererRef.current?.invertLayer();
  };

  return (
    <main className="canvas-area">
      <div className="opts">
        <div className="og">
          <span className="ol">Mode</span>
          <button
            className="ob"
            style={{
              color: "var(--ember)",
              borderColor: "rgba(192,57,43,0.3)",
            }}
          >
            Rectangle
          </button>
          <button className="ob">Fixed Ratio</button>
          <button className="ob">Fixed Size</button>
        </div>
        <div className="osep"></div>
        <div className="og">
          <span className="ol">Feather</span>
          <input
            type="range"
            className="osl"
            min="0"
            max="100"
            defaultValue="0"
          />
          <span className="ov">0px</span>
        </div>
        <div className="osep"></div>
        <div className="og">
          <span className="ol">AA</span>
          <button
            className="ob"
            style={{
              color: "var(--ember)",
              borderColor: "rgba(192,57,43,0.3)",
            }}
          >
            ON
          </button>
        </div>
        <div className="osep"></div>
        <div className="og">
          <button className="ob d">✕ Deselect</button>
          <button className="ob" style={{ marginLeft: 3 }} onClick={handleInvert}>
            Invert
          </button>
          <button className="ob" style={{ marginLeft: 3 }}>
            Grow
          </button>
        </div>
      </div>

      <div className="cwr">
        <div className="rc"></div>
        <div className="ruler rh">
          <div className="rt"></div>
        </div>
        <div className="ruler rv">
          <div className="rt"></div>
        </div>
        <div
          ref={vpRef}
          className="vp"
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        >
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              display: "block",
            }}
          />
          {doc && (
            <div className="clabel">
              <em>{doc.layers[0]?.name ?? "Untitled"}</em> — {doc.width} ×{" "}
              {doc.height} px
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
