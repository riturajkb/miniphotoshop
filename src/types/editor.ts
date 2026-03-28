/**
 * Core editor types for MiniPhotoshop
 * Following code-quality.md: pure types, no business logic
 */

// RGBA color representation
export interface RGBA {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-255
}

// Tool identifiers
export const Tool = {
  Move: "move",
  Brush: "brush",
  Pencil: "pencil",
  Eraser: "eraser",
  Selection: "selection",
  Lasso: "lasso",
  MagicWand: "magicWand",
  Fill: "fill",
  Gradient: "gradient",
  Eyedropper: "eyedropper",
  Crop: "crop",
  Text: "text",
  Shape: "shape",
  Zoom: "zoom",
} as const;

export type Tool = (typeof Tool)[keyof typeof Tool];

// Blend mode identifiers
export const BlendMode = {
  Normal: "normal",
  Dissolve: "dissolve",
  Multiply: "multiply",
  Screen: "screen",
  Overlay: "overlay",
  SoftLight: "softLight",
  HardLight: "hardLight",
  ColorDodge: "colorDodge",
  ColorBurn: "colorBurn",
  Darken: "darken",
  Lighten: "lighten",
  Difference: "difference",
  Exclusion: "exclusion",
  Hue: "hue",
  Saturation: "saturation",
  Color: "color",
  Luminosity: "luminosity",
} as const;

export type BlendMode = (typeof BlendMode)[keyof typeof BlendMode];

// Single layer representation
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0-100
  blendMode: BlendMode;
  pixels: Uint8ClampedArray | null; // RGBA pixel data
}

// Document representation
export interface Document {
  width: number;
  height: number;
  layers: Layer[];
  backgroundColor: RGBA;
}

// 2D point for pan offset
export interface Point {
  x: number;
  y: number;
}

// Viewport dimensions
export interface Viewport {
  width: number;
  height: number;
}

// Selection descriptor
export interface Selection {
  mask: Uint8ClampedArray | null; // 1-bit per pixel
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  feather: number;
  antiAlias: boolean;
}
