import { useState, useCallback, useRef, useEffect } from "react";
import { Tool, type Layer } from "../../types/editor";
import {
  useDocumentStore,
  createDefaultDocument,
} from "../../store/documentStore";
import { useEditorStore } from "../../store/editorStore";

const PRESETS = [
  { label: "800×600", w: 800, h: 600 },
  { label: "1280×720", w: 1280, h: 720 },
  { label: "1920×1080", w: 1920, h: 1080 },
  { label: "1080×1080", w: 1080, h: 1080 },
  { label: "2560×1440", w: 2560, h: 1440 },
  { label: "3840×2160", w: 3840, h: 2160 },
];

interface MenuBarProps {
  onOpenAppearance: () => void;
}

type ElectronAPI = {
  onMenuNew?: (callback: () => void) => () => void;
  onMenuUndo?: (callback: () => void) => () => void;
  onMenuRedo?: (callback: () => void) => () => void;
  onFileOpen?: (callback: (filePath: string) => void) => () => void;
};

function createLayerWithPixels(
  id: string,
  name: string,
  pixels: Uint8ClampedArray,
  transformSource: Layer["transformSource"] = null,
): Layer {
  return {
    id,
    name,
    visible: true,
    locked: false,
    opacity: 100,
    blendMode: "normal",
    pixels,
    transformSource,
  };
}

function createFilledLayer(
  id: string,
  name: string,
  width: number,
  height: number,
  color: { r: number; g: number; b: number; a: number },
): Layer {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = color.r;
    pixels[i + 1] = color.g;
    pixels[i + 2] = color.b;
    pixels[i + 3] = color.a;
  }
  return createLayerWithPixels(id, name, pixels);
}

export function MenuBar({ onOpenAppearance }: MenuBarProps) {
  const { setDocument, document: doc, addLayer, setActiveLayer, undo, redo, undoStack, redoStack } = useDocumentStore();
  const { setZoom, setPan, setTool, rendererRef } = useEditorStore();

  const [showNewModal, setShowNewModal] = useState(false);
  const [newWidth, setNewWidth] = useState(800);
  const [newHeight, setNewHeight] = useState(600);
  const [activePreset, setActivePreset] = useState<string | null>("800×600");

  // Menu dropdown states
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const editMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // JPEG quality dialog
  const [showQualityDialog, setShowQualityDialog] = useState(false);
  const [jpegQuality, setJpegQuality] = useState(90);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
        setFileMenuOpen(false);
        setExportMenuOpen(false);
      }
      if (editMenuRef.current && !editMenuRef.current.contains(event.target as Node)) {
        setEditMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNewFile = useCallback(() => {
    setShowNewModal(true);
  }, []);

  const handlePreset = useCallback((label: string, w: number, h: number) => {
    setActivePreset(label);
    setNewWidth(w);
    setNewHeight(h);
  }, []);

  const syncEditorState = useCallback(() => {
    if (!rendererRef) return;
    rendererRef.forceRender();
    setZoom(rendererRef.getZoom() * 100);
    setPan(rendererRef.getPan());
  }, [rendererRef, setPan, setZoom]);

  const applyDocumentState = useCallback(
    (nextDoc: ReturnType<typeof createDefaultDocument>, activeLayerId: string) => {
      if (rendererRef) {
        rendererRef.resizeDocument(nextDoc.width, nextDoc.height);
        rendererRef.syncDocument(nextDoc, activeLayerId);
      }
      setDocument(nextDoc);
      setActiveLayer(activeLayerId);
      syncEditorState();
    },
    [rendererRef, setActiveLayer, setDocument, syncEditorState],
  );

  const confirmNewFile = useCallback(() => {
    setShowNewModal(false);

    const width = Math.max(1, Math.min(16384, newWidth));
    const height = Math.max(1, Math.min(16384, newHeight));

    const newDoc = createDefaultDocument(width, height, {
      r: 255,
      g: 255,
      b: 255,
      a: 0,
    });
    newDoc.layers.push(
      createFilledLayer("layer-bg", "Background", width, height, {
        r: 255,
        g: 255,
        b: 255,
        a: 255,
      }),
    );
    applyDocumentState(newDoc, "layer-bg");
  }, [applyDocumentState, newHeight, newWidth]);

  const openImageAsDocument = useCallback(
    (img: HTMLImageElement, fileName: string) => {
      const nextDoc = createDefaultDocument(img.width, img.height, {
        r: 255,
        g: 255,
        b: 255,
        a: 0,
      });
      nextDoc.layers.push(
        createFilledLayer("layer-bg", "Background", img.width, img.height, {
          r: 255,
          g: 255,
          b: 255,
          a: 255,
        }),
      );

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(img, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);

      const imageLayerId = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      nextDoc.layers.push(
        createLayerWithPixels(
          imageLayerId,
          fileName,
          new Uint8ClampedArray(imageData.data),
        ),
      );

      applyDocumentState(nextDoc, imageLayerId);
    },
    [applyDocumentState],
  );

  // Import Image handler
  const handleImportImage = useCallback(() => {
    fileInputRef.current?.click();
    setFileMenuOpen(false);
  }, []);

  const openImageFromPath = useCallback(
    (filePath: string) => {
      const img = new Image();
      const fileName = filePath.split(/[\\/]/).pop() || "image";

      img.onload = () => openImageAsDocument(img, fileName);
      img.onerror = () => console.error(`Failed to open image: ${filePath}`);
      img.src = encodeURI(`file://${filePath}`);
    },
    [openImageAsDocument],
  );

  // Handle file selection for import
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !rendererRef || !doc) return;

    const objectURL = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const fileName = file.name;
      const currentDoc = useDocumentStore.getState().document;
      if (!currentDoc) {
        URL.revokeObjectURL(objectURL);
        return;
      }

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(img, 0, 0);

      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const docWidth = currentDoc.width;
      const docHeight = currentDoc.height;
      const nextLayerId = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const layerStack = rendererRef.getLayerStack();
      const newLayer = layerStack.createLayer(fileName, undefined, nextLayerId);

      const offsetX = Math.floor((docWidth - img.width) / 2);
      const offsetY = Math.floor((docHeight - img.height) / 2);
      const docPixelBuffer = new Uint8ClampedArray(docWidth * docHeight * 4);

      for (let y = 0; y < img.height; y++) {
        const destY = y + offsetY;
        if (destY < 0 || destY >= docHeight) continue;
        for (let x = 0; x < img.width; x++) {
          const destX = x + offsetX;
          if (destX < 0 || destX >= docWidth) continue;

          const srcIdx = (y * img.width + x) * 4;
          const destIdx = (destY * docWidth + destX) * 4;

          docPixelBuffer[destIdx] = imageData.data[srcIdx];
          docPixelBuffer[destIdx + 1] = imageData.data[srcIdx + 1];
          docPixelBuffer[destIdx + 2] = imageData.data[srcIdx + 2];
          docPixelBuffer[destIdx + 3] = imageData.data[srcIdx + 3];
        }
      }

      newLayer.pixelBuffer = docPixelBuffer;
      newLayer.width = docWidth;
      newLayer.height = docHeight;
      newLayer.dirty = true;

      const storeLayer = createLayerWithPixels(
        newLayer.id,
        newLayer.name,
        new Uint8ClampedArray(docPixelBuffer),
        {
          pixels: new Uint8ClampedArray(imageData.data),
          width: img.width,
          height: img.height,
          bounds: {
            x: offsetX,
            y: offsetY,
            width: img.width,
            height: img.height,
          },
        },
      );
      addLayer(storeLayer);
      setActiveLayer(storeLayer.id);
      setTool(Tool.Move);
      rendererRef.forceRender();

      URL.revokeObjectURL(objectURL);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    img.onerror = () => {
      console.error("Failed to load image");
      URL.revokeObjectURL(objectURL);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    img.src = objectURL;
  }, [rendererRef, doc, addLayer, setActiveLayer, setTool]);

  useEffect(() => {
    const electronAPI = (window as Window & { electronAPI?: ElectronAPI }).electronAPI;
    if (!electronAPI) return;

    const disposers = [
      electronAPI.onMenuNew?.(handleNewFile),
      electronAPI.onMenuUndo?.(undo),
      electronAPI.onMenuRedo?.(redo),
      electronAPI.onFileOpen?.(openImageFromPath),
    ].filter((value): value is () => void => typeof value === "function");

    return () => {
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [handleNewFile, openImageFromPath, redo, undo]);

  // Export handlers
  const triggerDownload = useCallback((dataURL: string, filename: string) => {
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleExportPNG = useCallback(() => {
    if (!rendererRef || !doc) return;
    const dataURL = rendererRef.exportToDataURL("image/png");
    const filename = `untitled.png`;
    triggerDownload(dataURL, filename);
    setFileMenuOpen(false);
    setExportMenuOpen(false);
  }, [rendererRef, doc, triggerDownload]);

  const handleExportJPEG = useCallback(() => {
    if (!rendererRef || !doc) return;
    setShowQualityDialog(true);
  }, [rendererRef, doc]);

  const confirmJPEGExport = useCallback(() => {
    if (!rendererRef || !doc) return;
    const dataURL = rendererRef.exportToDataURL("image/jpeg", jpegQuality / 100);
    const filename = `untitled.jpg`;
    triggerDownload(dataURL, filename);
    setShowQualityDialog(false);
    setFileMenuOpen(false);
    setExportMenuOpen(false);
  }, [rendererRef, doc, jpegQuality, triggerDownload]);

  const handleExportFlattenedPNG = useCallback(() => {
    if (!rendererRef || !doc) return;
    const dataURL = rendererRef.exportFlattenedToDataURL();
    const filename = `untitled-flattened.png`;
    triggerDownload(dataURL, filename);
    setFileMenuOpen(false);
    setExportMenuOpen(false);
  }, [rendererRef, doc, triggerDownload]);

  return (
    <>
      <nav className="menubar">
        <div className="mi" ref={fileMenuRef} style={{ position: "relative" }}>
          <span onClick={() => {
            setFileMenuOpen(!fileMenuOpen);
            setEditMenuOpen(false);
          }} style={{ cursor: "pointer" }}>
            File
          </span>
          {fileMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                backgroundColor: "#2a2a2a",
                border: "1px solid #3a3a3a",
                borderRadius: "4px",
                minWidth: "180px",
                zIndex: 1000,
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
            >
              <div
                style={{
                  padding: "8px 16px",
                  cursor: "pointer",
                  color: "#e0e0e0",
                  fontSize: "13px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#3a3a3a")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                onClick={() => {
                  setFileMenuOpen(false);
                  handleNewFile();
                }}
              >
                New Document
              </div>
              <div
                style={{
                  padding: "8px 16px",
                  cursor: doc ? "pointer" : "not-allowed",
                  color: doc ? "#e0e0e0" : "#666",
                  fontSize: "13px",
                }}
                onMouseEnter={(e) => doc && (e.currentTarget.style.backgroundColor = "#3a3a3a")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                onClick={doc ? handleImportImage : undefined}
              >
                Import Image...
              </div>
              <div
                style={{
                  padding: "8px 16px",
                  cursor: doc ? "pointer" : "not-allowed",
                  color: doc ? "#e0e0e0" : "#666",
                  fontSize: "13px",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (doc) {
                    e.currentTarget.style.backgroundColor = "#3a3a3a";
                    setExportMenuOpen(true);
                  }
                }}
                onClick={(e) => {
                  if (doc) {
                    e.stopPropagation();
                    setExportMenuOpen(!exportMenuOpen);
                  }
                }}
              >
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  Export
                  <span style={{ marginLeft: "20px" }}>▶</span>
                </span>
                {exportMenuOpen && doc && (
                  <div
                    style={{
                      position: "absolute",
                      left: "100%",
                      top: 0,
                      backgroundColor: "#2a2a2a",
                      border: "1px solid #3a3a3a",
                      borderRadius: "4px",
                      minWidth: "160px",
                      zIndex: 1001,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 16px",
                        cursor: "pointer",
                        color: "#e0e0e0",
                        fontSize: "13px",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#3a3a3a")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      onClick={handleExportPNG}
                    >
                      PNG
                    </div>
                    <div
                      style={{
                        padding: "8px 16px",
                        cursor: "pointer",
                        color: "#e0e0e0",
                        fontSize: "13px",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#3a3a3a")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      onClick={handleExportJPEG}
                    >
                      JPEG...
                    </div>
                    <div
                      style={{
                        padding: "8px 16px",
                        cursor: "pointer",
                        color: "#e0e0e0",
                        fontSize: "13px",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#3a3a3a")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      onClick={handleExportFlattenedPNG}
                    >
                      Flattened PNG
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="mi" ref={editMenuRef} style={{ position: "relative" }}>
          <span onClick={() => {
            setEditMenuOpen(!editMenuOpen);
            setFileMenuOpen(false);
          }} style={{ cursor: "pointer" }}>
            Edit
          </span>
          {editMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                backgroundColor: "#2a2a2a",
                border: "1px solid #3a3a3a",
                borderRadius: "4px",
                minWidth: "180px",
                zIndex: 1000,
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
            >
              <div
                style={{
                  padding: "8px 16px",
                  cursor: undoStack.length > 0 ? "pointer" : "default",
                  color: undoStack.length > 0 ? "#e0e0e0" : "#666",
                  fontSize: "13px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => undoStack.length > 0 && (e.currentTarget.style.backgroundColor = "#3a3a3a")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                onClick={() => {
                  if (undoStack.length > 0) {
                    undo();
                    setEditMenuOpen(false);
                  }
                }}
              >
                <span>Undo</span>
                <span style={{ opacity: 0.5, marginLeft: "20px" }}>Ctrl+Z</span>
              </div>
              <div
                style={{
                  padding: "8px 16px",
                  cursor: redoStack.length > 0 ? "pointer" : "default",
                  color: redoStack.length > 0 ? "#e0e0e0" : "#666",
                  fontSize: "13px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => redoStack.length > 0 && (e.currentTarget.style.backgroundColor = "#3a3a3a")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                onClick={() => {
                  if (redoStack.length > 0) {
                    redo();
                    setEditMenuOpen(false);
                  }
                }}
              >
                <span>Redo</span>
                <span style={{ opacity: 0.5, marginLeft: "20px" }}>Ctrl+Y</span>
              </div>
            </div>
          )}
        </div>

        <div className="mi">Image</div>
        <div className="mi">Layer</div>
        <div className="mi">Filter</div>
        <div className="mi">View</div>
        <div className="mi" onClick={onOpenAppearance}>Customize</div>
        <div className="msep"></div>
        <div className="mi">Window</div>
        <div className="mr">
          <div className="ws-badge">Painting</div>
        </div>
      </nav>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      {showNewModal && (
        <div className="dialog-overlay" onClick={() => setShowNewModal(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <span className="dialog-title">New Document</span>
              <button
                className="dialog-close"
                onClick={() => setShowNewModal(false)}
              >
                ×
              </button>
            </div>

            <div className="dialog-body">
              <div className="dialog-presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className={`preset-btn ${activePreset === p.label ? "on" : ""}`}
                    onClick={() => handlePreset(p.label, p.w, p.h)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="dialog-row">
                <div className="dialog-field">
                  <div className="dialog-label">
                    <span>Width</span>
                    <span>px</span>
                  </div>
                  <input
                    type="number"
                    className="dialog-input"
                    value={newWidth}
                    min={1}
                    max={16384}
                    onChange={(e) => {
                      setNewWidth(Number(e.target.value));
                      setActivePreset(null);
                    }}
                  />
                </div>
                <span className="dialog-x">×</span>
                <div className="dialog-field">
                  <div className="dialog-label">
                    <span>Height</span>
                    <span>px</span>
                  </div>
                  <input
                    type="number"
                    className="dialog-input"
                    value={newHeight}
                    min={1}
                    max={16384}
                    onChange={(e) => {
                      setNewHeight(Number(e.target.value));
                      setActivePreset(null);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="dialog-footer">
              <button
                className="dialog-btn"
                onClick={() => setShowNewModal(false)}
              >
                Cancel
              </button>
              <button className="dialog-btn primary" onClick={confirmNewFile}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JPEG Quality Dialog */}
      {showQualityDialog && (
        <div className="dialog-overlay" onClick={() => setShowQualityDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <span className="dialog-title">JPEG Export Quality</span>
              <button
                className="dialog-close"
                onClick={() => setShowQualityDialog(false)}
              >
                ×
              </button>
            </div>

            <div className="dialog-body">
              <div className="dialog-row" style={{ marginTop: "20px" }}>
                <div className="dialog-field" style={{ flex: 1 }}>
                  <div className="dialog-label">
                    <span>Quality</span>
                    <span>{jpegQuality}%</span>
                  </div>
                  <input
                    type="range"
                    className="dialog-input"
                    value={jpegQuality}
                    min={1}
                    max={100}
                    onChange={(e) => setJpegQuality(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            </div>

            <div className="dialog-footer">
              <button
                className="dialog-btn"
                onClick={() => setShowQualityDialog(false)}
              >
                Cancel
              </button>
              <button className="dialog-btn primary" onClick={confirmJPEGExport}>
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
