type ViewerQuickControlsProps = {
  autoRotateEnabled: boolean;
  onToggleAutoRotate: () => void;
  onAlignYellowUp: () => void;
};

function CompassIcon() {
  return (
    <svg
      className="viewer-quick-button-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="7.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.9"
      />
      <path
        d="M12 5.2L14.6 11.2L12 10.1L9.4 11.2L12 5.2Z"
        fill="currentColor"
      />
      <path
        d="M12 18.8L9.4 12.8L12 13.9L14.6 12.8L12 18.8Z"
        fill="currentColor"
        opacity="0.36"
      />
    </svg>
  );
}

export function ViewerQuickControls({
  autoRotateEnabled,
  onToggleAutoRotate,
  onAlignYellowUp,
}: ViewerQuickControlsProps) {
  return (
    <div className="viewer-quick-controls" aria-label="3Dビュー補助操作">
      <button
        type="button"
        className={`viewer-quick-button ${autoRotateEnabled ? "is-active" : ""}`}
        aria-label={autoRotateEnabled ? "自動回転をオフにする" : "自動回転をオンにする"}
        title={autoRotateEnabled ? "Rotate ON" : "Rotate OFF"}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleAutoRotate();
        }}
      >
        <span className="viewer-quick-button-icon" aria-hidden="true">
          ↻
        </span>
      </button>

      <button
        type="button"
        className="viewer-quick-button"
        aria-label="基準方位へそろえる"
        title="基準方位へそろえる"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onAlignYellowUp();
        }}
      >
        <CompassIcon />
      </button>
    </div>
  );
}
