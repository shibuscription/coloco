import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { pccsAchromatic, pccsPoints } from "../data";
import type { AchromaticToneCode, ChromaticToneCode } from "../data";

type MultiSelectHighlightPanelProps = {
  selectedIds: string[];
  onToggleTile: (id: string) => void;
  onSetTilesSelected: (ids: string[], selected: boolean) => void;
  onClearAll: () => void;
  onFocusPanel: () => void;
};

type Point = { x: number; y: number };

type SelectableTile = {
  id: string;
  label: string;
  hex: string;
};

type TileRow = {
  key: string;
  tiles: SelectableTile[];
};

const LONG_PRESS_DELAY_MS = 360;
const LONG_PRESS_CANCEL_MOVE_THRESHOLD = 10;
const AUTO_SCROLL_TOP_EDGE_THRESHOLD = 44;
const AUTO_SCROLL_BOTTOM_EDGE_THRESHOLD = 88;
const AUTO_SCROLL_STEP_PX = 9;

const EVEN_HUE_INDICES = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24] as const;
const ODD_HUE_INDICES = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23] as const;
const ACHROMATIC_ORDER: AchromaticToneCode[] = ["W", "ltGy", "mGy", "dkGy", "Bk"];
const CHROMATIC_ROW_ORDER: Array<
  { key: string; toneCode: ChromaticToneCode; hueIndices: readonly number[] }
> = [
  { key: "p", toneCode: "p", hueIndices: EVEN_HUE_INDICES },
  { key: "lt", toneCode: "lt", hueIndices: EVEN_HUE_INDICES },
  { key: "b", toneCode: "b", hueIndices: EVEN_HUE_INDICES },
  { key: "v-odd", toneCode: "v", hueIndices: ODD_HUE_INDICES },
  { key: "v-even", toneCode: "v", hueIndices: EVEN_HUE_INDICES },
  { key: "dp", toneCode: "dp", hueIndices: EVEN_HUE_INDICES },
  { key: "dk", toneCode: "dk", hueIndices: EVEN_HUE_INDICES },
  { key: "dkg", toneCode: "dkg", hueIndices: EVEN_HUE_INDICES },
  { key: "ltg", toneCode: "ltg", hueIndices: EVEN_HUE_INDICES },
  { key: "sf", toneCode: "sf", hueIndices: EVEN_HUE_INDICES },
  { key: "s", toneCode: "s", hueIndices: EVEN_HUE_INDICES },
  { key: "d", toneCode: "d", hueIndices: EVEN_HUE_INDICES },
  { key: "g", toneCode: "g", hueIndices: EVEN_HUE_INDICES },
];

const getDistance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

const getContrastTextColor = (hex: string): string => {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;

  return luminance > 145 ? "#2b251d" : "#fffaf1";
};

const buildTileRows = (): TileRow[] => {
  const chromaticMap = new Map(
    pccsPoints.map((point) => [`${point.toneCode}-${point.hueIndex24}`, point] as const),
  );
  const achromaticMap = new Map(pccsAchromatic.map((point) => [point.toneCode, point] as const));

  const chromaticRows = CHROMATIC_ROW_ORDER.map((row) => ({
    key: row.key,
    tiles: row.hueIndices
      .map((hueIndex24) => chromaticMap.get(`${row.toneCode}-${hueIndex24}`))
      .filter((point): point is NonNullable<typeof point> => Boolean(point))
      .map((point) => ({
        id: point.id,
        label: `${point.toneCode}${point.hueIndex24}`,
        hex: point.hex,
      })),
  }));

  const achromaticRow: TileRow = {
    key: "achromatic",
    tiles: ACHROMATIC_ORDER.map((toneCode) => achromaticMap.get(toneCode))
      .filter((point): point is NonNullable<typeof point> => Boolean(point))
      .map((point) => ({
        id: point.id,
        label: point.toneCode,
        hex: point.hex,
      })),
  };

  return [...chromaticRows, achromaticRow];
};

export function MultiSelectHighlightPanel({
  selectedIds,
  onToggleTile,
  onSetTilesSelected,
  onClearAll,
  onFocusPanel,
}: MultiSelectHighlightPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const pendingTilePressRef = useRef<{ pointerId: number; tileId: string; startPoint: Point } | null>(null);
  const dragSelectionRef = useRef<{
    pointerId: number;
    selected: boolean;
    processedIds: Set<string>;
    lastClientX: number;
    lastClientY: number;
  } | null>(null);
  const [isBulkSelecting, setIsBulkSelecting] = useState(false);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const tileRows = useMemo(() => buildTileRows(), []);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const clearAutoScroll = () => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const endBulkSelection = () => {
    clearAutoScroll();
    clearLongPressTimer();
    pendingTilePressRef.current = null;
    dragSelectionRef.current = null;
    setIsBulkSelecting(false);
  };

  const applyBulkSelectionToTile = (tileId: string) => {
    const dragSelection = dragSelectionRef.current;
    if (!dragSelection || dragSelection.processedIds.has(tileId)) {
      return;
    }

    dragSelection.processedIds.add(tileId);
    onSetTilesSelected([tileId], dragSelection.selected);
  };

  const applyTileAtClientPoint = (clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY);
    const tile = target instanceof HTMLElement ? target.closest<HTMLButtonElement>("[data-multi-tile-id]") : null;
    const tileId = tile?.dataset.multiTileId;
    if (!tileId) {
      return;
    }

    applyBulkSelectionToTile(tileId);
  };

  const runAutoScroll = () => {
    const scrollElement = scrollRef.current;
    const dragSelection = dragSelectionRef.current;
    if (!scrollElement || !dragSelection) {
      autoScrollFrameRef.current = null;
      return;
    }

    applyTileAtClientPoint(dragSelection.lastClientX, dragSelection.lastClientY);

    const rect = scrollElement.getBoundingClientRect();
    let deltaY = 0;

    if (dragSelection.lastClientY <= rect.top + AUTO_SCROLL_TOP_EDGE_THRESHOLD) {
      deltaY = -AUTO_SCROLL_STEP_PX;
    } else if (dragSelection.lastClientY >= rect.bottom - AUTO_SCROLL_BOTTOM_EDGE_THRESHOLD) {
      deltaY = AUTO_SCROLL_STEP_PX;
    }

    if (deltaY !== 0) {
      const previousScrollTop = scrollElement.scrollTop;
      scrollElement.scrollTop += deltaY;
      applyTileAtClientPoint(dragSelection.lastClientX, dragSelection.lastClientY);

      if (scrollElement.scrollTop === previousScrollTop) {
        autoScrollFrameRef.current = null;
        return;
      }
    }

    autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll);
  };

  const ensureAutoScroll = () => {
    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll);
    }
  };

  const beginBulkSelection = (pointerId: number, tileId: string, clientX: number, clientY: number) => {
    const shouldSelect = !selectedIdSet.has(tileId);
    suppressClickRef.current = true;
    dragSelectionRef.current = {
      pointerId,
      selected: shouldSelect,
      processedIds: new Set<string>(),
      lastClientX: clientX,
      lastClientY: clientY,
    };
    setIsBulkSelecting(true);
    applyBulkSelectionToTile(tileId);
    ensureAutoScroll();
  };

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (dragSelectionRef.current) {
        event.preventDefault();
      }
    };

    scrollElement.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      scrollElement.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  useEffect(() => {
    return () => {
      endBulkSelection();
    };
  }, []);

  const handleTilePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, tileId: string) => {
    onFocusPanel();

    if (event.pointerType !== "touch") {
      return;
    }

    const startPoint = { x: event.clientX, y: event.clientY };
    pendingTilePressRef.current = {
      pointerId: event.pointerId,
      tileId,
      startPoint,
    };

    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      const pending = pendingTilePressRef.current;
      if (!pending || pending.pointerId !== event.pointerId || pending.tileId !== tileId) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      beginBulkSelection(event.pointerId, tileId, startPoint.x, startPoint.y);
      pendingTilePressRef.current = null;
    }, LONG_PRESS_DELAY_MS);
  };

  const handleTilePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pending = pendingTilePressRef.current;
    if (pending && pending.pointerId === event.pointerId) {
      const movedDistance = getDistance(pending.startPoint, { x: event.clientX, y: event.clientY });
      if (movedDistance > LONG_PRESS_CANCEL_MOVE_THRESHOLD) {
        clearLongPressTimer();
        pendingTilePressRef.current = null;
      }
    }

    const dragSelection = dragSelectionRef.current;
    if (!dragSelection || dragSelection.pointerId !== event.pointerId) {
      return;
    }

    dragSelection.lastClientX = event.clientX;
    dragSelection.lastClientY = event.clientY;
    event.preventDefault();
    event.stopPropagation();
    applyTileAtClientPoint(event.clientX, event.clientY);
    ensureAutoScroll();
  };

  const handleTilePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pending = pendingTilePressRef.current;
    if (pending && pending.pointerId === event.pointerId) {
      clearLongPressTimer();
      pendingTilePressRef.current = null;
    }

    const dragSelection = dragSelectionRef.current;
    if (dragSelection && dragSelection.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      endBulkSelection();
    }
  };

  const handleTileClick = (tileId: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    onToggleTile(tileId);
  };

  return (
    <div className="multi-select-card" onPointerDown={onFocusPanel}>
      <div className="multi-select-body">
        <div className="multi-select-header">
          <button
            type="button"
            className="secondary-button secondary-button-small"
            disabled={selectedIds.length === 0}
            onClick={onClearAll}
          >
            全解除
          </button>
        </div>

        <div
          ref={scrollRef}
          className={`multi-select-scroll ${isBulkSelecting ? "is-bulk-selecting" : ""}`}
        >
          <div className="multi-select-grid">
            {tileRows.map((row) => (
              <div key={row.key} className={`multi-select-row ${row.key === "achromatic" ? "is-achromatic" : ""}`}>
                {row.tiles.map((tile) => {
                  const isSelected = selectedIdSet.has(tile.id);
                  return (
                    <button
                      key={tile.id}
                      type="button"
                      className={`analysis-tile ${isSelected ? "is-selected" : ""}`}
                      data-multi-tile-id={tile.id}
                      style={{
                        background: tile.hex,
                        color: getContrastTextColor(tile.hex),
                      }}
                      onClick={() => handleTileClick(tile.id)}
                      onPointerDown={(event) => handleTilePointerDown(event, tile.id)}
                      onPointerMove={handleTilePointerMove}
                      onPointerUp={handleTilePointerEnd}
                      onPointerCancel={handleTilePointerEnd}
                    >
                      <span className="analysis-tile-text">
                        <strong>{tile.label}</strong>
                      </span>
                      {isSelected ? (
                        <span className="analysis-check" aria-hidden="true">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
