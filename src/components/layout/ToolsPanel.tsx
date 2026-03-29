import type { Icon, IconWeight } from "@phosphor-icons/react";
import {
  ArrowsOutCardinal,
  Crop,
  Eraser,
  Eyedropper,
  Gradient,
  Lasso,
  MagicWand,
  MagnifyingGlassPlus,
  PaintBrush,
  PaintBucket,
  PencilSimple,
  RectangleDashed,
  CircleDashed,
  Shapes,
  TextT,
} from "@phosphor-icons/react";
import { useEditorStore } from "../../store/editorStore";
import { useAppearanceStore } from "../../store/appearanceStore";
import { Tool } from "../../types/editor";

type ToolButtonDefinition = {
  id: Tool;
  label: string;
  keycap?: string;
  icon: Icon;
};

const toolButtons: Array<ToolButtonDefinition | "separator"> = [
  { id: Tool.Move, label: "Move", keycap: "V", icon: ArrowsOutCardinal },
  { id: Tool.SelectionRect, label: "Rect Selection", keycap: "M", icon: RectangleDashed },
  { id: Tool.SelectionEllipse, label: "Ellipse Selection", keycap: "E", icon: CircleDashed },
  { id: Tool.Lasso, label: "Lasso", keycap: "L", icon: Lasso },
  { id: Tool.QuickSelection, label: "Quick Selection", keycap: "W", icon: MagicWand },
  "separator",
  { id: Tool.Crop, label: "Crop", keycap: "C", icon: Crop },
  { id: Tool.Eyedropper, label: "Eyedropper", keycap: "I", icon: Eyedropper },
  "separator",
  { id: Tool.Brush, label: "Brush", keycap: "B", icon: PaintBrush },
  { id: Tool.Pencil, label: "Pencil", keycap: "P", icon: PencilSimple },
  { id: Tool.Eraser, label: "Eraser", keycap: "E", icon: Eraser },
  { id: Tool.Fill, label: "Paint Bucket", keycap: "G", icon: PaintBucket },
  "separator",
  { id: Tool.Gradient, label: "Gradient", icon: Gradient },
  { id: Tool.Text, label: "Text", keycap: "T", icon: TextT },
  { id: Tool.Shape, label: "Shape", keycap: "U", icon: Shapes },
  "separator",
  { id: Tool.Zoom, label: "Zoom", keycap: "Z", icon: MagnifyingGlassPlus },
];

function ToolButton({
  tool,
  activeTool,
  setTool,
  iconScale,
  iconStyle,
}: {
  tool: ToolButtonDefinition;
  activeTool: Tool;
  setTool: (tool: Tool) => void;
  iconScale: "sm" | "md" | "lg";
  iconStyle: "sharp" | "rounded";
}) {
  const IconComponent = tool.icon;
  const size = iconScale === "sm" ? 16 : iconScale === "lg" ? 20 : 18;
  const weight: IconWeight = iconStyle === "sharp" ? "regular" : "light";

  return (
    <div
      className={`tb ${activeTool === tool.id ? "on" : ""}`}
      data-tip={`${tool.label}${tool.keycap ? `  ${tool.keycap}` : ""}`}
      onClick={() => setTool(tool.id)}
    >
      <IconComponent size={size} weight={weight} />
      {tool.keycap ? <span className="tsk">{tool.keycap}</span> : null}
    </div>
  );
}

export function ToolsPanel() {
  const { activeTool, setTool } = useEditorStore();
  const { iconStyle, iconScale } = useAppearanceStore();

  return (
    <aside className="toolpanel">
      {toolButtons.map((entry, index) =>
        entry === "separator" ? (
          <div key={`separator-${index}`} className="tsep"></div>
        ) : (
          <ToolButton
            key={entry.id}
            tool={entry}
            activeTool={activeTool}
            setTool={setTool}
            iconScale={iconScale}
            iconStyle={iconStyle}
          />
        ),
      )}
      <div className="tool-colors">
        <div className="cs-wrap">
          <div className="cs bg"></div>
          <div className="cs fg" style={{ background: "#0c0c0c", borderColor: "#3a3a3a" }}></div>
          <div className="cs-swap">⇄</div>
        </div>
      </div>
    </aside>
  );
}
