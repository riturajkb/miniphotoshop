/**
 * Compositor - Composites layers into a final display texture
 * Handles blend modes and layer opacity
 */
import type { BlendMode } from "../types/editor";
import type { LayerData } from "./LayerStack";

export class Compositor {
  private width: number;
  private height: number;
  private compositeBuffer: Uint8ClampedArray;
  private compositeImageData: ImageData;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.compositeBuffer = new Uint8ClampedArray(width * height * 4);
    this.compositeImageData = new ImageData(this.compositeBuffer as any, width, height);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.compositeBuffer = new Uint8ClampedArray(width * height * 4);
    this.compositeImageData = new ImageData(this.compositeBuffer as any, width, height);
  }

  getCompositeBuffer(): Uint8ClampedArray {
    return this.compositeBuffer;
  }

  composite(layers: LayerData[], dirtyRect?: { minX: number; minY: number; maxX: number; maxY: number }): ImageData {
    const visibleLayers = layers.filter((l) => l.visible && l.pixelBuffer);
    if (visibleLayers.length === 0) {
      this.compositeBuffer.fill(0);
      return this.compositeImageData;
    }

    let startX = 0;
    let startY = 0;
    let endX = this.width - 1;
    let endY = this.height - 1;

    if (dirtyRect) {
      startX = Math.max(0, Math.floor(dirtyRect.minX));
      startY = Math.max(0, Math.floor(dirtyRect.minY));
      endX = Math.min(this.width - 1, Math.ceil(dirtyRect.maxX));
      endY = Math.min(this.height - 1, Math.ceil(dirtyRect.maxY));
    }

    for (let y = startY; y <= endY; y++) {
      const rowStart = (y * this.width + startX) * 4;
      const rowEnd = (y * this.width + endX + 1) * 4;
      this.compositeBuffer.fill(0, rowStart, rowEnd);
    }

    if (
      visibleLayers.length === 1 &&
      visibleLayers[0].blendMode === "normal" &&
      visibleLayers[0].opacity === 100
    ) {
      this.copyLayerRect(visibleLayers[0], startX, startY, endX, endY);
      return this.compositeImageData;
    }

    for (const layer of visibleLayers) {
      if (!layer.pixelBuffer) continue;

      const layerOpacity = layer.opacity / 100;
      const isFastNormal = layer.blendMode === "normal" && layer.opacity === 100;
      const blendFn = this.getBlendFunction(layer.blendMode);

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const i = (y * this.width + x) * 4;
          const srcR = layer.pixelBuffer[i];
          const srcG = layer.pixelBuffer[i + 1];
          const srcB = layer.pixelBuffer[i + 2];
          const srcAByte = layer.pixelBuffer[i + 3];
          if (srcAByte === 0) continue;

          if (isFastNormal && srcAByte === 255) {
            this.compositeBuffer[i] = srcR;
            this.compositeBuffer[i + 1] = srcG;
            this.compositeBuffer[i + 2] = srcB;
            this.compositeBuffer[i + 3] = 255;
            continue;
          }

          const srcA = (srcAByte / 255) * layerOpacity;

          const dstR = this.compositeBuffer[i];
          const dstG = this.compositeBuffer[i + 1];
          const dstB = this.compositeBuffer[i + 2];
          const dstAByte = this.compositeBuffer[i + 3];
          const dstA = dstAByte / 255;

          const [blendedR, blendedG, blendedB] = blendFn(
            srcR,
            srcG,
            srcB,
            dstR,
            dstG,
            dstB,
          );

          const outA = srcA + dstA * (1 - srcA);

          if (outA > 0) {
            if (dstAByte === 0 && isFastNormal) {
              this.compositeBuffer[i] = srcR;
              this.compositeBuffer[i + 1] = srcG;
              this.compositeBuffer[i + 2] = srcB;
              this.compositeBuffer[i + 3] = srcAByte;
              continue;
            }

            this.compositeBuffer[i] = Math.round(
              (blendedR * srcA + dstR * dstA * (1 - srcA)) / outA,
            );
            this.compositeBuffer[i + 1] = Math.round(
              (blendedG * srcA + dstG * dstA * (1 - srcA)) / outA,
            );
            this.compositeBuffer[i + 2] = Math.round(
              (blendedB * srcA + dstB * dstA * (1 - srcA)) / outA,
            );
            this.compositeBuffer[i + 3] = Math.round(outA * 255);
          }
        }
      }
    }

    return this.compositeImageData;
  }

  private copyLayerRect(
    layer: LayerData,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) {
    if (!layer.pixelBuffer) return;

    const rowWidth = (endX - startX + 1) * 4;
    for (let y = startY; y <= endY; y++) {
      const rowStart = (y * this.width + startX) * 4;
      const rowEnd = rowStart + rowWidth;
      this.compositeBuffer.set(layer.pixelBuffer.subarray(rowStart, rowEnd), rowStart);
    }
  }

  private getBlendFunction(
    mode: BlendMode,
  ): (
    sR: number,
    sG: number,
    sB: number,
    dR: number,
    dG: number,
    dB: number,
  ) => [number, number, number] {
    switch (mode) {
      case "multiply":
        return this.blendMultiply;
      case "screen":
        return this.blendScreen;
      case "overlay":
        return this.blendOverlay;
      case "softLight":
        return this.blendSoftLight;
      case "hardLight":
        return this.blendHardLight;
      case "colorDodge":
        return this.blendColorDodge;
      case "colorBurn":
        return this.blendColorBurn;
      case "darken":
        return this.blendDarken;
      case "lighten":
        return this.blendLighten;
      case "difference":
        return this.blendDifference;
      case "exclusion":
        return this.blendExclusion;
      default:
        return this.blendNormal;
    }
  }

  private blendNormal(
    sR: number,
    sG: number,
    sB: number,
  ): [number, number, number] {
    return [sR, sG, sB];
  }

  private blendMultiply(
    sR: number,
    sG: number,
    sB: number,
    dR: number,
    dG: number,
    dB: number,
  ): [number, number, number] {
    return [(sR * dR) / 255, (sG * dG) / 255, (sB * dB) / 255];
  }

  private blendScreen(
    sR: number,
    sG: number,
    sB: number,
    dR: number,
    dG: number,
    dB: number,
  ): [number, number, number] {
    return [
      255 - ((255 - sR) * (255 - dR)) / 255,
      255 - ((255 - sG) * (255 - dG)) / 255,
      255 - ((255 - sB) * (255 - dB)) / 255,
    ];
  }

  private blendOverlay(
    sR: number,
    sG: number,
    sB: number,
    dR: number,
    dG: number,
    dB: number,
  ): [number, number, number] {
    return [
      dR < 128
        ? (2 * sR * dR) / 255
        : 255 - (2 * (255 - sR) * (255 - dR)) / 255,
      dG < 128
        ? (2 * sG * dG) / 255
        : 255 - (2 * (255 - sG) * (255 - dG)) / 255,
      dB < 128
        ? (2 * sB * dB) / 255
        : 255 - (2 * (255 - sB) * (255 - dB)) / 255,
    ];
  }

  private blendSoftLight(
    sR: number,
    sG: number,
    sB: number,
    dR: number,
    dG: number,
    dB: number,
  ): [number, number, number] {
    const softLight = (s: number, d: number): number => {
      const sN = s / 255;
      const dN = d / 255;
      if (sN < 0.5) {
        return dN - (1 - 2 * sN) * dN * (1 - dN);
      }
      const dSqrt = Math.sqrt(dN);
      return dN + (2 * sN - 1) * (dSqrt - dN);
    };

    return [
      Math.round(softLight(sR, dR) * 255),
      Math.round(softLight(sG, dG) * 255),
      Math.round(softLight(sB, dB) * 255),
    ];
  }

  private blendHardLight(
    sR: number,
    sG: number,
    sB: number,
    dR: number,
    dG: number,
    dB: number,
  ): [number, number, number] {
    return this.blendOverlay(dR, dG, dB, sR, sG, sB);
  }

  private blendColorDodge(
    sR: number,
    sG: number,
    sB: number,
    dR: number,
    dG: number,
    dB: number,
  ): [number, number, number] {
    const dodge = (s: number, d: number): number => {
      if (s === 255) return 255;
      return Math.min(255, (d * 255) / (255 - s));
    };

    return [dodge(sR, dR), dodge(sG, dG), dodge(sB, dB)];
  }

  private blendColorBurn(
    sR: number,
    sG: number,
    sB: number,
    dR: number,
    dG: number,
    dB: number,
  ): [number, number, number] {
    const burn = (s: number, d: number): number => {
      if (s === 0) return 0;
      return Math.max(0, 255 - ((255 - d) * 255) / s);
    };

    return [burn(sR, dR), burn(sG, dG), burn(sB, dB)];
  }

  private blendDarken(
    sR: number,
    sG: number,
    sB: number,
    dR: number,
    dG: number,
    dB: number,
  ): [number, number, number] {
    return [Math.min(sR, dR), Math.min(sG, dG), Math.min(sB, dB)];
  }

  private blendLighten(
    sR: number,
    sG: number,
    sB: number,
    dR: number,
    dG: number,
    dB: number,
  ): [number, number, number] {
    return [Math.max(sR, dR), Math.max(sG, dG), Math.max(sB, dB)];
  }

  private blendDifference(
    sR: number,
    sG: number,
    sB: number,
    dR: number,
    dG: number,
    dB: number,
  ): [number, number, number] {
    return [Math.abs(sR - dR), Math.abs(sG - dG), Math.abs(sB - dB)];
  }

  private blendExclusion(
    sR: number,
    sG: number,
    sB: number,
    dR: number,
    dG: number,
    dB: number,
  ): [number, number, number] {
    return [
      sR + dR - (2 * sR * dR) / 255,
      sG + dG - (2 * sG * dG) / 255,
      sB + dB - (2 * sB * dB) / 255,
    ];
  }
}
