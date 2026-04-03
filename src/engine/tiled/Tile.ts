import { RenderTexture, Sprite } from "pixi.js";
import type { Container } from "pixi.js";
import type { TileRecord } from "./types";
import { tileKey } from "./types";

export class Tile implements TileRecord {
  public readonly key: string;
  public readonly tileX: number;
  public readonly tileY: number;
  public readonly pixelX: number;
  public readonly pixelY: number;
  public readonly width: number;
  public readonly height: number;
  public readonly texture: RenderTexture;
  public readonly sprite: Sprite;
  public readonly container: Container;
  public dirty = false;
  public lastTouchedFrame = 0;

  constructor(
    container: Container,
    tileX: number,
    tileY: number,
    tileSize: number,
    width: number,
    height: number,
  ) {
    this.key = tileKey(tileX, tileY);
    this.tileX = tileX;
    this.tileY = tileY;
    this.pixelX = tileX * tileSize;
    this.pixelY = tileY * tileSize;
    this.width = width;
    this.height = height;
    this.container = container;
    this.texture = RenderTexture.create({
      width,
      height,
      resolution: 1,
      antialias: false,
      scaleMode: "nearest",
    });
    this.sprite = new Sprite(this.texture);
    this.sprite.position.set(this.pixelX, this.pixelY);
    this.sprite.roundPixels = true;

    this.container.addChild(this.sprite);
  }

  touch(frameId: number): void {
    this.lastTouchedFrame = frameId;
    this.dirty = true;
  }

  destroy(): void {
    this.sprite.destroy();
    this.texture.destroy(true);
  }
}
