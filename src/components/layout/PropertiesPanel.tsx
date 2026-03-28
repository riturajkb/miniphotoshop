/**
 * PropertiesPanel — shows layer/object properties.
 * Currently displays an empty-state placeholder.
 */
export function PropertiesPanel() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
        minHeight: "140px",
      }}
    >
      {/* Panel header */}
      <div className="panel-header">Properties</div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {/* Empty state */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            gap: "8px",
            opacity: 0.4,
            paddingTop: "8px",
          }}
        >
          <svg
            viewBox="0 0 32 32"
            width="28"
            height="28"
            fill="none"
            style={{ color: "var(--color-text-muted)" }}
          >
            <rect
              x="4"
              y="8"
              width="24"
              height="16"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path d="M4 13h24" stroke="currentColor" strokeWidth="1" />
            <path
              d="M9 18h6M9 21h4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <circle
              cx="22"
              cy="19.5"
              r="3"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
          <span
            style={{
              fontSize: "11px",
              color: "var(--color-text-muted)",
              textAlign: "center",
              lineHeight: "1.5",
            }}
          >
            Select a layer or tool
            <br />
            to view properties
          </span>
        </div>

        {/* Demo section — Layer Transform */}
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            paddingTop: "10px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--color-text-dim)",
              marginBottom: "8px",
            }}
          >
            Transform
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "5px",
            }}
          >
            {[
              { label: "X", value: "0" },
              { label: "Y", value: "0" },
              { label: "W", value: "800" },
              { label: "H", value: "600" },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--color-text-dim)",
                    width: "10px",
                    flexShrink: 0,
                    fontFamily: "monospace",
                  }}
                >
                  {label}
                </span>
                <input
                  type="text"
                  defaultValue={value}
                  className="ps-input mono"
                  style={{ flex: 1, fontSize: "11px" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
