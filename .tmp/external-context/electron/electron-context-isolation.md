---
source: electronjs.org
library: Electron
package: electron
topic: Context isolation and preload scripts
fetched: 2026-03-25T00:00:00Z
official_docs: https://www.electronjs.org/docs/latest/tutorial/context-isolation
---

# Context Isolation and Preload Scripts

## What is Context Isolation?

Context Isolation ensures preload scripts and Electron internals run in a separate context from your loaded website. This is a **security feature enabled by default since Electron 12**.

With context isolation enabled:

- Preload script's `window` object is **different** from renderer's `window`
- Website cannot access Electron internals or preload APIs

## Why It Matters

```javascript
// preload.js (with contextIsolation: true)
window.hello = "wave";

// renderer.js - website cannot access this
console.log(window.hello); // undefined
```

## Preload Scripts

Preload scripts run in renderer process before web content loads and have access to Node.js APIs.

### Attaching Preload to BrowserWindow

```javascript
const { BrowserWindow } = require("electron");

const win = new BrowserWindow({
  webPreferences: {
    preload: "path/to/preload.js",
  },
});
```

## Using contextBridge

The `contextBridge` module safely exposes APIs from preload to renderer:

### Basic Usage

```javascript
// preload.js
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("myAPI", {
  desktop: true,
  doAThing: () => {
    /* ... */
  },
});

// renderer.js - now accessible
console.log(window.myAPI.desktop); // true
```

## Complete Preload Pattern

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Invoke pattern for two-way communication
  openFile: () => ipcRenderer.invoke("dialog:openFile"),

  // Send pattern for one-way communication
  setTitle: (title) => ipcRenderer.send("set-title", title),

  // Receive pattern for main-to-renderer
  onUpdateCounter: (callback) => {
    ipcRenderer.on("update-counter", (_event, value) => callback(value));
  },
});
```

## Security Considerations

### ❌ UNSAFE: Direct API exposure

```javascript
// BAD - allows any IPC message
contextBridge.exposeInMainWorld("myAPI", {
  send: ipcRenderer.send,
});
```

### ✅ SAFE: Specific methods

```javascript
// GOOD - limited exposure
contextBridge.exposeInMainWorld("myAPI", {
  loadPreferences: () => ipcRenderer.invoke("load-prefs"),
});
```

## TypeScript Integration

### preload.ts

```typescript
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  loadPreferences: () => ipcRenderer.invoke("load-prefs"),
});
```

### window.d.ts

```typescript
export interface IElectronAPI {
  loadPreferences: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
```

### renderer.ts

```typescript
// TypeScript now knows about electronAPI
window.electronAPI.loadPreferences();
```

## WebPreferences Configuration

```javascript
const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true, // Default since Electron 12
    nodeIntegration: false, // Recommended: false
    sandbox: true, // Default since Electron 20
  },
});
```

## Process Model Summary

| Component        | Environment        | Access                                |
| ---------------- | ------------------ | ------------------------------------- |
| Main Process     | Node.js            | Full Electron APIs, native modules    |
| Renderer Process | Browser (Chromium) | Web APIs only                         |
| Preload Script   | Isolated context   | Node APIs + exposed via contextBridge |

## Process-Specific Type Aliases (TypeScript)

```javascript
// Main process types
const { app } = require("electron/main");

// Renderer process types
const { ipcRenderer } = require("electron/renderer");

// Common types (both processes)
const { shell } = require("electron/common");
```
