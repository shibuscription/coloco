import { useEffect, useRef } from "react";
import type { PccsRenderablePoint } from "../utils/pccs3d";
import type { SwipeDirection } from "../utils/pccsNavigation";

type FullscreenColorCardProps = {
  selectedPoint: PccsRenderablePoint;
  onClose: () => void;
  onSwipeNavigate: (direction: SwipeDirection) => void;
};

type Point = {
  x: number;
  y: number;
};

type GestureAxis = "horizontal" | "vertical" | null;

type GestureState = {
  start: Point;
  current: Point;
  axis: GestureAxis;
};

const AXIS_LOCK_THRESHOLD_PX = 14;
const SWIPE_TRIGGER_PX = 34;
const HORIZONTAL_BIAS_RATIO = 0.82;
const VERTICAL_BIAS_RATIO = 1.18;

const getContrastTextColor = (hex: string): string => {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;

  return luminance > 145 ? "#2b251d" : "#fffaf1";
};

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="fullscreen-color-card-icon">
      <path
        d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 9L4 4M15 9l5-5M15 15l5 5M9 15l-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="fullscreen-color-card-icon">
      <path
        d="M10 4H4v6M14 4h6v6M20 14v6h-6M4 14v6h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 9L4 10M15 9l5 1M15 15l5-1M9 15l-5-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const resolveGestureAxis = (deltaX: number, deltaY: number): GestureAxis => {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (Math.max(absX, absY) < AXIS_LOCK_THRESHOLD_PX) {
    return null;
  }

  if (absX >= absY * HORIZONTAL_BIAS_RATIO) {
    return "horizontal";
  }

  if (absY >= absX * VERTICAL_BIAS_RATIO) {
    return "vertical";
  }

  return absX >= absY ? "horizontal" : "vertical";
};

export function FullscreenEntryButton({
  colorHex,
  onClick,
}: {
  colorHex: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="color-chip-fullscreen-button"
      style={{ color: getContrastTextColor(colorHex) }}
      aria-label="全画面カラーカードで表示"
      title="全画面カラーカードで表示"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <ExpandIcon />
    </button>
  );
}

export function FullscreenColorCard({ selectedPoint, onClose, onSwipeNavigate }: FullscreenColorCardProps) {
  const overlayRef = useRef<HTMLElement | null>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const textColor = getContrastTextColor(selectedPoint.hex);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverscroll = root.style.overscrollBehavior;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    root.classList.add("fullscreen-color-card-scroll-lock");
    body.classList.add("fullscreen-color-card-scroll-lock");
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";

    const overlay = overlayRef.current;
    const preventTouchScroll = (event: TouchEvent) => {
      event.preventDefault();
    };

    overlay?.addEventListener("touchmove", preventTouchScroll, { passive: false });

    return () => {
      overlay?.removeEventListener("touchmove", preventTouchScroll);
      root.classList.remove("fullscreen-color-card-scroll-lock");
      body.classList.remove("fullscreen-color-card-scroll-lock");
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      root.style.overscrollBehavior = previousRootOverscroll;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    gestureRef.current = {
      start: { x: event.clientX, y: event.clientY },
      current: { x: event.clientX, y: event.clientY },
      axis: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) {
      return;
    }

    gesture.current = { x: event.clientX, y: event.clientY };

    if (gesture.axis === null) {
      gesture.axis = resolveGestureAxis(event.clientX - gesture.start.x, event.clientY - gesture.start.y);
    }

    if (gesture.axis !== null) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    gestureRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!gesture) {
      return;
    }

    const deltaX = gesture.current.x - gesture.start.x;
    const deltaY = gesture.current.y - gesture.start.y;
    const axis = gesture.axis ?? resolveGestureAxis(deltaX, deltaY);

    if (!axis) {
      return;
    }

    if (axis === "horizontal") {
      if (Math.abs(deltaX) < SWIPE_TRIGGER_PX) {
        return;
      }

      onSwipeNavigate(deltaX < 0 ? "left" : "right");
      return;
    }

    if (Math.abs(deltaY) < SWIPE_TRIGGER_PX) {
      return;
    }

    onSwipeNavigate(deltaY < 0 ? "up" : "down");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    const directionMap: Partial<Record<string, SwipeDirection>> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    const direction = directionMap[event.key];

    if (!direction) {
      return;
    }

    event.preventDefault();
    onSwipeNavigate(direction);
  };

  return (
    <section
      ref={overlayRef}
      className="fullscreen-color-card"
      style={{ background: selectedPoint.hex, color: textColor }}
      tabIndex={0}
      aria-label="全画面カラーカード"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      <div className="fullscreen-color-card-topbar">
        <div className="fullscreen-color-card-brand" aria-label="coloco">
          <span className="app-wordmark-text">coloco</span>
        </div>

        <button
          type="button"
          className="fullscreen-color-card-close"
          aria-label="通常表示に戻る"
          title="通常表示に戻る"
          style={{ color: textColor }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <MinimizeIcon />
        </button>
      </div>

      <div className="fullscreen-color-card-content">
        <div className="fullscreen-color-card-label">{selectedPoint.label}</div>
        <div className="fullscreen-color-card-meta">
          <span>{selectedPoint.pccsNotation ?? "-"}</span>
          <span>{selectedPoint.hex}</span>
        </div>
      </div>
    </section>
  );
}
