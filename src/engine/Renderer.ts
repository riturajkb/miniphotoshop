/**
 * Renderer - Syncs document state to PixiJS display tree
 */
import type { Graphics } from "pixi.js";
import { PixiEngine } from "./PixiEngine";
import { LayerStack } from "./LayerStack";
import { Compositor } from "./Compositor";

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
    this.updateTransform();
  }

  /** Composite dirty layers and upload texture. Call from tick(). */
  private composeDirty(): void {
    if (!this.layerStack.hasDirtyLayers()) return;

    const imageData = this.compositor.composite(this.layerStack.getLayers());

    this.offCtx.putImageData(imageData, 0, 0);

    this.engine.setCompositeTexture(this.offscreen);
    this.layerStack.clearDirty();
  }

  /** Call every animation frame — composites dirty layers then repaints PixiJS */
  render(): void {
    if (!this.engine.isInitialized) return;
    this.composeDirty();
    this.engine.render();
  }

  forceRender(): void {
    this.layerStack.markAllDirty();
    this.render();
  }

  setZoom(z: number): void {
    this.zoom = Math.max(0.05, Math.min(64, z));
    this.updateTransform();
  }

  getZoom(): number {
    return this.zoom;
  }

  setPan(x: number, y: number): void {
    this.panX = x;
    this.panY = y;
    this.updateTransform();
  }

  getPan(): { x: number; y: number } {
    return { x: this.panX, y: this.panY };
  }

  private updateTransform(): void {
    this.engine.setTransform(this.panX, this.panY, this.zoom);
  }

  screenToCanvas(sx: number, sy: number): { x: number; y: number } {
    return {
      x: Math.floor((sx - this.panX) / this.zoom),
      y: Math.floor((sy - this.panY) / this.zoom),
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

  /**
   * Brush drawing logic
   */
  drawBrush(x: number, y: number, color: import("../types/editor").RGBA, size: number): void {
    const layer = this.layerStack.getActiveLayer();
    if (!layer || layer.locked || !layer.pixelBuffer) return;

    const radius = Math.floor(size / 2);
    const w = this.docWidth;
    const h = this.docHeight;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx;
        const py = y + dy;

        if (px >= 0 && px < w && py >= 0 && py < h) {
          if (dx * dx + dy * dy <= radius * radius) {
            const idx = (py * w + px) * 4;
            layer.pixelBuffer[idx] = color.r;
            layer.pixelBuffer[idx + 1] = color.g;
            layer.pixelBuffer[idx + 2] = color.b;
            layer.pixelBuffer[idx + 3] = color.a;
          }
        }
      }
    }
    layer.dirty = true;
    this.render();
  }

  /**
   * Invert current layer pixels
   */
  invertLayer(): void {
    const layer = this.layerStack.getActiveLayer();
    if (!layer || layer.locked || !layer.pixelBuffer) return;

    for (let i = 0; i < layer.pixelBuffer.length; i += 4) {
      layer.pixelBuffer[i] = 255 - layer.pixelBuffer[i];
      layer.pixelBuffer[i + 1] = 255 - layer.pixelBuffer[i + 1];
      layer.pixelBuffer[i + 2] = 255 - layer.pixelBuffer[i + 2];
    }
    layer.dirty = true;
    this.render();
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
    this.layerStack.resize(w, h);
    this.layerStack.clear();
    this.engine.removeBackgroundGraphics();

    this.offscreen.width = w;
    this.offscreen.height = h;

    this.engine.createCheckerboard(w, h);

    // Auto-center the new document in the viewport
    if (this.vpW > 0 && this.vpH > 0) {
      this.fitToViewport(this.vpW, this.vpH);
    }
  }

  destroy(): void {
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
}
