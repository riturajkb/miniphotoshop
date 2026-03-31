import { useEditorStore } from "../../store/editorStore";
import { useDocumentStore } from "../../store/documentStore";

export function StatusBar() {
  const { activeTool, zoom } = useEditorStore();
  const { document } = useDocumentStore();
  
  const layerCount = document?.layers.length ?? 0;

  return (
    <footer className="statusbar">
      <div className="ss">
        <div className="sdot"></div>
        <span className="sk">Tool</span>
        <span className="sv acc" id="acttool" style={{ textTransform: 'capitalize' }}>{activeTool}</span>
      </div>
      <div className="ss">
        <div className="si right">
        <span className="sv" id="cx">0</span>
        <span className="sl">, </span>
        <span className="sv" id="cy">0</span>
      </div>
      </div>
      <div className="ss"><span className="sk">Zoom</span><span className="sv acc" id="zv">{Math.round(zoom)}%</span></div>
      <div className="ss"><span className="sk">Layers</span><span className="sv">{layerCount}</span></div>
      <div className="ss"><span className="sk">GPU</span><span className="sv" style={{ color: "#4a9eff" }}>WebGL ✓</span></div>
    </footer>
  );
}
