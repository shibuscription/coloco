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
  guideLinesVisible: boolean;
  onToggleAutoRotate: () => void;
  onToggleNorthLock: () => void;
  onToggleGuideLines: () => void;
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
      <circle
        cx="12"
        cy="12"
        r="7.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.9"
      />
      <path d="M12 5.2L14.6 11.2L12 10.1L9.4 11.2L12 5.2Z" fill="currentColor" />
      <path d="M12 18.8L9.4 12.8L12 13.9L14.6 12.8L12 18.8Z" fill="currentColor" opacity="0.36" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="panel-action-button-svg" viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="7.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M4.8 12h14.4" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.9" />
      <path d="M6.2 8.1c1.7 1 4 1.5 5.8 1.5s4.1-.5 5.8-1.5" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.82" />
      <path d="M6.2 15.9c1.7-1 4-1.5 5.8-1.5s4.1.5 5.8 1.5" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.82" />
      <path d="M12 4.7c-2 1.9-3.1 4.4-3.1 7.3s1.1 5.4 3.1 7.3" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.82" />
      <path d="M12 4.7c2 1.9 3.1 4.4 3.1 7.3s-1.1 5.4-3.1 7.3" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.82" />
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
          ▾
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
                {option.value === value ? <span aria-hidden="true">✔</span> : null}
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
  guideLinesVisible,
  onToggleAutoRotate,
  onToggleNorthLock,
  onToggleGuideLines,
  toneOptions,
  hueOptions,
}: HighlightControlsProps) {
  return (
    <div className="highlight-controls">
      <div className="panel-action-row" aria-label="3Dビュー補助操作">
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
            aria-label={northLockEnabled ? "基準方位固定をオフにする" : "基準方位に固定する"}
            title={northLockEnabled ? "基準方位固定 ON" : "基準方位に固定"}
            onClick={onToggleNorthLock}
          >
            <CompassIcon />
          </button>

          <button
            type="button"
            className={`panel-action-button ${guideLinesVisible ? "is-active" : ""}`}
            aria-label={guideLinesVisible ? "立体ガイド線を非表示にする" : "立体ガイド線を表示する"}
            title={guideLinesVisible ? "立体ガイド線 ON" : "立体ガイド線 OFF"}
            onClick={onToggleGuideLines}
          >
            <GlobeIcon />
          </button>
        </div>
      </div>

      <div className="control-group">
        <HighlightDropdown label="トーン強調" value={toneValue} options={toneOptions} onChange={onToneChange} />
      </div>

      <div className="control-group">
        <HighlightDropdown label="色相強調" value={hueValue} options={hueOptions} onChange={onHueChange} />
      </div>
    </div>
  );
}
