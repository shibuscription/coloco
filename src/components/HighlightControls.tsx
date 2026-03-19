import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

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
  sphereScale: number;
  autoRotateMode: "cw" | "ccw" | "off";
  autoRotateRpm: number;
  northLockEnabled: boolean;
  showToneGuides: boolean;
  showHueGuides: boolean;
  showLightnessGuides: boolean;
  onSphereScaleChange: (value: number) => void;
  onToggleAutoRotate: () => void;
  onAutoRotateRpmChange: (value: number) => void;
  onToggleNorthLock: () => void;
  onToggleToneGuides: () => void;
  onToggleHueGuides: () => void;
  onToggleLightnessGuides: () => void;
  onRequestReset: () => void;
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

function RotateCwIcon() {
  return (
    <svg className="panel-action-button-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M19 8.2V4.6M19 4.6H15.4M19 4.6L15.6 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.1 11.2A6.7 6.7 0 1 1 12 5.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RotateCcwIcon() {
  return (
    <svg className="panel-action-button-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 8.2V4.6M5 4.6H8.6M5 4.6L8.4 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.9 11.2A6.7 6.7 0 1 0 12 5.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg className="panel-action-button-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14.4 5.5L18.5 9.6C19.3 10.4 19.3 11.6 18.5 12.4L11.4 19.5H7.3L4.8 17C4 16.2 4 15 4.8 14.2L11.6 7.4C12.4 6.6 13.6 6.6 14.4 5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.8 19.5H18.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9.6 9.4L14.6 14.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HighlightDropdown({ label, value, options, onChange }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState<number | undefined>(undefined);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const textColor = getContrastTextColor(selectedOption.swatchHex);
  const keyboardOptions = options.filter((option) => option.value !== "");
  const selectedKeyboardIndex = keyboardOptions.findIndex((option) => option.value === value);

  const moveSelection = (direction: -1 | 1) => {
    if (keyboardOptions.length === 0) {
      return;
    }

    const baseIndex = selectedKeyboardIndex >= 0 ? selectedKeyboardIndex : direction > 0 ? -1 : 0;
    const nextIndex =
      ((baseIndex + direction) % keyboardOptions.length + keyboardOptions.length) % keyboardOptions.length;
    const nextOption = keyboardOptions[nextIndex];

    if (!nextOption || nextOption.value === value) {
      return;
    }

    onChange(nextOption.value);
  };

  const handleDropdownKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setDropdownMaxHeight(undefined);
      return;
    }

    const updateDropdownMaxHeight = () => {
      if (typeof window === "undefined" || window.matchMedia("(max-width: 980px)").matches) {
        setDropdownMaxHeight(undefined);
        return;
      }

      const menuElement = menuRef.current;
      if (!menuElement) {
        return;
      }

      const rect = menuElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const availableHeight = Math.max(180, Math.floor(viewportHeight - rect.top - 16));
      setDropdownMaxHeight(availableHeight);
    };

    const frameId = window.requestAnimationFrame(updateDropdownMaxHeight);
    window.addEventListener("resize", updateDropdownMaxHeight);
    window.addEventListener("scroll", updateDropdownMaxHeight, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateDropdownMaxHeight);
      window.removeEventListener("scroll", updateDropdownMaxHeight, true);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`custom-dropdown ${isOpen ? "is-open" : ""}`}>
      <label className="custom-dropdown-label">{label}</label>
      <button
        ref={triggerRef}
        type="button"
        className="custom-dropdown-trigger"
        style={{ background: selectedOption.swatchHex, color: textColor }}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleDropdownKeyDown}
      >
        <span>{selectedOption.label}</span>
        <span className="custom-dropdown-caret" aria-hidden="true">
          ▼
        </span>
      </button>

      {isOpen ? (
        <div ref={menuRef} className="custom-dropdown-menu" style={{ maxHeight: dropdownMaxHeight }}>
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
                  triggerRef.current?.focus();
                }}
                onKeyDown={handleDropdownKeyDown}
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
  sphereScale,
  autoRotateMode,
  autoRotateRpm,
  northLockEnabled,
  showToneGuides,
  showHueGuides,
  showLightnessGuides,
  onSphereScaleChange,
  onToggleAutoRotate,
  onAutoRotateRpmChange,
  onToggleNorthLock,
  onToggleToneGuides,
  onToggleHueGuides,
  onToggleLightnessGuides,
  onRequestReset,
  toneOptions,
  hueOptions,
}: HighlightControlsProps) {
  const isAutoRotateActive = autoRotateMode !== "off";
  const autoRotateLabel =
    autoRotateMode === "cw"
      ? "自動回転: 右回り"
      : autoRotateMode === "ccw"
        ? "自動回転: 左回り"
        : "自動回転: 停止";

  return (
    <div className="highlight-controls">
      <div className="panel-action-row" aria-label="3Dビュー操作">
        <div className="panel-action-left">
          <button
            type="button"
            className="panel-action-button panel-action-button-reset"
            aria-label="設定を初期化する"
            title="設定を初期化する"
            onClick={onRequestReset}
          >
            <EraserIcon />
          </button>
        </div>
        <div className="panel-action-buttons">
          <button
            type="button"
            className={`panel-action-button ${isAutoRotateActive ? "is-active" : ""}`}
            aria-label={autoRotateLabel}
            title={autoRotateLabel}
            onClick={onToggleAutoRotate}
          >
            {autoRotateMode === "ccw" ? <RotateCcwIcon /> : <RotateCwIcon />}
          </button>

          <button
            type="button"
            className={`panel-action-button ${northLockEnabled ? "is-active" : ""}`}
            aria-label={northLockEnabled ? "基準方位に固定する" : "基準方位固定を解除する"}
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

      <div className="control-group">
        <div className="rotation-speed-control">
          <div className="rotation-speed-header">
            <span className="custom-dropdown-label">球サイズ</span>
          </div>
          <input
            type="range"
            className="rotation-speed-slider"
            min={0.5}
            max={1}
            step={0.05}
            value={sphereScale}
            onChange={(event) => onSphereScaleChange(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="control-group">
        <div className="rotation-speed-control">
          <div className="rotation-speed-header">
            <span className="custom-dropdown-label">回転速度</span>
            <span className="rotation-speed-value">{autoRotateRpm.toFixed(1)} rpm</span>
          </div>
          <input
            type="range"
            className="rotation-speed-slider"
            min={0.5}
            max={6}
            step={0.5}
            value={autoRotateRpm}
            disabled={autoRotateMode === "off"}
            onChange={(event) => onAutoRotateRpmChange(Number(event.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
