import { Container, Sprite, Texture } from "pixi.js";

export class SelectionOverlay {
  public container: Container;
  private sprite: Sprite;
  private antsCanvas: HTMLCanvasElement;
  private antsCtx: CanvasRenderingContext2D;
  private currentMask: Uint8Array | null = null;
  private width = 0;
  private height = 0;
  private time = 0;
  private animating = false;

  constructor() {
    this.container = new Container();
    this.antsCanvas = document.createElement("canvas");
    this.antsCanvas.width = 1;
    this.antsCanvas.height = 1;
    this.antsCtx = this.antsCanvas.getContext("2d", { willReadFrequently: true })!;

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
    if (!this.animating || !this.sprite.visible || !this.currentMask) return false;

    this.time += dt;
    this.renderBoundary();
    return true;
  }

  updateMask(mask: Uint8Array | null, width: number, height: number) {
    this.width = width;
    this.height = height;

    if (!mask || mask.length !== width * height) {
      this.currentMask = null;
      this.sprite.visible = false;
      return;
    }

    if (this.antsCanvas.width !== width || this.antsCanvas.height !== height) {
      this.antsCanvas.width = width;
      this.antsCanvas.height = height;
      this.antsCtx = this.antsCanvas.getContext("2d", { willReadFrequently: true })!;
      this.sprite.texture.destroy(true);
      this.sprite.texture = Texture.from(this.antsCanvas);
    }

    this.currentMask = new Uint8Array(mask);
    this.sprite.visible = true;
    this.renderBoundary();
  }

  private renderBoundary() {
    if (!this.currentMask || this.width <= 0 || this.height <= 0) {
      this.sprite.visible = false;
      return;
    }

    const phase = Math.floor(this.time * 60);
    const imageData = this.antsCtx.createImageData(this.width, this.height);
    const data = imageData.data;
    const mask = this.currentMask;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = y * this.width + x;
        if (mask[index] === 0) continue;

        const top = y === 0 ? 0 : mask[index - this.width];
        const bottom = y === this.height - 1 ? 0 : mask[index + this.width];
        const left = x === 0 ? 0 : mask[index - 1];
        const right = x === this.width - 1 ? 0 : mask[index + 1];
        const isBoundary = top === 0 || bottom === 0 || left === 0 || right === 0;

        if (!isBoundary) continue;

        const pixel = index * 4;
        const dark = ((x + y - phase) & 15) >= 8;
        const shade = dark ? 0 : 255;
        data[pixel] = shade;
        data[pixel + 1] = shade;
        data[pixel + 2] = shade;
        data[pixel + 3] = 255;
      }
    }

    this.antsCtx.putImageData(imageData, 0, 0);
    this.sprite.texture.source.update();
  }

  clear() {
    this.currentMask = null;
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
}
