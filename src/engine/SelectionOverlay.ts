import { Container, Sprite, Texture } from "pixi.js";

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
  private antsCanvas: HTMLCanvasElement;
  private antsCtx: CanvasRenderingContext2D;
  private boundaryPoints: BoundaryPoint[] = [];
  private bounds: Bounds | null = null;
  private time = 0;
  private animating = false;

  constructor() {
    this.container = new Container();
    this.antsCanvas = document.createElement("canvas");
    this.antsCanvas.width = 1;
    this.antsCanvas.height = 1;
    this.antsCtx = this.antsCanvas.getContext("2d")!;

    this.sprite = new Sprite(Texture.from(this.antsCanvas));
    this.sprite.visible = false;
    this.container.addChild(this.sprite);
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

  updateMask(mask: Uint8Array | null, width: number, height: number) {
    if (!mask || mask.length !== width * height) {
      this.boundaryPoints = [];
      this.bounds = null;
      this.sprite.visible = false;
      return;
    }

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    const boundaryPoints: BoundaryPoint[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
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
      this.antsCanvas.width !== bounds.width ||
      this.antsCanvas.height !== bounds.height
    ) {
      this.antsCanvas.width = bounds.width;
      this.antsCanvas.height = bounds.height;
      this.antsCtx = this.antsCanvas.getContext("2d")!;
      this.sprite.texture.destroy(true);
      this.sprite.texture = Texture.from(this.antsCanvas);
    }

    this.boundaryPoints = boundaryPoints;
    this.bounds = bounds;
    this.sprite.position.set(bounds.x, bounds.y);
    this.sprite.visible = true;
    this.renderBoundary();
  }

  clear() {
    this.boundaryPoints = [];
    this.bounds = null;
    this.sprite.visible = false;
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

    const phase = Math.floor(this.time * 60);
    this.antsCtx.clearRect(0, 0, this.antsCanvas.width, this.antsCanvas.height);

    for (const point of this.boundaryPoints) {
      const localX = point.x - this.bounds.x;
      const localY = point.y - this.bounds.y;
      const dark = ((point.x + point.y - phase) & 15) >= 8;
      this.antsCtx.fillStyle = dark ? "#000000" : "#ffffff";
      this.antsCtx.fillRect(localX, localY, 1, 1);
    }

    this.sprite.texture.source.update();
  }
}
