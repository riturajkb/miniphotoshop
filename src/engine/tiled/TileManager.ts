import { Container, Matrix } from "pixi.js";
import type { Application, Sprite } from "pixi.js";
import { Tile } from "./Tile";
import type {
  BrushStamp,
  TileAddress,
  TileBounds,
  TileCachePolicy,
  TileRect,
} from "./types";
import { clamp, intersects, tileKey } from "./types";

const DEFAULT_CACHE_POLICY: TileCachePolicy = {
  maxTiles: 512,
  maxIdleFrames: 600,
};

export class TileManager {
  public readonly container: Container;

  private readonly renderer: Application["renderer"];
  private readonly documentWidth: number;
  private readonly documentHeight: number;
  private readonly tileSize: number;
  private readonly tiles = new Map<string, Tile>();
  private readonly dirtyTiles = new Set<string>();
  private readonly pendingStamps = new Map<string, BrushStamp[]>();
  private readonly stampSprite: Sprite;
  private readonly renderMatrix = new Matrix();
  private readonly cachePolicy: TileCachePolicy;

  private frameId = 0;

  constructor(options: {
    renderer: Application["renderer"];
    documentWidth: number;
    documentHeight: number;
    tileSize: number;
    container?: Container;
    stampSprite: Sprite;
    cachePolicy?: Partial<TileCachePolicy>;
  }) {
    this.renderer = options.renderer;
    this.documentWidth = options.documentWidth;
    this.documentHeight = options.documentHeight;
    this.tileSize = options.tileSize;
    this.container = options.container ?? new Container();
    this.stampSprite = options.stampSprite;
    this.cachePolicy = {
      ...DEFAULT_CACHE_POLICY,
      ...options.cachePolicy,
    };
  }

  beginFrame(frameId: number): void {
    this.frameId = frameId;
  }

  queueStamp(stamp: BrushStamp): void {
    const tiles = this.getIntersectingTiles(stamp.bounds);

    for (const address of tiles) {
      const tile = this.getOrCreateTile(address.x, address.y);
      const queue = this.pendingStamps.get(tile.key);

      if (queue) {
        queue.push(stamp);
      } else {
        this.pendingStamps.set(tile.key, [stamp]);
      }

      this.dirtyTiles.add(tile.key);
      tile.touch(this.frameId);
    }
  }

  flush(): TileRect | null {
    if (this.dirtyTiles.size === 0) {
      return null;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const key of this.dirtyTiles) {
      const tile = this.tiles.get(key);
      if (!tile) continue;

      const stamps = this.pendingStamps.get(key);
      if (!stamps || stamps.length === 0) continue;

      for (const stamp of stamps) {
        this.stampSprite.texture = stamp.texture;
        this.stampSprite.tint = stamp.color;
        this.stampSprite.alpha = stamp.alpha;
        this.stampSprite.position.set(
          stamp.x - tile.pixelX,
          stamp.y - tile.pixelY,
        );
        this.stampSprite.scale.set((stamp.radius * 2) / stamp.texture.width);

        this.renderMatrix.identity();

        this.renderer.render({
          container: this.stampSprite,
          target: tile.texture,
          clear: false,
          transform: this.renderMatrix,
        });
      }

      this.pendingStamps.delete(key);
      tile.dirty = false;

      minX = Math.min(minX, tile.pixelX);
      minY = Math.min(minY, tile.pixelY);
      maxX = Math.max(maxX, tile.pixelX + tile.width);
      maxY = Math.max(maxY, tile.pixelY + tile.height);
    }

    this.dirtyTiles.clear();

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  evictUnusedTiles(): number {
    if (this.tiles.size <= this.cachePolicy.maxTiles) {
      return 0;
    }

    const evictionCandidates = [...this.tiles.values()]
      .filter(
        (tile) =>
          this.frameId - tile.lastTouchedFrame >= this.cachePolicy.maxIdleFrames &&
          !this.pendingStamps.has(tile.key),
      )
      .sort((a, b) => a.lastTouchedFrame - b.lastTouchedFrame);

    const tilesToRemove = Math.min(
      evictionCandidates.length,
      this.tiles.size - this.cachePolicy.maxTiles,
    );

    for (let index = 0; index < tilesToRemove; index += 1) {
      const tile = evictionCandidates[index];
      this.tiles.delete(tile.key);
      this.dirtyTiles.delete(tile.key);
      this.pendingStamps.delete(tile.key);
      tile.destroy();
    }

    return tilesToRemove;
  }

  getTileCount(): number {
    return this.tiles.size;
  }

  getOrCreateTile(tileX: number, tileY: number): Tile {
    const key = tileKey(tileX, tileY);
    const existing = this.tiles.get(key);

    if (existing) {
      existing.touch(this.frameId);
      return existing;
    }

    const bounds = this.getTileBounds(tileX, tileY);
    const tile = new Tile(
      this.container,
      tileX,
      tileY,
      this.tileSize,
      bounds.width,
      bounds.height,
    );

    tile.touch(this.frameId);
    this.tiles.set(key, tile);
    return tile;
  }

  getTileBounds(tileX: number, tileY: number): TileBounds {
    const x = tileX * this.tileSize;
    const y = tileY * this.tileSize;
    const width = clamp(this.documentWidth - x, 0, this.tileSize);
    const height = clamp(this.documentHeight - y, 0, this.tileSize);

    return {
      tileX,
      tileY,
      x,
      y,
      width,
      height,
      key: tileKey(tileX, tileY),
    };
  }

  private getIntersectingTiles(rect: TileRect): TileAddress[] {
    const minTileX = Math.floor(rect.x / this.tileSize);
    const minTileY = Math.floor(rect.y / this.tileSize);
    const maxTileX = Math.floor((rect.x + rect.width) / this.tileSize);
    const maxTileY = Math.floor((rect.y + rect.height) / this.tileSize);
    const addresses: TileAddress[] = [];

    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      if (tileY < 0 || tileY * this.tileSize >= this.documentHeight) continue;

      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        if (tileX < 0 || tileX * this.tileSize >= this.documentWidth) continue;

        const bounds = this.getTileBounds(tileX, tileY);
        if (!intersects(rect, bounds)) continue;
        addresses.push({ x: tileX, y: tileY });
      }
    }

    return addresses;
  }

  destroy(): void {
    for (const tile of this.tiles.values()) {
      tile.destroy();
    }

    this.tiles.clear();
    this.dirtyTiles.clear();
    this.pendingStamps.clear();
    this.container.destroy({ children: true });
  }
}
