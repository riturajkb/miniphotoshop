import { useRef, useState } from "react";
import { useAppearanceStore } from "../../store/appearanceStore";
import { buildThemeFromPaletteImage } from "../../utils/themePalette";

interface AppearanceDialogProps {
  open: boolean;
  onClose: () => void;
}

const themeOptions = [
  { id: "obsidian", label: "Obsidian" },
  { id: "graphite", label: "Graphite" },
  { id: "paper", label: "Paper" },
  { id: "blueprint", label: "Blueprint" },
] as const;

const accentOptions = [
  { id: "ember", label: "Ember" },
  { id: "cyan", label: "Cyan" },
  { id: "lime", label: "Lime" },
  { id: "amber", label: "Amber" },
] as const;

const iconStyleOptions = [
  { id: "sharp", label: "Sharp" },
  { id: "rounded", label: "Rounded" },
] as const;

const iconScaleOptions = [
  { id: "sm", label: "Compact" },
  { id: "md", label: "Standard" },
  { id: "lg", label: "Large" },
] as const;

const fontOptions = [
  { id: "studio", label: "Studio" },
  { id: "editorial", label: "Editorial" },
  { id: "technical", label: "Technical" },
] as const;

const densityOptions = [
  { id: "compact", label: "Compact" },
  { id: "standard", label: "Standard" },
  { id: "spacious", label: "Spacious" },
] as const;

const chromeOptions = [
  { id: "angular", label: "Angular" },
  { id: "soft", label: "Soft" },
] as const;

const textureOptions = [
  { id: "none", label: "None" },
  { id: "grain", label: "Grain" },
  { id: "scanlines", label: "Scanlines" },
] as const;

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function adjustHexColor(hex: string, amount: number): string {
  if (!isHexColor(hex)) return hex;

  const normalized = hex.replace("#", "");
  const channels = [0, 2, 4].map((start) =>
    Number.parseInt(normalized.slice(start, start + 2), 16),
  );

  const adjusted = channels.map((channel) =>
    Math.max(0, Math.min(255, channel + amount)),
  );

  return `#${adjusted
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function AppearanceDialog({
  open,
  onClose,
}: AppearanceDialogProps) {
  const paletteFileInputRef = useRef<HTMLInputElement>(null);
  const [paletteImportError, setPaletteImportError] = useState("");
  const [activeCustomField, setActiveCustomField] =
    useState<
      | "void"
      | "abyss"
      | "pit"
      | "crater"
      | "ash"
      | "cinder"
      | "smoke"
      | "fog"
      | "mist"
      | "pale"
      | "bone"
      | "white"
      | "blood"
      | "ember"
      | "spark"
    >("blood");

  const {
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
    setTheme,
    setAccent,
    setIconStyle,
    setIconScale,
    setFontPreset,
    setDensity,
    setChrome,
    setTexture,
    setCustomPaletteColor,
    setCustomAlphaValue,
    applyCustomPalette,
    resetCustomPalette,
    resetCustomAlpha,
  } = useAppearanceStore();

  const customPaletteFields = [
    { key: "void", label: "Outer Background", fallback: "#080808" },
    { key: "abyss", label: "Panels", fallback: "#0d0d0d" },
    { key: "pit", label: "Canvas Chrome", fallback: "#111111" },
    { key: "crater", label: "Controls", fallback: "#181818" },
    { key: "ash", label: "Raised Surfaces", fallback: "#222222" },
    { key: "cinder", label: "Borders", fallback: "#2e2e2e" },
    { key: "smoke", label: "Low Text", fallback: "#404040" },
    { key: "fog", label: "Muted Text", fallback: "#666666" },
    { key: "mist", label: "UI Text", fallback: "#888888" },
    { key: "pale", label: "Soft Highlight", fallback: "#aaaaaa" },
    { key: "bone", label: "Primary Text", fallback: "#cccccc" },
    { key: "white", label: "Bright Text", fallback: "#e8e8e8" },
    { key: "blood", label: "Accent Base", fallback: "#c0392b" },
    { key: "ember", label: "Accent Bright", fallback: "#e74c3c" },
    { key: "spark", label: "Accent Pop", fallback: "#ff6b6b" },
  ] as const;

  const customPaletteFieldsMap = {
    void: customPaletteFields[0],
    abyss: customPaletteFields[1],
    pit: customPaletteFields[2],
    crater: customPaletteFields[3],
    ash: customPaletteFields[4],
    cinder: customPaletteFields[5],
    smoke: customPaletteFields[6],
    fog: customPaletteFields[7],
    mist: customPaletteFields[8],
    pale: customPaletteFields[9],
    bone: customPaletteFields[10],
    white: customPaletteFields[11],
    blood: customPaletteFields[12],
    ember: customPaletteFields[13],
    spark: customPaletteFields[14],
  } as const;

  const paletteSuggestions = [
    "#080808",
    "#1f2937",
    "#312e81",
    "#064e3b",
    "#7c2d12",
    "#f5f0e7",
    "#0ea5b7",
    "#8fd652",
    "#ec9f31",
    "#e74c3c",
  ];

  const alphaFields = [
    { key: "glow", label: "Glow", fallback: 16 },
    { key: "glowMid", label: "Glow Mid", fallback: 8 },
    { key: "glowFaint", label: "Glow Faint", fallback: 4 },
    { key: "panelBorder", label: "Panel Border", fallback: 16 },
  ] as const;

  const activeField = customPaletteFieldsMap[activeCustomField];
  const activeRawValue = customPalette[activeField.key];
  const activeTextValue = activeRawValue || activeField.fallback;
  const activeWheelValue = isHexColor(activeRawValue)
    ? activeRawValue
    : activeField.fallback;

  if (!open) return null;

  const handleImportPaletteImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setPaletteImportError("");
      const result = await buildThemeFromPaletteImage(file);
      setTheme(result.theme);
      setAccent(result.accent);
      applyCustomPalette(result.palette);
    } catch (error) {
      setPaletteImportError(
        error instanceof Error ? error.message : "Failed to import palette image",
      );
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog appearance-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">Appearance</span>
          <button className="dialog-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="dialog-body appearance-body">
          <section className="appearance-section">
            <div className="appearance-label">Theme</div>
            <div className="appearance-grid">
              {themeOptions.map((option) => (
                <button
                  key={option.id}
                  className={`appearance-chip ${theme === option.id ? "on" : ""}`}
                  onClick={() => setTheme(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="appearance-section">
            <div className="appearance-label">Accent</div>
            <div className="appearance-grid">
              {accentOptions.map((option) => (
                <button
                  key={option.id}
                  className={`appearance-chip ${accent === option.id ? "on" : ""}`}
                  onClick={() => setAccent(option.id)}
                >
                  <span className={`appearance-swatch ${option.id}`}></span>
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="appearance-section">
            <div className="appearance-label">Icon Style</div>
            <div className="appearance-grid compact">
              {iconStyleOptions.map((option) => (
                <button
                  key={option.id}
                  className={`appearance-chip ${iconStyle === option.id ? "on" : ""}`}
                  onClick={() => setIconStyle(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="appearance-section">
            <div className="appearance-label">Icon Size</div>
            <div className="appearance-grid compact">
              {iconScaleOptions.map((option) => (
                <button
                  key={option.id}
                  className={`appearance-chip ${iconScale === option.id ? "on" : ""}`}
                  onClick={() => setIconScale(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="appearance-section">
            <div className="appearance-label">Typography</div>
            <div className="appearance-grid compact">
              {fontOptions.map((option) => (
                <button
                  key={option.id}
                  className={`appearance-chip ${fontPreset === option.id ? "on" : ""}`}
                  onClick={() => setFontPreset(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="appearance-section">
            <div className="appearance-label">Density</div>
            <div className="appearance-grid compact">
              {densityOptions.map((option) => (
                <button
                  key={option.id}
                  className={`appearance-chip ${density === option.id ? "on" : ""}`}
                  onClick={() => setDensity(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="appearance-section">
            <div className="appearance-label">Chrome</div>
            <div className="appearance-grid compact">
              {chromeOptions.map((option) => (
                <button
                  key={option.id}
                  className={`appearance-chip ${chrome === option.id ? "on" : ""}`}
                  onClick={() => setChrome(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="appearance-section">
            <div className="appearance-label">Texture</div>
            <div className="appearance-grid compact">
              {textureOptions.map((option) => (
                <button
                  key={option.id}
                  className={`appearance-chip ${texture === option.id ? "on" : ""}`}
                  onClick={() => setTexture(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="appearance-section">
            <div className="appearance-header-row">
              <div className="appearance-label">Custom Colors</div>
              <div className="appearance-actions">
                <button
                  className="appearance-reset"
                  onClick={() => paletteFileInputRef.current?.click()}
                >
                  Import Palette Image
                </button>
                <button className="appearance-reset" onClick={resetCustomPalette}>
                  Reset Colors
                </button>
                <button className="appearance-reset" onClick={resetCustomAlpha}>
                  Reset Alpha
                </button>
              </div>
            </div>

            <input
              ref={paletteFileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: "none" }}
              onChange={handleImportPaletteImage}
            />

            {paletteImportError ? (
              <div className="appearance-error">{paletteImportError}</div>
            ) : null}

            <div className="token-picker-grid">
              {customPaletteFields.map((field) => {
                const value = customPalette[field.key] || field.fallback;
                const isActive = activeCustomField === field.key;

                return (
                  <button
                    key={field.key}
                    className={`token-chip ${isActive ? "on" : ""}`}
                    onClick={() => setActiveCustomField(field.key)}
                  >
                    <span
                      className="token-chip-swatch"
                      style={{ background: value }}
                    ></span>
                    <span className="token-chip-copy">
                      <span className="token-chip-label">{field.label}</span>
                      <span className="token-chip-value">{value}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="alpha-editor-grid">
              {alphaFields.map((field) => {
                const value = customAlpha[field.key] ?? field.fallback;

                return (
                  <label key={field.key} className="alpha-row">
                    <span className="alpha-row-label">{field.label}</span>
                    <div className="alpha-row-controls">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={value}
                        className="alpha-slider"
                        onChange={(e) =>
                          setCustomAlphaValue(
                            field.key,
                            clampPercent(Number(e.target.value)),
                          )
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={value}
                        className="dialog-input alpha-number-input"
                        onChange={(e) =>
                          setCustomAlphaValue(
                            field.key,
                            clampPercent(Number(e.target.value)),
                          )
                        }
                      />
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="color-editor-card">
              <div className="appearance-header-row">
                <div>
                  <div className="appearance-label">Editing</div>
                  <div className="color-editor-title">{activeField.label}</div>
                </div>
                <button
                  className="appearance-reset"
                  onClick={() => setCustomPaletteColor(activeField.key, "")}
                >
                  Reset Token
                </button>
              </div>

              <div className="color-editor-main">
                <input
                  type="color"
                  className="color-wheel-input large"
                  value={activeWheelValue}
                  onChange={(e) =>
                    setCustomPaletteColor(activeField.key, e.target.value)
                  }
                />
                <input
                  type="text"
                  className="dialog-input color-hex-input"
                  value={activeTextValue}
                  onChange={(e) =>
                    setCustomPaletteColor(activeField.key, e.target.value)
                  }
                />
              </div>

              <div className="color-editor-actions">
                <button
                  className="appearance-reset"
                  onClick={() =>
                    setCustomPaletteColor(
                      activeField.key,
                      adjustHexColor(activeWheelValue, -18),
                    )
                  }
                >
                  Darken
                </button>
                <button
                  className="appearance-reset"
                  onClick={() =>
                    setCustomPaletteColor(
                      activeField.key,
                      adjustHexColor(activeWheelValue, 18),
                    )
                  }
                >
                  Lighten
                </button>
              </div>
            </div>

            <div className="palette-suggestions">
              {paletteSuggestions.map((color) => (
                <button
                  key={color}
                  className="palette-swatch"
                  style={{ background: color }}
                  title={color}
                  onClick={() => setCustomPaletteColor(activeField.key, color)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
