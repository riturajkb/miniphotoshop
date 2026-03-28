import { useState, useRef, useCallback, useEffect } from "react";
import { canRemoveLayer, useDocumentStore } from "../../store/documentStore";
import { useEditorStore } from "../../store/editorStore";

export function RightPanel() {
  const {
    document,
    activeLayerId,
    setActiveLayer,
    updateLayer,
    addLayer,
    removeLayer,
    moveLayer,
  } = useDocumentStore();
  const layers = document?.layers || [];
  const canDeleteActiveLayer = canRemoveLayer(document, activeLayerId);

  const { rendererRef } = useEditorStore();

  // ===== Drag state =====
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [rowH, setRowH] = useState(40);
  const isDragging = dragFrom !== null;
  const listRef = useRef<HTMLDivElement>(null);

  // Refs for drag indices — used to read final values in onUp without
  // relying on nested setState callbacks (which React StrictMode double-invokes)
  const dragFromRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);

  // Keep mutable refs for closures
  const moveLayerRef = useRef(moveLayer);
  const rendererRefRef = useRef(rendererRef);
  const layersLenRef = useRef(layers.length);
  useEffect(() => {
    moveLayerRef.current = moveLayer;
    rendererRefRef.current = rendererRef;
    layersLenRef.current = layers.length;
  });

  // UI shows layers reversed (top = highest in stack)
  const displayLayers = [...layers].reverse();

  const handleAddLayer = () => {
    const id = `layer-${Date.now()}`;
    const name = `Layer ${(document?.layers.length || 0) + 1}`;

    addLayer({
      id,
      name,
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: "normal",
      pixels: null,
    });

    if (rendererRef) {
      rendererRef.getLayerStack().createLayer(name, undefined, id);
      rendererRef.forceRender();
    }
  };

  function toggleVisibility(id: string) {
    const layer = layers.find((l) => l.id === id);
    if (layer) updateLayer(id, { visible: !layer.visible });
  }

  const onSelectLayer = (id: string) => {
    setActiveLayer(id);
    if (rendererRef) {
      rendererRef.getLayerStack().setActiveLayer(id);
    }
  };

  const handleDeleteLayer = () => {
    if (!canDeleteActiveLayer || !activeLayerId) return;
    removeLayer(activeLayerId);
  };

  // ===== Drag start =====
  const handleGripMouseDown = useCallback(
    (e: React.MouseEvent, displayIndex: number) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const listEl = listRef.current;
      if (!listEl) return;

      const rows = listEl.querySelectorAll<HTMLElement>(".li");
      if (rows.length === 0) return;

      const measuredRowH = rows[0].getBoundingClientRect().height;
      const listRect = listEl.getBoundingClientRect();
      const startMouseY = e.clientY - listRect.top + listEl.scrollTop;
      const count = rows.length;

      // Set both state (for rendering) and refs (for reading in onUp)
      setRowH(measuredRowH);
      setDragFrom(displayIndex);
      setDragOver(displayIndex);
      setDragY(startMouseY);
      dragFromRef.current = displayIndex;
      dragOverRef.current = displayIndex;

      const onMove = (me: MouseEvent) => {
        const mouseY = me.clientY - listRect.top + listEl.scrollTop;
        const rawIdx = Math.round(mouseY / measuredRowH - 0.5);
        const clamped = Math.max(0, Math.min(count - 1, rawIdx));
        setDragY(mouseY);
        setDragOver(clamped);
        dragOverRef.current = clamped;
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);

        // Read the final indices from refs (not affected by StrictMode)
        const finalFrom = dragFromRef.current;
        const finalOver = dragOverRef.current;

        if (finalFrom !== null && finalOver !== null && finalFrom !== finalOver) {
          const len = layersLenRef.current;
          const fromData = len - 1 - finalFrom;
          const toData = len - 1 - finalOver;
          console.log("[DRAG] REORDER fromData:", fromData, "toData:", toData);
          moveLayerRef.current(fromData, toData);
          rendererRefRef.current?.getLayerStack().reorderLayer(fromData, toData);
          rendererRefRef.current?.forceRender();
        }

        // Clear state and refs
        dragFromRef.current = null;
        dragOverRef.current = null;
        setDragFrom(null);
        setDragOver(null);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [],
  );

  // ===== Per-row transform during drag =====
  function getRowStyle(displayIndex: number): React.CSSProperties {
    if (dragFrom === null || dragOver === null) return {};

    if (displayIndex === dragFrom) {
      const restY = (dragFrom + 0.5) * rowH;
      const delta = dragY - restY;
      return {
        transform: `translateY(${delta}px)`,
        zIndex: 10,
        opacity: 0.9,
        boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(192,57,43,0.3)",
        transition: "none",
        pointerEvents: "none",
      };
    }

    const t = "transform 0.15s cubic-bezier(.2,.8,.4,1)";
    if (dragFrom < dragOver) {
      if (displayIndex > dragFrom && displayIndex <= dragOver) {
        return { transform: `translateY(-${rowH}px)`, transition: t };
      }
    } else if (dragFrom > dragOver) {
      if (displayIndex >= dragOver && displayIndex < dragFrom) {
        return { transform: `translateY(${rowH}px)`, transition: t };
      }
    }

    return { transition: t };
  }

  return (
    <aside className="rp">
      <div className="ptabs">
        <div className="ptab on">Layers</div>
        <div className="ptab">History</div>
        <div className="ptab">Props</div>
      </div>

      <div className="layers-panel">
        <div className="lhdr">
          <select className="bsel" defaultValue="normal">
            <option value="normal">Normal</option>
            <option value="multiply">Multiply</option>
            <option value="screen">Screen</option>
            <option value="overlay">Overlay</option>
            <option value="softLight">Soft Light</option>
            <option value="hardLight">Hard Light</option>
            <option value="colorDodge">Color Dodge</option>
            <option value="colorBurn">Color Burn</option>
            <option value="difference">Difference</option>
            <option value="exclusion">Exclusion</option>
          </select>
          <div className="opm"><span className="opl">Op</span><div className="opv" id="opval">100%</div></div>
        </div>

        <div
          className="ll"
          ref={listRef}
          style={{
            cursor: isDragging ? "grabbing" : undefined,
            userSelect: isDragging ? "none" : undefined,
          }}
        >
          {displayLayers.map((layer, di) => {
            const isActive = activeLayerId === layer.id;
            const isBeingDragged = dragFrom === di;
            const rowStyle = getRowStyle(di);
            const showIndicator = isDragging && !isBeingDragged && dragOver === di;

            return (
              <div
                key={layer.id}
                className={`li ${isActive ? "on" : ""}${isBeingDragged ? " dragging" : ""}`}
                onClick={() => {
                  if (!isDragging) onSelectLayer(layer.id);
                }}
                style={{ position: "relative", ...rowStyle }}
              >
                {/* Drop indicator */}
                {showIndicator && (
                  <div
                    style={{
                      position: "absolute",
                      left: 4,
                      right: 4,
                      height: "2px",
                      background: "#c0392b",
                      borderRadius: "1px",
                      zIndex: 5,
                      boxShadow: "0 0 6px rgba(192,57,43,0.5)",
                      ...(dragFrom! < dragOver! ? { bottom: -1 } : { top: -1 }),
                    }}
                  />
                )}

                {/* Grip handle for drag */}
                <div
                  className="grip-handle"
                  onMouseDown={(e) => handleGripMouseDown(e, di)}
                  style={{
                    width: "10px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: isDragging ? "grabbing" : "grab",
                    flexShrink: 0,
                    opacity: 0.3,
                    padding: "4px 0",
                    marginRight: "2px",
                  }}
                  title="Drag to reorder"
                >
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="currentColor">
                    <circle cx="1.5" cy="1.5" r="1" />
                    <circle cx="4.5" cy="1.5" r="1" />
                    <circle cx="1.5" cy="5" r="1" />
                    <circle cx="4.5" cy="5" r="1" />
                    <circle cx="1.5" cy="8.5" r="1" />
                    <circle cx="4.5" cy="8.5" r="1" />
                  </svg>
                </div>

                <div className={`lvis ${layer.visible ? "" : "off"}`} onClick={(e) => {
                  e.stopPropagation();
                  updateLayer(layer.id, { visible: !layer.visible });
                }}>
                  {layer.visible ? (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 10 10">
                      <circle cx="5" cy="5" r="3.5"/><circle cx="5" cy="5" r="1.5" fill="currentColor"/>
                    </svg>
                  ) : (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 10 10">
                      <path d="M1 5s1.5-3 4-3 4 3 4 3-1.5 3-4 3-4-3-4-3z"/>
                      <path d="M2 2l6 6" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>

                <div className="lthumb" style={{ opacity: layer.visible ? 1 : 0.3 }}>
                  <div className="lthumb-img" style={{background:"linear-gradient(135deg,rgba(192,57,43,0.45),transparent)"}}></div>
                </div>

                <div className="linfo" style={{ opacity: layer.visible ? 1 : 0.35 }}>
                  <div className="lname">{layer.name}</div>
                  <div className="lmeta">
                    <span style={{ textTransform: "capitalize" }}>{layer.blendMode}</span>
                    {layer.opacity < 100 && <span>{layer.opacity}%</span>}
                  </div>
                </div>

                {layer.locked && (
                  <div className="llock">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 8 8">
                      <rect x="1.5" y="3.5" width="5" height="4" rx="0.5"/>
                      <path d="M2.5 3.5V2.5a1.5 1.5 0 013 0v1"/>
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="lftr">
          <div className="ib" title="New Layer" onClick={handleAddLayer}><svg fill="none" stroke="currentColor" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1"/><path d="M5 3v4M3 5h4" strokeLinecap="round"/></svg></div>
          <div className="ib" title="New Group"><svg fill="none" stroke="currentColor" viewBox="0 0 10 10"><path d="M1 3.5h8v5H1zM1 3.5L3 1.5h4l2 2"/></svg></div>
          <div className="ib" title="Adjustment Layer"><svg fill="none" stroke="currentColor" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.5"/><path d="M3.5 5h3M5 3.5v3" strokeLinecap="round"/></svg></div>
          <div className="ib" title="Add Mask"><svg fill="none" stroke="currentColor" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/><path d="M5 1v8M1 5h4" strokeLinecap="round"/><path d="M5 5a4 4 0 004 0" strokeLinecap="round"/></svg></div>
          <div style={{flex:1}}></div>
          <div className="ib" title="Duplicate"><svg fill="none" stroke="currentColor" viewBox="0 0 10 10"><rect x="3" y="3" width="6" height="6" rx="1"/><path d="M2 7V1.5a.5.5 0 01.5-.5H7"/></svg></div>
          <div
            className="ib del"
            title="Delete Layer"
            onClick={handleDeleteLayer}
            style={{
              opacity: canDeleteActiveLayer ? 1 : 0.4,
              pointerEvents: canDeleteActiveLayer ? "auto" : "none",
            }}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 10 10"><path d="M2 3h6M4 3V2h2v1M3.5 3l.5 5h2l.5-5"/></svg>
          </div>
        </div>

        {/* histogram */}
        <div className="hist">
          <div className="hist-lbl">Histogram <span id="hist-px">—</span></div>
          <div className="hist-bars" id="hbars">
            {[2,3,4,5,7,10,13,16,19,22,25,28,32,36,40,44,49,54,60,67,74,80,85,88,87,83,78,73,69,66,65,67,70,73,75,77,75,72,68,63,58,54,50,46,42,38,35,32,29,26,23,21,18,16,14,12,10,9,8,7,6,5,4,4,3,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2].map((v, i) => (
              <div key={i} className="hb" style={{height: Math.max(2, Math.round((v/88)*30)) + 'px'}} />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
