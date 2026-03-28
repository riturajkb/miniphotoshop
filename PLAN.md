# MiniPhotoshop — Full Project Plan

> A cross-platform, full-featured desktop image editor built with a 100% TypeScript stack.
> Targets modern low-end hardware (2 cores / 4 threads, 4GB RAM, integrated GPU).

---

## Table of Contents

1. [Project Philosophy](#1-project-philosophy)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Thread Strategy](#4-thread-strategy)
5. [Project Structure](#5-project-structure)
6. [Feature Roadmap](#6-feature-roadmap)
   - Phase 1 — Core Canvas & Tools
   - Phase 2 — Layer System
   - Phase 3 — Adjustments & Filters
   - Phase 4 — Advanced Tools
   - Phase 5 — Professional Features
   - Phase 6 — Polish & Distribution
7. [UI/UX Design System](#7-uiux-design-system)
8. [State Architecture](#8-state-architecture)
9. [Canvas Engine](#9-canvas-engine)
10. [File Format Support](#10-file-format-support)
11. [Keyboard Shortcuts](#11-keyboard-shortcuts)
12. [Performance Strategy](#12-performance-strategy)
13. [Testing Strategy](#13-testing-strategy)
14. [Distribution & Packaging](#14-distribution--packaging)
15. [Future Considerations](#15-future-considerations)

---

## 1. Project Philosophy

MiniPhotoshop is built around three non-negotiable principles:

**Excellent UI** — The interface must feel as polished as a commercial product. Every panel, slider, tooltip, and animation is intentional. No placeholder aesthetics.

**Fast on low-end hardware** — The app must feel snappy on a 4GB RAM laptop with integrated graphics. Every architectural decision is made with this constraint in mind. GPU-first rendering, Web Workers for CPU ops, minimal memory footprint.

**Cross-platform without compromise** — Windows, macOS, and Linux users get the same experience. No platform-specific code paths, no OS-dependent UI quirks.

The entire application is written in TypeScript — one language, one toolchain, one mental model. No Rust, no Go, no Python. Complexity is managed through architecture, not polyglotism.

---

## 2. Tech Stack

### Desktop Shell
| Technology | Version | Role |
|---|---|---|
| Electron | 32+ | Desktop wrapper, Node.js backend, native APIs |
| electron-vite | Latest | Build tool combining Vite + Electron |

Electron is chosen over Tauri because it includes a Node.js runtime, enabling Sharp (native C image library) without any Rust compilation. The ~150MB bundle size and ~200MB RAM baseline are acceptable on the target hardware profile.

### Frontend
| Technology | Version | Role |
|---|---|---|
| React | 18 | UI component framework |
| TypeScript | 5+ | Language — entire codebase |
| Vite | 5 | Build tool, HMR |
| Tailwind CSS | 4 | Utility-first styling |
| shadcn/ui | Latest | Owned component library (Radix primitives) |
| Radix UI | Latest | Accessible headless primitives |
| Framer Motion | Latest | Animations and micro-interactions |
| Phosphor Icons | Latest | Tool and UI icon set |

### Canvas Engine
| Technology | Version | Role |
|---|---|---|
| PixiJS | 8 | WebGL-accelerated canvas rendering |
| @pixi/react | 8 | React integration for PixiJS |

PixiJS is the core rendering engine. All drawing, compositing, and filter preview runs on the GPU via WebGL. Canvas2D is the automatic fallback for systems where WebGL is unavailable.

### State Management
| Technology | Version | Role |
|---|---|---|
| Zustand | 5 | Global state — editor, tools, colors, history |
| Immer | Latest | Immutable state updates for complex nested state |

### Image Processing
| Technology | Version | Role |
|---|---|---|
| Sharp | Latest | Node.js process — file I/O, encode/decode, export |
| Web Workers | Native | Browser threads — pixel ops, fill, adjustments |
| SharedArrayBuffer | Native | Zero-copy pixel buffer sharing between threads |
| WebGL Shaders (GLSL) | — | GPU — real-time filters and blend modes |

### Developer Tooling
| Technology | Role |
|---|---|
| ESLint + Prettier | Code quality and formatting |
| Vitest | Unit and integration testing |
| Playwright | End-to-end testing |
| electron-builder | Cross-platform packaging and distribution |

---

## 3. Architecture Overview

The application is split into two Electron processes that communicate via a secure IPC bridge.

### Main Process (Node.js / TypeScript)
Runs in Node.js. Has full access to the filesystem, native modules, and OS APIs. Responsibilities:
- Application lifecycle (window creation, menus, tray)
- File system operations via Sharp (open, save, export)
- Native OS dialogs (file picker, save dialog, color picker)
- Auto-updater
- Recent files registry
- Crash reporting

### Renderer Process (Chromium / TypeScript)
Runs in a sandboxed Chromium environment. Responsibilities:
- All React UI rendering
- PixiJS WebGL canvas engine
- Tool logic (brush, eraser, selection, fill, etc.)
- Layer compositing
- Undo/redo history
- Web Worker orchestration
- Real-time filter preview via GLSL shaders

### Preload Script
A thin bridge layer that exposes a typed, whitelisted API from the main process to the renderer. The renderer never has direct access to Node.js APIs — all cross-process communication goes through this typed contract.

### IPC Contract
All main ↔ renderer communication is defined in a single shared types file. Every message has a typed request and typed response. No untyped string-based IPC.

---

## 4. Thread Strategy

The application uses all available threads on a 4-thread system:

| Thread | Role | Contents |
|---|---|---|
| Thread 1 — UI | Main renderer thread | React, PixiJS WebGL, mouse/keyboard events, Zustand |
| Thread 2 — Fill Worker | Flood fill operations | BFS flood fill algorithm, contiguous region detection |
| Thread 3 — Image Worker | Heavy image processing | File decode/encode, histogram computation, blur convolutions |
| Thread 4 — History Worker | State serialization | Undo snapshot compression, autosave, clipboard |

Pixel buffers are shared between threads using `SharedArrayBuffer` for zero-copy performance — no serialization overhead when passing large image data to workers.

---

## 5. Project Structure

```
miniphotoshop/
│
├── electron/                        Main process (Node.js)
│   ├── main.ts                      Entry point, window creation
│   ├── preload.ts                   IPC bridge, context isolation
│   ├── menu.ts                      Native application menu
│   └── handlers/
│       ├── fileHandler.ts           Open / save via Sharp
│       ├── exportHandler.ts         Export with format options
│       ├── dialogHandler.ts         Native OS dialogs
│       └── updaterHandler.ts        Auto-update logic
│
├── src/                             Renderer process (React)
│   ├── main.tsx                     React entry point
│   ├── App.tsx                      Root layout and router
│   │
│   ├── components/
│   │   ├── layout/                  App shell structure
│   │   │   ├── AppShell.tsx         Overall window layout
│   │   │   ├── MenuBar.tsx          Top menu (File/Edit/View/Image/Layer/Filter)
│   │   │   ├── TopBar.tsx           Contextual tool options
│   │   │   ├── ToolsPanel.tsx       Left tool sidebar
│   │   │   ├── CanvasArea.tsx       Scrollable canvas viewport
│   │   │   ├── LayersPanel.tsx      Right layers panel
│   │   │   ├── PropertiesPanel.tsx  Right properties / adjustments
│   │   │   ├── HistoryPanel.tsx     Undo history visual list
│   │   │   └── StatusBar.tsx        Zoom, cursor position, document info
│   │   │
│   │   ├── canvas/                  Canvas rendering components
│   │   │   ├── PixiCanvas.tsx       PixiJS stage mount and lifecycle
│   │   │   ├── CanvasRulers.tsx     Top and left rulers with zoom-aware ticks
│   │   │   ├── CanvasGrid.tsx       Checkerboard transparency indicator
│   │   │   ├── SelectionOverlay.tsx Marching ants selection border
│   │   │   └── BrushCursor.tsx      Live brush size preview cursor
│   │   │
│   │   ├── panels/                  Side panel contents
│   │   │   ├── layers/
│   │   │   │   ├── LayerList.tsx    Scrollable layer stack
│   │   │   │   ├── LayerItem.tsx    Single layer row (thumb, name, opacity)
│   │   │   │   ├── LayerControls.tsx Add/delete/group layer buttons
│   │   │   │   └── BlendModeSelect.tsx Blend mode dropdown
│   │   │   ├── adjustments/
│   │   │   │   ├── BrightnessContrast.tsx
│   │   │   │   ├── HueSaturation.tsx
│   │   │   │   ├── Levels.tsx
│   │   │   │   ├── Curves.tsx
│   │   │   │   └── ColorBalance.tsx
│   │   │   └── filters/
│   │   │       ├── BlurPanel.tsx
│   │   │       ├── SharpenPanel.tsx
│   │   │       └── NoisePanel.tsx
│   │   │
│   │   ├── dialogs/                 Modal dialogs
│   │   │   ├── NewDocumentDialog.tsx Canvas size, resolution, color mode
│   │   │   ├── ImageSizeDialog.tsx  Resize with resampling options
│   │   │   ├── CanvasSizeDialog.tsx Expand/crop canvas with anchor
│   │   │   ├── ExportDialog.tsx     Format, quality, metadata options
│   │   │   └── PreferencesDialog.tsx App settings
│   │   │
│   │   └── ui/                     Shared UI primitives (shadcn/ui based)
│   │       ├── ToolButton.tsx       Tool icon button with tooltip
│   │       ├── ColorSwatch.tsx      FG/BG color display and swap
│   │       ├── ColorPicker.tsx      Full HSL color picker popover
│   │       ├── OpacitySlider.tsx    Labeled opacity control
│   │       ├── SizeInput.tsx        Numeric input with unit
│   │       └── Tooltip.tsx          Consistent tooltip with shortcut display
│   │
│   ├── engine/                     Core canvas engine (no React)
│   │   ├── PixiEngine.ts            PixiJS application singleton
│   │   ├── CanvasDocument.ts        Document model (pixels, size, metadata)
│   │   ├── LayerStack.ts            Layer array management and ordering
│   │   ├── Compositor.ts            Composites layers → final display texture
│   │   └── Renderer.ts              Syncs document state to PixiJS display tree
│   │
│   ├── tools/                      Tool implementations
│   │   ├── BaseTool.ts              Abstract interface (pointerDown/Move/Up)
│   │   ├── BrushTool.ts             Brush with size, opacity, hardness, flow
│   │   ├── PencilTool.ts            Hard-edge pixel brush
│   │   ├── EraserTool.ts            Erases to transparent
│   │   ├── SelectionTool.ts         Rectangle marquee selection
│   │   ├── LassoTool.ts             Freehand selection
│   │   ├── MagicWandTool.ts         Tolerance-based contiguous selection
│   │   ├── MoveTool.ts              Move layer or selection contents
│   │   ├── FillTool.ts              Flood fill with tolerance
│   │   ├── GradientTool.ts          Linear and radial gradients
│   │   ├── EyedropperTool.ts        Sample color from canvas
│   │   ├── CropTool.ts              Interactive crop with aspect ratio lock
│   │   ├── TextTool.ts              Vector text layers with font controls
│   │   ├── ShapeTool.ts             Rectangle, ellipse, line shapes
│   │   └── ZoomTool.ts              Click to zoom in/out
│   │
│   ├── workers/                    Web Worker scripts
│   │   ├── fillWorker.ts            BFS flood fill
│   │   ├── imageWorker.ts           Heavy image processing
│   │   └── historyWorker.ts         Snapshot compression and autosave
│   │
│   ├── shaders/                    GLSL shader programs
│   │   ├── blendModes.glsl          All Photoshop blend mode implementations
│   │   ├── gaussianBlur.glsl        Separable Gaussian blur
│   │   ├── adjustments.glsl         Brightness, contrast, hue, saturation
│   │   ├── curves.glsl              Curves via LUT texture
│   │   └── noise.glsl               Add/reduce noise
│   │
│   ├── store/                      Zustand state stores
│   │   ├── editorStore.ts           Active tool, zoom, pan, canvas size
│   │   ├── documentStore.ts         Document state, layers, pixels
│   │   ├── toolStore.ts             Per-tool settings (size, opacity, etc.)
│   │   ├── colorStore.ts            Foreground/background color
│   │   ├── selectionStore.ts        Active selection region
│   │   ├── historyStore.ts          Undo/redo stack
│   │   └── uiStore.ts               Panel visibility, preferences
│   │
│   ├── hooks/                      Custom React hooks
│   │   ├── useCanvasEvents.ts       Pointer events → tool dispatch
│   │   ├── useZoomPan.ts            Scroll zoom and pan logic
│   │   ├── useKeyboard.ts           Global keyboard shortcut handler
│   │   ├── useHistory.ts            Undo/redo actions
│   │   ├── useWorker.ts             Generic typed Web Worker hook
│   │   └── useDocument.ts           Document load/save/export actions
│   │
│   ├── lib/                        Utility modules
│   │   ├── ipc.ts                   All Electron IPC calls (typed)
│   │   ├── colorUtils.ts            Hex ↔ RGB ↔ HSL ↔ HSV conversions
│   │   ├── selectionUtils.ts        Selection mask operations
│   │   ├── canvasUtils.ts           ArrayBuffer and pixel helpers
│   │   ├── mathUtils.ts             Vector math, interpolation
│   │   └── formatUtils.ts           File size, dimension formatting
│   │
│   └── types/                      Shared TypeScript types
│       ├── editor.ts                Core types: RGBA, Tool, Document, Layer
│       ├── ipc.ts                   IPC message contracts
│       └── pixi.ts                  PixiJS extension types
│
├── resources/
│   ├── icons/                       App icon (all sizes, all platforms)
│   └── cursors/                     Custom tool cursors
│
├── package.json
├── electron-builder.config.ts       Packaging and distribution config
├── vite.config.ts                   Vite build config
├── tailwind.config.ts               Theme tokens and plugin config
└── tsconfig.json                    TypeScript compiler config
```

---

## 6. Feature Roadmap

### Phase 1 — Core Canvas & Tools

The foundation. A working single-layer image editor with the four essential tools, undo/redo, and file I/O. At the end of Phase 1 the app is genuinely usable for basic photo editing and digital painting.

**Infrastructure**
- Electron + Vite + React + TypeScript scaffold
- Dark Photoshop-like UI shell with all panels rendered
- PixiJS WebGL canvas mounted and displaying
- Zustand stores wired up
- Electron IPC bridge for file operations
- Web Workers configured for Thread 2 and Thread 3

**Canvas**
- Blank canvas with configurable size (default 800×600)
- Checkerboard background indicating transparency
- Zoom via scroll wheel, range 10%–3200%
- Pan via middle mouse button drag or Space+drag
- Canvas rulers (top and left) with zoom-aware tick marks
- Canvas centered in viewport on open
- Cursor coordinates in status bar
- Zoom level in status bar

**Tools — Brush**
- Draw with circles interpolated along pointer path
- Configurable size (1–500px), opacity (0–100%), hardness (0–100%)
- Smooth interpolation between mouse positions (no gaps at fast speeds)
- Uses foreground color from color store
- Live brush circle preview cursor that scales with brush size

**Tools — Eraser**
- Erases pixels to transparent
- Same size and opacity controls as brush
- Respects active selection boundary

**Tools — Rectangle Selection**
- Click-drag to define rectangular selection region
- Marching ants animated border on active selection
- Selection persists after mouse release
- Click outside to deselect
- Escape key to deselect
- Move selection region by dragging inside it
- Ctrl+A to select all
- Active selection constrains all drawing tools

**Tools — Fill (Bucket)**
- Click to flood fill contiguous region with foreground color
- Configurable tolerance (0–255)
- Runs entirely in Web Worker — UI thread never freezes
- Respects active selection boundary

**Color**
- Foreground and background color swatches in tools panel
- Full HSL color picker popover with hex input
- X key to swap foreground and background
- D key to reset to default black/white

**Undo / Redo**
- 20-step undo history
- Ctrl+Z to undo, Ctrl+Shift+Z to redo
- Each undoable action stores a canvas pixel snapshot

**File I/O**
- New document dialog (width, height, background color)
- Open PNG, JPG, BMP, WEBP via Sharp in Electron main process
- Save as PNG
- Export as JPG with quality control, PNG with compression level
- Drag and drop image onto canvas to open
- Recent files list in File menu
- Window title shows filename with unsaved changes indicator

---

### Phase 2 — Layer System

Layers transform the app from a basic paint program into a real image editor. This phase introduces the full layer model including blend modes, opacity, and layer management.

**Layer Model**
- Each layer is an independent RGBA pixel buffer
- Layers have a name, opacity, blend mode, visibility toggle, and lock toggle
- Maximum 100 layers per document

**Layer Panel**
- Scrollable layer stack matching Photoshop's visual layout
- Layer thumbnail (live preview of layer contents)
- Layer name (double-click to rename)
- Visibility toggle (eye icon)
- Lock toggle (lock icon)
- Opacity slider per layer
- Blend mode dropdown per layer
- Add new layer button
- Delete layer button (with confirmation if layer has content)
- Duplicate layer
- Merge down (merge current layer into layer below)
- Flatten image (collapse all layers into one)
- Layer reordering via drag and drop

**Blend Modes**
All implemented as GLSL fragment shaders running on the GPU:
- Normal
- Dissolve
- Multiply
- Screen
- Overlay
- Soft Light
- Hard Light
- Color Dodge
- Color Burn
- Darken
- Lighten
- Difference
- Exclusion
- Hue
- Saturation
- Color
- Luminosity

**Layer Operations**
- Move layer contents with Move tool
- Transform layer (scale, rotate) with free transform
- Clip layer to layer below (clipping mask)
- Layer groups (folder layers)
- Merge visible layers
- New layer from selection

**Copy / Paste**
- Copy selection to clipboard
- Paste as new layer
- Paste in place
- Cut selection (copy then fill selection with transparency)

---

### Phase 3 — Adjustments & Filters

Non-destructive adjustments applied to the active layer or as adjustment layers that affect all layers below them.

**Tonal Adjustments**
- Brightness / Contrast — simple two-slider control
- Levels — black point, white point, midtone sliders with histogram display
- Curves — editable curve with draggable anchor points, per-channel (RGB, R, G, B)
- Exposure — exposure, offset, gamma correction

**Color Adjustments**
- Hue / Saturation — hue shift, saturation, lightness with color range selector
- Color Balance — shadows, midtones, highlights color shift
- Vibrance — intelligent saturation that protects already-saturated colors
- Black and White — convert to grayscale with channel mix sliders
- Photo Filter — apply warm/cool color cast
- Channel Mixer — blend color channels

**Filters**
- Gaussian Blur — GPU shader, real-time preview
- Box Blur
- Motion Blur — angle and distance
- Radial Blur
- Smart Sharpen — amount, radius, reduce noise
- Unsharp Mask — amount, radius, threshold
- Add Noise — amount, Gaussian or uniform, monochromatic option
- Reduce Noise
- Median Filter

**Adjustment Layers**
Adjustments applied as non-destructive layers that can be modified at any time after creation. Each adjustment layer type above is available as an adjustment layer. Adjustment layers include a layer mask for selective application.

---

### Phase 4 — Advanced Tools

Expands the toolset to cover the remaining core Photoshop tools.

**Lasso Tool**
- Freehand selection by drawing an irregular region
- Polygonal lasso variant (click to add anchor points, close on start point)
- Magnetic lasso variant (snaps to high-contrast edges)

**Magic Wand Tool**
- Select contiguous region of similar color
- Configurable tolerance
- Contiguous vs sample all layers option
- Add to selection (Shift), subtract from selection (Alt)

**Selection Refinement**
- Feather selection (blur selection edge)
- Expand / Contract selection by pixels
- Smooth selection edges
- Invert selection
- Select by color range

**Move Tool**
- Move active layer contents
- Auto-select (click to select topmost layer under cursor)
- Show transform handles for scale/rotate

**Crop Tool**
- Interactive crop with drag handles
- Aspect ratio presets (1:1, 4:3, 16:9, custom)
- Aspect ratio lock toggle
- Crop to selection
- Content-aware fill option for expanded canvas (Phase 5)

**Gradient Tool**
- Linear gradient
- Radial gradient
- Angle gradient
- Reflected gradient
- Diamond gradient
- Configurable gradient stops (color and opacity)
- Gradient editor with preset gradients

**Eyedropper Tool**
- Sample single pixel color to foreground
- Sample average of 3×3, 5×5, or 11×11 area
- Sample from current layer or all merged layers

**Text Tool**
- Click to create a text layer
- Configurable font family, size, weight, style
- Color, alignment (left, center, right, justify)
- Character spacing and line height
- Rasterize text layer for pixel editing
- Text layers remain editable until rasterized

**Shape Tools**
- Rectangle (with corner radius option)
- Ellipse
- Line (with arrow options)
- Custom shape from path
- Fill color, stroke color, stroke width
- Shape layers (vector) or render as pixels

---

### Phase 5 — Professional Features

Features that distinguish a professional tool from a hobbyist editor.

**Smart Objects**
- Embed a linked file as a smart object layer
- Non-destructive transform (scale/rotate without quality loss)
- Edit contents in a separate document window
- Replace smart object contents

**Layer Masks**
- Add pixel mask to any layer
- Paint on mask with black (hide) or white (show)
- View mask in isolation (Alt+click on mask thumbnail)
- Disable/enable mask temporarily
- Apply mask permanently (merge mask into layer)
- Refine mask with edge detection for hair/fur

**Channels Panel**
- View individual R, G, B, A channels
- Edit individual channels
- Create alpha channel from selection
- Load selection from channel

**Content-Aware Fill**
- Fill a selection by intelligently sampling surrounding pixels
- Runs in Web Worker with progress indicator

**Batch Processing**
- Apply a sequence of operations to multiple files
- Configurable output format and directory
- Progress tracking

**Histograms**
- Live histogram in status bar area (RGB combined and individual channels)
- Updates in real time as adjustments are made

**Color Profiles**
- Display current document color profile in status bar
- Convert document to sRGB for web export
- Assign profile without conversion

**Grid and Guides**
- Configurable grid overlay (size, color, subdivisions)
- Snap to grid toggle
- Drag guides from rulers
- Smart guides (snap to other layer edges)
- Clear all guides

**Actions**
- Record a sequence of operations as a named action
- Play back actions on current document
- Save and load action sets
- Batch apply action to a folder of files

---

### Phase 6 — Polish & Distribution

The final phase focuses on making the app feel complete, stable, and distributable.

**Application Polish**
- Full custom application menu with all items functional
- Native OS integration (file association for common image formats)
- Drag image files onto app icon to open
- System tray icon with quick actions
- Custom window frame matching app theme
- Smooth panel resize with drag handles
- Collapsible panels
- Multiple document tabs (open several documents simultaneously)
- Floating tool windows (tear off panels)
- Workspace presets (save and restore panel layout)

**Preferences**
- Interface language
- Canvas background color
- Default new document settings
- Memory usage limit
- Auto-save interval
- GPU acceleration toggle
- Cursor preferences
- Keyboard shortcut customization

**Performance**
- Tile-based rendering for very large canvases (>4096×4096)
- Lazy layer compositing (only re-composite changed regions)
- Memory usage monitor in status bar
- Graceful degradation to Canvas2D on low VRAM systems

**Accessibility**
- Full keyboard navigation for all panels and dialogs
- Screen reader labels on all interactive elements
- High contrast mode
- Reduced motion mode (respects OS preference)
- Minimum touch target sizes for trackpad-heavy users

**Crash Recovery**
- Auto-save every 5 minutes to a recovery file
- On launch, offer to recover unsaved documents
- Crash report submission with user consent

**Auto-Updater**
- Background update check on launch
- Download update in background
- Prompt to restart and install on next launch

---

## 7. UI/UX Design System

### Layout
The application follows Photoshop's proven panel layout:

```
┌─────────────────────────────────────────────────────┐
│  Menu Bar (File / Edit / Image / Layer / Filter / View) │
├─────────────────────────────────────────────────────┤
│  Top Bar — contextual tool options                   │
├──────┬──────────────────────────────┬───────────────┤
│      │                              │               │
│ Tool │      Canvas Area             │   Layers      │
│ Bar  │   (scrollable viewport)      │   Panel       │
│      │                              │               │
│      │                              ├───────────────┤
│      │                              │  Properties   │
│      │                              │  Panel        │
├──────┴──────────────────────────────┴───────────────┤
│  Status Bar (zoom / cursor / document info)          │
└─────────────────────────────────────────────────────┘
```

### Color Tokens
```
--color-bg-app:       #1a1a1a   Application background
--color-bg-panel:     #1e1e1e   Panel backgrounds
--color-bg-surface:   #2a2a2a   Cards, canvas area bg
--color-bg-elevated:  #333333   Dropdowns, tooltips
--color-border:       #3a3a3a   Panel dividers
--color-border-focus: #4a9eff   Focused input borders
--color-text:         #cccccc   Primary text
--color-text-muted:   #888888   Secondary / placeholder text
--color-accent:       #4a9eff   Active tool, selection, links
--color-accent-hover: #6ab0ff   Hover state on accent elements
--color-danger:       #ff4a4a   Delete, destructive actions
--color-success:      #4aff88   Confirmation states
```

### Typography
- UI text: System font stack (native feel, zero loading delay)
- Monospace (size/coordinate inputs): JetBrains Mono
- Font sizes: 11px (dense panels), 12px (default), 13px (headings), 11px (status bar)

### Spacing System
Based on 4px grid. Panels use dense spacing (4px, 8px) consistent with professional creative tools where screen real estate is maximized for canvas space.

### Component Principles
- Every interactive element has a hover state, active state, and focus ring
- Tooltips on all tool buttons showing name and keyboard shortcut
- Sliders show numeric input alongside the slider for precise entry
- All dialogs are keyboard navigable with Tab/Shift+Tab
- Destructive actions require confirmation
- Loading states for all async operations

---

## 8. State Architecture

The state is split across focused Zustand stores. Stores never import each other — communication happens through React hooks that compose multiple stores.

### editorStore
Active tool, zoom level, pan offset, canvas viewport dimensions, cursor position.

### documentStore
The current document — canvas dimensions, DPI, color mode, and the ordered array of layers. Each layer contains its pixel buffer (SharedArrayBuffer), name, opacity, blend mode, visibility, and lock state. This is the source of truth for everything rendered on canvas.

### toolStore
Per-tool settings keyed by tool ID. Brush size, opacity, hardness, flow. Fill tolerance. Selection feather. Gradient type. Text font settings. These persist across tool switches so returning to a tool restores previous settings.

### colorStore
Foreground color, background color, recent colors swatch (last 20 used colors), saved swatches.

### selectionStore
The active selection — either null or a selection descriptor containing the selection mask (a 1-bit-per-pixel mask buffer), the bounding rectangle, feather amount, and anti-aliasing flag.

### historyStore
The undo/redo stack. Each entry stores a full snapshot of documentStore state (pixel buffers are copied into the snapshot). Maximum 50 entries. Older entries are dropped when the limit is reached. Each entry has a human-readable label matching the action that created it (shown in the History panel).

### uiStore
Panel visibility, panel widths/heights (user-resized), active dialog, preferences.

---

## 9. Canvas Engine

### Rendering Pipeline
Every frame, the Renderer composites the layer stack into a single display texture and presents it via PixiJS:

1. Iterate layers from bottom to top
2. For each visible layer, apply its adjustment filters via GLSL shader
3. Composite the layer onto the accumulator texture using the layer's blend mode shader
4. Apply layer opacity
5. Clip to selection mask if active
6. Present the final composited texture to the PixiJS stage

### Dirty Region Tracking
Re-compositing the entire layer stack every frame is unnecessary. The engine tracks dirty rectangles — regions of the canvas that have changed since the last frame. Only dirty regions are re-composited. For a brush stroke, only the bounding box of the current stroke is re-processed.

### Coordinate Systems
Three coordinate systems exist simultaneously:
- Screen space — pixels on the physical display, origin at top-left of window
- Viewport space — pixels within the canvas area, accounting for scroll
- Canvas space — pixels on the document canvas, accounting for zoom and pan

The engine provides transformation utilities to convert between these systems. Mouse events arrive in screen space and must be converted to canvas space before being passed to tools.

### Texture Atlas
Frequently reused textures (brush tips, pattern fills, gradient presets) are packed into a texture atlas loaded at startup. This avoids GPU texture upload overhead during tool use.

---

## 10. File Format Support

### Open (Read)
| Format | Support | Notes |
|---|---|---|
| PNG | Full | All bit depths, transparency |
| JPEG / JPG | Full | All quality levels |
| WEBP | Full | Lossy and lossless |
| BMP | Full | Uncompressed |
| TIFF | Full | via Sharp |
| GIF | Read first frame | No animation editing |
| ICO | Read | Windows icon files |

### Save / Export (Write)
| Format | Support | Options |
|---|---|---|
| PNG | Full | Compression level, interlace |
| JPEG | Full | Quality 1–100, progressive |
| WEBP | Full | Quality, lossless toggle |
| BMP | Full | Uncompressed |
| TIFF | Full | Compression type |
| PDF | Single page export | — |

### Native Format
The app's native project format (`.mps` — MiniPhotoshop) saves the full document state including all layers, adjustment layers, text layers, history, guides, and metadata. Implemented as a ZIP archive containing JSON metadata and raw pixel buffer files per layer. This avoids lossy compression when saving work in progress.

---

## 11. Keyboard Shortcuts

### Tools
| Key | Tool |
|---|---|
| V | Move |
| M | Rectangle Selection |
| L | Lasso |
| W | Magic Wand |
| C | Crop |
| I | Eyedropper |
| B | Brush |
| P | Pencil |
| E | Eraser |
| G | Fill (Bucket) |
| Shift+G | Gradient |
| T | Text |
| U | Shape |
| Z | Zoom |

### Canvas Navigation
| Shortcut | Action |
|---|---|
| Scroll Wheel | Zoom in/out toward cursor |
| Ctrl+= | Zoom in |
| Ctrl+- | Zoom out |
| Ctrl+0 | Fit canvas to window |
| Ctrl+1 | 100% zoom |
| Space+Drag | Pan canvas |
| Middle Mouse Drag | Pan canvas |

### Editing
| Shortcut | Action |
|---|---|
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+X | Cut |
| Ctrl+C | Copy |
| Ctrl+V | Paste as new layer |
| Ctrl+Shift+V | Paste in place |
| Delete | Delete selection / clear layer |
| Ctrl+A | Select all |
| Ctrl+D | Deselect |
| Ctrl+Shift+I | Invert selection |
| Escape | Cancel / deselect |

### Layers
| Shortcut | Action |
|---|---|
| Ctrl+Shift+N | New layer |
| Ctrl+J | Duplicate layer |
| Ctrl+E | Merge down |
| Ctrl+Shift+E | Merge visible |
| Ctrl+Shift+Alt+E | Stamp visible (flatten copy) |
| [ | Move layer down |
| ] | Move layer up |

### Brush
| Shortcut | Action |
|---|---|
| [ | Decrease brush size |
| ] | Increase brush size |
| Shift+[ | Decrease hardness |
| Shift+] | Increase hardness |
| 1–9 | Set opacity 10%–90% |
| 0 | Set opacity 100% |
| X | Swap foreground/background |
| D | Reset to default colors |

### File
| Shortcut | Action |
|---|---|
| Ctrl+N | New document |
| Ctrl+O | Open file |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save as |
| Ctrl+Shift+Alt+S | Export as |
| Ctrl+W | Close document |

---

## 12. Performance Strategy

### GPU-First Rendering
All compositing, blend modes, and filters run as GLSL fragment shaders on the integrated GPU. The CPU (JS main thread) only orchestrates — it never touches individual pixels in a hot loop.

### Web Workers for CPU Paths
Operations that cannot run on the GPU (flood fill, histogram computation, file encode/decode) run in Web Workers on separate threads. The UI thread remains free and responsive.

### SharedArrayBuffer for Zero-Copy IPC
Pixel buffers are allocated as `SharedArrayBuffer` instances. Workers operate directly on the shared memory — no serialization, no copying. A layer's pixel data is physically the same memory whether accessed from the UI thread or a worker.

### Tile-Based Large Canvas Handling
Canvases larger than 4096×4096 are divided into 512×512 tiles. Only tiles in the current viewport are held in GPU memory as textures. Tiles outside the viewport are evicted to system memory. This allows editing very large documents (up to ~16000×16000) without exhausting VRAM on integrated graphics.

### Lazy Compositing
The compositor tracks a dirty region for each layer. When a tool modifies pixels, only the affected rectangle is marked dirty. The next render frame re-composites only dirty regions, not the entire canvas.

### Memory Budget
- Layer pixel buffers: allocated as `SharedArrayBuffer`, never copied
- Undo history: maximum 50 snapshots, each snapshot is a full `ArrayBuffer` copy of all layer pixels. When memory pressure is detected (via `performance.memory`), older history entries are dropped first
- Texture atlas: preloaded at startup, never evicted
- Sharp (Node process): file decoding happens in the main process and the decoded buffer is transferred to the renderer via IPC once, then Sharp releases its copy

---

## 13. Testing Strategy

### Unit Tests (Vitest)
- Color conversion utilities (round-trip accuracy)
- Blend mode math functions
- Flood fill algorithm (correctness, edge cases)
- Selection mask operations
- History stack (undo/redo correctness)
- File format utilities

### Component Tests (Vitest + React Testing Library)
- Tool buttons render correctly for each tool state
- Color picker emits correct values
- Layer panel reflects store state
- Dialogs open and close correctly
- Keyboard shortcuts trigger correct actions

### Integration Tests (Vitest)
- Brush tool modifies pixels correctly
- Fill tool fills correct region at various tolerances
- Undo/redo restores correct document state
- Layer blend mode produces correct composite
- File open → display → save round-trip

### End-to-End Tests (Playwright + Electron)
- App launches without error
- New document → draw → save → reopen workflow
- All tools activate via keyboard shortcuts
- Layer operations (add, delete, reorder, merge)
- Export to each supported format

### Performance Tests
- Brush stroke renders at 60fps on target hardware profile
- Fill operation completes in under 500ms on a 2000×2000 canvas
- Layer compositing stays under 16ms per frame for 20 layers
- App startup under 3 seconds

---

## 14. Distribution & Packaging

### Build Targets
| Platform | Format | Notes |
|---|---|---|
| Windows | `.exe` NSIS installer | Code signed, auto-updater compatible |
| Windows | `.msi` | Optional enterprise distribution format |
| macOS | `.dmg` | Code signed and notarized, Apple Silicon + Intel universal binary |
| Linux | `.AppImage` | Portable, no install required |
| Linux | `.deb` | Ubuntu/Debian package |
| Linux | `.rpm` | Fedora/RHEL package |

### electron-builder Configuration
- Universal macOS binary (ARM64 + x64 combined)
- Windows x64 and ARM64 separate builds
- Linux x64
- Auto-updater via GitHub Releases
- Code signing certificates configured per platform
- File association for `.mps`, `.png`, `.jpg`, `.webp`, `.bmp`, `.tiff`

### Bundle Size Targets
| Platform | Target installer size |
|---|---|
| Windows | < 180MB |
| macOS | < 200MB |
| Linux AppImage | < 180MB |

### CI/CD
- GitHub Actions workflow builds and tests on every pull request
- Release builds triggered by version tags
- Artifacts uploaded to GitHub Releases automatically
- Update server notified of new release for auto-updater

---

## 15. Future Considerations

These features are explicitly out of scope for the current roadmap but are worth noting for future planning:

**Plugin System** — A sandboxed JavaScript plugin API allowing third-party scripts to add tools, filters, and file format support. Similar to Photoshop's scripting and plugin architecture.

**Mobile Companion App** — A React Native app sharing business logic with the desktop version. Useful for quick edits and viewing on tablet/phone. The shared TypeScript types and utility functions are already structured to support this.

**AI-Powered Features** — Background removal, content-aware fill improvements, generative fill via API integration, object selection. These are best added as optional cloud-connected features with clear opt-in.

**Collaboration** — Real-time multiplayer editing via CRDTs (Conflict-free Replicated Data Types) and WebSocket. Document state is structured to make this addition feasible without architectural changes.

**WebAssembly Acceleration** — If specific operations prove too slow in pure TypeScript (complex convolutions, large canvas histogram computation), AssemblyScript modules can be dropped in with no architecture changes — the Web Worker interface remains identical, only the implementation changes.

**Camera RAW Support** — Integration with libraw via a compiled WASM module for reading RAW files from digital cameras (.CR2, .NEF, .ARW, etc.).

---

*Document version: 1.0 | Last updated: March 2026*
