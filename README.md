# 🎨 MiniPhotoshop

A **cross-platform desktop image editor** built with Electron, React, and PixiJS — inspired by Adobe Photoshop, engineered for speed and extensibility.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Electron](https://img.shields.io/badge/Electron-32-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![PixiJS](https://img.shields.io/badge/PixiJS-8-e72264?logo=pixi.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)

---

## ✨ Features

### 🖼️ Canvas & Rendering
- **WebGL-accelerated** rendering via PixiJS v8
- **Layer compositing** with blend modes (Normal, Multiply, Screen, Overlay, and more)
- **Real-time viewport** with smooth pan and zoom (mouse wheel / middle-click drag)
- **Checkerboard background** for transparency visualization
- **Export** to PNG and JPEG with configurable quality

### 🗂️ Layer Management
- Create, delete, and rename layers
- **Drag-to-reorder** layers in the panel
- Per-layer **visibility toggle** and **opacity control**
- Layer **blend mode** selection
- Layer locking support

### 🖌️ Tools
| Tool | Description |
|---|---|
| **Move** | Pan and reposition layers |
| **Brush** | Freehand painting with configurable size |
| **Pencil** | Hard-edge pixel brush |
| **Eraser** | Erase pixels with soft/hard edge |
| **Fill (Paint Bucket)** | Flood-fill with adjustable tolerance, contiguous or global |
| **Eyedropper** | Sample colors from the canvas |
| **Crop** | Crop the document |
| **Gradient** | Apply gradient fills |
| **Text** | Add text layers |
| **Shapes** | Draw basic shapes |
| **Zoom** | Zoom in and out |

### 🔲 Selection Tools
| Tool | Shortcut | Description |
|---|---|---|
| **Rectangular Selection** | `M` | Click and drag; hold `Shift` to constrain to square |
| **Elliptical Selection** | `E` | Click and drag; hold `Shift` to constrain to circle |
| **Lasso** | `L` | Freehand path selection |
| **Quick Selection** | `W` | Paint to grow selection using color-similarity flood fill |

**Selection behaviors:**
- `Shift` + draw → **Add** to existing selection
- `Alt` + draw → **Subtract** from existing selection
- `Escape` / `Ctrl+D` → **Deselect all**
- Animated **Marching Ants** border around active selections
- Selection mask respected by Brush, Eraser, Fill, and Invert operations
- Selection stored as a **pixel mask** (`Uint8Array`) for reuse across tools

### ↩️ History (Undo / Redo)
- `Ctrl+Z` — Undo
- `Ctrl+Y` — Redo
- Up to **50-step** history with deep pixel buffer snapshotting

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | [Electron](https://www.electronjs.org/) 32 |
| UI Framework | [React](https://react.dev/) 18 |
| Rendering Engine | [PixiJS](https://pixijs.com/) 8 (WebGL 2) |
| State Management | [Zustand](https://zustand-demo.pmnd.rs/) 5 + [Immer](https://immerjs.github.io/immer/) |
| Language | TypeScript 5.6 |
| Build Tool | [electron-vite](https://electron-vite.org/) + Vite 5 |
| UI Primitives | [Radix UI](https://www.radix-ui.com/) |
| Icons | [Phosphor Icons](https://phosphoricons.com/) |
| Animation | [Framer Motion](https://www.framer.com/motion/) |
| Testing | Vitest + Playwright |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+
- **npm** 9+

### Installation

```bash
git clone https://github.com/riturajkb/miniphotoshop.git
cd miniphotoshop
npm install
```

### Development

```bash
npm run dev
```

Starts the Electron app with hot-module reloading.

### Build

```bash
npm run build
```

Produces a distributable in the `out/` directory.

### Type Check

```bash
npm run typecheck
```

### Tests

```bash
# Unit tests
npm test

# End-to-end tests
npm run test:e2e
```

---

## 🏗️ Architecture

```
src/
├── engine/
│   ├── PixiEngine.ts        # Core PixiJS app wrapper
│   ├── Renderer.ts          # Document ↔ PixiJS sync, drawing operations
│   ├── LayerStack.ts        # Layer data management
│   ├── Compositor.ts        # Multi-layer blending and compositing
│   ├── SelectionManager.ts  # Mask generation (rect, ellipse, lasso, flood fill)
│   └── SelectionOverlay.ts  # Marching ants animation via canvas-to-sprite
├── store/
│   ├── documentStore.ts     # Zustand store: layers, history, selection
│   ├── editorStore.ts       # UI state: active tool, zoom, pan, cursor
│   └── toolStore.ts         # Per-tool settings (brush size, fill tolerance, etc.)
├── components/layout/
│   ├── CanvasArea.tsx       # Main canvas interaction component
│   ├── ToolsPanel.tsx       # Left toolbar
│   ├── LayersPanel.tsx      # Layer management panel
│   ├── MenuBar.tsx          # App menu (File, Edit, Image, etc.)
│   └── RightPanel.tsx       # Properties and adjustments
└── types/
    └── editor.ts            # Core type definitions (Tool, Layer, Document, Selection)
```

---

## 📋 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+D` / `Esc` | Deselect all |
| `M` | Rectangular Selection |
| `E` | Elliptical Selection |
| `L` | Lasso |
| `W` | Quick Selection |
| `V` | Move tool |
| `B` | Brush |
| `P` | Pencil |
| `G` | Fill (Paint Bucket) |
| `I` | Eyedropper |
| `Z` | Zoom |
| `T` | Text |
| `Middle-click drag` | Pan canvas |
| `Scroll wheel` | Zoom in/out |

---

## 🌿 Branch Strategy

| Branch | Purpose |
|---|---|
| `master` | Stable production code |
| `develop` | Active development |
| `backup-stable` | Previous stable checkpoint |
| `backup-stable-v2` | Stable checkpoint with selection tools |

---

## 📄 License

MIT © [riturajkb](https://github.com/riturajkb)
