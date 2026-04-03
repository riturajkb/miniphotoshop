import { Container, Graphics, Sprite, Texture } from "pixi.js";

type BoundaryPoint = { x: number; y: number };

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export class SelectionOverlay {
  public container: Container;
  private sprite: Sprite;
  private draftGraphics: Graphics;
  private antsCanvas: HTMLCanvasElement;
  private antsCtx: CanvasRenderingContext2D;
  private boundaryPoints: BoundaryPoint[] = [];
  private bounds: Bounds | null = null;
  private time = 0;
  private animating = false;
  private viewScale = 1;

  constructor() {
    this.container = new Container();
    this.antsCanvas = document.createElement("canvas");
    this.antsCanvas.width = 1;
    this.antsCanvas.height = 1;
    this.antsCtx = this.antsCanvas.getContext("2d")!;

    this.sprite = new Sprite(Texture.from(this.antsCanvas));
    this.sprite.texture.source.scaleMode = "nearest";
    this.sprite.visible = false;
    this.container.addChild(this.sprite);

    this.draftGraphics = new Graphics();
    this.draftGraphics.visible = false;
    this.container.addChild(this.draftGraphics);
  }

  startAnimation() {
    this.animating = true;
  }

  stopAnimation() {
    this.animating = false;
  }

  updateAnimationAndGetDirty(dt: number): boolean {
    if (!this.animating || !this.sprite.visible || this.boundaryPoints.length === 0) {
      return false;
    }

    this.time += dt;
    this.renderBoundary();
    return true;
  }

  isAnimating(): boolean {
    return this.animating && this.sprite.visible && this.boundaryPoints.length > 0;
  }

  setViewScale(scale: number) {
    const nextScale = Math.max(0.05, scale);
    if (Math.abs(this.viewScale - nextScale) < 0.0001) {
      return;
    }

    this.viewScale = nextScale;
    this.container.scale.set(1 / this.viewScale);

    if (this.sprite.visible && this.boundaryPoints.length > 0) {
      this.renderBoundary();
    }
  }

  updateMask(mask: Uint8Array | null, width: number, height: number) {
    this.updateMaskWithBounds(mask, width, height);
  }

  updateMaskWithBounds(
    mask: Uint8Array | null,
    width: number,
    height: number,
    boundsHint?: Bounds | null,
  ) {
    if (!mask || mask.length !== width * height) {
      this.boundaryPoints = [];
      this.bounds = null;
      this.sprite.visible = false;
      return;
    }

    const scanStartX = Math.max(0, Math.floor(boundsHint?.x ?? 0));
    const scanStartY = Math.max(0, Math.floor(boundsHint?.y ?? 0));
    const scanEndX = Math.min(width, Math.ceil((boundsHint?.x ?? 0) + (boundsHint?.width ?? width)));
    const scanEndY = Math.min(height, Math.ceil((boundsHint?.y ?? 0) + (boundsHint?.height ?? height)));

    let minX = scanEndX;
    let minY = scanEndY;
    let maxX = -1;
    let maxY = -1;
    const boundaryPoints: BoundaryPoint[] = [];

    for (let y = scanStartY; y < scanEndY; y++) {
      for (let x = scanStartX; x < scanEndX; x++) {
        const index = y * width + x;
        if (mask[index] === 0) continue;

        const top = y === 0 ? 0 : mask[index - width];
        const bottom = y === height - 1 ? 0 : mask[index + width];
        const left = x === 0 ? 0 : mask[index - 1];
        const right = x === width - 1 ? 0 : mask[index + 1];
        const isBoundary = top === 0 || bottom === 0 || left === 0 || right === 0;

        if (!isBoundary) continue;

        boundaryPoints.push({ x, y });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (boundaryPoints.length === 0) {
      this.boundaryPoints = [];
      this.bounds = null;
      this.sprite.visible = false;
      return;
    }

    const bounds = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };

    if (
      this.antsCanvas.width !== this.getScreenWidth(bounds.width) ||
      this.antsCanvas.height !== this.getScreenHeight(bounds.height)
    ) {
      this.antsCanvas.width = this.getScreenWidth(bounds.width);
      this.antsCanvas.height = this.getScreenHeight(bounds.height);
      this.antsCtx = this.antsCanvas.getContext("2d")!;
      this.sprite.texture.destroy(true);
      this.sprite.texture = Texture.from(this.antsCanvas);
      this.sprite.texture.source.scaleMode = "nearest";
    }

    this.boundaryPoints = boundaryPoints;
    this.bounds = bounds;
    this.container.position.set(bounds.x, bounds.y);
    this.sprite.position.set(0, 0);
    this.sprite.visible = true;
    this.renderBoundary();
  }

  updateDraftPolygon(points: readonly BoundaryPoint[]) {
    this.draftGraphics.clear();

    if (points.length === 0) {
      this.draftGraphics.visible = false;
      return;
    }

    this.draftGraphics.visible = true;
    if (points.length === 1) {
      const point = points[0];
      this.draftGraphics
        .circle(point.x + 0.5, point.y + 0.5, 2)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.95 });
      return;
    }

    this.draftGraphics.moveTo(points[0].x + 0.5, points[0].y + 0.5);
    for (let index = 1; index < points.length; index += 1) {
      this.draftGraphics.lineTo(points[index].x + 0.5, points[index].y + 0.5);
    }

    this.draftGraphics.stroke({ width: 1, color: 0x000000, alpha: 0.9 });
    this.draftGraphics.moveTo(points[0].x + 0.5, points[0].y + 0.5);
    for (let index = 1; index < points.length; index += 1) {
      this.draftGraphics.lineTo(points[index].x + 0.5, points[index].y + 0.5);
    }
    this.draftGraphics.stroke({ width: 1, color: 0xffffff, alpha: 0.9, pixelLine: true });
  }

  clearDraft() {
    this.draftGraphics.clear();
    this.draftGraphics.visible = false;
  }

  clear() {
    this.boundaryPoints = [];
    this.bounds = null;
    this.sprite.visible = false;
    this.clearDraft();
    this.antsCtx.clearRect(0, 0, this.antsCanvas.width, this.antsCanvas.height);
    this.sprite.texture.source.update();
  }

  destroy() {
    if (this.sprite.texture && this.sprite.texture !== Texture.EMPTY) {
      this.sprite.texture.destroy(true);
    }
    this.container.destroy();
  }

  private renderBoundary() {
    if (!this.bounds || this.boundaryPoints.length === 0) {
      this.sprite.visible = false;
      return;
    }

    const screenWidth = this.getScreenWidth(this.bounds.width);
    const screenHeight = this.getScreenHeight(this.bounds.height);
    if (this.antsCanvas.width !== screenWidth || this.antsCanvas.height !== screenHeight) {
      this.antsCanvas.width = screenWidth;
      this.antsCanvas.height = screenHeight;
      this.antsCtx = this.antsCanvas.getContext("2d")!;
      this.sprite.texture.destroy(true);
      this.sprite.texture = Texture.from(this.antsCanvas);
      this.sprite.texture.source.scaleMode = "nearest";
      this.sprite.position.set(0, 0);
    }

    const phase = Math.floor(this.time * 60);
    this.antsCtx.clearRect(0, 0, this.antsCanvas.width, this.antsCanvas.height);
    const antSize = Math.max(1, Math.ceil(this.viewScale));

    for (const point of this.boundaryPoints) {
      const localX = Math.floor((point.x - this.bounds.x) * this.viewScale);
      const localY = Math.floor((point.y - this.bounds.y) * this.viewScale);
      const dark = ((point.x + point.y - phase) & 15) >= 8;
      this.antsCtx.fillStyle = dark ? "#000000" : "#ffffff";
      this.antsCtx.fillRect(localX, localY, antSize, antSize);
    }

    this.sprite.texture.source.update();
  }

  private getScreenWidth(docWidth: number): number {
    return Math.max(1, Math.ceil(docWidth * this.viewScale) + Math.ceil(this.viewScale));
  }

  private getScreenHeight(docHeight: number): number {
    return Math.max(1, Math.ceil(docHeight * this.viewScale) + Math.ceil(this.viewScale));
  }
}
