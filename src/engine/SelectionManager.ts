import { SelectionMode, Point } from "../types/editor";

type SelectionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export class SelectionManager {
  private width: number;
  private height: number;
  private mask: Uint8Array;
  private hasActive = false;
  private bounds: SelectionBounds | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.mask = new Uint8Array(width * height);
  }

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.mask = new Uint8Array(w * h);
    this.hasActive = false;
    this.bounds = null;
  }

  loadMask(mask: Uint8Array | null) {
    if (mask && mask.length === this.width * this.height) {
      this.mask = new Uint8Array(mask);
      this.recomputeBoundsAndActive();
      return;
    }

    this.mask = new Uint8Array(this.width * this.height);
    this.hasActive = false;
    this.bounds = null;
  }

  getMask(): Uint8Array {
    return this.mask;
  }

  getMaskAndActive(): { mask: Uint8Array; hasActiveSelection: boolean } {
    return { mask: this.mask, hasActiveSelection: this.hasActive };
  }

  getBounds(): SelectionBounds | null {
    return this.bounds ? { ...this.bounds } : null;
  }

  drawRect(x: number, y: number, w: number, h: number, mode: SelectionMode) {
    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));
    const endX = Math.min(this.width, Math.ceil(x + w));
    const endY = Math.min(this.height, Math.ceil(y + h));

    this.applyShape(startX, startY, endX, endY, mode, () => true);
  }

  drawEllipse(x: number, y: number, rx: number, ry: number, mode: SelectionMode) {
    if (rx <= 0 || ry <= 0) return;

    const startX = Math.max(0, Math.floor(x - rx));
    const startY = Math.max(0, Math.floor(y - ry));
    const endX = Math.min(this.width, Math.ceil(x + rx));
    const endY = Math.min(this.height, Math.ceil(y + ry));

    this.applyShape(startX, startY, endX, endY, mode, (px, py) => {
      const dx = (px + 0.5 - x) / rx;
      const dy = (py + 0.5 - y) / ry;
      return dx * dx + dy * dy <= 1;
    });
  }

  drawPolygon(points: Point[], mode: SelectionMode) {
    if (points.length < 3) return;

    let minX = this.width;
    let minY = this.height;
    let maxX = -1;
    let maxY = -1;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    const startX = Math.max(0, Math.floor(minX));
    const startY = Math.max(0, Math.floor(minY));
    const endX = Math.min(this.width, Math.ceil(maxX));
    const endY = Math.min(this.height, Math.ceil(maxY));

    this.applyShape(startX, startY, endX, endY, mode, (px, py) =>
      this.pointInPolygon(px + 0.5, py + 0.5, points),
    );
  }

  quickSelect(
    startX: number,
    startY: number,
    radius: number,
    tolerance: number,
    sourcePixels: Uint8ClampedArray,
    mode: SelectionMode,
  ) {
    const w = this.width;
    const h = this.height;
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const visited = new Uint8Array(w * h);
    const queue: number[] = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;

        const px = startX + dx;
        const py = startY + dy;
        if (px < 0 || px >= w || py < 0 || py >= h) continue;

        const index = py * w + px;
        if (visited[index]) continue;
        visited[index] = 1;
        queue.push(index);
      }
    }

    if (queue.length === 0) return;

    const centerIdx = (startY * w + startX) * 4;
    const sr = sourcePixels[centerIdx];
    const sg = sourcePixels[centerIdx + 1];
    const sb = sourcePixels[centerIdx + 2];
    const sa = sourcePixels[centerIdx + 3];

    const fillMask = new Uint8Array(w * h);
    let head = 0;

    while (head < queue.length) {
      const index = queue[head++];
      const px = index % w;
      const py = Math.floor(index / w);

      fillMask[index] = 255;

      const neighbors = [
        [px - 1, py],
        [px + 1, py],
        [px, py - 1],
        [px, py + 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

        const next = ny * w + nx;
        if (visited[next]) continue;
        visited[next] = 1;

        const pxIdx = next * 4;
        const dr = sourcePixels[pxIdx] - sr;
        const dg = sourcePixels[pxIdx + 1] - sg;
        const db = sourcePixels[pxIdx + 2] - sb;
        const da = sourcePixels[pxIdx + 3] - sa;
        const distance = Math.sqrt(dr * dr + dg * dg + db * db + da * da);

        if (distance <= tolerance) {
          queue.push(next);
        }
      }
    }

    this.applyMask(fillMask, mode);
  }

  clear() {
    this.mask.fill(0);
    this.hasActive = false;
    this.bounds = null;
  }

  private applyShape(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    mode: SelectionMode,
    contains: (x: number, y: number) => boolean,
  ) {
    if (startX >= endX || startY >= endY) {
      if (mode === "replace" || mode === "intersect") {
        this.clear();
      }
      return;
    }

    if (mode === "replace") {
      this.mask.fill(0);
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          if (contains(x, y)) {
            this.mask[y * this.width + x] = 255;
          }
        }
      }
      this.recomputeBoundsAndActive();
      return;
    }

    if (mode === "intersect") {
      const nextMask = new Uint8Array(this.width * this.height);
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const index = y * this.width + x;
          if (this.mask[index] > 0 && contains(x, y)) {
            nextMask[index] = 255;
          }
        }
      }
      this.mask = nextMask;
      this.recomputeBoundsAndActive();
      return;
    }

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (!contains(x, y)) continue;

        const index = y * this.width + x;
        this.mask[index] = mode === "subtract" ? 0 : 255;
      }
    }

    this.recomputeBoundsAndActive();
  }

  private applyMask(newMask: Uint8Array, mode: SelectionMode) {
    if (mode === "replace") {
      this.mask = new Uint8Array(newMask);
      this.recomputeBoundsAndActive();
      return;
    }

    if (mode === "intersect") {
      for (let i = 0; i < this.mask.length; i++) {
        if (newMask[i] === 0) {
          this.mask[i] = 0;
        }
      }
      this.recomputeBoundsAndActive();
      return;
    }

    for (let i = 0; i < this.mask.length; i++) {
      if (newMask[i] === 0) continue;
      this.mask[i] = mode === "subtract" ? 0 : 255;
    }

    this.recomputeBoundsAndActive();
  }

  private recomputeBoundsAndActive() {
    let minX = this.width;
    let minY = this.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.mask[y * this.width + x] === 0) continue;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (maxX === -1 || maxY === -1) {
      this.hasActive = false;
      this.bounds = null;
      return;
    }

    this.hasActive = true;
    this.bounds = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  private pointInPolygon(x: number, y: number, points: Point[]) {
    let inside = false;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;

      const intersects =
        yi > y !== yj > y &&
        x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }
}
