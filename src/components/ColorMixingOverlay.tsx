import { useEffect, useMemo, useRef, useState } from "react";
import {
  clampMixRatiosAroundBoundary,
  getEqualMixRatios,
  MIN_MIX_RATIO,
  mixAdditiveColors,
  mixSubtractiveColors,
  updateMixRatioWithSinglePartner,
  type AdditiveMixMode,
  type SubtractiveMixMode,
} from "../utils/colorMixing";
import { findNearestPccsEntryByRgb, type PccsLabEntry } from "../utils/imageClassification";

type MixingColorItem = {
  id: string;
  label: string;
  hex: string;
  pccsNotation?: string;
};

type ColorMixingOverlayProps = {
  colors: MixingColorItem[];
  palette: PccsLabEntry[];
  onClose: () => void;
};

type PieSlice = {
  id: string;
  hex: string;
  path: string;
};

type DragState = {
  pointerId: number;
  boundaryIndex: number;
};

type RatioPressState = {
  pointerId: number;
  index: number;
  delta: number;
};

type MixingResultCardProps = {
  title: string;
  description: string;
  hex: string;
  r: number;
  g: number;
  b: number;
  ariaLabelPrefix: string;
  nearestPccs: PccsLabEntry | null;
};

const PIE_SIZE = 220;
const PIE_RADIUS = 92;
const PIE_CENTER = PIE_SIZE / 2;
const HANDLE_HIT_WIDTH = 24;
const RATIO_REPEAT_DELAY_MS = 350;
const RATIO_REPEAT_INTERVAL_MS = 90;
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

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`mixing-accordion-icon ${isOpen ? "is-open" : ""}`}
    >
      <path
        d="M7 10l5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MixingResultCard({
  title,
  description,
  hex,
  r,
  g,
  b,
  ariaLabelPrefix,
  nearestPccs,
}: MixingResultCardProps) {
  return (
    <div className="mixing-result-card">
      <div className="mixing-result-swatch" style={{ background: hex }} aria-label={`${ariaLabelPrefix} ${hex}`} />
      <div className="mixing-result-meta">
        <strong className="mixing-result-title">{title}</strong>
        <p className="mixing-result-description">{description}</p>
        <dl className="mixing-result-values">
          <div className="mixing-result-row">
            <dt>HEX</dt>
            <dd>{hex}</dd>
          </div>
          <div className="mixing-result-row">
            <dt>RGB</dt>
            <dd>{`rgb(${r}, ${g}, ${b})`}</dd>
          </div>
        </dl>
        {nearestPccs ? (
          <div className="mixing-nearest-card">
            <strong className="mixing-nearest-title">PCCS近似色</strong>
            <div className="mixing-nearest-body">
              <div
                className="mixing-nearest-swatch"
                style={{ background: nearestPccs.hex }}
                aria-label={`PCCS近似色 ${nearestPccs.hex}`}
              />
              <dl className="mixing-nearest-values">
                <div className="mixing-result-row">
                  <dt>PCCS</dt>
                  <dd>{nearestPccs.pccsLabel}</dd>
                </div>
                <div className="mixing-result-row">
                  <dt>Label</dt>
                  <dd>{nearestPccs.pccsShortLabel}</dd>
                </div>
                <div className="mixing-result-row">
                  <dt>HEX</dt>
                  <dd>{nearestPccs.hex}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const formatRatioInput = (ratio: number): string => `${Math.round(ratio)}`;

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleDeg: number) => {
  const angleInRadians = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describePieSlice = (startAngle: number, endAngle: number) => {
  const end = polarToCartesian(PIE_CENTER, PIE_CENTER, PIE_RADIUS, endAngle);
  const start = polarToCartesian(PIE_CENTER, PIE_CENTER, PIE_RADIUS, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${PIE_CENTER} ${PIE_CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${PIE_RADIUS} ${PIE_RADIUS} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
};

const buildPieSlices = (colors: MixingColorItem[], ratios: number[]): PieSlice[] => {
  let currentAngle = 0;

  return colors.map((color, index) => {
    const ratio = ratios[index] ?? 0;
    const sweep = (ratio / 100) * 360;
    const path = describePieSlice(currentAngle, currentAngle + sweep);
    currentAngle += sweep;

    return {
      id: color.id,
      hex: color.hex,
      path,
    };
  });
};

const getAdditiveResultTitle = (mode: AdditiveMixMode) => {
  switch (mode) {
    case "srgb-average":
      return "sRGB 平均ベースの加法混色";
    case "perceptual-average":
      return "Lab 平均ベースの知覚寄り混色";
    default:
      return "線形 RGB ベースの加法混色";
  }
};

const getAdditiveResultDescription = (mode: AdditiveMixMode) => {
  switch (mode) {
    case "srgb-average":
      return "見た目比較用として、RGB をそのまま平均した簡易モデルです。";
    case "perceptual-average":
      return "Lab 空間で平均してから RGB に戻した、知覚寄りの比較モデルです。";
    default:
      return "光の混色を意識して、線形 RGB で加重平均した基準モデルです。";
  }
};

const getSubtractiveResultTitle = (mode: SubtractiveMixMode) => {
  switch (mode) {
    case "multiply":
      return "乗算ベースの減法混色";
    case "cmy-average":
      return "CMY 平均ベースの近似混色";
    default:
      return "やわらかめの減法混色";
  }
};

const getSubtractiveResultDescription = (mode: SubtractiveMixMode) => {
  switch (mode) {
    case "multiply":
      return "暗く沈みやすい基準モデルです。顔料が強く影響する見え方を比較できます。";
    case "cmy-average":
      return "CMY に変換して平均する、教材比較向けの簡易モデルです。";
    default:
      return "乗算系を少し緩めて、黒落ちしすぎにくくした比較モデルです。";
  }
};

export function ColorMixingOverlay({ colors, palette, onClose }: ColorMixingOverlayProps) {
  const isValid = colors.length >= 2 && colors.length <= 4;
  const [ratios, setRatios] = useState<number[]>(() => getEqualMixRatios(colors.length));
  const [ratioInputs, setRatioInputs] = useState<string[]>(() => getEqualMixRatios(colors.length).map(formatRatioInput));
  const [isDraggingRatio, setIsDraggingRatio] = useState(false);
  const [additiveMode, setAdditiveMode] = useState<AdditiveMixMode>("linear-rgb");
  const [subtractiveMode, setSubtractiveMode] = useState<SubtractiveMixMode>("soft-multiply");
  const [isAdditiveOpen, setIsAdditiveOpen] = useState(true);
  const [isSubtractiveOpen, setIsSubtractiveOpen] = useState(true);
  const barRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const ratioPressStateRef = useRef<RatioPressState | null>(null);
  const activeRatioPointerIdRef = useRef<number | null>(null);
  const ratioRepeatDelayRef = useRef<number | null>(null);
  const ratioRepeatIntervalRef = useRef<number | null>(null);
  const pieSlices = useMemo(() => buildPieSlices(colors, ratios), [colors, ratios]);
  const additiveMix = useMemo(
    () => mixAdditiveColors(colors, ratios, additiveMode),
    [additiveMode, colors, ratios],
  );
  const subtractiveMix = useMemo(
    () => mixSubtractiveColors(colors, ratios, subtractiveMode),
    [colors, ratios, subtractiveMode],
  );
  const additiveNearestPccs = useMemo(
    () => (additiveMix ? findNearestPccsEntryByRgb(additiveMix, palette) : null),
    [additiveMix, palette],
  );
  const subtractiveNearestPccs = useMemo(
    () => (subtractiveMix ? findNearestPccsEntryByRgb(subtractiveMix, palette) : null),
    [palette, subtractiveMix],
  );

  const cumulativeBoundaries = useMemo(() => {
    const boundaries: number[] = [];
    let sum = 0;
    for (let index = 0; index < ratios.length - 1; index += 1) {
      sum += ratios[index];
      boundaries.push(sum);
    }
    return boundaries;
  }, [ratios]);

  useEffect(() => {
    const initialRatios = getEqualMixRatios(colors.length);
    setRatios(initialRatios);
    setRatioInputs(initialRatios.map(formatRatioInput));
  }, [colors]);

  useEffect(() => {
    setRatioInputs(ratios.map(formatRatioInput));
  }, [ratios]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      const barElement = barRef.current;
      if (!dragState || !barElement || dragState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const rect = barElement.getBoundingClientRect();
      const nextBoundaryPercent = ((event.clientX - rect.left) / rect.width) * 100;

      setRatios((current) =>
        clampMixRatiosAroundBoundary(current, dragState.boundaryIndex, nextBoundaryPercent, MIN_MIX_RATIO),
      );
    };

    const endDragging = (pointerId: number) => {
      if (dragStateRef.current?.pointerId === pointerId) {
        dragStateRef.current = null;
        setIsDraggingRatio(false);
      }
    };

    const handlePointerUp = (event: PointerEvent) => endDragging(event.pointerId);
    const handlePointerCancel = (event: PointerEvent) => endDragging(event.pointerId);

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      dragStateRef.current = null;
      setIsDraggingRatio(false);
    };
  }, []);

  useEffect(() => {
    const handleGlobalPointerUp = (event: PointerEvent) => {
      stopRatioStepRepeat(event.pointerId, event.type);
    };

    const handleGlobalMouseUp = () => {
      stopRatioStepRepeat(undefined, "mouseup");
    };

    const handleGlobalTouchEnd = () => {
      stopRatioStepRepeat(undefined, "touchend");
    };

    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("touchend", handleGlobalTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleGlobalTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("touchend", handleGlobalTouchEnd);
      window.removeEventListener("touchcancel", handleGlobalTouchEnd);

      if (ratioRepeatDelayRef.current !== null) {
        window.clearTimeout(ratioRepeatDelayRef.current);
      }
      if (ratioRepeatIntervalRef.current !== null) {
        window.clearInterval(ratioRepeatIntervalRef.current);
      }
      ratioPressStateRef.current = null;
      activeRatioPointerIdRef.current = null;
    };
  }, []);

  const startBoundaryDrag = (boundaryIndex: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (!barRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragStateRef.current = {
      pointerId: event.pointerId,
      boundaryIndex,
    };
    setIsDraggingRatio(true);
  };

  const applyRatioValue = (index: number, nextValue: number) => {
    const requestedValue = Math.round(nextValue);

    setRatios((currentRatios) => {
      const nextRatios = updateMixRatioWithSinglePartner(currentRatios, index, requestedValue, MIN_MIX_RATIO);
      setRatioInputs(nextRatios.map(formatRatioInput));
      return nextRatios;
    });
  };

  const handleRatioStep = (index: number, delta: number) => {
    setRatios((currentRatios) => {
      const currentValue = Math.round(currentRatios[index] ?? 0);
      const requestedValue = currentValue + delta;
      const nextRatios = updateMixRatioWithSinglePartner(currentRatios, index, requestedValue, MIN_MIX_RATIO);
      setRatioInputs(nextRatios.map(formatRatioInput));
      return nextRatios;
    });
  };

  const stopRatioStepRepeat = (pointerId?: number, _reason = "unknown") => {
    if (pointerId !== undefined && activeRatioPointerIdRef.current !== pointerId) {
      return;
    }

    if (ratioRepeatDelayRef.current !== null) {
      window.clearTimeout(ratioRepeatDelayRef.current);
      ratioRepeatDelayRef.current = null;
    }

    if (ratioRepeatIntervalRef.current !== null) {
      window.clearInterval(ratioRepeatIntervalRef.current);
      ratioRepeatIntervalRef.current = null;
    }

    ratioPressStateRef.current = null;
    activeRatioPointerIdRef.current = null;
  };

  const startRatioStepRepeat = (index: number, delta: number, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    const target = event.currentTarget;

    stopRatioStepRepeat(undefined, "restart");

    try {
      target.setPointerCapture(pointerId);
    } catch {
      // Some touch browsers can refuse capture during edge-case gesture transitions.
    }

    activeRatioPointerIdRef.current = pointerId;
    handleRatioStep(index, delta);

    ratioPressStateRef.current = {
      pointerId,
      index,
      delta,
    };

    ratioRepeatDelayRef.current = window.setTimeout(() => {
      const pressState = ratioPressStateRef.current;
      if (!pressState || pressState.pointerId !== pointerId) {
        return;
      }

      ratioRepeatIntervalRef.current = window.setInterval(() => {
        const activePressState = ratioPressStateRef.current;
        if (!activePressState || activePressState.pointerId !== pointerId) {
          stopRatioStepRepeat(pointerId, "interval-guard-stop");
          return;
        }

        handleRatioStep(activePressState.index, activePressState.delta);
      }, RATIO_REPEAT_INTERVAL_MS);
    }, RATIO_REPEAT_DELAY_MS);
  };

  const applyRatioInput = (index: number, rawValue: string) => {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) {
      setRatioInputs((current) =>
        current.map((value, currentIndex) =>
          currentIndex === index ? formatRatioInput(ratios[index] ?? 0) : value,
        ),
      );
      return;
    }

    applyRatioValue(index, parsed);
  };

  const handleRatioInputChange = (index: number, nextValue: string) => {
    if (!/^\d*$/.test(nextValue)) {
      return;
    }

    setRatioInputs((current) => current.map((value, currentIndex) => (currentIndex === index ? nextValue : value)));
  };

  const handleRatioInputBlur = (index: number) => {
    const rawValue = ratioInputs[index] ?? "";
    if (rawValue.trim() === "") {
      setRatioInputs((current) =>
        current.map((value, currentIndex) =>
          currentIndex === index ? formatRatioInput(ratios[index] ?? 0) : value,
        ),
      );
      return;
    }

    applyRatioInput(index, rawValue);
  };

  const handleRatioInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <section className="mixing-overlay-layer" role="dialog" aria-modal="true" aria-labelledby="mixing-overlay-title">
      <div className="mixing-overlay-backdrop" onClick={onClose} />
      <div className="mixing-overlay-card">
        <header className="mixing-overlay-header">
          <button
            type="button"
            className="mixing-overlay-back-button"
            aria-label="混色画面を閉じる"
            onClick={onClose}
          >
            <BackIcon />
          </button>
          <h2 id="mixing-overlay-title" className="mixing-overlay-title">
            混色
          </h2>
        </header>

        <div className="mixing-overlay-body">
          {isValid ? (
            <>
              <section className="mixing-overlay-section">
                <h3 className="mixing-overlay-section-title">比率編集</h3>
                <div className="mixing-ratio-editor">
                  <div
                    ref={barRef}
                    className={`mixing-ratio-bar ${isDraggingRatio ? "is-dragging" : ""}`}
                    aria-label="混色比率の編集バー"
                  >
                    {colors.map((color, index) => (
                      <div
                        key={color.id}
                        className={`mixing-ratio-segment ${isDraggingRatio ? "is-dragging" : ""}`}
                        style={{
                          width: `${ratios[index] ?? 0}%`,
                          background: color.hex,
                        }}
                      />
                    ))}

                    {cumulativeBoundaries.map((boundary, index) => (
                      <button
                        key={`${colors[index].id}-${colors[index + 1]?.id ?? index}`}
                        type="button"
                        className={`mixing-ratio-handle ${isDraggingRatio ? "is-dragging" : ""}`}
                        style={{ left: `calc(${boundary}% - ${HANDLE_HIT_WIDTH / 2}px)` }}
                        aria-label={`${colors[index].label} と ${colors[index + 1]?.label ?? ""} の比率を調整`}
                        onPointerDown={(event) => startBoundaryDrag(index, event)}
                      >
                        <span className="mixing-ratio-handle-line" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                  <p className="mixing-ratio-hint">各色の割合は最低 {MIN_MIX_RATIO}% を維持します。</p>
                </div>
              </section>

              <section className="mixing-overlay-section mixing-overview-grid">
                <div className="mixing-overview-pane mixing-overview-chart">
                  <h3 className="mixing-overlay-section-title">円グラフ</h3>
                  <div className="mixing-pie-shell">
                    <svg
                      className="mixing-pie-chart"
                      viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
                      role="img"
                      aria-label="混色比率の円グラフ"
                    >
                      {pieSlices.map((slice) => (
                        <path
                          key={slice.id}
                          d={slice.path}
                          fill={slice.hex}
                          stroke="rgba(255, 252, 247, 0.72)"
                          strokeWidth="2"
                        />
                      ))}
                      <circle cx={PIE_CENTER} cy={PIE_CENTER} r="34" fill="rgba(255, 252, 247, 0.84)" />
                      <text x={PIE_CENTER} y={PIE_CENTER + 4} textAnchor="middle" className="mixing-pie-center-label">
                        100%
                      </text>
                    </svg>
                  </div>
                </div>

                <div className="mixing-overview-pane mixing-overview-ratios">
                  <h3 className="mixing-overlay-section-title">現在の比率</h3>
                  <ul className="mixing-ratio-list">
                    {colors.map((color, index) => (
                      <li key={color.id} className="mixing-ratio-row">
                        <span className="mixing-ratio-row-label">
                          <i className="mixing-ratio-chip" style={{ background: color.hex }} aria-hidden="true" />
                          <span>{color.label}</span>
                        </span>
                        <div className="mixing-ratio-input-wrap">
                          <button
                            type="button"
                            className="mixing-ratio-step-button"
                            aria-label={`${color.label} の割合を 1% 減らす`}
                            onPointerDown={(event) => startRatioStepRepeat(index, -1, event)}
                            onPointerUp={(event) => stopRatioStepRepeat(event.pointerId, "pointerup")}
                            onPointerCancel={(event) => stopRatioStepRepeat(event.pointerId, "pointercancel")}
                            onLostPointerCapture={(event) => stopRatioStepRepeat(event.pointerId, "lostpointercapture")}
                            onContextMenu={(event) => event.preventDefault()}
                          >
                            −
                          </button>
                          <label className="mixing-ratio-input-field">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="mixing-ratio-input"
                              value={ratioInputs[index] ?? ""}
                              onChange={(event) => handleRatioInputChange(index, event.target.value)}
                              onBlur={() => handleRatioInputBlur(index)}
                              onKeyDown={handleRatioInputKeyDown}
                              aria-label={`${color.label} の割合`}
                            />
                          </label>
                          <button
                            type="button"
                            className="mixing-ratio-step-button"
                            aria-label={`${color.label} の割合を 1% 増やす`}
                            onPointerDown={(event) => startRatioStepRepeat(index, 1, event)}
                            onPointerUp={(event) => stopRatioStepRepeat(event.pointerId, "pointerup")}
                            onPointerCancel={(event) => stopRatioStepRepeat(event.pointerId, "pointercancel")}
                            onLostPointerCapture={(event) => stopRatioStepRepeat(event.pointerId, "lostpointercapture")}
                            onContextMenu={(event) => event.preventDefault()}
                          >
                            +
                          </button>
                          <span className="mixing-ratio-input-unit">%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="mixing-overlay-section mixing-accordion-section">
                <button
                  type="button"
                  className="mixing-accordion-toggle"
                  aria-expanded={isAdditiveOpen}
                  onClick={() => setIsAdditiveOpen((current) => !current)}
                >
                  <span className="mixing-overlay-section-title">加法混色</span>
                  <ChevronIcon isOpen={isAdditiveOpen} />
                </button>

                {isAdditiveOpen ? (
                  <div className="mixing-accordion-content">
                    <div className="mixing-mode-switch" role="tablist" aria-label="加法混色の方式">
                      {additiveModeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="tab"
                          aria-selected={additiveMode === option.value}
                          className={`mixing-mode-chip ${additiveMode === option.value ? "is-active" : ""}`}
                          onClick={() => setAdditiveMode(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {additiveMix ? (
                      <MixingResultCard
                        title={getAdditiveResultTitle(additiveMode)}
                        description={getAdditiveResultDescription(additiveMode)}
                        hex={additiveMix.hex}
                        r={additiveMix.r}
                        g={additiveMix.g}
                        b={additiveMix.b}
                        ariaLabelPrefix="加法混色の結果色"
                        nearestPccs={additiveNearestPccs}
                      />
                    ) : (
                      <div className="mixing-overlay-placeholder">
                        <p>加法混色の結果色を表示できませんでした。</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>

              <section className="mixing-overlay-section mixing-accordion-section">
                <button
                  type="button"
                  className="mixing-accordion-toggle"
                  aria-expanded={isSubtractiveOpen}
                  onClick={() => setIsSubtractiveOpen((current) => !current)}
                >
                  <span className="mixing-overlay-section-title">減法混色</span>
                  <ChevronIcon isOpen={isSubtractiveOpen} />
                </button>

                {isSubtractiveOpen ? (
                  <div className="mixing-accordion-content">
                    <div className="mixing-mode-switch" role="tablist" aria-label="減法混色の方式">
                      {subtractiveModeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="tab"
                          aria-selected={subtractiveMode === option.value}
                          className={`mixing-mode-chip ${subtractiveMode === option.value ? "is-active" : ""}`}
                          onClick={() => setSubtractiveMode(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {subtractiveMix ? (
                      <MixingResultCard
                        title={getSubtractiveResultTitle(subtractiveMode)}
                        description={getSubtractiveResultDescription(subtractiveMode)}
                        hex={subtractiveMix.hex}
                        r={subtractiveMix.r}
                        g={subtractiveMix.g}
                        b={subtractiveMix.b}
                        ariaLabelPrefix="減法混色の結果色"
                        nearestPccs={subtractiveNearestPccs}
                      />
                    ) : (
                      <div className="mixing-overlay-placeholder">
                        <p>減法混色の結果色を表示できませんでした。</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>

            </>
          ) : (
            <section className="mixing-overlay-section mixing-overlay-placeholder">
              <p>混色は 2〜4 色選択時に利用できます。</p>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}

export type { MixingColorItem };
