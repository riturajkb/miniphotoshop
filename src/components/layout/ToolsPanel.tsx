import { useEditorStore } from "../../store/editorStore";
import { Tool } from "../../types/editor";

export function ToolsPanel() {
  const { activeTool, setTool } = useEditorStore();

  return (
    <aside className="toolpanel">
      <div className={`tb ${activeTool === Tool.Move ? 'on' : ''}`} data-tip="Move  V" onClick={() => setTool(Tool.Move)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><path d="M8 2v12M2 8h12M8 2L6 4M8 2l2 2M8 14l-2-2M8 14l2-2M2 8l2-2M2 8l2 2M14 8l-2-2M14 8l-2 2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span className="tsk">V</span>
      </div>
      <div className={`tb ${activeTool === Tool.Selection ? 'on' : ''}`} data-tip="Selection  M" onClick={() => setTool(Tool.Selection)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" rx="0.5" strokeDasharray="2.5 1.5"/></svg>
        <span className="tsk">M</span>
      </div>
      <div className={`tb ${activeTool === Tool.Lasso ? 'on' : ''}`} data-tip="Lasso  L" onClick={() => setTool(Tool.Lasso)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><path d="M8 3C5 3 2.5 5 2.5 7.5 2.5 10 4.5 12 7 12c1.5 0 2.5-.8 3-2" strokeLinecap="round"/><path d="M10 10c1-1.5 3-2 3-4 0-1.5-1-2.5-2.5-2.5" strokeLinecap="round"/></svg>
        <span className="tsk">L</span>
      </div>
      <div className={`tb ${activeTool === Tool.MagicWand ? 'on' : ''}`} data-tip="Magic Wand  W" onClick={() => setTool(Tool.MagicWand)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><path d="M3 13L9 7" strokeLinecap="round"/><path d="M9 3v1M13 7h-1M11.5 4.5l-.7.7M6 4l.7.7" strokeLinecap="round"/><circle cx="10" cy="6" r="2.5"/></svg>
        <span className="tsk">W</span>
      </div>
      <div className="tsep"></div>
      <div className={`tb ${activeTool === Tool.Crop ? 'on' : ''}`} data-tip="Crop  C" onClick={() => setTool(Tool.Crop)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><path d="M4 2v8a1 1 0 001 1h8" strokeLinecap="round"/><path d="M2 4h8a1 1 0 011 1v8" strokeLinecap="round"/></svg>
        <span className="tsk">C</span>
      </div>
      <div className={`tb ${activeTool === Tool.Eyedropper ? 'on' : ''}`} data-tip="Eyedropper  I" onClick={() => setTool(Tool.Eyedropper)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><path d="M10.5 3L13 5.5l-5.5 5.5L5 13l-2-.5L2.5 11l2.5-2.5L10.5 3z" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 4.5l2.5 2.5" strokeLinecap="round"/></svg>
        <span className="tsk">I</span>
      </div>
      <div className="tsep"></div>
      <div className={`tb ${activeTool === Tool.Brush ? 'on' : ''}`} data-tip="Brush  B" onClick={() => setTool(Tool.Brush)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><path d="M3 13c2-1 4-3 4-5 0-1-.5-1.5-1-2L9.5 3.5a2 2 0 012.8 2.8L8.5 10" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 13c0-1.5.5-2.5 1.5-2.5S6 11.5 6 13c0 .5-.8 1-1.5 1C3.8 14 3 13.5 3 13z"/></svg>
        <span className="tsk">B</span>
      </div>
      <div className={`tb ${activeTool === Tool.Pencil ? 'on' : ''}`} data-tip="Pencil  P" onClick={() => setTool(Tool.Pencil)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><path d="M11 2l3 3-8 8H3v-3L11 2z" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 4l3 3" strokeLinecap="round"/></svg>
        <span className="tsk">P</span>
      </div>
      <div className={`tb ${activeTool === Tool.Eraser ? 'on' : ''}`} data-tip="Eraser  E" onClick={() => setTool(Tool.Eraser)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><path d="M13 4L7 10l-4 2 2-4 6-6 2 2z" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 12h10M7 10l2-2" strokeLinecap="round"/></svg>
        <span className="tsk">E</span>
      </div>
      <div className={`tb ${activeTool === Tool.Fill ? 'on' : ''}`} data-tip="Fill  G" onClick={() => setTool(Tool.Fill)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><path d="M3 13c1-2 3-2 4-4s0-4-1-5l5-1 1 5-1 2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="1.8" fill="currentColor" opacity="0.5"/></svg>
        <span className="tsk">G</span>
      </div>
      <div className="tsep"></div>
      <div className={`tb ${activeTool === Tool.Gradient ? 'on' : ''}`} data-tip="Gradient" onClick={() => setTool(Tool.Gradient)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 16 16"><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#444"/><stop offset="100%" stopColor="#ccc"/></linearGradient></defs><rect x="3" y="5.5" width="10" height="5" rx="1" fill="url(#gg)" stroke="currentColor" strokeWidth={1}/></svg>
      </div>
      <div className={`tb ${activeTool === Tool.Text ? 'on' : ''}`} data-tip="Text  T" onClick={() => setTool(Tool.Text)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><path d="M3 4h10M8 4v9" strokeLinecap="round"/><path d="M5 13h6" strokeLinecap="round"/></svg>
        <span className="tsk">T</span>
      </div>
      <div className={`tb ${activeTool === Tool.Shape ? 'on' : ''}`} data-tip="Shape  U" onClick={() => setTool(Tool.Shape)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><rect x="3" y="5" width="10" height="7" rx="1"/></svg>
        <span className="tsk">U</span>
      </div>
      <div className="tsep"></div>
      <div className={`tb ${activeTool === Tool.Zoom ? 'on' : ''}`} data-tip="Zoom  Z" onClick={() => setTool(Tool.Zoom)}>
        <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14M5.5 7h3M7 5.5v3" strokeLinecap="round"/></svg>
        <span className="tsk">Z</span>
      </div>
      <div className="tool-colors">
        <div className="cs-wrap">
          <div className="cs bg"></div>
          <div className="cs fg" style={{background:"#0c0c0c", borderColor:"#3a3a3a"}}></div>
          <div className="cs-swap">⇄</div>
        </div>
      </div>
    </aside>
  );
}
