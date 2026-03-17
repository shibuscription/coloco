import { useEffect, useRef, useState } from "react";
import type { PccsRenderablePoint } from "../utils/pccs3d";
import type { SwipeDirection } from "../utils/pccsNavigation";

type ColorInfoPanelProps = {
  selectedPoint: PccsRenderablePoint | null;
  onSwipeNavigate: (direction: SwipeDirection) => void;
};

type Point = {
  x: number;
  y: number;
};

type CopyableFieldKey = "pccs" | "munsell" | "hex" | "rgb";

const SWIPE_THRESHOLD_PX = 42;

const getContrastTextColor = (hex: string): string => {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;

  return luminance > 145 ? "#2b251d" : "#fffaf1";
};

export function ColorInfoPanel({ selectedPoint, onSwipeNavigate }: ColorInfoPanelProps) {
  const swipeStartRef = useRef<Point | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 980px)").matches : false,
  );
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<CopyableFieldKey | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const updateMatch = () => setIsMobileView(mediaQuery.matches);

    updateMatch();
    mediaQuery.addEventListener("change", updateMatch);
    return () => mediaQuery.removeEventListener("change", updateMatch);
  }, []);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    },
    [],
  );

  if (!selectedPoint) {
    return null;
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const swipeStart = swipeStartRef.current;
    swipeStartRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!swipeStart) {
      return;
    }

    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD_PX) {
      return;
    }

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      onSwipeNavigate(deltaX < 0 ? "left" : "right");
      return;
    }

    onSwipeNavigate(deltaY < 0 ? "up" : "down");
  };

  const showDetails = !isMobileView || isMobileExpanded;
  const rgbText = `${selectedPoint.rgb.r}, ${selectedPoint.rgb.g}, ${selectedPoint.rgb.b}`;

  const handleCopy = async (field: CopyableFieldKey, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);

      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }

      feedbackTimerRef.current = window.setTimeout(() => {
        setCopiedField(null);
        feedbackTimerRef.current = null;
      }, 1200);
    } catch {
      setCopiedField(null);
    }
  };

  const copyRows: Array<{ key: CopyableFieldKey; label: string; value: string }> = [
    { key: "pccs", label: "PCCS記号", value: selectedPoint.pccsNotation ?? "-" },
    { key: "munsell", label: "マンセル記号", value: selectedPoint.munsellNotation ?? "-" },
    { key: "hex", label: "HEX", value: selectedPoint.hex },
    { key: "rgb", label: "RGB", value: rgbText },
  ];

  return (
    <section
      className={`panel info-panel info-overlay-card ${isMobileView ? "is-mobile-collapsible" : ""} ${
        showDetails ? "is-expanded" : "is-collapsed"
      }`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerMove={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        className="color-chip color-chip-large"
        style={{
          background: selectedPoint.hex,
          color: getContrastTextColor(selectedPoint.hex),
        }}
      >
        <div className="color-chip-content">
          <strong>{selectedPoint.label}</strong>
          {isMobileView ? (
            <button
              type="button"
              className="color-chip-toggle"
              aria-label={showDetails ? "色情報を折りたたむ" : "色情報を展開する"}
              aria-expanded={showDetails}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsMobileExpanded((current) => !current);
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <span className={`color-chip-toggle-icon ${showDetails ? "is-open" : ""}`}>⌃</span>
            </button>
          ) : null}
        </div>
      </div>

      {showDetails ? (
        <dl className="info-grid info-grid-compact">
          {copyRows.map((row) => (
            <div key={row.key} className="info-grid-row">
              <dt>{row.label}</dt>
              <dd>
                <div className="info-value-row">
                  <span className="info-value-text">{row.value}</span>
                  <button
                    type="button"
                    className={`info-copy-button ${copiedField === row.key ? "is-copied" : ""}`}
                    aria-label={`${row.label}をコピー`}
                    title={`${row.label}をコピー`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleCopy(row.key, row.value);
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    {copiedField === row.key ? "✓" : "⧉"}
                  </button>
                </div>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
