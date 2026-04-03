import "pixi.js/unsafe-eval";
import { Application, Container } from "pixi.js";
import { BrushEngine } from "./BrushEngine";
import { TileManager } from "./TileManager";
import type { BrushSettings, StrokePoint, ViewTransform } from "./types";
import { clamp, colorToPixiHex } from "./types";

export class Renderer {
  public readonly app = new Application();
  public readonly stage = new Container();
  public readonly world = new Container();

  private readonly layerManagers = new Map<string, TileManager>();
  private readonly layerOrder: string[] = [];
  private readonly documentWidth: number;
  private readonly documentHeight: number;
  private readonly tileSize: number;
  private readonly brushEngine: BrushEngine;

  private frameId = 0;
  private rafId: number | null = null;
  private transform: ViewTransform = {
    zoom: 1,
    panX: 0,
    panY: 0,
  };

  constructor(options: {
    documentWidth: number;
    documentHeight: number;
    tileSize?: number;
  }) {
    this.documentWidth = options.documentWidth;
    this.documentHeight = options.documentHeight;
    this.tileSize = options.tileSize ?? 256;

    this.stage.addChild(this.world);
    this.brushEngine = new BrushEngine(this.app.renderer);
  }

  async init(options: {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
  }): Promise<void> {
    await this.app.init({
      canvas: options.canvas,
      width: options.width,
      height: options.height,
      resolution: 1,
      antialias: false,
      autoStart: false,
      backgroundAlpha: 0,
    });

    this.app.stage.addChild(this.stage);
    this.ensureLayer("base");
    this.renderNow();
  }

  ensureLayer(layerId: string): TileManager {
    const existing = this.layerManagers.get(layerId);
    if (existing) return existing;

    const container = new Container();
    const manager = new TileManager({
      renderer: this.app.renderer,
      documentWidth: this.documentWidth,
      documentHeight: this.documentHeight,
      tileSize: this.tileSize,
      container,
      stampSprite: this.brushEngine.createReusableStampSprite(),
    });

    this.layerManagers.set(layerId, manager);
    this.layerOrder.push(layerId);
    this.world.addChild(container);

    return manager;
  }

  stroke(
    layerId: string,
    from: StrokePoint,
    to: StrokePoint,
    color: { r: number; g: number; b: number; a: number },
    settings: BrushSettings,
  ): void {
    const layer = this.ensureLayer(layerId);
    const normalized = {
      ...settings,
      size: clamp(settings.size, 1, 1024),
      hardness: clamp(settings.hardness, 0, 100),
      opacity: clamp(settings.opacity, 0, 100),
      flow: clamp(settings.flow, 0, 100),
      spacing: clamp(settings.spacing, 0.01, 1),
      rgba: color,
      color: colorToPixiHex(color),
    };

    this.frameId += 1;
    this.brushEngine.nextFrame(this.frameId);
    layer.beginFrame(this.frameId);

    this.brushEngine.rasterizeStroke(from, to, normalized, (stamp) => {
      layer.queueStamp(stamp);
    });

    this.scheduleRender();
  }

  setTransform(transform: Partial<ViewTransform>): void {
    this.transform = {
      ...this.transform,
      ...transform,
    };
    this.world.position.set(this.transform.panX, this.transform.panY);
    this.world.scale.set(this.transform.zoom);
    this.renderNow();
  }

  resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
    this.renderNow();
  }

  renderNow(): void {
    this.flushDirtyTiles();
    this.app.renderer.render(this.app.stage);
  }

  scheduleRender(): void {
    if (this.rafId !== null) return;

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.renderNow();
    });
  }

  evictUnusedTiles(): number {
    let removed = 0;

    for (const manager of this.layerManagers.values()) {
      manager.beginFrame(this.frameId);
      removed += manager.evictUnusedTiles();
    }

    this.brushEngine.trimCache();
    return removed;
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    for (const manager of this.layerManagers.values()) {
      manager.destroy();
    }

    this.layerManagers.clear();
    this.layerOrder.length = 0;
    this.brushEngine.destroy();
    this.app.destroy(true, {
      children: true,
      texture: true,
      textureSource: true,
    });
  }

  private flushDirtyTiles(): void {
    for (const layerId of this.layerOrder) {
      const manager = this.layerManagers.get(layerId);
      if (!manager) continue;

      manager.beginFrame(this.frameId);
      manager.flush();
    }
  }
}
