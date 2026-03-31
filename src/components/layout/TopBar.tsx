/**
 * TopBar — contextual tool options bar.
 * Shows relevant settings for the currently active tool.
 */
import { PaintBrush, Eraser } from "@phosphor-icons/react";
import { useEditorStore } from "../../store/editorStore";
import { useToolStore } from "../../store/toolStore";
import { Tool } from "../../types/editor";

function PaintBucketSvg({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
      <path d="M238.66,163.56a8,8,0,0,0-13.32,0C223.57,166.23,208,190.09,208,208a24,24,0,0,0,48,0C256,190.09,240.43,166.23,238.66,163.56ZM232,216a8,8,0,0,1-8-8c0-6.8,4-16.32,8-24.08,4,7.76,8,17.34,8,24.08A8,8,0,0,1,232,216Zm2.53-76.93a8,8,0,0,0,3.13-13.24L122.17,10.34a8,8,0,0,0-11.31,0L70.25,51,45.65,26.34a8,8,0,0,0-11.31,11.31L59,62.3,15,106.17a24,24,0,0,0,0,33.94L99.89,225a24,24,0,0,0,33.94,0L212.7,146.12Zm-32.19-5.24-79.83,79.83a8,8,0,0,1-11.31,0L25.51,150.86a8,8,0,0,1,0-11.31L70.25,94.8l34.15,34.15a28,28,0,1,0,11.31-11.31L81.57,83.5l34.95-34.95,93.27,93.27A8,8,0,0,1,202.86,140.89ZM114.1,106.11a12,12,0,1,1,0,17,12,12,0,0,1,0-17Z" />
    </svg>
  );
}

export function TopBar() {
  const { activeTool } = useEditorStore();
  const { brush, fill, setFillTolerance, setFillContiguous } = useToolStore();

  const toolInfo = getToolInfo(activeTool);

  return (
    <div
      style={{
        height: "var(--topbar-height)",
        background: "var(--abyss)",
        borderBottom: "var(--panel-border)",
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        gap: "2px",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {/* Tool name chip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          paddingRight: "10px",
          marginRight: "6px",
          borderRight: "1px solid var(--cinder)",
          height: "20px",
        }}
      >
        {toolInfo.icon}
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--fog)",
            letterSpacing: "0.03em",
          }}
        >
          {toolInfo.name.toUpperCase()}
        </span>
      </div>

      {/* Tool-specific options */}
      {activeTool === Tool.Brush || activeTool === Tool.Pencil ? (
        <>
          <TopBarGroup label="Size">
            <input
              type="number"
              value={brush.size}
              readOnly
              className="ps-input mono"
              style={{ width: "54px", textAlign: "right" }}
            />
            <span style={{ fontSize: "10px", color: "var(--smoke)", marginLeft: "2px" }}>px</span>
          </TopBarGroup>
          <Divider />
          <TopBarGroup label="Opacity">
            <input
              type="range"
              min={0}
              max={100}
              value={brush.opacity}
              readOnly
              style={{ width: "72px", accentColor: "var(--blood)", cursor: "pointer" }}
            />
            <input
              type="number"
              value={brush.opacity}
              readOnly
              className="ps-input mono"
              style={{ width: "54px", textAlign: "right" }}
            />
            <span style={{ fontSize: "10px", color: "var(--smoke)", marginLeft: "1px" }}>%</span>
          </TopBarGroup>
          <Divider />
          <TopBarGroup label="Hardness">
            <input
              type="range"
              min={0}
              max={100}
              value={brush.hardness}
              readOnly
              style={{ width: "72px", accentColor: "var(--blood)", cursor: "pointer" }}
            />
            <input
              type="number"
              value={brush.hardness}
              readOnly
              className="ps-input mono"
              style={{ width: "54px", textAlign: "right" }}
            />
            <span style={{ fontSize: "10px", color: "var(--smoke)", marginLeft: "1px" }}>%</span>
          </TopBarGroup>
        </>
      ) : activeTool === Tool.Fill ? (
        <>
          <TopBarGroup label="Tolerance">
            <input
              type="range"
              min={0}
              max={255}
              value={fill.tolerance}
              onChange={(e) => setFillTolerance(parseInt(e.target.value))}
              style={{ width: "100px", accentColor: "var(--blood)", cursor: "pointer" }}
            />
            <input
              type="number"
              min={0}
              max={255}
              value={fill.tolerance}
              onChange={(e) => setFillTolerance(parseInt(e.target.value) || 0)}
              className="ps-input mono"
              style={{ width: "54px", textAlign: "right" }}
            />
            <span style={{ fontSize: "10px", color: "var(--smoke)", marginLeft: "2px" }}>/255</span>
          </TopBarGroup>
          <Divider />
          <TopBarGroup label="Contiguous">
            <button
              className={`ob ${fill.contiguous ? "active" : ""}`}
              onClick={() => setFillContiguous(!fill.contiguous)}
              style={{ padding: "2px 8px", fontSize: "11px", cursor: "pointer" }}
            >
              {fill.contiguous ? "ON" : "OFF"}
            </button>
          </TopBarGroup>
        </>
      ) : activeTool === Tool.Eraser ? (
        <>
          <TopBarGroup label="Size">
            <input
              type="number"
              value={brush.size}
              readOnly
              className="ps-input mono"
              style={{ width: "54px", textAlign: "right" }}
            />
            <span style={{ fontSize: "10px", color: "var(--smoke)", marginLeft: "2px" }}>px</span>
          </TopBarGroup>
        </>
      ) : null}
    </div>
  );
}

function getToolInfo(tool: Tool) {
  switch (tool) {
    case Tool.Brush:
      return { name: "Brush", icon: <PaintBrush size={14} weight="regular" style={{ color: "var(--blood)" }} /> };
    case Tool.Pencil:
      return { name: "Pencil", icon: <PaintBrush size={14} weight="regular" style={{ color: "var(--blood)" }} /> };
    case Tool.Eraser:
      return { name: "Eraser", icon: <Eraser size={14} weight="regular" style={{ color: "var(--blood)" }} /> };
    case Tool.Fill:
      return { name: "Paint Bucket", icon: <PaintBucketSvg size={14} /> };
    default:
      return { name: "Brush", icon: <PaintBrush size={14} weight="regular" style={{ color: "var(--blood)" }} /> };
  }
}

function TopBarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "0 6px" }}>
      <span style={{ fontSize: "10px", color: "var(--smoke)", letterSpacing: "0.03em", minWidth: "fit-content" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div style={{ width: "1px", height: "18px", background: "var(--cinder)", flexShrink: 0, margin: "0 2px" }} />
  );
}
