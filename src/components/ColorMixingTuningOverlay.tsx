import { useMemo, useState } from "react";
import { getLabDistance, rgbToLab } from "../utils/color";
import {
  DEFAULT_ADDITIVE_TUNING_PARAMS,
  DEFAULT_SUBTRACTIVE_TUNING_PARAMS,
  mixAdditiveColorsTuned,
  mixSubtractiveColorsTuned,
  type AdditiveMixMode,
  type AdditiveTuningParams,
  type SubtractiveMixMode,
  type SubtractiveTuningParams,
} from "../utils/colorMixing";
import { COLOR_MIXING_TUNING_CASES } from "../utils/colorMixingTuningCases";

type ColorMixingTuningOverlayProps = {
  onClose: () => void;
};

const additiveModeOptions: Array<{ value: AdditiveMixMode; label: string }> = [
  { value: "linear-rgb", label: "線形RGB" },
  { value: "srgb-average", label: "RGB平均" },
  { value: "perceptual-average", label: "知覚平均" },
];

const subtractiveModeOptions: Array<{ value: SubtractiveMixMode; label: string }> = [
  { value: "multiply", label: "乗算系" },
  { value: "soft-multiply", label: "やわらかめ" },
  { value: "cmy-average", label: "CMY平均" },
];

const additiveControlDefs: Array<{
  key: keyof AdditiveTuningParams;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "gamma", label: "gamma", min: 0.4, max: 3, step: 0.05 },
  { key: "saturationBoost", label: "saturationBoost", min: 0.5, max: 1.8, step: 0.01 },
  { key: "brightnessBias", label: "brightnessBias", min: -0.25, max: 0.25, step: 0.01 },
  { key: "mixExponent", label: "mixExponent", min: 0.5, max: 2.2, step: 0.01 },
  { key: "perceptualWeight", label: "perceptualWeight", min: 0, max: 1, step: 0.01 },
];

const subtractiveControlDefs: Array<{
  key: keyof SubtractiveTuningParams;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "blackInfluence", label: "blackInfluence", min: 0, max: 1, step: 0.01 },
  { key: "chromaRetention", label: "chromaRetention", min: 0.4, max: 1.8, step: 0.01 },
  { key: "softness", label: "softness", min: 0, max: 1, step: 0.01 },
  { key: "cmyWeight", label: "cmyWeight", min: 0, max: 1, step: 0.01 },
  { key: "darkeningCurve", label: "darkeningCurve", min: 0.4, max: 2.2, step: 0.01 },
];

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="mixing-overlay-back-icon">
      <path
        d="M15 5l-7 7 7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type TuningNumericControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (nextValue: number) => void;
};

function TuningNumericControl({ label, value, min, max, step, onChange }: TuningNumericControlProps) {
  return (
    <label className="mixing-tuning-control">
      <span className="mixing-tuning-control-label">{label}</span>
      <div className="mixing-tuning-control-inputs">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            if (!Number.isFinite(parsed)) {
              return;
            }
            onChange(parsed);
          }}
        />
      </div>
    </label>
  );
}

export function ColorMixingTuningOverlay({ onClose }: ColorMixingTuningOverlayProps) {
  const [additiveParams, setAdditiveParams] = useState<AdditiveTuningParams>(DEFAULT_ADDITIVE_TUNING_PARAMS);
  const [subtractiveParams, setSubtractiveParams] = useState<SubtractiveTuningParams>(DEFAULT_SUBTRACTIVE_TUNING_PARAMS);
  const [copyLabel, setCopyLabel] = useState("Copy");

  const caseResults = useMemo(
    () =>
      COLOR_MIXING_TUNING_CASES.map((mixingCase) => {
        const additiveResult = mixAdditiveColorsTuned(
          mixingCase.additive.colors,
          mixingCase.additive.ratios,
          additiveParams,
        );
        const subtractiveResult = mixSubtractiveColorsTuned(
          mixingCase.subtractive.colors,
          mixingCase.subtractive.ratios,
          subtractiveParams,
        );

        const normalized = mixingCase.targetHex.replace("#", "");
        const targetRgb = {
          r: Number.parseInt(normalized.slice(0, 2), 16),
          g: Number.parseInt(normalized.slice(2, 4), 16),
          b: Number.parseInt(normalized.slice(4, 6), 16),
        };
        const targetLab = rgbToLab(targetRgb);

        return {
          ...mixingCase,
          additiveResult,
          subtractiveResult,
          additiveError: additiveResult ? getLabDistance(rgbToLab(additiveResult), targetLab) : null,
          subtractiveError: subtractiveResult ? getLabDistance(rgbToLab(subtractiveResult), targetLab) : null,
        };
      }),
    [additiveParams, subtractiveParams],
  );

  const additiveTotalError = useMemo(
    () => caseResults.reduce((sum, item) => sum + (item.additiveError ?? 0), 0),
    [caseResults],
  );
  const subtractiveTotalError = useMemo(
    () => caseResults.reduce((sum, item) => sum + (item.subtractiveError ?? 0), 0),
    [caseResults],
  );

  const tuningParamsText = useMemo(() => {
    const formatValue = (value: string | number) =>
      typeof value === "string" ? `'${value}'` : Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(4))}`;

    return [
      "const tuningParams = {",
      "  additive: {",
      `    mode: ${formatValue(additiveParams.mode)},`,
      ...additiveControlDefs.map(
        (control) => `    ${control.key}: ${formatValue(additiveParams[control.key] as number)},`,
      ),
      "  },",
      "  subtractive: {",
      `    mode: ${formatValue(subtractiveParams.mode)},`,
      ...subtractiveControlDefs.map(
        (control) => `    ${control.key}: ${formatValue(subtractiveParams[control.key] as number)},`,
      ),
      "  },",
      "};",
    ].join("\n");
  }, [additiveParams, subtractiveParams]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tuningParamsText);
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Copy failed");
    }
    window.setTimeout(() => setCopyLabel("Copy"), 1200);
  };

  return (
    <section
      className="mixing-overlay-layer mixing-tuning-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mixing-tuning-title"
    >
      <div className="mixing-overlay-backdrop" onClick={onClose} />
      <div className="mixing-overlay-card mixing-tuning-card">
        <header className="mixing-overlay-header">
          <button type="button" className="mixing-overlay-back-button" aria-label="閉じる" onClick={onClose}>
            <BackIcon />
          </button>
          <div className="mixing-tuning-title-block">
            <h2 id="mixing-tuning-title" className="mixing-overlay-title">
              混色チューニング
            </h2>
            <p className="mixing-tuning-subtitle">一時検証UI / 色彩士検定3級の4ケース比較</p>
          </div>
        </header>

        <div className="mixing-overlay-body mixing-tuning-body">
          <div className="mixing-tuning-layout">
            <div className="mixing-tuning-column mixing-tuning-column-params">
              <section className="mixing-overlay-section mixing-tuning-panel">
                <div className="mixing-tuning-column-header">
                  <h3 className="mixing-overlay-section-title">Parameters</h3>
                  <span className="mixing-tuning-column-note">左で値を触って、中央の4ケースへ反映</span>
                </div>

                <div className="mixing-tuning-subsection">
                  <h4 className="mixing-tuning-subsection-title">加法混色</h4>
                  <div className="mixing-mode-switch" role="tablist" aria-label="加法混色のモード">
                    {additiveModeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={additiveParams.mode === option.value}
                        className={`mixing-mode-chip ${additiveParams.mode === option.value ? "is-active" : ""}`}
                        onClick={() => setAdditiveParams((current) => ({ ...current, mode: option.value }))}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="mixing-tuning-control-list">
                    {additiveControlDefs.map((control) => (
                      <TuningNumericControl
                        key={control.key}
                        label={control.label}
                        value={additiveParams[control.key] as number}
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        onChange={(nextValue) =>
                          setAdditiveParams((current) => ({ ...current, [control.key]: nextValue }))
                        }
                      />
                    ))}
                  </div>
                </div>

                <div className="mixing-tuning-subsection">
                  <h4 className="mixing-tuning-subsection-title">減法混色</h4>
                  <div className="mixing-mode-switch" role="tablist" aria-label="減法混色のモード">
                    {subtractiveModeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={subtractiveParams.mode === option.value}
                        className={`mixing-mode-chip ${subtractiveParams.mode === option.value ? "is-active" : ""}`}
                        onClick={() => setSubtractiveParams((current) => ({ ...current, mode: option.value }))}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="mixing-tuning-control-list">
                    {subtractiveControlDefs.map((control) => (
                      <TuningNumericControl
                        key={control.key}
                        label={control.label}
                        value={subtractiveParams[control.key] as number}
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        onChange={(nextValue) =>
                          setSubtractiveParams((current) => ({ ...current, [control.key]: nextValue }))
                        }
                      />
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <div className="mixing-tuning-column mixing-tuning-column-cases">
              <section className="mixing-overlay-section">
                <div className="mixing-tuning-column-header">
                  <h3 className="mixing-overlay-section-title">Cases</h3>
                  <span className="mixing-tuning-column-note">期待色 / 加法 / 減法を同時比較</span>
                </div>

                <div className="mixing-tuning-cases">
                  {caseResults.map((mixingCase) => (
                    <article key={mixingCase.id} className="mixing-tuning-case-card">
                      <div className="mixing-tuning-case-header">
                        <div>
                          <h3 className="mixing-overlay-section-title">{mixingCase.label}</h3>
                          {mixingCase.note ? <p className="mixing-tuning-case-note">{mixingCase.note}</p> : null}
                        </div>
                      </div>

                      <div className="mixing-tuning-compare-strip">
                        <div className="mixing-tuning-compare-item">
                          <span>期待</span>
                          <i
                            className="mixing-tuning-color-chip is-large"
                            style={{ background: mixingCase.targetHex }}
                            aria-hidden="true"
                          />
                          <code>{mixingCase.targetHex}</code>
                        </div>
                        <div className="mixing-tuning-compare-item">
                          <span>加法</span>
                          <i
                            className="mixing-tuning-color-chip is-large"
                            style={{ background: mixingCase.additiveResult?.hex ?? "#FFFFFF" }}
                            aria-hidden="true"
                          />
                          <code>{mixingCase.additiveResult?.hex ?? "N/A"}</code>
                        </div>
                        <div className="mixing-tuning-compare-item">
                          <span>減法</span>
                          <i
                            className="mixing-tuning-color-chip is-large"
                            style={{ background: mixingCase.subtractiveResult?.hex ?? "#FFFFFF" }}
                            aria-hidden="true"
                          />
                          <code>{mixingCase.subtractiveResult?.hex ?? "N/A"}</code>
                        </div>
                      </div>

                      <div className="mixing-tuning-case-grid">
                        <section className="mixing-tuning-result-block">
                          <div className="mixing-tuning-result-header">
                            <strong>加法混色</strong>
                            <span>正解 {mixingCase.additive.answer}</span>
                          </div>
                          <p className="mixing-tuning-input-note">{mixingCase.additive.note}</p>
                          <div className="mixing-tuning-input-colors">
                            {mixingCase.additive.colors.map((color, index) => (
                              <span key={`${mixingCase.id}-add-${color.label}`} className="mixing-tuning-color-pill">
                                <i className="mixing-tuning-color-chip" style={{ background: color.hex }} aria-hidden="true" />
                                {color.label} {mixingCase.additive.ratios[index]}%
                              </span>
                            ))}
                          </div>
                          <div className="mixing-tuning-result-metrics">
                            <code>{mixingCase.additiveResult?.hex ?? "N/A"}</code>
                            <div className="mixing-tuning-error">誤差 {mixingCase.additiveError?.toFixed(2) ?? "N/A"}</div>
                          </div>
                        </section>

                        <section className="mixing-tuning-result-block">
                          <div className="mixing-tuning-result-header">
                            <strong>減法混色</strong>
                            <span>正解 {mixingCase.subtractive.answer}</span>
                          </div>
                          <p className="mixing-tuning-input-note">{mixingCase.subtractive.note}</p>
                          <div className="mixing-tuning-input-colors">
                            {mixingCase.subtractive.colors.map((color, index) => (
                              <span key={`${mixingCase.id}-sub-${color.label}`} className="mixing-tuning-color-pill">
                                <i className="mixing-tuning-color-chip" style={{ background: color.hex }} aria-hidden="true" />
                                {color.label} {Math.round(mixingCase.subtractive.ratios[index])}%
                              </span>
                            ))}
                          </div>
                          <div className="mixing-tuning-result-metrics">
                            <code>{mixingCase.subtractiveResult?.hex ?? "N/A"}</code>
                            <div className="mixing-tuning-error">誤差 {mixingCase.subtractiveError?.toFixed(2) ?? "N/A"}</div>
                          </div>
                        </section>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <div className="mixing-tuning-column mixing-tuning-column-export">
              <section className="mixing-overlay-section mixing-tuning-panel">
                <div className="mixing-tuning-column-header">
                  <h3 className="mixing-overlay-section-title">Export / Scores</h3>
                  <span className="mixing-tuning-column-note">現在値をそのままコピー</span>
                </div>

                <div className="mixing-tuning-export-actions">
                  <button type="button" className="secondary-button" onClick={handleCopy}>
                    {copyLabel}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setAdditiveParams(DEFAULT_ADDITIVE_TUNING_PARAMS);
                      setSubtractiveParams(DEFAULT_SUBTRACTIVE_TUNING_PARAMS);
                    }}
                  >
                    Reset
                  </button>
                </div>

                <div className="mixing-tuning-summary">
                  <div className="mixing-tuning-score-card">
                    <strong>加法 total error</strong>
                    <span>{additiveTotalError.toFixed(2)}</span>
                    <small>avg {(additiveTotalError / caseResults.length).toFixed(2)}</small>
                  </div>
                  <div className="mixing-tuning-score-card">
                    <strong>減法 total error</strong>
                    <span>{subtractiveTotalError.toFixed(2)}</span>
                    <small>avg {(subtractiveTotalError / caseResults.length).toFixed(2)}</small>
                  </div>
                  <div className="mixing-tuning-score-card">
                    <strong>overall</strong>
                    <span>{(additiveTotalError + subtractiveTotalError).toFixed(2)}</span>
                    <small>4ケース合計</small>
                  </div>
                </div>

                <textarea className="mixing-tuning-export-textarea" value={tuningParamsText} readOnly />
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
