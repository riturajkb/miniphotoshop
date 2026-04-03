# Tiled Pixi Renderer

## Folder structure

```text
src/engine/tiled/
  ARCHITECTURE.md
  types.ts
  Tile.ts
  TileManager.ts
  BrushEngine.ts
  Renderer.ts
  index.ts
```

## Core architecture

- `Renderer`
  Owns the Pixi `Application`, disables auto ticking, manages zoom/pan, and flushes dirty tiles on demand.
- `TileManager`
  Owns one sparse tile grid for one layer. Tiles are created lazily and only for touched regions.
- `Tile`
  Wraps one `PIXI.RenderTexture` plus its display `Sprite`.
- `BrushEngine`
  Converts pointer movement into spaced brush stamps and caches brush textures.

## Tile map data structures

```ts
type TileKey = `${number}:${number}`;

type TileMap = Map<TileKey, Tile>;
type DirtyTileSet = Set<TileKey>;
type PendingStampMap = Map<TileKey, BrushStamp[]>;
type LayerTileMap = Map<string, TileManager>;
```

## Dirty tile update loop

```ts
pointermove -> BrushEngine.rasterizeStroke()
           -> TileManager.queueStamp() per intersecting tile
           -> requestAnimationFrame()
           -> TileManager.flush()
           -> renderer.render(stage)
```

- No full-canvas composite pass during painting.
- Each tile only receives stamps that intersect it.
- Zoom and pan only change container transforms and do not rewrite tile textures.

## Tile creation

```ts
const tile = new Tile(container, tileX, tileY, tileSize, width, height);
tile.texture = RenderTexture.create({
  width,
  height,
  resolution: 1,
  antialias: false,
});
tile.sprite.position.set(tileX * tileSize, tileY * tileSize);
```

## Brush rendering into tiles

```ts
for (const stamp of stampsForTile) {
  stampSprite.texture = stamp.texture;
  stampSprite.position.set(stamp.x - tile.pixelX, stamp.y - tile.pixelY);
  stampSprite.scale.set((stamp.radius * 2) / stamp.texture.width);

  renderer.render({
    container: stampSprite,
    target: tile.texture,
    clear: false,
  });
}
```

This avoids reading pixels back to CPU and keeps brush application on the GPU.

## Performance considerations

- `resolution: 1` keeps GPU memory stable and avoids DPR-driven tile growth.
- Brush textures are cached by size and hardness bucket instead of recreated per pointer event.
- Stamps are queued and flushed once per RAF, which reduces render target switches.
- Sparse tile creation avoids allocating empty `RenderTexture`s across large documents.
- Per-layer tile managers keep multi-layer support additive instead of forcing a monolithic surface.

## Tradeoffs

- More tiles reduce per-update cost but increase sprite count.
- Larger tiles reduce sprite count but waste fill rate on small edits.
- The current implementation favors `256x256` as a balanced default; `512x512` is better for large soft brushes.
- Cached stamp textures trade some memory for much lower CPU overhead.

## Further optimization

- Add tile visibility culling so off-screen tiles skip sprite submission entirely.
- Add pooled `RenderTexture` reuse for evicted tiles.
- Use pressure/tilt to vary stamp alpha and size without changing the overall architecture.
- Add shader brushes by replacing the cached stamp texture with a custom filter or mesh pipeline.
- Store undo/redo as per-tile snapshots or compressed tile diffs rather than full-layer images.
- Add a background worker for CPU-side history compression and persistence.
