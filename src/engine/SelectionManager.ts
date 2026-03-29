import { SelectionMode, Point } from "../types/editor";

export class SelectionManager {
  private width: number;
  private height: number;
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.maskCanvas = document.createElement("canvas");
    this.maskCanvas.width = width;
    this.maskCanvas.height = height;
    this.maskCtx = this.maskCanvas.getContext("2d", { willReadFrequently: true })!;
  }

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.maskCanvas.width = w;
    this.maskCanvas.height = h;
    this.maskCtx = this.maskCanvas.getContext("2d", { willReadFrequently: true })!;
  }

  // Set the current canvas state from an existing mask (e.g. from Redo/Undo)
  loadMask(mask: Uint8Array | null) {
      this.maskCtx.clearRect(0, 0, this.width, this.height);
      if (mask && mask.length === this.width * this.height) {
         const imgData = this.maskCtx.createImageData(this.width, this.height);
         for(let i=0; i<mask.length; ++i) {
             const m = mask[i];
             const idx = i * 4;
             imgData.data[idx] = m;
             imgData.data[idx+1] = m;
             imgData.data[idx+2] = m;
             imgData.data[idx+3] = m; // Alpha controls opacity in getMask and visual
         }
         this.maskCtx.putImageData(imgData, 0, 0);
      }
  }

  getMask(): Uint8Array {
      const imgData = this.maskCtx.getImageData(0, 0, this.width, this.height);
      const mask = new Uint8Array(this.width * this.height);
      for(let i=0; i<mask.length; ++i) {
          mask[i] = imgData.data[i * 4 + 3]; // using alpha channel
      }
      return mask;
  }
  
  // Primitives
  drawRect(x: number, y: number, w: number, h: number, mode: SelectionMode) {
      this.setCompositeMode(mode);
      this.maskCtx.fillStyle = '#000000'; // Color doesn't matter, we use Alpha
      this.maskCtx.fillRect(x, y, w, h);
  }

  drawEllipse(x: number, y: number, rx: number, ry: number, mode: SelectionMode) {
      this.setCompositeMode(mode);
      this.maskCtx.fillStyle = '#000000';
      this.maskCtx.beginPath();
      this.maskCtx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
      this.maskCtx.fill();
  }

  drawPolygon(points: Point[], mode: SelectionMode) {
      if(points.length < 3) return;
      this.setCompositeMode(mode);
      this.maskCtx.fillStyle = '#000000';
      this.maskCtx.beginPath();
      this.maskCtx.moveTo(points[0].x, points[0].y);
      for(let i=1; i<points.length; ++i) {
          this.maskCtx.lineTo(points[i].x, points[i].y);
      }
      this.maskCtx.closePath();
      this.maskCtx.fill();
  }

  private setCompositeMode(mode: SelectionMode) {
      if (mode === "replace") {
          this.maskCtx.clearRect(0, 0, this.width, this.height);
          this.maskCtx.globalCompositeOperation = "source-over";
      } else if (mode === "add") {
          this.maskCtx.globalCompositeOperation = "source-over";
      } else if (mode === "subtract") {
          this.maskCtx.globalCompositeOperation = "destination-out";
      } else if (mode === "intersect") {
          this.maskCtx.globalCompositeOperation = "source-in";
      }
  }

  // Quick Selection (Flood Fill) as a brush stroke
  quickSelect(startX: number, startY: number, radius: number, tolerance: number, sourcePixels: Uint8ClampedArray, mode: SelectionMode) {
      const w = this.width;
      const h = this.height;
      if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

      const visited = new Uint8Array(w * h);
      const queue: number[] = [];
      
      // Start seeds from within the brush radius
      for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
              if (dx*dx + dy*dy <= radius*radius) {
                  const px = startX + dx;
                  const py = startY + dy;
                  if (px >= 0 && px < w && py >= 0 && py < h) {
                      const seedIdx = py * w + px;
                      queue.push(seedIdx);
                      visited[seedIdx] = 1;
                  }
              }
          }
      }

      if (queue.length === 0) return;

      // Sample center color for flood fill criteria
      const centerIdx = (startY * w + startX) * 4;
      const sr = sourcePixels[centerIdx];
      const sg = sourcePixels[centerIdx+1];
      const sb = sourcePixels[centerIdx+2];
      const sa = sourcePixels[centerIdx+3];

      // Temporary mask for the filled area
      const fillMask = new Uint8Array(w * h);
      let head = 0;

      while (head < queue.length) {
          const idx = queue[head++];
          const x = idx % w;
          const y = Math.floor(idx / w);

          fillMask[idx] = 255;

          // Check neighbors
          const neighbors = [
              [x-1, y], [x+1, y], [x, y-1], [x, y+1]
          ];

          for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                  const nIdx = ny * w + nx;
                  if (!visited[nIdx]) {
                      visited[nIdx] = 1;
                      // Color dist
                      const pxIdx = nIdx * 4;
                      const r = sourcePixels[pxIdx];
                      const g = sourcePixels[pxIdx+1];
                      const b = sourcePixels[pxIdx+2];
                      const a = sourcePixels[pxIdx+3];
                      
                      // Euclidean distance gives a smoother tolerance threshold
                      const dist = Math.sqrt((r - sr)**2 + (g - sg)**2 + (b - sb)**2 + (a - sa)**2);
                      if (dist <= tolerance) {
                          queue.push(nIdx);
                      }
                  }
              }
          }
      }

      this.applyMask(fillMask, mode);
  }
  
  private applyMask(newMask: Uint8Array, mode: SelectionMode) {
      const imgData = this.maskCtx.getImageData(0, 0, this.width, this.height);
      if (mode === 'replace') {
          for(let i=0; i<newMask.length; ++i) {
             const m = newMask[i];
             const idx = i * 4;
             imgData.data[idx] = m;
             imgData.data[idx+1] = m;
             imgData.data[idx+2] = m;
             imgData.data[idx+3] = m;
          }
      } else if (mode === 'add') {
          for(let i=0; i<newMask.length; ++i) {
             if (newMask[i] > 0) imgData.data[i * 4 + 3] = 255;
          }
      } else if (mode === 'subtract') {
          for(let i=0; i<newMask.length; ++i) {
             if (newMask[i] > 0) imgData.data[i * 4 + 3] = 0;
          }
      } else if (mode === 'intersect') {
          for(let i=0; i<newMask.length; ++i) {
             if (newMask[i] === 0) imgData.data[i * 4 + 3] = 0;
          }
      }
      this.maskCtx.putImageData(imgData, 0, 0);
  }

  clear() {
      this.maskCtx.clearRect(0, 0, this.width, this.height);
  }
}
