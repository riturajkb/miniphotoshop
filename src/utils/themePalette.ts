import type {
  AccentPreset,
  CustomPalette,
  ThemePreset,
} from "../store/appearanceStore";

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface WeightedRGB extends RGB {
  weight: number;
}

export interface ImportedPaletteTheme {
  theme: ThemePreset;
  accent: AccentPreset;
  palette: Partial<CustomPalette>;
}

function rgbToHex({ r, g, b }: RGB): string {
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function luminance({ r, g, b }: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation({ r, g, b }: RGB): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

function hue({ r, g, b }: RGB): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  if (delta === 0) return 0;

  let value = 0;
  if (max === rn) value = ((gn - bn) / delta) % 6;
  else if (max === gn) value = (bn - rn) / delta + 2;
  else value = (rn - gn) / delta + 4;

  return Math.round(((value * 60) + 360) % 360);
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  const t = clamp(amount, 0, 1);
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function distance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function contrast(a: RGB, b: RGB): number {
  return Math.abs(luminance(a) - luminance(b));
}

function classifyAccentPreset(color: RGB): AccentPreset {
  const h = hue(color);
  if (h >= 165 && h <= 220) return "cyan";
  if (h >= 65 && h <= 155) return "lime";
  if (h >= 25 && h <= 64) return "amber";
  return "ember";
}

function classifyTheme(background: RGB, accent: RGB): ThemePreset {
  const backgroundLuma = luminance(background);
  const accentHue = hue(accent);

  if (backgroundLuma > 170) return "paper";
  if (backgroundLuma < 95 && accentHue >= 170 && accentHue <= 235) {
    return "blueprint";
  }
  return "obsidian";
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load palette image"));
      img.src = objectUrl;
    });
    return img;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function weightedAverage(colors: WeightedRGB[]): RGB {
  const totalWeight = colors.reduce((sum, color) => sum + color.weight, 0) || 1;
  return {
    r: Math.round(colors.reduce((sum, color) => sum + color.r * color.weight, 0) / totalWeight),
    g: Math.round(colors.reduce((sum, color) => sum + color.g * color.weight, 0) / totalWeight),
    b: Math.round(colors.reduce((sum, color) => sum + color.b * color.weight, 0) / totalWeight),
  };
}

function extractRepresentativeColors(img: HTMLImageElement): WeightedRGB[] {
  const maxDimension = 160;
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const buckets = new Map<
    string,
    { weight: number; r: number; g: number; b: number }
  >();

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 200) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const isEdge =
      x < width * 0.12 ||
      x > width * 0.88 ||
      y < height * 0.12 ||
      y > height * 0.88;
    const weight = isEdge ? 2.4 : 1;

    const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(
      b / 24,
    )}`;

    const bucket = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
    bucket.weight += weight;
    bucket.r += r * weight;
    bucket.g += g * weight;
    bucket.b += b * weight;
    buckets.set(key, bucket);
  }

  const sorted = [...buckets.values()]
    .sort((a, b) => b.weight - a.weight)
    .map((bucket) => ({
      r: Math.round(bucket.r / bucket.weight),
      g: Math.round(bucket.g / bucket.weight),
      b: Math.round(bucket.b / bucket.weight),
      weight: bucket.weight,
    }));

  const filtered: WeightedRGB[] = [];
  for (const color of sorted) {
    if (filtered.every((existing) => distance(existing, color) > 36)) {
      filtered.push(color);
    }
    if (filtered.length >= 8) break;
  }

  return filtered;
}

function chooseBackground(colors: WeightedRGB[]): WeightedRGB {
  const ranked = [...colors].sort((a, b) => {
    const aScore = a.weight * 1.2 - saturation(a) * 8;
    const bScore = b.weight * 1.2 - saturation(b) * 8;
    return bScore - aScore;
  });
  return ranked[0] ?? colors[0];
}

function chooseForeground(colors: WeightedRGB[], background: RGB): RGB {
  const best =
    [...colors].sort((a, b) => {
      const aScore = contrast(a, background) + saturation(a) * 18;
      const bScore = contrast(b, background) + saturation(b) * 18;
      return bScore - aScore;
    })[0] ?? background;

  const target =
    luminance(background) > 150 ? { r: 16, g: 16, b: 16 } : { r: 245, g: 245, b: 245 };
  return mix(best, target, 0.18);
}

function chooseAccent(colors: WeightedRGB[], background: RGB): RGB {
  const scored =
    [...colors].sort((a, b) => {
      const aScore =
        saturation(a) * 90 +
        contrast(a, background) * 0.35 +
        Math.min(a.weight, 160) * 0.2;
      const bScore =
        saturation(b) * 90 +
        contrast(b, background) * 0.35 +
        Math.min(b.weight, 160) * 0.2;
      return bScore - aScore;
    })[0] ?? background;

  const luma = luminance(scored);
  if (luma < 90) return mix(scored, { r: 255, g: 255, b: 255 }, 0.18);
  if (luma > 210) return mix(scored, { r: 0, g: 0, b: 0 }, 0.18);
  return scored;
}

function chooseSurfaceColors(colors: WeightedRGB[], background: RGB, foreground: RGB): {
  abyss: RGB;
  crater: RGB;
  cinder: RGB;
} {
  const darker = colors.filter((color) => luminance(color) <= luminance(background) + 35);
  const lighter = colors.filter((color) => luminance(color) >= luminance(background) - 10);

  const abyssSource = darker[0] ?? background;
  const craterSource =
    [...colors].sort(
      (a, b) =>
        Math.abs(luminance(a) - (luminance(background) + luminance(foreground)) / 2) -
        Math.abs(luminance(b) - (luminance(background) + luminance(foreground)) / 2),
    )[0] ?? background;
  const cinderSource = lighter[0] ?? foreground;

  return {
    abyss: mix(background, abyssSource, 0.42),
    crater: mix(craterSource, background, 0.3),
    cinder: mix(cinderSource, foreground, 0.22),
  };
}

export async function buildThemeFromPaletteImage(
  file: File,
): Promise<ImportedPaletteTheme> {
  const img = await loadImageFromFile(file);
  const colors = extractRepresentativeColors(img);

  if (colors.length === 0) {
    throw new Error("Palette image did not contain readable colors");
  }

  const background = chooseBackground(colors);
  const foreground = chooseForeground(colors, background);
  const accent = chooseAccent(colors, background);
  const surfaces = chooseSurfaceColors(colors, background, foreground);

  const darkAnchor = mix(background, { r: 0, g: 0, b: 0 }, 0.1);
  const brightAccent = mix(accent, foreground, 0.26);
  const theme = classifyTheme(background, accent);
  const accentPreset = classifyAccentPreset(accent);

  const palette: Partial<CustomPalette> = {
    void: rgbToHex(darkAnchor),
    abyss: rgbToHex(surfaces.abyss),
    crater: rgbToHex(surfaces.crater),
    cinder: rgbToHex(surfaces.cinder),
    bone: rgbToHex(foreground),
    blood: rgbToHex(accent),
    ember: rgbToHex(brightAccent),
  };

  return {
    theme,
    accent: accentPreset,
    palette,
  };
}
