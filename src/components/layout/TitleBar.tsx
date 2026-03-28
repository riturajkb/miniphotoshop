import { useDocumentStore } from "../../store/documentStore";

export function TitleBar() {
  const { document } = useDocumentStore();
  
  return (
    <header className="titlebar">
      <div className="tb-dots">
        <div className="tb-dot c"></div>
        <div className="tb-dot m"></div>
        <div className="tb-dot x"></div>
      </div>
      <div className="wordmark"><em>⬡</em> MINIPHOTOSHOP</div>
      {document && (
        <>
          <div className="tb-filename">{document.layers[0]?.name || "Untitled"}<span className="dot">●</span></div>
          <div className="tb-meta"><span>{document.width} × {document.height}</span><span>72 ppi</span><span>sRGB</span></div>
        </>
      )}
    </header>
  );
}
