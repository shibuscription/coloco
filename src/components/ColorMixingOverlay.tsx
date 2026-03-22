import { useEffect, useMemo, useRef, useState } from "react";
import {
  clampMixRatiosAroundBoundary,
  DEFAULT_ADDITIVE_TUNING_PARAMS,
  DEFAULT_SUBTRACTIVE_TUNING_PARAMS,
  getEqualMixRatios,
  hexToRgb,
  MIN_MIX_RATIO,
  mixAdditiveColorsTuned,
  mixSubtractiveColorsTuned,
  updateMixRatioWithSinglePartner,
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

type MixingResultPanelProps = {
  kind: string;
  hex: string;
  nearestPccs: PccsLabEntry | null;
};

const PIE_SIZE = 220;
const PIE_RADIUS = 92;
const PIE_CENTER = PIE_SIZE / 2;
const HANDLE_HIT_WIDTH = 24;
const RATIO_REPEAT_DELAY_MS = 350;
const RATIO_REPEAT_INTERVAL_MS = 90;

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

const getReadableTextColor = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return "#fffaf4";
  }

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.58 ? "#2b251d" : "#fffaf4";
};

function MixingResultPanel({ kind, hex, nearestPccs }: MixingResultPanelProps) {
  const textColor = getReadableTextColor(hex);

  return (
    <section className="mixing-result-panel" style={{ background: hex, color: textColor }} aria-label={`${kind} ${hex}`}>
      <div className="mixing-result-panel-meta">
        <span className="mixing-result-panel-kind">{kind}</span>
        {nearestPccs ? (
          <>
            <strong className="mixing-result-panel-label">{nearestPccs.pccsShortLabel}</strong>
            <span className="mixing-result-panel-notation">{nearestPccs.pccsLabel}</span>
          </>
        ) : (
          <>
            <strong className="mixing-result-panel-label">PCCS未判定</strong>
            <span className="mixing-result-panel-notation">-</span>
          </>
        )}
      </div>
    </section>
  );
}

export function ColorMixingOverlay({ colors, palette, onClose }: ColorMixingOverlayProps) {
  const isValid = colors.length >= 2 && colors.length <= 4;
  const [ratios, setRatios] = useState<number[]>(() => getEqualMixRatios(colors.length));
  const [ratioInputs, setRatioInputs] = useState<string[]>(() => getEqualMixRatios(colors.length).map(formatRatioInput));
  const [isDraggingRatio, setIsDraggingRatio] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const ratioPressStateRef = useRef<RatioPressState | null>(null);
  const activeRatioPointerIdRef = useRef<number | null>(null);
  const ratioRepeatDelayRef = useRef<number | null>(null);
  const ratioRepeatIntervalRef = useRef<number | null>(null);

  const pieSlices = useMemo(() => buildPieSlices(colors, ratios), [colors, ratios]);
  const additiveMix = useMemo(
    () => mixAdditiveColorsTuned(colors, ratios, DEFAULT_ADDITIVE_TUNING_PARAMS),
    [colors, ratios],
  );
  const subtractiveMix = useMemo(
    () => mixSubtractiveColorsTuned(colors, ratios, DEFAULT_SUBTRACTIVE_TUNING_PARAMS),
    [colors, ratios],
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

  const stopRatioStepRepeat = (pointerId?: number) => {
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

  useEffect(() => {
    const handleGlobalPointerUp = (event: PointerEvent) => {
      stopRatioStepRepeat(event.pointerId);
    };

    const handleGlobalMouseUp = () => {
      stopRatioStepRepeat();
    };

    const handleGlobalTouchEnd = () => {
      stopRatioStepRepeat();
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
      stopRatioStepRepeat();
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

  const startRatioStepRepeat = (index: number, delta: number, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    const target = event.currentTarget;

    stopRatioStepRepeat();

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
          stopRatioStepRepeat(pointerId);
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
                </div>
              </section>

              <section className="mixing-overlay-section mixing-overview-grid">
                <div className="mixing-overview-pane mixing-overview-chart">
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
                    </svg>
                  </div>
                </div>

                <div className="mixing-overview-pane mixing-overview-ratios">
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
                            onPointerUp={(event) => stopRatioStepRepeat(event.pointerId)}
                            onPointerCancel={(event) => stopRatioStepRepeat(event.pointerId)}
                            onLostPointerCapture={(event) => stopRatioStepRepeat(event.pointerId)}
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
                            onPointerUp={(event) => stopRatioStepRepeat(event.pointerId)}
                            onPointerCancel={(event) => stopRatioStepRepeat(event.pointerId)}
                            onLostPointerCapture={(event) => stopRatioStepRepeat(event.pointerId)}
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

              {additiveMix ? (
                <MixingResultPanel kind="加法混色" hex={additiveMix.hex} nearestPccs={additiveNearestPccs} />
              ) : null}

              {subtractiveMix ? (
                <MixingResultPanel kind="減法混色" hex={subtractiveMix.hex} nearestPccs={subtractiveNearestPccs} />
              ) : null}
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
