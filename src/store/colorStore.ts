/**
 * Color store - foreground, background colors, recent colors
 * Uses Immer for immutable state updates
 */
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { RGBA } from "../types/editor";

// Maximum recent colors to track
const MAX_RECENT_COLORS = 20;

// State interface
interface ColorState {
  foregroundColor: RGBA;
  backgroundColor: RGBA;
  recentColors: RGBA[];
}

// Actions interface
interface ColorActions {
  setForeground: (color: RGBA) => void;
  setBackground: (color: RGBA) => void;
  swapColors: () => void;
  resetColors: () => void;
  addRecentColor: (color: RGBA) => void;
  clearRecentColors: () => void;
}

type ColorStore = ColorState & ColorActions;

// Default colors
const DEFAULT_FOREGROUND: RGBA = { r: 0, g: 0, b: 0, a: 255 };
const DEFAULT_BACKGROUND: RGBA = { r: 255, g: 255, b: 255, a: 255 };

// Initial state
const initialState: ColorState = {
  foregroundColor: DEFAULT_FOREGROUND,
  backgroundColor: DEFAULT_BACKGROUND,
  recentColors: [],
};

// Color store with Immer middleware for immutable updates
export const useColorStore = create<ColorStore>()(
  immer((setFn) => ({
    ...initialState,

    setForeground: (color: RGBA) =>
      setFn((state: ColorState) => {
        state.foregroundColor = color;
      }),

    setBackground: (color: RGBA) =>
      setFn((state: ColorState) => {
        state.backgroundColor = color;
      }),

    swapColors: () =>
      setFn((state: ColorState) => {
        const temp = state.foregroundColor;
        state.foregroundColor = state.backgroundColor;
        state.backgroundColor = temp;
      }),

    resetColors: () =>
      setFn((state: ColorState) => {
        state.foregroundColor = DEFAULT_FOREGROUND;
        state.backgroundColor = DEFAULT_BACKGROUND;
      }),

    addRecentColor: (color: RGBA) =>
      setFn((state: ColorState) => {
        // Remove if already exists
        const existingIndex = state.recentColors.findIndex(
          (c) =>
            c.r === color.r &&
            c.g === color.g &&
            c.b === color.b &&
            c.a === color.a,
        );
        if (existingIndex !== -1) {
          state.recentColors.splice(existingIndex, 1);
        }
        // Add to front
        state.recentColors.unshift(color);
        // Trim to max
        if (state.recentColors.length > MAX_RECENT_COLORS) {
          state.recentColors.pop();
        }
      }),

    clearRecentColors: () =>
      setFn((state: ColorState) => {
        state.recentColors = [];
      }),
  })),
);

// Selectors
export const selectForegroundHex = (state: ColorStore): string => {
  const { r, g, b } = state.foregroundColor;
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
};

export const selectBackgroundHex = (state: ColorStore): string => {
  const { r, g, b } = state.backgroundColor;
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
};

// Utility functions for color conversion
export const rgbaToHex = (color: RGBA): string => {
  const { r, g, b } = color;
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
};

export const hexToRgba = (hex: string, alpha = 255): RGBA => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0, a: alpha };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: alpha,
  };
};

export const rgbaToHsl = (color: RGBA): { h: number; s: number; l: number } => {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
};
