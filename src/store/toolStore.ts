/**
 * Tool store - per-tool settings (brush, eraser, fill, etc.)
 * Uses Immer for immutable state updates
 */
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Tool as ToolType } from "../types/editor";

// Brush tool settings
export interface BrushSettings {
  size: number; // 1-500
  opacity: number; // 0-100
  hardness: number; // 0-100
  flow: number; // 0-100
}

// Eraser tool settings
export interface EraserSettings {
  size: number;
  opacity: number;
  hardness: number;
  mode: "brush" | "block";
}

// Fill tool settings
export interface FillSettings {
  tolerance: number; // 0-255
  contiguous: boolean;
}

// Selection tool settings
export interface SelectionSettings {
  feather: number;
  antiAlias: boolean;
  mode: "add" | "subtract" | "intersect";
}

// Gradient tool settings
export type GradientType =
  | "linear"
  | "radial"
  | "angle"
  | "reflected"
  | "diamond";
export interface GradientSettings {
  type: GradientType;
  reverse: boolean;
}

// Text tool settings
export interface TextSettings {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  alignment: "left" | "center" | "right" | "justify";
  color: { r: number; g: number; b: number; a: number };
}

// Shape tool settings
export type ShapeType = "rectangle" | "ellipse" | "line" | "custom";
export interface ShapeSettings {
  type: ShapeType;
  fillColor: { r: number; g: number; b: number; a: number };
  strokeColor: { r: number; g: number; b: number; a: number };
  strokeWidth: number;
  cornerRadius: number;
}

// All tool settings indexed by tool type
export interface ToolSettings {
  [Tool.Brush]: BrushSettings;
  [Tool.Pencil]: BrushSettings;
  [Tool.Eraser]: EraserSettings;
  [Tool.Fill]: FillSettings;
  [Tool.Selection]: SelectionSettings;
  [Tool.MagicWand]: FillSettings;
  [Tool.Gradient]: GradientSettings;
  [Tool.Text]: TextSettings;
  [Tool.Shape]: ShapeSettings;
}

// Default settings per tool
const defaultBrushSettings: BrushSettings = {
  size: 10,
  opacity: 100,
  hardness: 100,
  flow: 100,
};

const defaultEraserSettings: EraserSettings = {
  size: 10,
  opacity: 100,
  hardness: 100,
  mode: "brush",
};

const defaultFillSettings: FillSettings = {
  tolerance: 32,
  contiguous: true,
};

const defaultSelectionSettings: SelectionSettings = {
  feather: 0,
  antiAlias: true,
  mode: "add",
};

const defaultGradientSettings: GradientSettings = {
  type: "linear",
  reverse: false,
};

const defaultTextSettings: TextSettings = {
  fontFamily: "Arial",
  fontSize: 48,
  fontWeight: 400,
  fontStyle: "normal",
  alignment: "left",
  color: { r: 0, g: 0, b: 0, a: 255 },
};

const defaultShapeSettings: ShapeSettings = {
  type: "rectangle",
  fillColor: { r: 255, g: 255, b: 255, a: 255 },
  strokeColor: { r: 0, g: 0, b: 0, a: 255 },
  strokeWidth: 1,
  cornerRadius: 0,
};

// Import Tool constant
import { Tool } from "../types/editor";

// State interface
interface ToolState {
  brush: BrushSettings;
  pencil: BrushSettings;
  eraser: EraserSettings;
  fill: FillSettings;
  selection: SelectionSettings;
  magicWand: FillSettings;
  gradient: GradientSettings;
  text: TextSettings;
  shape: ShapeSettings;
}

// Actions interface
interface ToolActions {
  setBrushSize: (size: number) => void;
  setBrushOpacity: (opacity: number) => void;
  setBrushHardness: (hardness: number) => void;
  setBrushFlow: (flow: number) => void;
  setEraserSize: (size: number) => void;
  setEraserMode: (mode: "brush" | "block") => void;
  setFillTolerance: (tolerance: number) => void;
  setFillContiguous: (contiguous: boolean) => void;
  setSelectionFeather: (feather: number) => void;
  setGradientType: (type: GradientType) => void;
  setGradientReverse: (reverse: boolean) => void;
  setTextSettings: (settings: Partial<TextSettings>) => void;
  setShapeSettings: (settings: Partial<ShapeSettings>) => void;
  resetToolSettings: (tool: ToolType) => void;
}

type ToolStore = ToolState & ToolActions;

// Initial state
const initialState: ToolState = {
  brush: defaultBrushSettings,
  pencil: { ...defaultBrushSettings },
  eraser: defaultEraserSettings,
  fill: defaultFillSettings,
  selection: defaultSelectionSettings,
  magicWand: { ...defaultFillSettings },
  gradient: defaultGradientSettings,
  text: defaultTextSettings,
  shape: defaultShapeSettings,
};

// Tool store with Immer middleware for immutable updates
export const useToolStore = create<ToolStore>()(
  immer((setFn) => ({
    ...initialState,

    setBrushSize: (size: number) =>
      setFn((state: ToolState) => {
        state.brush.size = Math.max(1, Math.min(500, size));
      }),

    setBrushOpacity: (opacity: number) =>
      setFn((state: ToolState) => {
        state.brush.opacity = Math.max(0, Math.min(100, opacity));
      }),

    setBrushHardness: (hardness: number) =>
      setFn((state: ToolState) => {
        state.brush.hardness = Math.max(0, Math.min(100, hardness));
      }),

    setBrushFlow: (flow: number) =>
      setFn((state: ToolState) => {
        state.brush.flow = Math.max(0, Math.min(100, flow));
      }),

    setEraserSize: (size: number) =>
      setFn((state: ToolState) => {
        state.eraser.size = Math.max(1, Math.min(500, size));
      }),

    setEraserMode: (mode: "brush" | "block") =>
      setFn((state: ToolState) => {
        state.eraser.mode = mode;
      }),

    setFillTolerance: (tolerance: number) =>
      setFn((state: ToolState) => {
        state.fill.tolerance = Math.max(0, Math.min(255, tolerance));
      }),

    setFillContiguous: (contiguous: boolean) =>
      setFn((state: ToolState) => {
        state.fill.contiguous = contiguous;
      }),

    setSelectionFeather: (feather: number) =>
      setFn((state: ToolState) => {
        state.selection.feather = Math.max(0, feather);
      }),

    setGradientType: (type: GradientType) =>
      setFn((state: ToolState) => {
        state.gradient.type = type;
      }),

    setGradientReverse: (reverse: boolean) =>
      setFn((state: ToolState) => {
        state.gradient.reverse = reverse;
      }),

    setTextSettings: (settings: Partial<TextSettings>) =>
      setFn((state: ToolState) => {
        Object.assign(state.text, settings);
      }),

    setShapeSettings: (settings: Partial<ShapeSettings>) =>
      setFn((state: ToolState) => {
        Object.assign(state.shape, settings);
      }),

    resetToolSettings: (tool: ToolType) =>
      setFn((state: ToolState) => {
        switch (tool) {
          case "brush":
            state.brush = { ...defaultBrushSettings };
            break;
          case "pencil":
            state.pencil = { ...defaultBrushSettings };
            break;
          case "eraser":
            state.eraser = { ...defaultEraserSettings };
            break;
          case "fill":
            state.fill = { ...defaultFillSettings };
            break;
          case "selection":
            state.selection = { ...defaultSelectionSettings };
            break;
          case "magicWand":
            state.magicWand = { ...defaultFillSettings };
            break;
          case "gradient":
            state.gradient = { ...defaultGradientSettings };
            break;
          case "text":
            state.text = { ...defaultTextSettings };
            break;
          case "shape":
            state.shape = { ...defaultShapeSettings };
            break;
        }
      }),
  })),
);

// Selectors
export const selectBrushPreview = (state: ToolStore) => ({
  size: state.brush.size,
  hardness: state.brush.hardness,
  opacity: state.brush.opacity,
});
