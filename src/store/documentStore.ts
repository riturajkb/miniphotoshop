/**
 * Document store - document state, layers, active layer
 * Uses Immer for immutable state updates
 */
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Document, Layer, RGBA } from "../types/editor";

// State interface
interface DocumentState {
  document: Document | null;
  activeLayerId: string | null;
}

// Actions interface
interface DocumentActions {
  setDocument: (doc: Document) => void;
  addLayer: (layer: Layer) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, updates: Partial<Omit<Layer, "id">>) => void;
  setActiveLayer: (layerId: string | null) => void;
  clearDocument: () => void;
}

type DocumentStore = DocumentState & DocumentActions;

export function canRemoveLayer(
  document: Document | null,
  layerId: string | null,
): boolean {
  if (!document || !layerId) return false;
  if (document.layers.length <= 1) return false;
  return document.layers.some((layer) => layer.id === layerId);
}

// Default layer factory
const createDefaultLayer = (
  id: string,
  name: string,
  _width: number,
  _height: number,
): Layer => ({
  id,
  name,
  visible: true,
  locked: false,
  opacity: 100,
  blendMode: "normal",
  pixels: null,
});

// Default document factory
// Note: Background layer is created separately by the renderer to ensure proper
// Graphics object integration. This creates a document with no initial layers.
export const createDefaultDocument = (
  width: number,
  height: number,
  backgroundColor: RGBA = { r: 255, g: 255, b: 255, a: 0 },
): Document => ({
  width,
  height,
  backgroundColor,
  layers: [],
});

// Document store with Immer middleware for immutable updates
export const useDocumentStore = create<DocumentStore>()(
  immer((setFn) => ({
    document: null,
    activeLayerId: null,

    setDocument: (doc: Document) =>
      setFn((state: DocumentState) => {
        state.document = doc;
        state.activeLayerId = doc.layers[0]?.id ?? null;
      }),

    addLayer: (layer: Layer) =>
      setFn((state: DocumentState) => {
        if (state.document) {
          const activeIndex = state.document.layers.findIndex(
            (l) => l.id === state.activeLayerId,
          );
          if (activeIndex !== -1) {
            state.document.layers.splice(activeIndex + 1, 0, layer);
          } else {
            state.document.layers.push(layer);
          }
          state.activeLayerId = layer.id;
        }
      }),

    removeLayer: (layerId: string) =>
      setFn((state: DocumentState) => {
        const document = state.document;
        if (!document || !canRemoveLayer(document, layerId)) return;

        const index = document.layers.findIndex((l) => l.id === layerId);
        if (index !== -1) {
          document.layers.splice(index, 1);
          if (state.activeLayerId === layerId) {
            const nextActiveLayer =
              document.layers[Math.min(index, document.layers.length - 1)] ??
              null;
            state.activeLayerId = nextActiveLayer?.id ?? null;
          }
        }
      }),

    updateLayer: (layerId: string, updates: Partial<Omit<Layer, "id">>) =>
      setFn((state: DocumentState) => {
        if (state.document) {
          const layer = state.document.layers.find((l) => l.id === layerId);
          if (layer) {
            Object.assign(layer, updates);
          }
        }
      }),

    setActiveLayer: (layerId: string | null) =>
      setFn((state: DocumentState) => {
        state.activeLayerId = layerId;
      }),

    clearDocument: () =>
      setFn((state: DocumentState) => {
        state.document = null;
        state.activeLayerId = null;
      }),
  })),
);

// Selectors
export const selectLayers = (state: DocumentStore): Layer[] =>
  state.document?.layers ?? [];

export const selectActiveLayer = (state: DocumentStore): Layer | null => {
  if (!state.document || !state.activeLayerId) return null;
  return (
    state.document.layers.find((l) => l.id === state.activeLayerId) ?? null
  );
};

export const selectVisibleLayers = (state: DocumentStore): Layer[] =>
  state.document?.layers.filter((l) => l.visible) ?? [];
