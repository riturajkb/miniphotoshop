/**
 * LayerStack - Manages the ordered array of layers
 * Handles layer creation, deletion, reordering, and merging
 */
import { Sprite, Texture, Graphics } from "pixi.js";
import type { BlendMode, RGBA } from "../types/editor";

export interface LayerData {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  sprite: Sprite | null;
  pixelBuffer: Uint8ClampedArray | null;
  width: number;
  height: number;
  dirty: boolean;
  graphics?: Graphics; // Optional PixiJS Graphics object (e.g., for background layer)
}

export class LayerStack {
  private layers: LayerData[] = [];
  private activeLayerId: string | null = null;
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  reset(width = this.width, height = this.height): void {
    for (const layer of this.layers) {
      if (layer.sprite) {
        layer.sprite.destroy({ texture: true });
      }
      if (layer.graphics) {
        layer.graphics.destroy();
      }
    }

    this.layers = [];
    this.activeLayerId = null;
    this.width = width;
    this.height = height;
  }

  createLayer(name: string, fillColor?: RGBA, id?: string): LayerData {
    const layerId = id || `layer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const pixelBuffer = new Uint8ClampedArray(this.width * this.height * 4);

    if (fillColor) {
      for (let i = 0; i < pixelBuffer.length; i += 4) {
        pixelBuffer[i] = fillColor.r;
        pixelBuffer[i + 1] = fillColor.g;
        pixelBuffer[i + 2] = fillColor.b;
        pixelBuffer[i + 3] = fillColor.a;
      }
    }

    const layer: LayerData = {
      id: layerId,
      name,
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: "normal",
      sprite: null,
      pixelBuffer,
      width: this.width,
      height: this.height,
      dirty: true,
    };

    const activeIndex = this.layers.findIndex((l) => l.id === this.activeLayerId);
    if (activeIndex !== -1) {
      this.layers.splice(activeIndex + 1, 0, layer);
    } else {
      this.layers.push(layer);
    }
    this.activeLayerId = layerId;
    return layer;
  }

  deleteLayer(layerId: string): boolean {
    if (this.layers.length <= 1) return false;

    const index = this.layers.findIndex((l) => l.id === layerId);
    if (index === -1) return false;

    const layer = this.layers[index];
    if (layer.sprite) {
      layer.sprite.destroy({ texture: true });
    }
    if (layer.graphics) {
      layer.graphics.destroy();
    }

    this.layers.splice(index, 1);

    if (this.activeLayerId === layerId) {
      const nextActiveLayer = this.layers[Math.min(index, this.layers.length - 1)] ?? null;
      this.activeLayerId = nextActiveLayer?.id ?? null;
    }

    return true;
  }

  getLayer(layerId: string): LayerData | null {
    return this.layers.find((l) => l.id === layerId) ?? null;
  }

  getActiveLayer(): LayerData | null {
    if (!this.activeLayerId) return null;
    return this.getLayer(this.activeLayerId);
  }

  setActiveLayer(layerId: string | null): void {
    this.activeLayerId = layerId;
  }

  getLayers(): LayerData[] {
    return [...this.layers];
  }

  getVisibleLayers(): LayerData[] {
    return this.layers.filter((l) => l.visible);
  }

  reorderLayer(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 || fromIndex >= this.layers.length ||
      toIndex < 0 || toIndex >= this.layers.length ||
      fromIndex === toIndex
    ) return;
    const [moved] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, moved);
  }

  getLayerCount(): number {
    return this.layers.length;
  }

  moveLayer(layerId: string, newIndex: number): boolean {
    const currentIndex = this.layers.findIndex((l) => l.id === layerId);
    if (currentIndex === -1) return false;

    const clampedIndex = Math.max(
      0,
      Math.min(newIndex, this.layers.length - 1),
    );
    const [layer] = this.layers.splice(currentIndex, 1);
    this.layers.splice(clampedIndex, 0, layer);

    return true;
  }

  moveLayerUp(layerId: string): boolean {
    const index = this.layers.findIndex((l) => l.id === layerId);
    if (index === -1 || index >= this.layers.length - 1) return false;

    [this.layers[index], this.layers[index + 1]] = [
      this.layers[index + 1],
      this.layers[index],
    ];
    return true;
  }

  moveLayerDown(layerId: string): boolean {
    const index = this.layers.findIndex((l) => l.id === layerId);
    if (index <= 0) return false;

    [this.layers[index], this.layers[index - 1]] = [
      this.layers[index - 1],
      this.layers[index],
    ];
    return true;
  }

  duplicateLayer(layerId: string): LayerData | null {
    const source = this.getLayer(layerId);
    if (!source) return null;

    const copy = this.createLayer(`${source.name} copy`);
    copy.opacity = source.opacity;
    copy.blendMode = source.blendMode;
    copy.visible = source.visible;

    if (source.pixelBuffer && copy.pixelBuffer) {
      copy.pixelBuffer.set(source.pixelBuffer);
    }

    copy.dirty = true;
    return copy;
  }

  mergeDown(layerId: string): LayerData | null {
    const index = this.layers.findIndex((l) => l.id === layerId);
    if (index <= 0) return null;

    const topLayer = this.layers[index];
    const bottomLayer = this.layers[index - 1];

    if (!topLayer.pixelBuffer || !bottomLayer.pixelBuffer) return null;

    const topOpacity = topLayer.opacity / 100;
    for (let i = 0; i < bottomLayer.pixelBuffer.length; i += 4) {
      const srcA = (topLayer.pixelBuffer[i + 3] / 255) * topOpacity;
      const dstA = bottomLayer.pixelBuffer[i + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);

      if (outA > 0) {
        bottomLayer.pixelBuffer[i] = Math.round(
          (topLayer.pixelBuffer[i] * srcA +
            bottomLayer.pixelBuffer[i] * dstA * (1 - srcA)) /
            outA,
        );
        bottomLayer.pixelBuffer[i + 1] = Math.round(
          (topLayer.pixelBuffer[i + 1] * srcA +
            bottomLayer.pixelBuffer[i + 1] * dstA * (1 - srcA)) /
            outA,
        );
        bottomLayer.pixelBuffer[i + 2] = Math.round(
          (topLayer.pixelBuffer[i + 2] * srcA +
            bottomLayer.pixelBuffer[i + 2] * dstA * (1 - srcA)) /
            outA,
        );
        bottomLayer.pixelBuffer[i + 3] = Math.round(outA * 255);
      }
    }

    bottomLayer.dirty = true;
    this.deleteLayer(layerId);

    return bottomLayer;
  }

  flattenImage(): LayerData {
    const flatBuffer = new Uint8ClampedArray(this.width * this.height * 4);

    for (let i = 0; i < flatBuffer.length; i += 4) {
      flatBuffer[i] = 255;
      flatBuffer[i + 1] = 255;
      flatBuffer[i + 2] = 255;
      flatBuffer[i + 3] = 255;
    }

    for (const layer of this.layers) {
      if (!layer.visible || !layer.pixelBuffer) continue;

      const layerOpacity = layer.opacity / 100;
      for (let i = 0; i < flatBuffer.length; i += 4) {
        const srcA = (layer.pixelBuffer[i + 3] / 255) * layerOpacity;
        const dstA = flatBuffer[i + 3] / 255;
        const outA = srcA + dstA * (1 - srcA);

        if (outA > 0) {
          flatBuffer[i] = Math.round(
            (layer.pixelBuffer[i] * srcA + flatBuffer[i] * dstA * (1 - srcA)) /
              outA,
          );
          flatBuffer[i + 1] = Math.round(
            (layer.pixelBuffer[i + 1] * srcA +
              flatBuffer[i + 1] * dstA * (1 - srcA)) /
              outA,
          );
          flatBuffer[i + 2] = Math.round(
            (layer.pixelBuffer[i + 2] * srcA +
              flatBuffer[i + 2] * dstA * (1 - srcA)) /
              outA,
          );
          flatBuffer[i + 3] = Math.round(outA * 255);
        }
      }
    }

    this.layers = [];
    const flatLayer = this.createLayer("Flattened");
    flatLayer.pixelBuffer = flatBuffer;
    flatLayer.dirty = true;

    return flatLayer;
  }

  markAllDirty(): void {
    for (const layer of this.layers) {
      layer.dirty = true;
    }
  }

  clearDirty(): void {
    for (const layer of this.layers) {
      layer.dirty = false;
    }
  }

  hasDirtyLayers(): boolean {
    return this.layers.some((l) => l.dirty);
  }

  /**
   * Reconcile the engine's LayerStack with external document state
   */
  syncFromDocument(docLayers: import("../types/editor").Layer[]): void {
    // 1. Identify layers to remove
    const docIds = new Set(docLayers.map((l) => l.id));
    this.layers = this.layers.filter((engineLayer) => {
      if (!docIds.has(engineLayer.id)) {
        if (engineLayer.sprite) engineLayer.sprite.destroy({ texture: true });
        if (engineLayer.graphics) engineLayer.graphics.destroy();
        return false;
      }
      return true;
    });

    // 2. Identify and create/update layers
    const newLayers: LayerData[] = [];

    for (const docLayer of docLayers) {
      let engineLayer = this.layers.find((l) => l.id === docLayer.id);

      if (!engineLayer) {
        // Create new engine layer
        engineLayer = {
          id: docLayer.id,
          name: docLayer.name,
          visible: docLayer.visible,
          locked: docLayer.locked,
          opacity: docLayer.opacity,
          blendMode: docLayer.blendMode,
          sprite: null,
          pixelBuffer: docLayer.pixels ? new Uint8ClampedArray(docLayer.pixels) : new Uint8ClampedArray(this.width * this.height * 4),
          width: this.width,
          height: this.height,
          dirty: true,
        };
      } else {
        // Update existing layer properties
        engineLayer.name = docLayer.name;
        engineLayer.visible = docLayer.visible;
        engineLayer.locked = docLayer.locked;
        engineLayer.opacity = docLayer.opacity;
        engineLayer.blendMode = docLayer.blendMode;

        if (
          !engineLayer.pixelBuffer ||
          engineLayer.pixelBuffer.length !== this.width * this.height * 4
        ) {
          engineLayer.pixelBuffer = new Uint8ClampedArray(
            this.width * this.height * 4,
          );
        }

        // Sync pixels if they exist in doc and are different (or simply always sync for simplicity in undo/redo)
        if (docLayer.pixels) {
          engineLayer.pixelBuffer?.set(docLayer.pixels);
        }
        engineLayer.width = this.width;
        engineLayer.height = this.height;
        engineLayer.dirty = true;
      }

      newLayers.push(engineLayer);
    }

    this.layers = newLayers;
    this.markAllDirty();
  }
}
