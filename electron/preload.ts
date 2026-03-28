import { contextBridge, ipcRenderer } from "electron";

/**
 * Exposes a secure, typed API to the renderer process.
 * All main process communication goes through this bridge.
 */
const electronAPI = {
  // File operations
  openFile: () => ipcRenderer.invoke("dialog:open-file"),
  saveFile: (defaultPath?: string) =>
    ipcRenderer.invoke("dialog:save-file", defaultPath),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window:maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),

  // Menu event listeners
  onMenuNew: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("menu:new", handler);
    return () => ipcRenderer.removeListener("menu:new", handler);
  },
  onMenuSave: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("menu:save", handler);
    return () => ipcRenderer.removeListener("menu:save", handler);
  },
  onMenuSaveAs: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("menu:save-as", handler);
    return () => ipcRenderer.removeListener("menu:save-as", handler);
  },
  onMenuUndo: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("menu:undo", handler);
    return () => ipcRenderer.removeListener("menu:undo", handler);
  },
  onMenuRedo: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("menu:redo", handler);
    return () => ipcRenderer.removeListener("menu:redo", handler);
  },
  onMenuSelectAll: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("menu:select-all", handler);
    return () => ipcRenderer.removeListener("menu:select-all", handler);
  },
  onMenuDeselect: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("menu:deselect", handler);
    return () => ipcRenderer.removeListener("menu:deselect", handler);
  },
  onFileOpen: (callback: (filePath: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, filePath: string) =>
      callback(filePath);
    ipcRenderer.on("file:open", handler);
    return () => ipcRenderer.removeListener("file:open", handler);
  },
  onMenuImageSize: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("menu:image-size", handler);
    return () => ipcRenderer.removeListener("menu:image-size", handler);
  },
  onMenuCanvasSize: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("menu:canvas-size", handler);
    return () => ipcRenderer.removeListener("menu:canvas-size", handler);
  },
  onMenuRotate: (callback: (degrees: number) => void) => {
    const handler = (_: Electron.IpcRendererEvent, degrees: number) =>
      callback(degrees);
    ipcRenderer.on("menu:rotate", handler);
    return () => ipcRenderer.removeListener("menu:rotate", handler);
  },
  onMenuFlip: (callback: (direction: "horizontal" | "vertical") => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      direction: "horizontal" | "vertical",
    ) => callback(direction);
    ipcRenderer.on("menu:flip", handler);
    return () => ipcRenderer.removeListener("menu:flip", handler);
  },
  onLayerNew: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("layer:new", handler);
    return () => ipcRenderer.removeListener("layer:new", handler);
  },
  onLayerDuplicate: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("layer:duplicate", handler);
    return () => ipcRenderer.removeListener("layer:duplicate", handler);
  },
  onLayerDelete: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("layer:delete", handler);
    return () => ipcRenderer.removeListener("layer:delete", handler);
  },
  onLayerMergeDown: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("layer:merge-down", handler);
    return () => ipcRenderer.removeListener("layer:merge-down", handler);
  },
  onLayerFlatten: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("layer:flatten", handler);
    return () => ipcRenderer.removeListener("layer:flatten", handler);
  },
  onFilterBlur: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("filter:blur", handler);
    return () => ipcRenderer.removeListener("filter:blur", handler);
  },
  onFilterSharpen: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("filter:sharpen", handler);
    return () => ipcRenderer.removeListener("filter:sharpen", handler);
  },
  onFilterBrightnessContrast: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("filter:brightness-contrast", handler);
    return () =>
      ipcRenderer.removeListener("filter:brightness-contrast", handler);
  },
  onFilterHueSaturation: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("filter:hue-saturation", handler);
    return () => ipcRenderer.removeListener("filter:hue-saturation", handler);
  },
  onViewZoomIn: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("view:zoom-in", handler);
    return () => ipcRenderer.removeListener("view:zoom-in", handler);
  },
  onViewZoomOut: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("view:zoom-out", handler);
    return () => ipcRenderer.removeListener("view:zoom-out", handler);
  },
  onViewFit: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("view:fit", handler);
    return () => ipcRenderer.removeListener("view:fit", handler);
  },
  onViewActual: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("view:actual", handler);
    return () => ipcRenderer.removeListener("view:actual", handler);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Type definition for the exposed API
export type ElectronAPI = typeof electronAPI;
