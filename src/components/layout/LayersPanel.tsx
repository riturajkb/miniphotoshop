import { useState, useRef, useCallback, useEffect } from "react";
import {
  canRemoveLayer,
  useDocumentStore,
  selectLayers,
} from "../../store/documentStore";
import { useEditorStore } from "../../store/editorStore";

const BLEND_MODES = [
  "Normal",
  "Dissolve",
  "Multiply",
  "Screen",
  "Overlay",
  "Soft Light",
  "Hard Light",
  "Color Dodge",
  "Color Burn",
  "Darken",
  "Lighten",
  "Difference",
  "Exclusion",
  "Hue",
  "Saturation",
  "Color",
  "Luminosity",
];

export function LayersPanel() {
  const layers = useDocumentStore(selectLayers);
  const activeLayerId = useDocumentStore((s) => s.activeLayerId);
  const setActiveLayer = useDocumentStore((s) => s.setActiveLayer);
  const updateLayer = useDocumentStore((s) => s.updateLayer);
  const removeLayer = useDocumentStore((s) => s.removeLayer);
  const moveLayer = useDocumentStore((s) => s.moveLayer);
  const rendererRef = useEditorStore((s) => s.rendererRef);
  const document = useDocumentStore((s) => s.document);
  const canDeleteActiveLayer = canRemoveLayer(document, activeLayerId);

  // Drag state: which display index is being dragged, where is it hovering
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [rowH, setRowH] = useState(34);
  const isDragging = dragFrom !== null;

  const listRef = useRef<HTMLDivElement>(null);

  // Keep mutable refs so closures always have current values
  const moveLayerRef = useRef(moveLayer);
  const rendererRefRef = useRef(rendererRef);
  const layersLenRef = useRef(layers.length);
  useEffect(() => {
    moveLayerRef.current = moveLayer;
    rendererRefRef.current = rendererRef;
    layersLenRef.current = layers.length;
  });

  // UI shows layers top-to-bottom (reversed from data model)
  const displayLayers = [...layers].reverse();

  function toggleVisibility(id: string) {
    const layer = layers.find((l) => l.id === id);
    if (layer) updateLayer(id, { visible: !layer.visible });
  }

  function handleSelectLayer(id: string) {
    setActiveLayer(id);
    rendererRef?.getLayerStack().setActiveLayer(id);
  }

  function handleDeleteLayer() {
    if (!canDeleteActiveLayer || !activeLayerId) return;
    removeLayer(activeLayerId);
  }

  // ===== Drag start handler =====
  const handleGripMouseDown = useCallback(
    (e: React.MouseEvent, displayIndex: number) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const listEl = listRef.current;
      if (!listEl) return;

      const rows = listEl.querySelectorAll<HTMLElement>("[data-layer-id]");
      if (rows.length === 0) return;

      const measuredRowH = rows[0].getBoundingClientRect().height;
      const listRect = listEl.getBoundingClientRect();
      const startMouseY = e.clientY - listRect.top + listEl.scrollTop;
      const count = rows.length;

      setRowH(measuredRowH);
      setDragFrom(displayIndex);
      setDragOver(displayIndex);
      setDragY(startMouseY);

      const onMove = (me: MouseEvent) => {
        const mouseY = me.clientY - listRect.top + listEl.scrollTop;
        const rawIdx = Math.round(mouseY / measuredRowH - 0.5);
        const clamped = Math.max(0, Math.min(count - 1, rawIdx));
        setDragY(mouseY);
        setDragOver(clamped);
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);

        // Read the final values from state via a callback
        setDragOver((finalOver) => {
          setDragFrom((finalFrom) => {
            if (finalFrom !== null && finalOver !== null && finalFrom !== finalOver) {
              const len = layersLenRef.current;
              const fromData = len - 1 - finalFrom;
              const toData = len - 1 - finalOver;
              moveLayerRef.current(fromData, toData);
              rendererRefRef.current?.getLayerStack().reorderLayer(fromData, toData);
              rendererRefRef.current?.forceRender();
            }
            return null; // clear dragFrom
          });
          return null; // clear dragOver
        });
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [],
  );

  // ===== Compute per-row transform during drag =====
  function getRowStyle(displayIndex: number): React.CSSProperties {
    if (dragFrom === null || dragOver === null) return {};

    if (displayIndex === dragFrom) {
      // Dragged row follows mouse
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

    // Other rows shift to make room
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
        minHeight: "180px",
      }}
    >
      <div className="panel-header">Layers</div>

      {/* Blend mode + opacity */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 8px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg-panel)",
        }}
      >
        <select
          className="ps-select"
          style={{ flex: 1, fontSize: "11px" }}
          defaultValue="Normal"
        >
          {BLEND_MODES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
          <span style={{ fontSize: "10px", color: "var(--color-text-dim)" }}>Opac</span>
          <input
            type="number"
            defaultValue={100}
            min={0}
            max={100}
            className="ps-input mono"
            style={{ width: "36px", textAlign: "right", fontSize: "11px" }}
          />
          <span style={{ fontSize: "10px", color: "var(--color-text-dim)" }}>%</span>
        </div>
      </div>

      {/* Layer list */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          position: "relative",
          cursor: isDragging ? "grabbing" : undefined,
          userSelect: isDragging ? "none" : undefined,
        }}
      >
        {displayLayers.map((layer, di) => {
          const isSelected = layer.id === activeLayerId;
          const isBeingDragged = dragFrom === di;
          const rowStyle = getRowStyle(di);

          // Show drop indicator on the target row
          const showIndicator =
            isDragging && !isBeingDragged && dragOver === di;

          return (
            <div
              key={layer.id}
              data-layer-id={layer.id}
              className={`layer-row${isSelected ? " selected" : ""}${isBeingDragged ? " dragging" : ""}`}
              onClick={() => {
                if (!isDragging) handleSelectLayer(layer.id);
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

              {/* Grip handle */}
              <div
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
                  padding: "4px 2px",
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

              {/* Visibility toggle */}
              <button
                title={layer.visible ? "Hide layer" : "Show layer"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVisibility(layer.id);
                }}
                style={{
                  width: "16px",
                  height: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: layer.visible ? "var(--color-text-muted)" : "var(--color-text-dim)",
                  flexShrink: 0,
                  padding: 0,
                  opacity: layer.visible ? 1 : 0.35,
                }}
              >
                <svg viewBox="0 0 14 14" width="13" height="13" fill="none">
                  {layer.visible ? (
                    <>
                      <ellipse cx="7" cy="7" rx="5" ry="3.5" stroke="currentColor" strokeWidth="1.1" />
                      <circle cx="7" cy="7" r="1.8" fill="currentColor" />
                    </>
                  ) : (
                    <>
                      <ellipse cx="7" cy="7" rx="5" ry="3.5" stroke="currentColor" strokeWidth="1.1" opacity="0.4" />
                      <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                    </>
                  )}
                </svg>
              </button>

              {/* Thumbnail */}
              <div
                className="checkerboard"
                style={{
                  width: "26px",
                  height: "22px",
                  border: `1px solid ${isSelected ? "var(--color-accent)" : "var(--color-border)"}`,
                  borderRadius: "2px",
                  flexShrink: 0,
                  background: layer.name === "Background" ? "#ffffff" : undefined,
                  overflow: "hidden",
                }}
              >
                {layer.name === "Background" && (
                  <div style={{ width: "100%", height: "100%", background: "#ffffff" }} />
                )}
              </div>

              {/* Layer name */}
              <span
                style={{
                  flex: 1,
                  fontSize: "12px",
                  color: isSelected ? "var(--color-text-bright)" : "var(--color-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
              >
                {layer.name}
              </span>

              {/* Lock icon */}
              {layer.locked && (
                <svg viewBox="0 0 12 12" width="10" height="10" fill="none" style={{ color: "var(--color-text-dim)", flexShrink: 0 }}>
                  <rect x="2" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
                  <path d="M4 5V4a2 2 0 014 0v1" stroke="currentColor" strokeWidth="1" fill="none" />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Layer actions footer */}
      <div
        style={{
          height: "30px",
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          padding: "0 6px",
          gap: "2px",
          background: "var(--color-bg-panel)",
        }}
      >
        <LayerActionBtn
          title="New Layer"
          icon={
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
              <rect x="1" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
              <path d="M4 1h6a1 1 0 011 1v6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <path d="M5 7V9M4 8h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          }
        />
        <LayerActionBtn
          title="Duplicate Layer"
          icon={
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
              <rect x="3" y="1" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
              <rect x="1" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          }
        />
        <LayerActionBtn
          title="Merge Down"
          icon={
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
              <path d="M6 2v7M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="1" y1="11" x2="11" y2="11" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          }
        />
        <div style={{ flex: 1 }} />
        <LayerActionBtn
          title="Delete Layer"
          danger
          disabled={!canDeleteActiveLayer}
          onClick={handleDeleteLayer}
          icon={
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
              <path d="M2 3h8M4 3V2h4v1M5 5v4M7 5v4M3 3l1 7h4l1-7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
      </div>
    </div>
  );
}

function LayerActionBtn({
  title,
  icon,
  danger,
  disabled,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: "24px",
        height: "22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        borderRadius: "3px",
        cursor: disabled ? "default" : "pointer",
        color: danger ? "var(--color-text-dim)" : "var(--color-text-muted)",
        transition: "background 0.1s, color 0.1s",
        padding: 0,
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseOver={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = danger ? "rgba(255,85,85,0.12)" : "var(--color-bg-hover)";
        e.currentTarget.style.color = danger ? "var(--color-danger)" : "var(--color-text-bright)";
      }}
      onMouseOut={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = danger ? "var(--color-text-dim)" : "var(--color-text-muted)";
      }}
    >
      {icon}
    </button>
  );
}
