"use strict";
const electron = require("electron");
const path = require("path");
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#1a1a1a",
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  const menuTemplate = buildMenuTemplate();
  const menu = electron.Menu.buildFromTemplate(menuTemplate);
  electron.Menu.setApplicationMenu(menu);
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function buildMenuTemplate() {
  return [
    {
      label: "File",
      submenu: [
        {
          label: "New",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow?.webContents.send("menu:new")
        },
        {
          label: "Open...",
          accelerator: "CmdOrCtrl+O",
          click: () => handleOpenFile()
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow?.webContents.send("menu:save")
        },
        {
          label: "Save As...",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => mainWindow?.webContents.send("menu:save-as")
        },
        { type: "separator" },
        {
          label: "Export...",
          accelerator: "CmdOrCtrl+Shift+Alt+S",
          click: () => mainWindow?.webContents.send("menu:export")
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          click: () => mainWindow?.webContents.send("menu:undo")
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Shift+Z",
          click: () => mainWindow?.webContents.send("menu:redo")
        },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { type: "separator" },
        {
          label: "Select All",
          accelerator: "CmdOrCtrl+A",
          click: () => mainWindow?.webContents.send("menu:select-all")
        },
        {
          label: "Deselect",
          accelerator: "CmdOrCtrl+D",
          click: () => mainWindow?.webContents.send("menu:deselect")
        }
      ]
    },
    {
      label: "Image",
      submenu: [
        {
          label: "Image Size...",
          click: () => mainWindow?.webContents.send("menu:image-size")
        },
        {
          label: "Canvas Size...",
          click: () => mainWindow?.webContents.send("menu:canvas-size")
        },
        { type: "separator" },
        {
          label: "Rotate 180°",
          click: () => mainWindow?.webContents.send("menu:rotate", 180)
        },
        {
          label: "Rotate 90° CW",
          click: () => mainWindow?.webContents.send("menu:rotate", 90)
        },
        {
          label: "Rotate 90° CCW",
          click: () => mainWindow?.webContents.send("menu:rotate", -90)
        },
        { type: "separator" },
        {
          label: "Flip Horizontal",
          click: () => mainWindow?.webContents.send("menu:flip", "horizontal")
        },
        {
          label: "Flip Vertical",
          click: () => mainWindow?.webContents.send("menu:flip", "vertical")
        }
      ]
    },
    {
      label: "Layer",
      submenu: [
        {
          label: "New Layer",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => mainWindow?.webContents.send("layer:new")
        },
        {
          label: "Duplicate Layer",
          accelerator: "CmdOrCtrl+J",
          click: () => mainWindow?.webContents.send("layer:duplicate")
        },
        {
          label: "Delete Layer",
          click: () => mainWindow?.webContents.send("layer:delete")
        },
        { type: "separator" },
        {
          label: "Merge Down",
          accelerator: "CmdOrCtrl+E",
          click: () => mainWindow?.webContents.send("layer:merge-down")
        },
        {
          label: "Flatten Image",
          click: () => mainWindow?.webContents.send("layer:flatten")
        }
      ]
    },
    {
      label: "Filter",
      submenu: [
        {
          label: "Gaussian Blur...",
          click: () => mainWindow?.webContents.send("filter:blur")
        },
        {
          label: "Sharpen...",
          click: () => mainWindow?.webContents.send("filter:sharpen")
        },
        { type: "separator" },
        {
          label: "Brightness/Contrast...",
          click: () => mainWindow?.webContents.send("filter:brightness-contrast")
        },
        {
          label: "Hue/Saturation...",
          click: () => mainWindow?.webContents.send("filter:hue-saturation")
        }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+=",
          click: () => mainWindow?.webContents.send("view:zoom-in")
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => mainWindow?.webContents.send("view:zoom-out")
        },
        {
          label: "Fit to Window",
          accelerator: "CmdOrCtrl+0",
          click: () => mainWindow?.webContents.send("view:fit")
        },
        {
          label: "Actual Size",
          accelerator: "CmdOrCtrl+1",
          click: () => mainWindow?.webContents.send("view:actual")
        },
        { type: "separator" },
        { role: "togglefullscreen" },
        { type: "separator" },
        { role: "toggleDevTools" }
      ]
    },
    {
      label: "Help",
      submenu: [
        { label: "About MiniPhotoshop", click: () => showAboutDialog() }
      ]
    }
  ];
}
async function handleOpenFile() {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "bmp", "webp", "tiff", "gif"]
      },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow?.webContents.send("file:open", result.filePaths[0]);
  }
}
function showAboutDialog() {
  electron.dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "About MiniPhotoshop",
    message: "MiniPhotoshop",
    detail: "Version 1.0.0\nA cross-platform desktop image editor."
  });
}
electron.ipcMain.handle("dialog:open-file", async () => {
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "bmp", "webp", "tiff", "gif"]
      }
    ]
  });
  return result;
});
electron.ipcMain.handle("dialog:save-file", async (_, defaultPath) => {
  const result = await electron.dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: [
      { name: "PNG Image", extensions: ["png"] },
      { name: "JPEG Image", extensions: ["jpg", "jpeg"] },
      { name: "WebP Image", extensions: ["webp"] }
    ]
  });
  return result;
});
electron.ipcMain.handle("window:minimize", () => {
  mainWindow?.minimize();
});
electron.ipcMain.handle("window:maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
electron.ipcMain.handle("window:close", () => {
  mainWindow?.close();
});
electron.ipcMain.handle("window:is-maximized", () => {
  return mainWindow?.isMaximized() ?? false;
});
electron.app.whenReady().then(() => {
  electron.app.setAppUserModelId("com.miniphotoshop.app");
  electron.app.on("browser-window-created", (_, window) => {
    if (process.env.NODE_ENV !== "production") {
      window.webContents.on("before-input-event", () => {
      });
    }
  });
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
