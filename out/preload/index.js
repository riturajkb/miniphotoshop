"use strict";
const electron = require("electron");
const electronAPI = {
  // File operations
  openFile: () => electron.ipcRenderer.invoke("dialog:open-file"),
  saveFile: (defaultPath) => electron.ipcRenderer.invoke("dialog:save-file", defaultPath),
  // Window controls
  minimizeWindow: () => electron.ipcRenderer.invoke("window:minimize"),
  maximizeWindow: () => electron.ipcRenderer.invoke("window:maximize"),
  closeWindow: () => electron.ipcRenderer.invoke("window:close"),
  isMaximized: () => electron.ipcRenderer.invoke("window:is-maximized"),
  // Menu event listeners
  onMenuNew: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("menu:new", handler);
    return () => electron.ipcRenderer.removeListener("menu:new", handler);
  },
  onMenuSave: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("menu:save", handler);
    return () => electron.ipcRenderer.removeListener("menu:save", handler);
  },
  onMenuSaveAs: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("menu:save-as", handler);
    return () => electron.ipcRenderer.removeListener("menu:save-as", handler);
  },
  onMenuUndo: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("menu:undo", handler);
    return () => electron.ipcRenderer.removeListener("menu:undo", handler);
  },
  onMenuRedo: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("menu:redo", handler);
    return () => electron.ipcRenderer.removeListener("menu:redo", handler);
  },
  onMenuSelectAll: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("menu:select-all", handler);
    return () => electron.ipcRenderer.removeListener("menu:select-all", handler);
  },
  onMenuDeselect: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("menu:deselect", handler);
    return () => electron.ipcRenderer.removeListener("menu:deselect", handler);
  },
  onFileOpen: (callback) => {
    const handler = (_, filePath) => callback(filePath);
    electron.ipcRenderer.on("file:open", handler);
    return () => electron.ipcRenderer.removeListener("file:open", handler);
  },
  onMenuImageSize: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("menu:image-size", handler);
    return () => electron.ipcRenderer.removeListener("menu:image-size", handler);
  },
  onMenuCanvasSize: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("menu:canvas-size", handler);
    return () => electron.ipcRenderer.removeListener("menu:canvas-size", handler);
  },
  onMenuRotate: (callback) => {
    const handler = (_, degrees) => callback(degrees);
    electron.ipcRenderer.on("menu:rotate", handler);
    return () => electron.ipcRenderer.removeListener("menu:rotate", handler);
  },
  onMenuFlip: (callback) => {
    const handler = (_, direction) => callback(direction);
    electron.ipcRenderer.on("menu:flip", handler);
    return () => electron.ipcRenderer.removeListener("menu:flip", handler);
  },
  onLayerNew: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("layer:new", handler);
    return () => electron.ipcRenderer.removeListener("layer:new", handler);
  },
  onLayerDuplicate: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("layer:duplicate", handler);
    return () => electron.ipcRenderer.removeListener("layer:duplicate", handler);
  },
  onLayerDelete: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("layer:delete", handler);
    return () => electron.ipcRenderer.removeListener("layer:delete", handler);
  },
  onLayerMergeDown: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("layer:merge-down", handler);
    return () => electron.ipcRenderer.removeListener("layer:merge-down", handler);
  },
  onLayerFlatten: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("layer:flatten", handler);
    return () => electron.ipcRenderer.removeListener("layer:flatten", handler);
  },
  onFilterBlur: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("filter:blur", handler);
    return () => electron.ipcRenderer.removeListener("filter:blur", handler);
  },
  onFilterSharpen: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("filter:sharpen", handler);
    return () => electron.ipcRenderer.removeListener("filter:sharpen", handler);
  },
  onFilterBrightnessContrast: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("filter:brightness-contrast", handler);
    return () => electron.ipcRenderer.removeListener("filter:brightness-contrast", handler);
  },
  onFilterHueSaturation: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("filter:hue-saturation", handler);
    return () => electron.ipcRenderer.removeListener("filter:hue-saturation", handler);
  },
  onViewZoomIn: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("view:zoom-in", handler);
    return () => electron.ipcRenderer.removeListener("view:zoom-in", handler);
  },
  onViewZoomOut: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("view:zoom-out", handler);
    return () => electron.ipcRenderer.removeListener("view:zoom-out", handler);
  },
  onViewFit: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("view:fit", handler);
    return () => electron.ipcRenderer.removeListener("view:fit", handler);
  },
  onViewActual: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("view:actual", handler);
    return () => electron.ipcRenderer.removeListener("view:actual", handler);
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
