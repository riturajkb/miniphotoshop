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

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.compositeBuffer = new Uint8ClampedArray(width * height * 4);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.compositeBuffer = new Uint8ClampedArray(width * height * 4);
  }

  composite(layers: LayerData[]): ImageData {
    this.compositeBuffer.fill(0);

    const visibleLayers = layers.filter((l) => l.visible && l.pixelBuffer);
    if (visibleLayers.length === 0) {
      const result = new Uint8ClampedArray(this.compositeBuffer);
      return new ImageData(result, this.width, this.height);
    }

    for (let i = 0; i < this.compositeBuffer.length; i += 4) {
      this.compositeBuffer[i] = 0;
      this.compositeBuffer[i + 1] = 0;
      this.compositeBuffer[i + 2] = 0;
      this.compositeBuffer[i + 3] = 0;
    }

    for (const layer of visibleLayers) {
      if (!layer.pixelBuffer) continue;

      const layerOpacity = layer.opacity / 100;
      const blendFn = this.getBlendFunction(layer.blendMode);

      for (let i = 0; i < this.compositeBuffer.length; i += 4) {
        const srcR = layer.pixelBuffer[i];
        const srcG = layer.pixelBuffer[i + 1];
        const srcB = layer.pixelBuffer[i + 2];
        const srcA = (layer.pixelBuffer[i + 3] / 255) * layerOpacity;

        const dstR = this.compositeBuffer[i];
        const dstG = this.compositeBuffer[i + 1];
        const dstB = this.compositeBuffer[i + 2];
        const dstA = this.compositeBuffer[i + 3] / 255;

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

    const result = new Uint8ClampedArray(this.compositeBuffer);
    return new ImageData(result, this.width, this.height);
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
