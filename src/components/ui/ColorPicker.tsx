import { useRef, useCallback, useEffect, useState } from "react";
import type { RGBA } from "../../types/editor";
import { useColorStore } from "../../store/colorStore";

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const hi = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const m = Math.round;
  switch (hi) {
    case 0: return [m(v * 255), m(t * 255), m(p * 255)];
    case 1: return [m(q * 255), m(v * 255), m(p * 255)];
    case 2: return [m(p * 255), m(v * 255), m(t * 255)];
    case 3: return [m(p * 255), m(q * 255), m(v * 255)];
    case 4: return [m(t * 255), m(p * 255), m(v * 255)];
    case 5: return [m(v * 255), m(p * 255), m(q * 255)];
    default: return [0, 0, 0];
  }
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return [h, s, v];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return null;
}

interface ColorPickerProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
  target?: "foreground" | "background";
}

export function ColorPicker({ isOpen, onClose, anchorRect, target = "foreground" }: ColorPickerProps) {
  const { foregroundColor, backgroundColor, setForeground, setBackground } = useColorStore();
  const lastPushedColor = useRef<RGBA | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const svDragging = useRef(false);
  const hueDragging = useRef(false);

  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(0);
  const [val, setVal] = useState(1);
  const [alpha, setAlpha] = useState(100);
  const [hexInput, setHexInput] = useState("#000000");
  const [rgbR, setRgbR] = useState("0");
  const [rgbG, setRgbG] = useState("0");
  const [rgbB, setRgbB] = useState("0");

  useEffect(() => {
    if (!isOpen) {
      lastPushedColor.current = null;
      return;
    }
    const c = target === "foreground" ? foregroundColor : backgroundColor;
    
    if (
      lastPushedColor.current &&
      lastPushedColor.current.r === c.r &&
      lastPushedColor.current.g === c.g &&
      lastPushedColor.current.b === c.b &&
      lastPushedColor.current.a === c.a
    ) {
      return;
    }

    const [h, s, v] = rgbToHsv(c.r, c.g, c.b);
    setHue(h);
    setSat(s);
    setVal(v);
    setAlpha(Math.round((c.a / 255) * 100));
    setHexInput(rgbToHex(c.r, c.g, c.b));
    setRgbR(String(c.r));
    setRgbG(String(c.g));
    setRgbB(String(c.b));
  }, [isOpen, target, foregroundColor, backgroundColor]);

  const pushColor = useCallback((h: number, s: number, v: number, a: number) => {
    const [r, g, b] = hsvToRgb(h, s, v);
    const newColor = { r, g, b, a: Math.round(a * 255 / 100) };
    lastPushedColor.current = newColor;
    if (target === "foreground") {
      setForeground(newColor);
    } else {
      setBackground(newColor);
    }
    setHexInput(rgbToHex(r, g, b));
    setRgbR(String(r));
    setRgbG(String(g));
    setRgbB(String(b));
  }, [target, setForeground, setBackground]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width;
    const h = canvas.height;
    const [hr, hg, hb] = hsvToRgb(hue, 1, 1);
    ctx.fillStyle = `rgb(${hr},${hg},${hb})`;
    ctx.fillRect(0, 0, w, h);
    const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
    whiteGrad.addColorStop(0, "rgba(255,255,255,1)");
    whiteGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, w, h);
    const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
    blackGrad.addColorStop(0, "rgba(0,0,0,0)");
    blackGrad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, w, h);
  }, [hue, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const updateSv = (clientX: number, clientY: number) => {
      const surface = svRef.current;
      if (!surface) return;
      const rect = surface.getBoundingClientRect();
      const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
      setSat(s);
      setVal(v);
      pushColor(hue, s, v, alpha);
    };
    const updateHue = (clientY: number) => {
      const slider = hueRef.current;
      if (!slider) return;
      const rect = slider.getBoundingClientRect();
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const newHue = (1 - y) * 360;
      setHue(newHue);
      pushColor(newHue, sat, val, alpha);
    };
    const onMove = (e: MouseEvent) => {
      if (svDragging.current) {
        updateSv(e.clientX, e.clientY);
      }
      if (hueDragging.current) {
        updateHue(e.clientY);
      }
    };
    const onUp = () => {
      svDragging.current = false;
      hueDragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isOpen, hue, sat, val, alpha, pushColor]);

  const handleSvDown = useCallback((e: React.MouseEvent) => {
    svDragging.current = true;
    const surface = svRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    setSat(s);
    setVal(v);
    pushColor(hue, s, v, alpha);
  }, [hue, alpha, pushColor]);

  const handleHueDown = useCallback((e: React.MouseEvent) => {
    hueDragging.current = true;
    const slider = hueRef.current;
    if (!slider) return;
    const rect = slider.getBoundingClientRect();
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const newHue = (1 - y) * 360;
    setHue(newHue);
    pushColor(newHue, sat, val, alpha);
  }, [sat, val, alpha, pushColor]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setHexInput(v);
    const rgb = hexToRgb(v);
    if (rgb) {
      const [h, s, vv] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
      setHue(h); setSat(s); setVal(vv);
      const newColor = { r: rgb[0], g: rgb[1], b: rgb[2], a: Math.round(alpha * 255 / 100) };
      lastPushedColor.current = newColor;
      if (target === "foreground") setForeground(newColor);
      else setBackground(newColor);
      setRgbR(String(rgb[0]));
      setRgbG(String(rgb[1]));
      setRgbB(String(rgb[2]));
    }
  };

  const handleRgbInput = useCallback((channel: "r" | "g" | "b", raw: string) => {
    const num = Math.max(0, Math.min(255, parseInt(raw) || 0));
    if (channel === "r") setRgbR(raw);
    if (channel === "g") setRgbG(raw);
    if (channel === "b") setRgbB(raw);
    const r = channel === "r" ? num : parseInt(rgbR) || 0;
    const g = channel === "g" ? num : parseInt(rgbG) || 0;
    const b = channel === "b" ? num : parseInt(rgbB) || 0;
    const [h, s, vv] = rgbToHsv(r, g, b);
    setHue(h); setSat(s); setVal(vv);
    const newColor = { r, g, b, a: Math.round(alpha * 255 / 100) };
    lastPushedColor.current = newColor;
    if (target === "foreground") setForeground(newColor);
    else setBackground(newColor);
    setHexInput(rgbToHex(r, g, b));
  }, [rgbR, rgbG, rgbB, alpha, target, setForeground, setBackground]);

  const handleAlphaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = parseInt(e.target.value);
    setAlpha(a);
    pushColor(hue, sat, val, a);
  };

  if (!isOpen) return null;

  const svW = 200;
  const svH = 200;
  const popupWidth = 256;
  const popupHeight = 360;
  const svThumbX = sat * svW;
  const svThumbY = (1 - val) * svH;
  const hueThumbY = (1 - hue / 360) * svH;
  const [cr, cg, cb] = hsvToRgb(hue, sat, val);
  const previewColor = `rgba(${cr},${cg},${cb},${alpha / 100})`;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : popupWidth;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : popupHeight;
  const popupLeft = anchorRect
    ? Math.min(
        viewportWidth - popupWidth - 12,
        Math.max(12, anchorRect.right + 12),
      )
    : 12;
  const popupTop = anchorRect
    ? Math.min(
        viewportHeight - popupHeight - 12,
        Math.max(12, anchorRect.bottom - popupHeight),
      )
    : 12;

  return (
    <div
      data-color-picker-root="true"
      style={{
        position: "fixed",
        zIndex: 1000,
        left: popupLeft,
        top: popupTop,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          background: "#1d1f21",
          border: "1px solid #383f47",
          borderRadius: 8,
          padding: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          width: 256,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Color preview */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 4,
              background: previewColor,
              border: "1px solid #555",
              backgroundImage: `linear-gradient(45deg, #222 25%, transparent 25%),
                linear-gradient(-45deg, #222 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #222 75%),
                linear-gradient(-45deg, transparent 75%, #222 75%)`,
              backgroundSize: "8px 8px",
              backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: previewColor }} />
          </div>
          <span style={{ fontSize: 12, color: "#a0a8b0", fontFamily: "monospace" }}>{hexInput}</span>
        </div>

        {/* SV square + Hue slider */}
        <div style={{ display: "flex", gap: 8 }}>
          <div ref={svRef} style={{ position: "relative", width: svW, height: svH, cursor: "crosshair" }}>
            <canvas
              ref={canvasRef}
              width={svW}
              height={svH}
              style={{ display: "block", width: svW, height: svH, borderRadius: 3 }}
              onMouseDown={handleSvDown}
            />
            <div
              style={{
                position: "absolute",
                left: svThumbX,
                top: svThumbY,
                width: 14,
                height: 14,
                borderRadius: "50%",
                border: `2px solid ${val > 0.5 && sat < 0.5 ? "#000" : "#fff"}`,
                boxShadow: "0 0 3px rgba(0,0,0,0.6)",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          </div>
          <div
            ref={hueRef}
            style={{
              position: "relative",
              width: 20,
              height: svH,
              borderRadius: 3,
              background: "linear-gradient(to bottom, #f00 0%, #f0f 17%, #00f 33%, #0ff 50%, #0f0 67%, #ff0 83%, #f00 100%)",
              cursor: "pointer",
              flexShrink: 0,
            }}
            onMouseDown={handleHueDown}
          >
            <div
              style={{
                position: "absolute",
                left: -3,
                top: hueThumbY,
                width: 26,
                height: 8,
                borderRadius: 2,
                border: "2px solid #fff",
                boxShadow: "0 0 3px rgba(0,0,0,0.5)",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                background: `hsl(${hue}, 100%, 50%)`,
              }}
            />
          </div>
        </div>

        {/* Alpha slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#6f7883", width: 32 }}>Alpha</span>
          <div style={{ flex: 1, position: "relative", height: 14 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `linear-gradient(45deg, #222 25%, transparent 25%),
                  linear-gradient(-45deg, #222 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #222 75%),
                  linear-gradient(-45deg, transparent 75%, #222 75%)`,
                backgroundSize: "6px 6px",
                backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0",
                backgroundColor: "#333",
                border: "1px solid #555",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div style={{ height: "100%", width: `${alpha}%`, background: previewColor }} />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={alpha}
              onChange={handleAlphaChange}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                margin: 0,
                opacity: 0,
                cursor: "pointer",
              }}
            />
          </div>
          <input
            type="number"
            min={0}
            max={100}
            value={alpha}
            onChange={(e) => { const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)); setAlpha(v); pushColor(hue, sat, val, v); }}
            style={{
              width: 48,
              padding: "2px 4px",
              border: "1px solid #383f47",
              borderRadius: 3,
              background: "#212428",
              color: "#b3bac2",
              fontSize: 10,
              textAlign: "center",
              fontFamily: "monospace",
            }}
          />
        </div>

        {/* Hex input */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#6f7883", width: 32 }}>Hex</span>
          <input
            type="text"
            value={hexInput}
            onChange={handleHexChange}
            maxLength={7}
            style={{
              flex: 1,
              padding: "4px 6px",
              border: "1px solid #383f47",
              borderRadius: 3,
              background: "#212428",
              color: "#b3bac2",
              fontSize: 11,
              fontFamily: "monospace",
            }}
          />
        </div>

        {/* RGB inputs */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#6f7883", width: 32 }}>RGB</span>
          {(["r", "g", "b"] as const).map((ch) => (
            <div key={ch} style={{ flex: 1, display: "flex", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 9, color: "#555e69", textTransform: "uppercase", fontWeight: 600 }}>{ch}</span>
              <input
                type="number"
                min={0}
                max={255}
                value={ch === "r" ? rgbR : ch === "g" ? rgbG : rgbB}
                onChange={(e) => handleRgbInput(ch, e.target.value)}
                style={{
                  width: "100%",
                  padding: "3px 4px",
                  border: "1px solid #383f47",
                  borderRadius: 3,
                  background: "#212428",
                  color: "#b3bac2",
                  fontSize: 10,
                  textAlign: "center",
                  fontFamily: "monospace",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
