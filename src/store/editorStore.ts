import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Point, Tool as ToolType } from "../types/editor";

interface EditorState {
  activeTool: ToolType;
  zoom: number;
  pan: Point;
  viewportWidth: number;
  viewportHeight: number;
  cursorX: number;
  cursorY: number;
  rendererRef: any | null; // using any to avoid import cycles for now
}

interface EditorActions {
  setTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: Point) => void;
  setViewport: (width: number, height: number) => void;
  setCursor: (x: number, y: number) => void;
  setRendererRef: (ref: any) => void;
}

type EditorStore = EditorState & EditorActions;

const initialState: EditorState = {
  activeTool: "brush",
  zoom: 100,
  pan: { x: 0, y: 0 },
  viewportWidth: 800,
  viewportHeight: 600,
  cursorX: 0,
  cursorY: 0,
  rendererRef: null,
};

export const useEditorStore = create<EditorStore>()(
  immer((setFn) => ({
    ...initialState,
    setTool: (tool: ToolType) => setFn((state: EditorState) => { state.activeTool = tool; }),
    setZoom: (zoom: number) => setFn((state: EditorState) => { state.zoom = Math.max(10, Math.min(3200, zoom)); }),
    setPan: (pan: Point) => setFn((state: EditorState) => { state.pan = pan; }),
    setViewport: (width: number, height: number) => setFn((state: EditorState) => { state.viewportWidth = width; state.viewportHeight = height; }),
    setCursor: (x: number, y: number) => setFn((state: EditorState) => { state.cursorX = x; state.cursorY = y; }),
    setRendererRef: (ref: any) => setFn((state: EditorState) => { state.rendererRef = ref; })
  }))
);

// Selectors for common derived values
export const selectZoomPercent = (state: EditorStore): number => state.zoom;

export const selectCanvasToViewportTransform = (state: EditorStore) => ({
  scale: state.zoom / 100,
  offsetX: state.pan.x,
  offsetY: state.pan.y,
});
