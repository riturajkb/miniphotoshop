/**
 * Renderer - Syncs document state to PixiJS display tree
 */
import type { Graphics } from "pixi.js";
import { PixiEngine } from "./PixiEngine";
import { LayerStack } from "./LayerStack";
import { Compositor } from "./Compositor";
import { SelectionManager } from "./SelectionManager";
import { SelectionOverlay } from "./SelectionOverlay";

export class Renderer {
  private engine: PixiEngine;
  private layerStack: LayerStack;
  private compositor: Compositor;
  private docWidth: number;
  private docHeight: number;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private vpW = 0;
  private vpH = 0;
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private selectionManager: SelectionManager;
  private selectionOverlay: SelectionOverlay;
  private tempSelectionMask: Uint8Array | null = null;
  private lastTime = performance.now();
  private renderRequestId: number | null = null;

  constructor(width: number, height: number) {
    this.engine = new PixiEngine();
    this.layerStack = new LayerStack(width, height);
    this.compositor = new Compositor(width, height);
    this.docWidth = width;
    this.docHeight = height;

    this.offscreen = document.createElement("canvas");
    this.offscreen.width = width;
    this.offscreen.height = height;
    this.offCtx = this.offscreen.getContext("2d")!;

    this.selectionManager = new SelectionManager(width, height);
    this.selectionOverlay = new SelectionOverlay();
  }

  async init(
    canvas: HTMLCanvasElement,
    vpW: number,
    vpH: number,
  ): Promise<void> {
    this.vpW = vpW;
    this.vpH = vpH;
    await this.engine.init(canvas, vpW, vpH);
    this.engine.createCheckerboard(this.docWidth, this.docHeight);
    this.engine.documentContainer.addChild(this.selectionOverlay.container);
    this.updateTransform();
  }

  private setLayerDirty(layer: import("./LayerStack").LayerData, x?: number, y?: number, w?: number, h?: number): void {
    layer.dirty = true;
    if (x !== undefined && y !== undefined && w !== undefined && h !== undefined) {
      const newRect = { minX: x, minY: y, maxX: x + w - 1, maxY: y + h - 1 };
      if (!layer.dirtyRect) {
         layer.dirtyRect = newRect;
      } else {
         layer.dirtyRect.minX = Math.min(layer.dirtyRect.minX, newRect.minX);
         layer.dirtyRect.minY = Math.min(layer.dirtyRect.minY, newRect.minY);
         layer.dirtyRect.maxX = Math.max(layer.dirtyRect.maxX, newRect.maxX);
         layer.dirtyRect.maxY = Math.max(layer.dirtyRect.maxY, newRect.maxY);
      }
    } else {
      layer.dirtyRect = undefined;
    }
  }

  /** Composite dirty layers and upload texture. Call from tick(). */
  private composeDirty(): void {
    if (!this.layerStack.hasDirtyLayers()) return;

    let globalDirtyRect: { minX: number; minY: number; maxX: number; maxY: number } | undefined;
    let canDoPartial = true;

    for (const layer of this.layerStack.getLayers()) {
      if (layer.dirty) {
        if (!layer.dirtyRect) {
          canDoPartial = false;
          break;
        }
        if (!globalDirtyRect) {
          globalDirtyRect = { ...layer.dirtyRect };
        } else {
          globalDirtyRect.minX = Math.min(globalDirtyRect.minX, layer.dirtyRect.minX);
          globalDirtyRect.minY = Math.min(globalDirtyRect.minY, layer.dirtyRect.minY);
          globalDirtyRect.maxX = Math.max(globalDirtyRect.maxX, layer.dirtyRect.maxX);
          globalDirtyRect.maxY = Math.max(globalDirtyRect.maxY, layer.dirtyRect.maxY);
        }
      }
    }

    const imageData = this.compositor.composite(
        this.layerStack.getLayers(),
        canDoPartial ? globalDirtyRect : undefined
    );

    if (canDoPartial && globalDirtyRect) {
      const dw = globalDirtyRect.maxX - globalDirtyRect.minX + 1;
      const dh = globalDirtyRect.maxY - globalDirtyRect.minY + 1;
      this.offCtx.putImageData(
          imageData,
          0,
          0,
          globalDirtyRect.minX,
          globalDirtyRect.minY,
          dw,
          dh
      );
    } else {
      this.offCtx.putImageData(imageData, 0, 0);
    }

    this.engine.setCompositeTexture(this.offscreen, globalDirtyRect);
    this.layerStack.clearDirty();
  }

  /** Call every animation frame — composites dirty layers then repaints PixiJS */
  render(): void {
    if (!this.engine.isInitialized) return;
    this.composeDirty();

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    
    this.selectionOverlay.updateAnimationAndGetDirty(dt);

    this.engine.render();
  }

  needsAnimationFrame(): boolean {
    return this.selectionOverlay.isAnimating();
  }

  forceRender(): void {
    this.layerStack.markAllDirty();
    this.render();
  }

  scheduleRender(): void {
    if (this.renderRequestId !== null) return;

    this.renderRequestId = requestAnimationFrame(() => {
      this.renderRequestId = null;
      this.render();
    });
  }

  setZoom(z: number): void {
    this.zoom = Math.max(0.05, Math.min(64, z));
    this.updateTransform();
    this.engine.render();
  }

  getZoom(): number {
    return this.zoom;
  }

  setPan(x: number, y: number): void {
    this.panX = x;
    this.panY = y;
    this.updateTransform();
    this.engine.render();
  }

  getPan(): { x: number; y: number } {
    return { x: this.panX, y: this.panY };
  }

  private updateTransform(): void {
    this.engine.setTransform(this.panX, this.panY, this.zoom);
  }

  screenToCanvasPrecise(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom,
    };
  }

  screenToCanvas(sx: number, sy: number): { x: number; y: number } {
    const precise = this.screenToCanvasPrecise(sx, sy);
    return {
      x: Math.floor(precise.x),
      y: Math.floor(precise.y),
    };
  }

  canvasToScreen(cx: number, cy: number): { x: number; y: number } {
    return {
      x: cx * this.zoom + this.panX,
      y: cy * this.zoom + this.panY,
    };
  }

  resizeViewport(w: number, h: number): void {
    this.vpW = w;
    this.vpH = h;
    this.engine.resize(w, h);
    this.engine.render();
  }

  centerDocument(vpW: number, vpH: number): void {
    this.panX = (vpW - this.docWidth * this.zoom) / 2;
    this.panY = (vpH - this.docHeight * this.zoom) / 2;
    this.updateTransform();
  }

  fitToViewport(vpW: number, vpH: number): void {
    const pad = 40;
    const sx = (vpW - pad * 2) / this.docWidth;
    const sy = (vpH - pad * 2) / this.docHeight;
    this.zoom = Math.min(sx, sy);
    this.centerDocument(vpW, vpH);
  }

  getLayerStack(): LayerStack {
    return this.layerStack;
  }

  private getSelectionState(): {
    mask: Uint8Array;
    hasActiveSelection: boolean;
  } {
    return this.selectionManager.getMaskAndActive();
  }

  private canAffectPixel(
    x: number,
    y: number,
    selectionMask: Uint8Array,
    hasActiveSelection: boolean,
  ): boolean {
    if (x < 0 || x >= this.docWidth || y < 0 || y >= this.docHeight) {
      return false;
    }

    if (!hasActiveSelection) {
      return true;
    }

    return selectionMask[y * this.docWidth + x] > 0;
  }

  /**
   * Brush drawing logic
   */
  drawBrush(x: number, y: number, color: import("../types/editor").RGBA, size: number): void {
    const layer = this.layerStack.getActiveLayer();
    if (!layer || layer.locked || !layer.pixelBuffer) return;

    const radius = Math.floor(size / 2);
    const w = this.docWidth;
    const h = this.docHeight;
    const { mask: selectionMask, hasActiveSelection } = this.getSelectionState();

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx;
        const py = y + dy;

        if (px >= 0 && px < w && py >= 0 && py < h) {
          if (dx * dx + dy * dy <= radius * radius) {
            if (hasActiveSelection && selectionMask[py * w + px] === 0) {
              continue;
            }

            const idx = (py * w + px) * 4;
            layer.pixelBuffer[idx] = color.r;
            layer.pixelBuffer[idx + 1] = color.g;
            layer.pixelBuffer[idx + 2] = color.b;
            layer.pixelBuffer[idx + 3] = color.a;
          }
        }
      }
    }
    this.setLayerDirty(
      layer,
      Math.max(0, x - radius),
      Math.max(0, y - radius),
      Math.min(w - Math.max(0, x - radius), radius * 2 + 1),
      Math.min(h - Math.max(0, y - radius), radius * 2 + 1)
    );
    this.scheduleRender();
  }

  fill(
    x: number,
    y: number,
    color: import("../types/editor").RGBA,
    tolerance: number,
    contiguous: boolean,
  ): void {
    const layer = this.layerStack.getActiveLayer();
    if (!layer || layer.locked || !layer.pixelBuffer) return;
    if (x < 0 || x >= this.docWidth || y < 0 || y >= this.docHeight) return;

    const pixels = layer.pixelBuffer;
    const width = this.docWidth;
    const height = this.docHeight;
    const { mask: selectionMask, hasActiveSelection } = this.getSelectionState();

    if (hasActiveSelection && selectionMask[y * width + x] === 0) return;

    const startIndex = (y * width + x) * 4;
    const source = {
      r: pixels[startIndex],
      g: pixels[startIndex + 1],
      b: pixels[startIndex + 2],
      a: pixels[startIndex + 3],
    };

    if (
      source.r === color.r &&
      source.g === color.g &&
      source.b === color.b &&
      source.a === color.a
    ) {
      return;
    }

    const withinTolerance = (index: number) => {
      const dr = pixels[index] - source.r;
      const dg = pixels[index + 1] - source.g;
      const db = pixels[index + 2] - source.b;
      const da = pixels[index + 3] - source.a;
      return Math.sqrt(dr * dr + dg * dg + db * db + da * da) <= tolerance;
    };

    const applyAtIndex = (index: number) => {
      pixels[index] = color.r;
      pixels[index + 1] = color.g;
      pixels[index + 2] = color.b;
      pixels[index + 3] = color.a;
    };

    if (!contiguous) {
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          if (hasActiveSelection && selectionMask[py * width + px] === 0) {
            continue;
          }

          const index = (py * width + px) * 4;
          if (withinTolerance(index)) {
            applyAtIndex(index);
          }
        }
      }
      this.setLayerDirty(layer);
      this.scheduleRender();
      return;
    }

    const visited = new Uint8Array(width * height);
    const queue: number[] = [y * width + x];
    visited[y * width + x] = 1;
    let head = 0;

    while (head < queue.length) {
      const current = queue[head++];
      const px = current % width;
      const py = Math.floor(current / width);

      if (hasActiveSelection && selectionMask[current] === 0) {
        continue;
      }

      const index = current * 4;
      if (!withinTolerance(index)) {
        continue;
      }

      applyAtIndex(index);

      const neighbors = [
        [px - 1, py],
        [px + 1, py],
        [px, py - 1],
        [px, py + 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (visited[next]) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }

    this.setLayerDirty(layer);
    this.scheduleRender();
  }

  /**
   * Invert current layer pixels
   */
  invertLayer(): void {
    const layer = this.layerStack.getActiveLayer();
    if (!layer || layer.locked || !layer.pixelBuffer) return;
    const { mask: selectionMask, hasActiveSelection } = this.getSelectionState();

    for (let i = 0; i < layer.pixelBuffer.length; i += 4) {
      const pixelIndex = i / 4;
      const px = pixelIndex % this.docWidth;
      const py = Math.floor(pixelIndex / this.docWidth);

      if (hasActiveSelection && selectionMask[pixelIndex] === 0) {
        continue;
      }

      layer.pixelBuffer[i] = 255 - layer.pixelBuffer[i];
      layer.pixelBuffer[i + 1] = 255 - layer.pixelBuffer[i + 1];
      layer.pixelBuffer[i + 2] = 255 - layer.pixelBuffer[i + 2];
    }
    this.setLayerDirty(layer);
    this.scheduleRender();
  }

  /**
   * Create a white background Graphics object as the bottommost layer
   * This creates a real PixiJS Graphics object in the scene graph
   */
  createBackgroundGraphics(): void {
    this.engine.createBackgroundGraphics(this.docWidth, this.docHeight);
  }

  /**
   * Remove the background graphics object
   */
  removeBackgroundGraphics(): void {
    this.engine.removeBackgroundGraphics();
  }

  /**
   * Get the background graphics object if it exists
   */
  getBackgroundGraphics(): Graphics | null {
    return this.engine.backgroundGraphics;
  }

  getDocWidth(): number {
    return this.docWidth;
  }

  getDocHeight(): number {
    return this.docHeight;
  }

  resizeDocument(w: number, h: number): void {
    this.docWidth = w;
    this.docHeight = h;
    this.compositor.resize(w, h);
    this.layerStack.reset(w, h);
    this.selectionManager.resize(w, h);
    this.engine.removeBackgroundGraphics();

    // Recreate canvas to explicitly bypass PixiJS CanvasResource caching
    this.offscreen = document.createElement("canvas");
    this.offscreen.width = w;
    this.offscreen.height = h;
    this.offCtx = this.offscreen.getContext("2d", { willReadFrequently: true })!;

    this.engine.createCheckerboard(w, h);

    // Auto-center the new document in the viewport
    if (this.vpW > 0 && this.vpH > 0) {
      this.fitToViewport(this.vpW, this.vpH);
    }
  }

  syncDocument(doc: import("../types/editor").Document, activeLayerId: string | null): void {
    if (doc.width !== this.docWidth || doc.height !== this.docHeight) {
      this.resizeDocument(doc.width, doc.height);
    }

    const visualChanged = this.layerStack.syncFromDocument(doc.layers);
    this.layerStack.setActiveLayer(activeLayerId);

    if (visualChanged) {
      this.render();
    }
  }

  destroy(): void {
    if (this.renderRequestId !== null) {
      cancelAnimationFrame(this.renderRequestId);
      this.renderRequestId = null;
    }
    this.engine.destroy();
  }

  /**
   * Export the current canvas to a data URL
   * @param format - MIME type for export (image/png, image/jpeg)
   * @param quality - Quality for JPEG export (0-1)
   * @returns Data URL string
   */
  exportToDataURL(format: "image/png" | "image/jpeg" = "image/png", quality?: number): string {
    // Force a fresh composite before export
    this.layerStack.markAllDirty();
    this.composeDirty();

    // For PNG, we need to ensure the background is included
    // Create a temporary canvas to composite with background
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = this.docWidth;
    exportCanvas.height = this.docHeight;
    const exportCtx = exportCanvas.getContext("2d")!;

    // Fill with white background for JPEG exports (or if requested)
    if (format === "image/jpeg") {
      exportCtx.fillStyle = "#FFFFFF";
      exportCtx.fillRect(0, 0, this.docWidth, this.docHeight);
    }

    // Draw the composited image
    exportCtx.drawImage(this.offscreen, 0, 0);

    return exportCanvas.toDataURL(format, quality);
  }

  /**
   * Export a flattened version of all visible layers
   * Merges all visible layers into a single image
   * @returns Data URL string (PNG format)
   */
  exportFlattenedToDataURL(): string {
    // Force fresh composite
    this.layerStack.markAllDirty();
    this.composeDirty();

    // Get visible layers in order (they're already composited in offscreen)
    // Just export the offscreen canvas directly
    return this.offscreen.toDataURL("image/png");
  }

  // ============================================
  // SELECTION INTERACTIVE DRAFTING API
  // ============================================

  beginSelectionDraft(originalMask: Uint8Array | null) {
    this.tempSelectionMask = originalMask;
    this.selectionManager.loadMask(originalMask);
  }

  updateSelectionRectDraft(x: number, y: number, w: number, h: number, mode: import("../types/editor").SelectionMode) {
    this.selectionManager.loadMask(this.tempSelectionMask);
    this.selectionManager.drawRect(x, y, w, h, mode);
    this.updateOverlayFromManager();
  }

  updateSelectionEllipseDraft(x: number, y: number, rx: number, ry: number, mode: import("../types/editor").SelectionMode) {
    this.selectionManager.loadMask(this.tempSelectionMask);
    this.selectionManager.drawEllipse(x, y, rx, ry, mode);
    this.updateOverlayFromManager();
  }

  updateSelectionPolygonDraft(points: import("../types/editor").Point[], mode: import("../types/editor").SelectionMode) {
    this.selectionManager.loadMask(this.tempSelectionMask);
    this.selectionManager.drawPolygon(points, mode);
    this.updateOverlayFromManager();
  }

  updateSelectionQuickDraft(startX: number, startY: number, radius: number, tolerance: number, mode: import("../types/editor").SelectionMode) {
    // Force latest composite for accurate color sampling
    this.composeDirty();
    const pixels = this.compositor.getCompositeBuffer();
    
    this.selectionManager.quickSelect(startX, startY, radius, tolerance, pixels, mode);
    this.updateOverlayFromManager();
  }

  commitSelectionDraft(): Uint8Array {
    return this.selectionManager.getMask();
  }

  private updateOverlayFromManager() {
    const mask = this.selectionManager.getMask();
    this.selectionOverlay.updateMask(mask, this.docWidth, this.docHeight);
    this.scheduleRender();
  }

  // ============================================
  // STORE SYNC API
  // ============================================
  syncSelection(selection: import("../types/editor").Selection | null) {
    if (selection && selection.mask) {
       this.selectionManager.loadMask(selection.mask);
       this.selectionOverlay.updateMask(selection.mask, this.docWidth, this.docHeight);
       this.selectionOverlay.startAnimation();
    } else {
       this.selectionManager.clear();
       this.selectionOverlay.clear();
       this.selectionOverlay.stopAnimation();
    }
    this.scheduleRender();
  }
}
