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
  toneOptions,
  hueOptions,
}: HighlightControlsProps) {
  return (
    <div className="highlight-controls">
      <div className="control-group">
        <HighlightDropdown label="トーン強調" value={toneValue} options={toneOptions} onChange={onToneChange} />
      </div>

      <div className="control-group">
        <HighlightDropdown label="色相強調" value={hueValue} options={hueOptions} onChange={onHueChange} />
      </div>
    </div>
  );
}
