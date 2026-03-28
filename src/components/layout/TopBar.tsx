/**
 * TopBar — contextual tool options bar.
 * Shows relevant settings for the currently active tool.
 * Currently displays Brush tool options as a representative placeholder.
 */
export function TopBar() {
  return (
    <div
      style={{
        height: "var(--topbar-height)",
        background: "var(--color-bg-panel)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        gap: "2px",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {/* Tool name chip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          paddingRight: "10px",
          marginRight: "6px",
          borderRight: "1px solid var(--color-border)",
          height: "20px",
        }}
      >
        {/* Brush icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{ color: "var(--color-accent)" }}
        >
          <path
            d="M9.5 2L12 4.5L5 11.5C4.5 12 3.5 12 3 11.5C2.5 11 2.5 10 3 9.5L9.5 2Z"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M3 9.5C2 10 1.5 11 2 12C2.5 12.5 3.5 12 4 11"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
          />
        </svg>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--color-text-muted)",
            letterSpacing: "0.03em",
          }}
        >
          BRUSH
        </span>
      </div>

      {/* Size */}
      <TopBarGroup label="Size">
        <input
          type="number"
          defaultValue={20}
          className="ps-input mono"
          style={{ width: "54px", textAlign: "right" }}
        />
        <span
          style={{
            fontSize: "10px",
            color: "var(--color-text-dim)",
            marginLeft: "2px",
          }}
        >
          px
        </span>
      </TopBarGroup>

      <Divider />

      {/* Opacity */}
      <TopBarGroup label="Opacity">
        <input
          type="range"
          min={0}
          max={100}
          defaultValue={100}
          style={{
            width: "72px",
            accentColor: "var(--color-accent)",
            cursor: "pointer",
          }}
        />
        <input
          type="number"
          defaultValue={100}
          className="ps-input mono"
          style={{ width: "54px", textAlign: "right" }}
        />
        <span
          style={{
            fontSize: "10px",
            color: "var(--color-text-dim)",
            marginLeft: "1px",
          }}
        >
          %
        </span>
      </TopBarGroup>

      <Divider />

      {/* Hardness */}
      <TopBarGroup label="Hardness">
        <input
          type="range"
          min={0}
          max={100}
          defaultValue={80}
          style={{
            width: "72px",
            accentColor: "var(--color-accent)",
            cursor: "pointer",
          }}
        />
        <input
          type="number"
          defaultValue={80}
          className="ps-input mono"
          style={{ width: "54px", textAlign: "right" }}
        />
        <span
          style={{
            fontSize: "10px",
            color: "var(--color-text-dim)",
            marginLeft: "1px",
          }}
        >
          %
        </span>
      </TopBarGroup>

      <Divider />

      {/* Flow */}
      <TopBarGroup label="Flow">
        <input
          type="number"
          defaultValue={100}
          className="ps-input mono"
          style={{ width: "54px", textAlign: "right" }}
        />
        <span
          style={{
            fontSize: "10px",
            color: "var(--color-text-dim)",
            marginLeft: "1px",
          }}
        >
          %
        </span>
      </TopBarGroup>
    </div>
  );
}

function TopBarGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        padding: "0 6px",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          color: "var(--color-text-dim)",
          letterSpacing: "0.03em",
          minWidth: "fit-content",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: "1px",
        height: "18px",
        background: "var(--color-border)",
        flexShrink: 0,
        margin: "0 2px",
      }}
    />
  );
}
