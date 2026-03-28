---
source: electron-vite.org
library: electron-vite
package: electron-vite
topic: React + TypeScript scaffold setup
fetched: 2026-03-25T00:00:00Z
official_docs: https://electron-vite.org/guide/
---

# Electron + Vite + React + TypeScript Scaffold Setup

## Quick Start

electron-vite is a build tool for Electron that provides faster development with Vite.

### Requirements

- Node.js 20.19+, 22.12+
- Vite 5.0+

### Installation

```bash
npm create @quick-start/electron@latest
```

### Scaffolding Options

When prompted, select:

```
✔ Project name: … <electron-app>
✔ Select a framework: › react
✔ Add TypeScript? … Yes
✔ Add Electron updater plugin? … No / Yes
✔ Enable Electron download mirror proxy? … No / Yes
```

Or via command line:

```bash
npm create @quick-start/electron@latest my-app -- --template react-ts
```

### Available Templates

| Framework | JavaScript | TypeScript |
| --------- | ---------- | ---------- |
| React     | react      | react-ts   |
| Vue       | vue        | vue-ts     |
| Svelte    | svelte     | svelte-ts  |
| Vanilla   | vanilla    | vanilla-ts |

## Project Structure

```
electron-app/
├── electron.vite.config.ts    # Main config
├── src/
│   ├── main/                  # Main process
│   │   └── index.ts
│   ├── preload/               # Preload scripts
│   │   └── index.ts
│   └── renderer/              # React app
│       ├── src/
│       │   ├── App.tsx
│       │   └── main.tsx
│       └── index.html
├── package.json
└── tsconfig.json
```

## electron.vite.config.ts

```typescript
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/renderer/index.html"),
        },
      },
    },
    plugins: [react()],
  },
});
```

## package.json Configuration

```json
{
  "name": "electron-app",
  "version": "1.0.0",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview"
  }
}
```

## TypeScript Configuration

Add to your `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "types": ["electron-vite/node"]
  }
}
```

Or add reference in your main file:

```typescript
/// <reference types="electron-vite/node" />
```

## Running the App

```bash
npm run dev      # Development mode with HMR
npm run build    # Production build
npm run preview  # Preview production build
```

## Key Features

- **HMR** for renderer processes
- **Hot reloading** for main process and preload scripts
- **Context isolation** enabled by default
- **Preload scripts** for secure IPC communication
