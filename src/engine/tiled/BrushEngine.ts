import { Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import type { Application, Renderer as PixiRenderer } from "pixi.js";
import type { BrushSettings, BrushStamp, StrokePoint, TileRect } from "./types";
import { clamp, colorToPixiHex } from "./types";

type BrushTextureCacheEntry = {
  key: string;
  lastUsedFrame: number;
  texture: Texture;
};

type StrokeOptions = BrushSettings & {
  rgba: { r: number; g: number; b: number; a: number };
};

const DEFAULT_SPACING = 0.2;

export class BrushEngine {
  private readonly renderer: Application["renderer"];
  private readonly textureCache = new Map<string, BrushTextureCacheEntry>();
  private frameId = 0;

  constructor(renderer: Application["renderer"]) {
    this.renderer = renderer;
  }

  nextFrame(frameId: number): void {
    this.frameId = frameId;
  }

  rasterizeStroke(
    from: StrokePoint,
    to: StrokePoint,
    options: StrokeOptions,
    emit: (stamp: BrushStamp) => void,
  ): TileRect {
    const radius = Math.max(0.5, options.size * 0.5);
    const spacingPx = Math.max(1, options.size * Math.max(DEFAULT_SPACING, options.spacing));
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    const steps = distance === 0 ? 1 : Math.max(1, Math.ceil(distance / spacingPx));
    const texture = this.getBrushTexture(options);
    const alpha = (options.rgba.a / 255) * (options.opacity / 100) * (options.flow / 100);
    const color = colorToPixiHex(options.rgba);

    const minX = Math.min(from.x, to.x) - radius;
    const minY = Math.min(from.y, to.y) - radius;
    const maxX = Math.max(from.x, to.x) + radius;
    const maxY = Math.max(from.y, to.y) + radius;

    for (let step = 0; step <= steps; step += 1) {
      const t = steps === 0 ? 1 : step / steps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;

      emit({
        x,
        y,
        radius,
        color,
        alpha,
        texture,
        bounds: {
          x: x - radius,
          y: y - radius,
          width: radius * 2,
          height: radius * 2,
        },
      });
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  trimCache(maxEntries = 24): void {
    if (this.textureCache.size <= maxEntries) return;

    const staleEntries = [...this.textureCache.values()].sort(
      (a, b) => a.lastUsedFrame - b.lastUsedFrame,
    );
    const excess = this.textureCache.size - maxEntries;

    for (let index = 0; index < excess; index += 1) {
      const entry = staleEntries[index];
      this.textureCache.delete(entry.key);
      entry.texture.destroy(true);
    }
  }

  private getBrushTexture(options: BrushSettings): Texture {
    const size = clamp(Math.ceil(options.size), 1, 1024);
    const hardnessBucket = clamp(Math.round(options.hardness / 5) * 5, 0, 100);
    const key = `${size}:${hardnessBucket}`;
    const cached = this.textureCache.get(key);

    if (cached) {
      cached.lastUsedFrame = this.frameId;
      return cached.texture;
    }

    const texture = this.buildBrushTexture(size, hardnessBucket);
    this.textureCache.set(key, {
      key,
      texture,
      lastUsedFrame: this.frameId,
    });

    return texture;
  }

  private buildBrushTexture(size: number, hardness: number): Texture {
    const stampSize = Math.max(2, size + 2);
    const graphics = new Graphics();
    const radius = size * 0.5;
    const center = stampSize * 0.5;
    const innerRadius = radius * (hardness / 100);

    graphics.rect(0, 0, stampSize, stampSize).fill({ color: 0xffffff, alpha: 0 });

    if (innerRadius > 0) {
      graphics.circle(center, center, innerRadius).fill(0xffffff);
    }

    const featherSteps = Math.max(8, Math.ceil(radius - innerRadius));
    const featherThickness = radius - innerRadius;

    if (featherThickness > 0) {
      for (let step = 0; step < featherSteps; step += 1) {
        const t0 = step / featherSteps;
        const t1 = (step + 1) / featherSteps;
        const ringRadius = innerRadius + featherThickness * t1;
        const alpha = Math.pow(1 - t0, 1.75);

        graphics.circle(center, center, ringRadius).fill({ color: 0xffffff, alpha });
      }
    }

    const texture = this.renderer.textureGenerator.generateTexture({
      target: graphics,
      frame: new Rectangle(0, 0, stampSize, stampSize),
      resolution: 1,
      antialias: true,
      textureSourceOptions: {
        scaleMode: "linear",
      },
    });

    graphics.destroy();

    return texture;
  }

  createReusableStampSprite(): Sprite {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5);
    return sprite;
  }

  destroy(): void {
    for (const entry of this.textureCache.values()) {
      entry.texture.destroy(true);
    }
    this.textureCache.clear();
  }
}
