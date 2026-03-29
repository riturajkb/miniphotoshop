import { useEffect, useState } from "react";
import { TitleBar } from "./TitleBar";
import { MenuBar } from "./MenuBar";
import { ToolsPanel } from "./ToolsPanel";
import { CanvasArea } from "./CanvasArea";
import { RightPanel } from "./RightPanel";
import { StatusBar } from "./StatusBar";
import { AppearanceDialog } from "./AppearanceDialog";
import { useAppearanceStore } from "../../store/appearanceStore";

function hexToRgb(value: string): string {
  const normalized = value.replace("#", "");
  if (normalized.length !== 6) return "192, 57, 43";

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return "192, 57, 43";
  }

  return `${r}, ${g}, ${b}`;
}

export function AppShell() {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const { theme, accent, iconStyle, iconScale, fontPreset, density, chrome, texture, customPalette, customAlpha } =
    useAppearanceStore();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.accent = accent;
    root.dataset.iconStyle = iconStyle;
    root.dataset.iconScale = iconScale;
    root.dataset.fontPreset = fontPreset;
    root.dataset.density = density;
    root.dataset.chrome = chrome;
    root.dataset.texture = texture;

    const tokenMap = {
      "--void": customPalette.void,
      "--abyss": customPalette.abyss,
      "--pit": customPalette.pit,
      "--crater": customPalette.crater,
      "--ash": customPalette.ash,
      "--cinder": customPalette.cinder,
      "--smoke": customPalette.smoke,
      "--fog": customPalette.fog,
      "--mist": customPalette.mist,
      "--pale": customPalette.pale,
      "--bone": customPalette.bone,
      "--white": customPalette.white,
      "--blood": customPalette.blood,
      "--ember": customPalette.ember,
      "--spark": customPalette.spark,
    } as const;

    for (const [token, value] of Object.entries(tokenMap)) {
      if (value) {
        root.style.setProperty(token, value);
      } else {
        root.style.removeProperty(token);
      }
    }

    if (customPalette.blood) {
      const accentRgb = hexToRgb(customPalette.blood);
      root.style.setProperty("--accent-rgb", accentRgb);
      root.style.setProperty(
        "--glow",
        `rgba(${accentRgb}, ${(customAlpha.glow ?? 16) / 100})`,
      );
      root.style.setProperty(
        "--glow-mid",
        `rgba(${accentRgb}, ${(customAlpha.glowMid ?? 8) / 100})`,
      );
      root.style.setProperty(
        "--glow-faint",
        `rgba(${accentRgb}, ${(customAlpha.glowFaint ?? 4) / 100})`,
      );
    } else {
      root.style.removeProperty("--accent-rgb");
      root.style.removeProperty("--glow");
      root.style.removeProperty("--glow-mid");
      root.style.removeProperty("--glow-faint");
    }

    if (customAlpha.panelBorder !== null) {
      root.style.setProperty(
        "--panel-border",
        `1px solid rgba(114, 122, 132, ${customAlpha.panelBorder / 100})`,
      );
    } else {
      root.style.removeProperty("--panel-border");
    }
  }, [
    theme,
    accent,
    iconStyle,
    iconScale,
    fontPreset,
    density,
    chrome,
    texture,
    customPalette,
    customAlpha,
  ]);

  return (
    <div className="app">
      <TitleBar />
      <MenuBar onOpenAppearance={() => setAppearanceOpen(true)} />
      <ToolsPanel />
      <CanvasArea />
      <RightPanel />
      <StatusBar />
      <AppearanceDialog
        open={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
      />
    </div>
  );
}
