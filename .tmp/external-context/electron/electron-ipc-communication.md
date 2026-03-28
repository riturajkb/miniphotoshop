---
source: electronjs.org
library: Electron
package: electron
topic: IPC communication patterns
fetched: 2026-03-25T00:00:00Z
official_docs: https://www.electronjs.org/docs/latest/tutorial/ipc
---

# IPC Communication Patterns in Electron

IPC (Inter-Process Communication) is essential for communicating between main and renderer processes.

## Core Concept

Processes communicate via channels using `ipcMain` (main process) and `ipcRenderer` (renderer process). Channels are arbitrary and bidirectional.

## Pattern 1: One-Way (Renderer → Main)

### Main Process

```javascript
const { app, BrowserWindow, ipcMain } = require("electron/main");
const path = require("node:path");

function handleSetTitle(event, title) {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  win.setTitle(title);
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  ipcMain.on("set-title", handleSetTitle);
  createWindow();
});
```

### Preload Script

```javascript
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setTitle: (title) => ipcRenderer.send("set-title", title),
});
```

### Renderer Process

```javascript
const titleInput = document.getElementById("title");
const setButton = document.getElementById("btn");

setButton.addEventListener("click", () => {
  const title = titleInput.value;
  window.electronAPI.setTitle(title);
});
```

## Pattern 2: Two-Way (Renderer ↔ Main) - RECOMMENDED

### Main Process

```javascript
const { app, BrowserWindow, ipcMain, dialog } = require("electron/main");

async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog();
  if (!canceled) {
    return filePaths[0];
  }
}

app.whenReady().then(() => {
  ipcMain.handle("dialog:openFile", handleFileOpen);
  createWindow();
});
```

### Preload Script

```javascript
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
});
```

### Renderer Process

```javascript
const btn = document.getElementById("btn");
const filePathElement = document.getElementById("filePath");

btn.addEventListener("click", async () => {
  const filePath = await window.electronAPI.openFile();
  filePathElement.innerText = filePath;
});
```

## Pattern 3: Main → Renderer

### Main Process

```javascript
const { app, BrowserWindow, Menu } = require("electron/main");

function createWindow() {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        {
          click: () => mainWindow.webContents.send("update-counter", 1),
          label: "Increment",
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}
```

### Preload Script

```javascript
contextBridge.exposeInMainWorld("electronAPI", {
  onUpdateCounter: (callback) => {
    ipcRenderer.on("update-counter", (_event, value) => callback(value));
  },
});
```

### Renderer Process

```javascript
const counter = document.getElementById("counter");

window.electronAPI.onUpdateCounter((value) => {
  const oldValue = Number(counter.innerText);
  const newValue = oldValue + value;
  counter.innerText = newValue.toString();
});
```

## Pattern 4: Renderer ↔ Renderer

No direct method exists. Options:

1. Use main process as message broker
2. Use MessagePort from main process to both renderers

## TypeScript Types

Main process types:

```typescript
const { app } = require("electron/main");
const { ipcMain } = require("electron");
```

Renderer process types:

```typescript
const { ipcRenderer } = require("electron/renderer");
const { contextBridge } = require("electron");
```

## Security Best Practices

❌ UNSAFE - Exposes full API:

```javascript
contextBridge.exposeInMainWorld("myAPI", {
  send: ipcRenderer.send, // BAD!
});
```

✅ SAFE - One method per IPC message:

```javascript
contextBridge.exposeInMainWorld("myAPI", {
  loadPreferences: () => ipcRenderer.invoke("load-prefs"),
});
```

## Object Serialization

IPC uses HTML Structured Clone Algorithm. Not serializable:

- DOM objects (Element, Location)
- Node.js objects backed by C++ (process.env, Stream)
- Electron objects backed by C++ (WebContents, BrowserWindow)
