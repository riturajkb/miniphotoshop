/**
 * PixiEngine - Core PixiJS application wrapper
 * No singleton — each Renderer creates its own PixiEngine to survive HMR/StrictMode
 */
import "pixi.js/unsafe-eval"; // Required: CSP blocks eval() used by PixiJS shader compiler
import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";

export class PixiEngine {
  public app!: Application;
  public documentContainer!: Container;
  public checkerboardContainer!: Container;
  public compositeSprite!: Sprite;
  public backgroundGraphics: Graphics | null = null;

  private initialized = false;

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
    this.compositeSprite = new Sprite(Texture.EMPTY);
    this.compositeSprite.eventMode = "static";

    this.app.stage.addChild(this.checkerboardContainer);
    this.documentContainer.addChild(this.compositeSprite);
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
        g.fill(isEvenRow === isEvenCol ? 0x141414 : 0x0e0e0e);
      }
    }

    this.checkerboardContainer.addChild(g);
  }

  setCompositeTexture(canvas: HTMLCanvasElement): void {
    if (
      this.compositeSprite.texture &&
      this.compositeSprite.texture !== Texture.EMPTY
    ) {
      if (
        this.compositeSprite.texture.width !== canvas.width ||
        this.compositeSprite.texture.height !== canvas.height
      ) {
        this.compositeSprite.texture.destroy(true);
        this.compositeSprite.texture = Texture.from(canvas);
      } else {
        this.compositeSprite.texture.source.update();
      }
    } else {
      this.compositeSprite.texture = Texture.from(canvas);
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
    this.app.destroy(true, { children: true, texture: true });
    this.initialized = false;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}
