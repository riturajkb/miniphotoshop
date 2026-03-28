/**
 * CanvasDocument - Document model for canvas state
 * Manages canvas dimensions, metadata, and pixel buffers
 */
import type { RGBA } from "../types/editor";

export interface DocumentMetadata {
  name: string;
  width: number;
  height: number;
  dpi: number;
  colorMode: "rgb" | "rgba" | "grayscale";
  createdAt: number;
  modifiedAt: number;
}

export class CanvasDocument {
  public metadata: DocumentMetadata;
  public backgroundColor: RGBA;
  private pixelBuffer: ImageData | null = null;

  constructor(
    width: number,
    height: number,
    name = "Untitled",
    backgroundColor: RGBA = { r: 255, g: 255, b: 255, a: 255 },
  ) {
    this.metadata = {
      name,
      width,
      height,
      dpi: 72,
      colorMode: "rgba",
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    this.backgroundColor = backgroundColor;
    this.initPixelBuffer();
  }

  private initPixelBuffer(): void {
    const { width, height } = this.metadata;
    this.pixelBuffer = new ImageData(width, height);

    const data = this.pixelBuffer.data;
    const { r, g, b, a } = this.backgroundColor;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }

  get width(): number {
    return this.metadata.width;
  }

  get height(): number {
    return this.metadata.height;
  }

  get pixels(): ImageData | null {
    return this.pixelBuffer;
  }

  get name(): string {
    return this.metadata.name;
  }

  set name(value: string) {
    this.metadata.name = value;
    this.metadata.modifiedAt = Date.now();
  }

  resize(width: number, height: number): void {
    this.metadata.width = width;
    this.metadata.height = height;
    this.metadata.modifiedAt = Date.now();
    this.initPixelBuffer();
  }

  setPixel(x: number, y: number, color: RGBA): void {
    if (!this.pixelBuffer) return;
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

    const index = (y * this.width + x) * 4;
    this.pixelBuffer.data[index] = color.r;
    this.pixelBuffer.data[index + 1] = color.g;
    this.pixelBuffer.data[index + 2] = color.b;
    this.pixelBuffer.data[index + 3] = color.a;
    this.metadata.modifiedAt = Date.now();
  }

  getPixel(x: number, y: number): RGBA | null {
    if (!this.pixelBuffer) return null;
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;

    const index = (y * this.width + x) * 4;
    return {
      r: this.pixelBuffer.data[index],
      g: this.pixelBuffer.data[index + 1],
      b: this.pixelBuffer.data[index + 2],
      a: this.pixelBuffer.data[index + 3],
    };
  }

  clear(): void {
    this.initPixelBuffer();
  }

  getPixelData(): Uint8ClampedArray | null {
    return this.pixelBuffer?.data ?? null;
  }

  clone(): CanvasDocument {
    const doc = new CanvasDocument(this.width, this.height, this.name, {
      ...this.backgroundColor,
    });

    if (this.pixelBuffer && doc.pixelBuffer) {
      doc.pixelBuffer.data.set(this.pixelBuffer.data);
    }

    return doc;
  }
}
