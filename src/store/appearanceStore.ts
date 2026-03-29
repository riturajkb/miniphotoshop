import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreset = "obsidian" | "graphite" | "paper" | "blueprint";
export type AccentPreset = "ember" | "cyan" | "lime" | "amber";
export type IconStyle = "sharp" | "rounded";
export type IconScale = "sm" | "md" | "lg";
export type FontPreset = "studio" | "editorial" | "technical";
export type DensityPreset = "compact" | "standard" | "spacious";
export type ChromePreset = "angular" | "soft";
export type TexturePreset = "none" | "grain" | "scanlines";

export interface CustomPalette {
  void: string;
  abyss: string;
  pit: string;
  crater: string;
  ash: string;
  cinder: string;
  smoke: string;
  fog: string;
  mist: string;
  pale: string;
  bone: string;
  white: string;
  blood: string;
  ember: string;
  spark: string;
}

export interface CustomAlpha {
  glow: number | null;
  glowMid: number | null;
  glowFaint: number | null;
  panelBorder: number | null;
}

const defaultCustomPalette: CustomPalette = {
  void: "",
  abyss: "",
  pit: "",
  crater: "",
  ash: "",
  cinder: "",
  smoke: "",
  fog: "",
  mist: "",
  pale: "",
  bone: "",
  white: "",
  blood: "",
  ember: "",
  spark: "",
};

const defaultCustomAlpha: CustomAlpha = {
  glow: null,
  glowMid: null,
  glowFaint: null,
  panelBorder: null,
};

interface AppearanceState {
  theme: ThemePreset;
  accent: AccentPreset;
  iconStyle: IconStyle;
  iconScale: IconScale;
  fontPreset: FontPreset;
  density: DensityPreset;
  chrome: ChromePreset;
  texture: TexturePreset;
  customPalette: CustomPalette;
  customAlpha: CustomAlpha;
  setTheme: (theme: ThemePreset) => void;
  setAccent: (accent: AccentPreset) => void;
  setIconStyle: (iconStyle: IconStyle) => void;
  setIconScale: (iconScale: IconScale) => void;
  setFontPreset: (fontPreset: FontPreset) => void;
  setDensity: (density: DensityPreset) => void;
  setChrome: (chrome: ChromePreset) => void;
  setTexture: (texture: TexturePreset) => void;
  setCustomPaletteColor: (key: keyof CustomPalette, value: string) => void;
  setCustomAlphaValue: (key: keyof CustomAlpha, value: number | null) => void;
  applyCustomPalette: (palette: Partial<CustomPalette>) => void;
  resetCustomPalette: () => void;
  resetCustomAlpha: () => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: "obsidian",
      accent: "ember",
      iconStyle: "sharp",
      iconScale: "md",
      fontPreset: "studio",
      density: "standard",
      chrome: "angular",
      texture: "grain",
      customPalette: defaultCustomPalette,
      customAlpha: defaultCustomAlpha,
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setIconStyle: (iconStyle) => set({ iconStyle }),
      setIconScale: (iconScale) => set({ iconScale }),
      setFontPreset: (fontPreset) => set({ fontPreset }),
      setDensity: (density) => set({ density }),
      setChrome: (chrome) => set({ chrome }),
      setTexture: (texture) => set({ texture }),
      setCustomPaletteColor: (key, value) =>
        set((state) => ({
          customPalette: {
            ...state.customPalette,
            [key]: value,
          },
        })),
      setCustomAlphaValue: (key, value) =>
        set((state) => ({
          customAlpha: {
            ...state.customAlpha,
            [key]: value,
          },
        })),
      applyCustomPalette: (palette) =>
        set((state) => ({
          customPalette: {
            ...state.customPalette,
            ...palette,
          },
        })),
      resetCustomPalette: () => set({ customPalette: defaultCustomPalette }),
      resetCustomAlpha: () => set({ customAlpha: defaultCustomAlpha }),
    }),
    {
      name: "miniphotoshop-appearance",
    },
  ),
);
