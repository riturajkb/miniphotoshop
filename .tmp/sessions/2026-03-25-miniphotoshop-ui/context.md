# Task Context: MiniPhotoshop Phase 1 — UI Build

Session ID: 2026-03-25-miniphotoshop-ui
Created: 2026-03-25T19:00:00
Status: in_progress

## Current Request

Build Phase 1 UI for MiniPhotoshop — a professional desktop image editor. Start with:

1. Project scaffold (Electron + Vite + React + TypeScript)
2. Complete dark Photoshop-like UI shell with all panels
3. PixiJS canvas mounted in the viewport

## Context Files (Standards to Follow)

- `~/.opencode/context/core/standards/code-quality.md` — modular, functional code patterns
- `~/.opencode/context/ui/web/design-systems.md` — dark mode design tokens, OKLCH colors
- `~/.opencode/context/ui/web/ui-styling-standards.md` — Tailwind CSS patterns
- `~/.opencode/context/ui/web/react-patterns.md` — React component patterns
- `~/.opencode/context/ui/web/animation-basics.md` — motion guidelines

## External Docs Fetched

- `.tmp/external-context/electron/` — Electron + electron-vite + React scaffold docs, IPC patterns, context isolation, window management

## Components to Build

1. **Project Scaffold** — electron-vite + React 18 + TypeScript + Tailwind CSS 4 + shadcn/ui
2. **AppShell** — Main layout orchestrating all panels
3. **MenuBar** — File/Edit/Image/Layer/Filter/View menus
4. **TopBar** — Contextual tool options strip
5. **ToolsPanel** — Left sidebar with tool icons
6. **CanvasArea** — Scrollable viewport with checkerboard transparency bg
7. **LayersPanel** — Right panel layer stack
8. **PropertiesPanel** — Right panel for adjustments
9. **HistoryPanel** — Undo history visual list
10. **StatusBar** — Zoom level, cursor coords, document info

## Design Tokens (Dark Theme — from PLAN.md Section 7)

```css
--color-bg-app: #1a1a1a --color-bg-panel: #1e1e1e --color-bg-surface: #2a2a2a
  --color-bg-elevated: #333333 --color-border: #3a3a3a
  --color-border-focus: #4a9eff --color-text: #cccccc
  --color-text-muted: #888888 --color-accent: #4a9eff
  --color-accent-hover: #6ab0ff --color-danger: #ff4a4a --color-success: #4aff88;
```

Typography: System font stack for UI, JetBrains Mono for coordinates/inputs
Spacing: 4px grid, dense panels (4px, 8px internal spacing)

## Constraints

- Electron with context isolation enabled
- PixiJS 8 for WebGL canvas (fallback Canvas2D)
- Zustand for state management
- Tailwind CSS 4 for styling
- shadcn/ui + Radix primitives
- Framer Motion for animations
- Phosphor Icons for tool icons
- All code in TypeScript

## Exit Criteria

- [ ] Project scaffolds and builds without errors
- [ ] All 10 UI components render in AppShell
- [ ] Dark theme matches PLAN.md color tokens
- [ ] PixiJS canvas mounts and displays checkerboard
- [ ] ToolsPanel shows all tool icons with keyboard shortcuts
- [ ] StatusBar shows zoom level and cursor position
- [ ] Panel layout matches Photoshop layout from PLAN.md
