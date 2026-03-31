/**
 * PixiEngine - Core PixiJS application wrapper
 * No singleton — each Renderer creates its own PixiEngine to survive HMR/StrictMode
 */
import "pixi.js/unsafe-eval"; // Required: CSP blocks eval() used by PixiJS shader compiler
import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";

type CompositeTile = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  sprite: Sprite;
  texture: Texture;
  x: number;
  y: number;
  width: number;
  height: number;
};

export class PixiEngine {
  public app!: Application;
  public documentContainer!: Container;
  public checkerboardContainer!: Container;
  public compositeContainer!: Container;
  public backgroundGraphics: Graphics | null = null;

  private initialized = false;
  private compositeTiles: CompositeTile[] = [];
  private compositeWidth = 0;
  private compositeHeight = 0;
  private readonly compositeTileSize = 512;

  async init(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
  ): Promise<void> {
    if (this.initialized) return;

    this.app = new Application();

    await this.app.init({
      canvas,
      width,
      height,
      backgroundColor: 0x1a1a1a,
      antialias: false,
      resolution: 1,
      autoStart: false,
    });

    this.checkerboardContainer = new Container();
    this.documentContainer = new Container();
    this.compositeContainer = new Container();

    this.app.stage.addChild(this.checkerboardContainer);
    this.documentContainer.addChild(this.compositeContainer);
    this.app.stage.addChild(this.documentContainer);

    this.initialized = true;
    console.log(
      `[PixiEngine] initialized: canvas ${canvas.width}x${canvas.height}, vp ${width}x${height}`,
    );
  }

  resize(width: number, height: number): void {
    if (!this.initialized) return;
    this.app.renderer.resize(width, height);
  }

  createCheckerboard(docWidth: number, docHeight: number, tileSize = 8): void {
    this.checkerboardContainer.removeChildren();

    const g = new Graphics();
    for (let y = 0; y < docHeight; y += tileSize) {
      for (let x = 0; x < docWidth; x += tileSize) {
        const isEvenRow = Math.floor(y / tileSize) % 2 === 0;
        const isEvenCol = Math.floor(x / tileSize) % 2 === 0;
        g.rect(x, y, tileSize, tileSize);
        g.fill(isEvenRow === isEvenCol ? 0xdddddd : 0xcccccc);
      }
    }

    this.checkerboardContainer.addChild(g);
  }

  setCompositeTexture(
    canvas: HTMLCanvasElement,
    dirtyRect?: { minX: number; minY: number; maxX: number; maxY: number },
  ): void {
    this.ensureCompositeTiles(canvas.width, canvas.height);

    const minX = dirtyRect ? dirtyRect.minX : 0;
    const minY = dirtyRect ? dirtyRect.minY : 0;
    const maxX = dirtyRect ? dirtyRect.maxX : canvas.width - 1;
    const maxY = dirtyRect ? dirtyRect.maxY : canvas.height - 1;

    for (const tile of this.compositeTiles) {
      const tileMaxX = tile.x + tile.width - 1;
      const tileMaxY = tile.y + tile.height - 1;
      const intersects =
        tile.x <= maxX &&
        tile.y <= maxY &&
        tileMaxX >= minX &&
        tileMaxY >= minY;

      if (!intersects) continue;

      tile.ctx.clearRect(0, 0, tile.width, tile.height);
      tile.ctx.drawImage(
        canvas,
        tile.x,
        tile.y,
        tile.width,
        tile.height,
        0,
        0,
        tile.width,
        tile.height,
      );
      tile.texture.source.update();
    }
  }

  /**
   * Create a white background Graphics object as the bottommost layer
   * This is a real scene graph object that can be exported and flattened
   */
  createBackgroundGraphics(width: number, height: number): Graphics {
    // Remove any existing background graphics
    if (this.backgroundGraphics) {
      this.backgroundGraphics.destroy();
      this.backgroundGraphics = null;
    }

    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill(0xFFFFFF);
    bg.alpha = 1;

    // Insert as first child of documentContainer (below compositeSprite)
    this.documentContainer.addChildAt(bg, 0);
    this.backgroundGraphics = bg;

    return bg;
  }

  /**
   * Remove the background graphics object
   */
  removeBackgroundGraphics(): void {
    if (this.backgroundGraphics) {
      this.backgroundGraphics.destroy();
      this.backgroundGraphics = null;
    }
  }

  setTransform(x: number, y: number, scale: number): void {
    this.checkerboardContainer.position.set(x, y);
    this.checkerboardContainer.scale.set(scale);
    this.documentContainer.position.set(x, y);
    this.documentContainer.scale.set(scale);
  }

  render(): void {
    if (!this.initialized) return;
    this.app.renderer.render({ container: this.app.stage });
  }

  destroy(): void {
    if (!this.initialized) return;
    this.destroyCompositeTiles();
    this.app.destroy(true, { children: true, texture: true });
    this.initialized = false;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  private ensureCompositeTiles(width: number, height: number): void {
    if (this.compositeWidth === width && this.compositeHeight === height && this.compositeTiles.length > 0) {
      return;
    }

    this.destroyCompositeTiles();
    this.compositeWidth = width;
    this.compositeHeight = height;

    for (let y = 0; y < height; y += this.compositeTileSize) {
      for (let x = 0; x < width; x += this.compositeTileSize) {
        const tileWidth = Math.min(this.compositeTileSize, width - x);
        const tileHeight = Math.min(this.compositeTileSize, height - y);
        const tileCanvas = document.createElement("canvas");
        tileCanvas.width = tileWidth;
        tileCanvas.height = tileHeight;
        const tileCtx = tileCanvas.getContext("2d")!;
        const texture = Texture.from(tileCanvas);
        const sprite = new Sprite(texture);
        sprite.position.set(x, y);
        this.compositeContainer.addChild(sprite);
        this.compositeTiles.push({
          canvas: tileCanvas,
          ctx: tileCtx,
          sprite,
          texture,
          x,
          y,
          width: tileWidth,
          height: tileHeight,
        });
      }
    }
  }

  private destroyCompositeTiles(): void {
    for (const tile of this.compositeTiles) {
      tile.sprite.destroy({ texture: true });
    }
    this.compositeTiles = [];
    this.compositeWidth = 0;
    this.compositeHeight = 0;
    this.compositeContainer?.removeChildren();
  }
}
