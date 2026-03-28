import { TitleBar } from "./TitleBar";
import { MenuBar } from "./MenuBar";
import { ToolsPanel } from "./ToolsPanel";
import { CanvasArea } from "./CanvasArea";
import { RightPanel } from "./RightPanel";
import { StatusBar } from "./StatusBar";

export function AppShell() {
  return (
    <div className="app">
      <TitleBar />
      <MenuBar />
      <ToolsPanel />
      <CanvasArea />
      <RightPanel />
      <StatusBar />
    </div>
  );
}
