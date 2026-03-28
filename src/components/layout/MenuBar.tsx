import { useState, useCallback, useRef, useEffect } from "react";
import type { Layer } from "../../types/editor";
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

export function MenuBar() {
  const { setDocument, document: doc, addLayer, setActiveLayer } = useDocumentStore();
  const { setZoom, setPan, rendererRef } = useEditorStore();

  const [showNewModal, setShowNewModal] = useState(false);
  const [newWidth, setNewWidth] = useState(800);
  const [newHeight, setNewHeight] = useState(600);
  const [activePreset, setActivePreset] = useState<string | null>("800×600");

  // File menu dropdown state
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // JPEG quality dialog
  const [showQualityDialog, setShowQualityDialog] = useState(false);
  const [jpegQuality, setJpegQuality] = useState(90);

  // Close file menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
        setFileMenuOpen(false);
        setExportMenuOpen(false);
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

    if (rendererRef) {
      // resizeDocument now internally calls fitToViewport to center the new canvas
      rendererRef.resizeDocument(width, height);

      // Create a white background Graphics object as the bottommost layer in the scene graph
      // This is a real PixiJS Graphics object that can be exported and flattened correctly
      rendererRef.createBackgroundGraphics();

      // Add a corresponding layer entry for the Background with solid white pixels
      const layerStack = rendererRef.getLayerStack();
      const backgroundLayer = layerStack.createLayer("Background", {
        r: 255,
        g: 255,
        b: 255,
        a: 255,
      }, "layer-bg");

      // Associate the Graphics object with the layer so it gets cleaned up on deletion
      const bgGraphics = rendererRef.getBackgroundGraphics();
      if (bgGraphics) {
        backgroundLayer.graphics = bgGraphics;
      }

      // Add the Background layer to the document before setting it
      const backgroundLayerForStore: Layer = {
        id: "layer-bg",
        name: "Background",
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal",
        pixels: null,
      };
      newDoc.layers.push(backgroundLayerForStore);
      setDocument(newDoc);

      rendererRef.forceRender();

      // Sync zoom/pan state back to Zustand store
      setZoom(rendererRef.getZoom() * 100);
      setPan(rendererRef.getPan());
    } else {
      setDocument(newDoc);
    }
  }, [newWidth, newHeight, setDocument, setZoom, setPan, rendererRef]);

  const isPristineStartupDocument = useCallback(() => {
    const currentDoc = useDocumentStore.getState().document;
    if (!currentDoc) return false;
    return currentDoc.layers.length === 1 && currentDoc.layers[0]?.id === "layer-bg";
  }, []);

  const rebuildDocumentWithBackground = useCallback(
    (width: number, height: number) => {
      if (!rendererRef) return;

      const nextDoc = createDefaultDocument(width, height, {
        r: 255,
        g: 255,
        b: 255,
        a: 0,
      });

      rendererRef.resizeDocument(width, height);
      rendererRef.createBackgroundGraphics();

      const layerStack = rendererRef.getLayerStack();
      const bgLayerData = layerStack.createLayer(
        "Background",
        { r: 255, g: 255, b: 255, a: 255 },
        "layer-bg",
      );

      const bgGraphics = rendererRef.getBackgroundGraphics();
      if (bgGraphics) {
        bgLayerData.graphics = bgGraphics;
      }

      const bgLayerForStore: Layer = {
        id: "layer-bg",
        name: "Background",
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal",
        pixels: null,
      };

      nextDoc.layers.push(bgLayerForStore);
      setDocument(nextDoc);

      rendererRef.forceRender();
      setZoom(rendererRef.getZoom() * 100);
      setPan(rendererRef.getPan());
    },
    [rendererRef, setDocument, setPan, setZoom],
  );

  const openImageAsDocument = useCallback(
    (img: HTMLImageElement, fileName: string) => {
      if (!rendererRef) return;

      const nextDoc = createDefaultDocument(img.width, img.height, {
        r: 255,
        g: 255,
        b: 255,
        a: 0,
      });

      rendererRef.resizeDocument(img.width, img.height);
      rendererRef.createBackgroundGraphics();

      const layerStack = rendererRef.getLayerStack();
      const bgLayerData = layerStack.createLayer(
        "Background",
        { r: 255, g: 255, b: 255, a: 255 },
        "layer-bg",
      );

      const bgGraphics = rendererRef.getBackgroundGraphics();
      if (bgGraphics) {
        bgLayerData.graphics = bgGraphics;
      }

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(img, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);

      const imageLayer = layerStack.createLayer(fileName);
      imageLayer.pixelBuffer = new Uint8ClampedArray(imageData.data);
      imageLayer.width = img.width;
      imageLayer.height = img.height;
      imageLayer.dirty = true;

      nextDoc.layers.push({
        id: "layer-bg",
        name: "Background",
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal",
        pixels: null,
      });

      nextDoc.layers.push({
        id: imageLayer.id,
        name: fileName,
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal",
        pixels: null,
      });

      setDocument(nextDoc);
      setActiveLayer(imageLayer.id);
      rendererRef.forceRender();
      setZoom(rendererRef.getZoom() * 100);
      setPan(rendererRef.getPan());
    },
    [rendererRef, setActiveLayer, setDocument, setPan, setZoom],
  );

  // Import Image handler
  const handleImportImage = useCallback(() => {
    fileInputRef.current?.click();
    setFileMenuOpen(false);
  }, []);

  // Handle file selection for import
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !rendererRef || !doc) return;

    const objectURL = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const fileName = file.name;
      if (isPristineStartupDocument()) {
        openImageAsDocument(img, fileName);
        URL.revokeObjectURL(objectURL);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      const currentDoc = useDocumentStore.getState().document;
      if (!currentDoc) {
        URL.revokeObjectURL(objectURL);
        return;
      }

      const layerStack = rendererRef.getLayerStack();

      // Create a new layer named after the file
      const newLayer = layerStack.createLayer(fileName);

      // Draw image to a temporary canvas to get pixel data
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(img, 0, 0);

      // Get pixel data
      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      newLayer.pixelBuffer = imageData.data;
      newLayer.width = img.width;
      newLayer.height = img.height;
      newLayer.dirty = true;

      // Center the image on the canvas
      const docWidth = currentDoc.width;
      const docHeight = currentDoc.height;
      const offsetX = Math.floor((docWidth - img.width) / 2);
      const offsetY = Math.floor((docHeight - img.height) / 2);

      // Create pixel buffer for the full document size, positioned at center
      const docPixelBuffer = new Uint8ClampedArray(docWidth * docHeight * 4);
      // Fill with transparent
      for (let i = 3; i < docPixelBuffer.length; i += 4) {
        docPixelBuffer[i] = 0;
      }

      // Copy image pixels to centered position
      for (let y = 0; y < img.height; y++) {
        const destY = y + offsetY;
        if (destY < 0 || destY >= docHeight) continue;
        for (let x = 0; x < img.width; x++) {
          const destX = x + offsetX;
          if (destX < 0 || destX >= docWidth) continue;

          const srcIdx = (y * img.width + x) * 4;
          const destIdx = (destY * docWidth + destX) * 4;

          docPixelBuffer[destIdx] = newLayer.pixelBuffer![srcIdx];
          docPixelBuffer[destIdx + 1] = newLayer.pixelBuffer![srcIdx + 1];
          docPixelBuffer[destIdx + 2] = newLayer.pixelBuffer![srcIdx + 2];
          docPixelBuffer[destIdx + 3] = newLayer.pixelBuffer![srcIdx + 3];
        }
      }

      newLayer.pixelBuffer = docPixelBuffer;
      newLayer.width = docWidth;
      newLayer.height = docHeight;

      // Add layer to store
      const storeLayer: Layer = {
        id: newLayer.id,
        name: newLayer.name,
        visible: true,
        locked: false,
        opacity: 100,
        blendMode: "normal",
        pixels: null,
      };
      addLayer(storeLayer);
      setActiveLayer(storeLayer.id);

      rendererRef.forceRender();
      URL.revokeObjectURL(objectURL);

      // Reset file input
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
  }, [rendererRef, doc, addLayer, isPristineStartupDocument, openImageAsDocument, setActiveLayer]);

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
          <span onClick={() => setFileMenuOpen(!fileMenuOpen)} style={{ cursor: "pointer" }}>
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
        <div className="mi">Edit</div>
        <div className="mi">Image</div>
        <div className="mi">Layer</div>
        <div className="mi">Filter</div>
        <div className="mi">View</div>
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
