import { useEffect, useRef, useState } from "react";

type SelectOption = {
  value: string;
  label: string;
  swatchHex: string;
};

type HighlightControlsProps = {
  toneValue: string;
  hueValue: string;
  onToneChange: (value: string) => void;
  onHueChange: (value: string) => void;
  autoRotateEnabled: boolean;
  northLockEnabled: boolean;
  showToneGuides: boolean;
  showHueGuides: boolean;
  showLightnessGuides: boolean;
  onToggleAutoRotate: () => void;
  onToggleNorthLock: () => void;
  onToggleToneGuides: () => void;
  onToggleHueGuides: () => void;
  onToggleLightnessGuides: () => void;
  toneOptions: SelectOption[];
  hueOptions: SelectOption[];
};

type DropdownProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
};

const getContrastTextColor = (hex: string): string => {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;

  return luminance > 145 ? "#2b251d" : "#fffaf1";
};

function CompassIcon() {
  return (
    <svg className="panel-action-button-svg" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.9" />
      <path d="M12 5.2L14.6 11.2L12 10.1L9.4 11.2L12 5.2Z" fill="currentColor" />
      <path d="M12 18.8L9.4 12.8L12 13.9L14.6 12.8L12 18.8Z" fill="currentColor" opacity="0.36" />
    </svg>
  );
}

function HighlightDropdown({ label, value, options, onChange }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const textColor = getContrastTextColor(selectedOption.swatchHex);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className={`custom-dropdown ${isOpen ? "is-open" : ""}`}>
      <label className="custom-dropdown-label">{label}</label>
      <button
        type="button"
        className="custom-dropdown-trigger"
        style={{ background: selectedOption.swatchHex, color: textColor }}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{selectedOption.label}</span>
        <span className="custom-dropdown-caret" aria-hidden="true">
          ▼
        </span>
      </button>

      {isOpen ? (
        <div className="custom-dropdown-menu">
          {options.map((option) => {
            const optionTextColor = getContrastTextColor(option.swatchHex);
            return (
              <button
                key={option.value || "empty"}
                type="button"
                className={`custom-dropdown-option ${option.value === value ? "is-selected" : ""}`}
                style={{ background: option.swatchHex, color: optionTextColor }}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {option.value === value ? <span aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function HighlightControls({
  toneValue,
  hueValue,
  onToneChange,
  onHueChange,
  autoRotateEnabled,
  northLockEnabled,
  showToneGuides,
  showHueGuides,
  showLightnessGuides,
  onToggleAutoRotate,
  onToggleNorthLock,
  onToggleToneGuides,
  onToggleHueGuides,
  onToggleLightnessGuides,
  toneOptions,
  hueOptions,
}: HighlightControlsProps) {
  return (
    <div className="highlight-controls">
      <div className="panel-action-row" aria-label="3Dビュー操作">
        <div className="panel-action-buttons">
          <button
            type="button"
            className={`panel-action-button ${autoRotateEnabled ? "is-active" : ""}`}
            aria-label={autoRotateEnabled ? "自動回転をオフにする" : "自動回転をオンにする"}
            title={autoRotateEnabled ? "Rotate ON" : "Rotate OFF"}
            onClick={onToggleAutoRotate}
          >
            <span className="panel-action-button-icon" aria-hidden="true">
              ↻
            </span>
          </button>

          <button
            type="button"
            className={`panel-action-button ${northLockEnabled ? "is-active" : ""}`}
            aria-label={northLockEnabled ? "基準方位固定をオフにする" : "基準方位に固定"}
            title={northLockEnabled ? "基準方位固定 ON" : "基準方位固定 OFF"}
            onClick={onToggleNorthLock}
          >
            <CompassIcon />
          </button>
        </div>
      </div>

      <div className="control-group">
        <HighlightDropdown label="トーン強調" value={toneValue} options={toneOptions} onChange={onToneChange} />
      </div>

      <div className="control-group">
        <HighlightDropdown label="色相強調" value={hueValue} options={hueOptions} onChange={onHueChange} />
      </div>

      <div className="control-group">
        <div className="guide-controls">
          <span className="custom-dropdown-label">補助線表示</span>
          <div className="guide-controls-row">
            <label className="guide-toggle">
              <input type="checkbox" checked={showToneGuides} onChange={onToggleToneGuides} />
              <span>同一トーン</span>
            </label>

            <label className="guide-toggle">
              <input type="checkbox" checked={showHueGuides} onChange={onToggleHueGuides} />
              <span>同一色相</span>
            </label>

            <label className="guide-toggle">
              <input type="checkbox" checked={showLightnessGuides} onChange={onToggleLightnessGuides} />
              <span>同一明度</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
