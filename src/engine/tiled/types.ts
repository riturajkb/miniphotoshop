import type { Container, RenderTexture, Sprite, Texture } from "pixi.js";

export interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TileAddress {
  x: number;
  y: number;
}

export interface TileBounds extends TileRect {
  tileX: number;
  tileY: number;
  key: string;
}

export interface BrushSettings {
  size: number;
  hardness: number;
  spacing: number;
  opacity: number;
  flow: number;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface BrushStamp {
  x: number;
  y: number;
  radius: number;
  color: number;
  alpha: number;
  texture: Texture;
  bounds: TileRect;
}

export interface TileCachePolicy {
  maxTiles: number;
  maxIdleFrames: number;
}

export interface TileRecord {
  key: string;
  tileX: number;
  tileY: number;
  pixelX: number;
  pixelY: number;
  width: number;
  height: number;
  texture: RenderTexture;
  sprite: Sprite;
  container: Container;
  dirty: boolean;
  lastTouchedFrame: number;
}

export function tileKey(x: number, y: number): string {
  return `${x}:${y}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function colorToPixiHex(color: {
  r: number;
  g: number;
  b: number;
}): number {
  return ((color.r & 0xff) << 16) | ((color.g & 0xff) << 8) | (color.b & 0xff);
}

export function intersects(a: TileRect, b: TileRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
