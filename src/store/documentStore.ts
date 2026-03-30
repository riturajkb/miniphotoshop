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
  undoStack: Document[];
  redoStack: Document[];
}

// Actions interface
interface DocumentActions {
  setDocument: (doc: Document) => void;
  addLayer: (layer: Layer) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, updates: Partial<Omit<Layer, "id">>) => void;
  syncPixels: (layerId: string, pixels: Uint8ClampedArray) => void;
  setActiveLayer: (layerId: string | null) => void;
  moveLayer: (fromIndex: number, toIndex: number) => void;
  clearDocument: () => void;
  // Selection actions
  setSelection: (selection: import("../types/editor").Selection | null) => void;
  clearSelection: () => void;
  // History actions
  undo: () => void;
  redo: () => void;
  commitHistory: () => void;
}

type DocumentStore = DocumentState & DocumentActions;

// Helper to deep clone document for history
function cloneDocument(doc: Document): Document {
  return {
    ...doc,
    layers: doc.layers.map((l) => ({
      ...l,
      pixels: l.pixels ? new Uint8ClampedArray(l.pixels) : null,
      transformSource: l.transformSource ? {
        ...l.transformSource,
        pixels: new Uint8ClampedArray(l.transformSource.pixels),
        bounds: { ...l.transformSource.bounds },
      } : null,
    })),
    selection: doc.selection ? {
      ...doc.selection,
      mask: new Uint8Array(doc.selection.mask),
      bounds: doc.selection.bounds ? { ...doc.selection.bounds } : null
    } : null,
  };
}

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
  transformSource: null,
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
  selection: null,
});

// Document store with Immer middleware for immutable updates
export const useDocumentStore = create<DocumentStore>()(
  immer((setFn, getFn) => ({
    document: null,
    activeLayerId: null,
    undoStack: [],
    redoStack: [],

    commitHistory: () => {
      const { document } = getFn();
      if (!document) return;
      setFn((state: DocumentState) => {
        state.undoStack.push(cloneDocument(document));
        if (state.undoStack.length > 50) state.undoStack.shift();
        state.redoStack = []; // Clear redo stack on new action
      });
    },

    undo: () =>
      setFn((state: DocumentState) => {
        if (state.undoStack.length === 0 || !state.document) return;
        const previous = state.undoStack.pop()!;
        state.redoStack.push(cloneDocument(state.document));
        state.document = previous;
        // Ensure active layer is still valid
        if (!state.document.layers.some(l => l.id === state.activeLayerId)) {
           state.activeLayerId = state.document.layers[0]?.id || null;
        }
      }),

    redo: () =>
      setFn((state: DocumentState) => {
        if (state.redoStack.length === 0 || !state.document) return;
        const next = state.redoStack.pop()!;
        state.undoStack.push(cloneDocument(state.document));
        state.document = next;
        // Ensure active layer is still valid
        if (!state.document.layers.some(l => l.id === state.activeLayerId)) {
           state.activeLayerId = state.document.layers[0]?.id || null;
        }
      }),

    setDocument: (doc: Document) =>
      setFn((state: DocumentState) => {
        state.document = doc;
        state.activeLayerId = doc.layers[0]?.id ?? null;
        state.undoStack = [];
        state.redoStack = [];
      }),

    setSelection: (selection: import("../types/editor").Selection | null) => {
      getFn().commitHistory();
      setFn((state: DocumentState) => {
        if (state.document) {
          state.document.selection = selection;
        }
      });
    },

    clearSelection: () => {
      getFn().commitHistory();
      setFn((state: DocumentState) => {
        if (state.document && state.document.selection) {
          state.document.selection = null;
        }
      });
    },

    addLayer: (layer: Layer) => {
      getFn().commitHistory();
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
      });
    },

    removeLayer: (layerId: string) => {
      if (!canRemoveLayer(getFn().document, layerId)) return;
      getFn().commitHistory();
      setFn((state: DocumentState) => {
        const document = state.document;
        if (!document) return;

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
      });
    },

    updateLayer: (layerId: string, updates: Partial<Omit<Layer, "id">>) => {
      // We only commit history if we're changing something substantial
      // or if pixels are updated. For now, we commit on every update for simplicity.
      // Optimization: filter out setActiveLayer-like updates
      getFn().commitHistory();
      setFn((state: DocumentState) => {
        if (state.document) {
          const layer = state.document.layers.find((l) => l.id === layerId);
          if (layer) {
            if ("pixels" in updates && !("transformSource" in updates)) {
              layer.transformSource = null;
            }
            Object.assign(layer, updates);
          }
        }
      });
    },

    syncPixels: (layerId: string, pixels: Uint8ClampedArray) =>
      setFn((state: DocumentState) => {
        if (state.document) {
          const layer = state.document.layers.find((l) => l.id === layerId);
          if (layer) {
            layer.pixels = new Uint8ClampedArray(pixels);
            layer.transformSource = null;
          }
        }
      }),

    setActiveLayer: (layerId: string | null) =>
      setFn((state: DocumentState) => {
        state.activeLayerId = layerId;
      }),

    moveLayer: (fromIndex: number, toIndex: number) => {
      getFn().commitHistory();
      setFn((state: DocumentState) => {
        if (!state.document) return;
        const layers = state.document.layers;
        if (
          fromIndex < 0 || fromIndex >= layers.length ||
          toIndex < 0 || toIndex >= layers.length ||
          fromIndex === toIndex
        ) return;
        const [moved] = layers.splice(fromIndex, 1);
        layers.splice(toIndex, 0, moved);
      });
    },

    clearDocument: () =>
      setFn((state: DocumentState) => {
        state.document = null;
        state.activeLayerId = null;
        state.undoStack = [];
        state.redoStack = [];
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
