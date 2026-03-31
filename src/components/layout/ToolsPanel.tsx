import { useState, useRef, useEffect } from "react";
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
  PencilSimple,
  RectangleDashed,
  CircleDashed,
  Shapes,
  TextT,
} from "@phosphor-icons/react";
import { useEditorStore } from "../../store/editorStore";
import { useAppearanceStore } from "../../store/appearanceStore";
import { useColorStore } from "../../store/colorStore";
import { ColorPicker } from "../ui/ColorPicker";
import { Tool } from "../../types/editor";

// SVG icon for Paint Bucket (fill tool)
function PaintBucketIcon({ size = 18, weight = "regular" as IconWeight }) {
  const strokeWidth = weight === "bold" ? 24 : weight === "light" ? 12 : 16;
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
      <path
        d={weight === "bold"
          ? "M235.79,142.88a12,12,0,0,0,4.7-19.87L125,7.52a12,12,0,0,0-17,0L70.25,45.29,48.48,23.52a12,12,0,0,0-17,17L53.28,62.26,12.2,103.35a28,28,0,0,0,0,39.6l84.86,84.86a28,28,0,0,0,39.6,0L214.48,150Zm-31.58-14.77a12,12,0,0,0-4.7,2.9l-79.82,79.83a4,4,0,0,1-5.66,0L29.17,126a4,4,0,0,1,0-5.66L70.25,79.24l24.29,24.29a32,32,0,0,0,52.09,35.11h0a32,32,0,0,0-35.12-52.08L87.23,62.26,116.52,33l93.27,93.28Zm-85.87-17.75,0,0a8,8,0,1,1-.06.06ZM256,208a24,24,0,0,1-48,0c0-19.44,12.93-37.23,14.4-39.2a12,12,0,0,1,19.2,0C243.07,170.78,256,188.57,256,208Z"
          : "M238.66,163.56a8,8,0,0,0-13.32,0C223.57,166.23,208,190.09,208,208a24,24,0,0,0,48,0C256,190.09,240.43,166.23,238.66,163.56ZM232,216a8,8,0,0,1-8-8c0-6.8,4-16.32,8-24.08,4,7.76,8,17.34,8,24.08A8,8,0,0,1,232,216Zm2.53-76.93a8,8,0,0,0,3.13-13.24L122.17,10.34a8,8,0,0,0-11.31,0L70.25,51,45.65,26.34a8,8,0,0,0-11.31,11.31L59,62.3,15,106.17a24,24,0,0,0,0,33.94L99.89,225a24,24,0,0,0,33.94,0L212.7,146.12Zm-32.19-5.24-79.83,79.83a8,8,0,0,1-11.31,0L25.51,150.86a8,8,0,0,1,0-11.31L70.25,94.8l34.15,34.15a28,28,0,1,0,11.31-11.31L81.57,83.5l34.95-34.95,93.27,93.27A8,8,0,0,1,202.86,140.89ZM114.1,106.11a12,12,0,1,1,0,17,12,12,0,0,1,0-17Z"
        }
      />
    </svg>
  );
}

type ToolButtonDefinition = {
  id: Tool;
  label: string;
  keycap?: string;
  icon: Icon | typeof PaintBucketIcon;
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
  { id: Tool.Fill, label: "Paint Bucket", keycap: "G", icon: PaintBucketIcon },
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
  const { foregroundColor, backgroundColor, swapColors } = useColorStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"foreground" | "background">("foreground");
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pickerAnchorRect, setPickerAnchorRect] = useState<DOMRect | null>(null);

  const fgColor = `rgba(${foregroundColor.r},${foregroundColor.g},${foregroundColor.b},${foregroundColor.a / 255})`;
  const bgColor = `rgba(${backgroundColor.r},${backgroundColor.g},${backgroundColor.b},${backgroundColor.a / 255})`;

  useEffect(() => {
    if (!pickerOpen) return;
    const updateAnchor = () => {
      setPickerAnchorRect(pickerRef.current?.getBoundingClientRect() ?? null);
    };
    updateAnchor();
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const clickedInsidePicker =
        !!target?.closest("[data-color-picker-root='true']");
      if (pickerRef.current && !pickerRef.current.contains(target) && !clickedInsidePicker) {
        setPickerOpen(false);
      }
    };
    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", updateAnchor, true);
    window.addEventListener("mousedown", handler);
    return () => {
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
      window.removeEventListener("mousedown", handler);
    };
  }, [pickerOpen]);

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
        <div className="cs-wrap" ref={pickerRef} style={{ position: "relative" }}>
          <div
            className="cs bg"
            style={{ background: bgColor, cursor: "pointer" }}
            onClick={() => {
              setPickerAnchorRect(pickerRef.current?.getBoundingClientRect() ?? null);
              setPickerTarget("background");
              setPickerOpen(true);
            }}
          />
          <div
            className="cs fg"
            style={{ background: fgColor, borderColor: "#3a3a3a", cursor: "pointer" }}
            onClick={() => {
              setPickerAnchorRect(pickerRef.current?.getBoundingClientRect() ?? null);
              setPickerTarget("foreground");
              setPickerOpen(true);
            }}
          />
          <div className="cs-swap" onClick={swapColors} style={{ cursor: "pointer" }}>⇄</div>
          <ColorPicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} anchorRect={pickerAnchorRect} target={pickerTarget} />
        </div>
      </div>
    </aside>
  );
}
