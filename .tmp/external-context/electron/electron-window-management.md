---
source: electronjs.org
library: Electron
package: electron
topic: Window management best practices
fetched: 2026-03-25T00:00:00Z
official_docs: https://www.electronjs.org/docs/latest/api/browser-window
---

# Window Management Best Practices

## Creating a BrowserWindow

```javascript
const { BrowserWindow } = require("electron");

const win = new BrowserWindow({
  width: 1200,
  height: 800,
  minWidth: 400,
  minHeight: 300,
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
  },
});

win.loadFile("index.html");
```

## Avoiding Visual Flash

### Method 1: ready-to-show Event (Recommended)

```javascript
const win = new BrowserWindow({ show: false });

win.once("ready-to-show", () => {
  win.show();
});
```

### Method 2: Background Color

```javascript
const win = new BrowserWindow({
  backgroundColor: "#2e2c29", // Match your app's background
});
```

## Parent and Child Windows

```javascript
// Create child window
const child = new BrowserWindow({
  parent: topWindow, // Child always shows on top
  modal: true, // Disables parent window
  show: false,
});

child.loadURL("https://github.com");
child.once("ready-to-show", () => {
  child.show();
});
```

## Window State Management

```javascript
// Get all windows
const allWindows = BrowserWindow.getAllWindows();

// Get focused window
const focused = BrowserWindow.getFocusedWindow();

// Get window from WebContents
const win = BrowserWindow.fromWebContents(webContents);

// Get window by ID
const win = BrowserWindow.fromId(id);
```

## Common Instance Methods

```javascript
// Show/Hide
win.show();
win.hide();
win.isVisible();

// Focus/Blur
win.focus();
win.blur();
win.isFocused();

// Maximize/Minimize/Restore
win.maximize();
win.unmaximize();
win.minimize();
win.restore();
win.isMaximized();
win.isMinimized();
win.isNormal();

// Fullscreen
win.setFullScreen(true);
win.isFullScreen();

// Close
win.close(); // Allows cancel via beforeunload
win.destroy(); // Force close immediately

// Bounds
win.setBounds({ x: 0, y: 0, width: 800, height: 600 });
win.getBounds();

// Center
win.center();

// Title
win.setTitle("New Title");
win.title; // Read-only
```

## Application Lifecycle

```javascript
const { app } = require("electron");

// Quit when all windows are closed (Windows/Linux)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Re-create window on macOS
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

## Window Events

```javascript
win.on("close", (event) => {
  // Before window closes
  event.preventDefault(); // Cancels close
});

win.on("closed", () => {
  // Window is destroyed
});

win.on("ready-to-show", () => {
  // Window is rendered and can be shown
});

win.on("focus", () => {
  /* ... */
});
win.on("blur", () => {
  /* ... */
});

win.on("maximize", () => {
  /* ... */
});
win.on("unmaximize", () => {
  /* ... */
});
win.on("minimize", () => {
  /* ... */
});
win.on("restore", () => {
  /* ... */
});

win.on("resize", () => {
  /* ... */
});
win.on("move", () => {
  /* ... */
});
```

## BrowserWindowConstructorOptions

```javascript
const win = new BrowserWindow({
  // Size
  width: 800,
  height: 600,
  minWidth: 400,
  minHeight: 300,
  maxWidth: 1200,
  maxHeight: 900,

  // Position
  x: 100,
  y: 100,

  // Behavior
  resizable: true,
  movable: true,
  minimizable: true,
  maximizable: true,
  closable: true,

  // Appearance
  frame: true, // false = frameless
  titleBarStyle: "hidden",
  transparent: false,
  backgroundColor: "#ffffff",

  // Window type
  parent: parentWindow, // For child windows
  modal: false, // For modal dialogs

  // Auto-show
  show: false, // Use with ready-to-show

  // Always on top
  alwaysOnTop: false,

  // Kiosk mode
  kiosk: false,

  // WebPreferences
  webPreferences: {
    preload: "preload.js",
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true, // Default since Electron 20
  },
});
```

## Multi-Window Management

```javascript
// Store windows
const windows = new Set();

function createWindow() {
  const win = new BrowserWindow();
  windows.add(win);

  win.on("closed", () => {
    windows.delete(win);
  });

  return win;
}

// Close all windows
function closeAllWindows() {
  windows.forEach((win) => win.close());
}
```

## Security Best Practices

1. **Enable context isolation**: `contextIsolation: true`
2. **Disable node integration**: `nodeIntegration: false`
3. **Use sandbox**: `sandbox: true`
4. **Validate IPC inputs**: Never trust renderer input
5. **Set Content Security Policy**:
   ```html
   <meta
     http-equiv="Content-Security-Policy"
     content="default-src 'self'; script-src 'self'"
   />
   ```

## Page Visibility

The Page Visibility API works across platforms:

- **All platforms**: Tracks hidden/minimized state
- **macOS**: Also tracks window occlusion
- **Linux**: Limited visibility tracking

```javascript
// Pause expensive operations when hidden
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    pauseExpensiveWork();
  }
});
```
