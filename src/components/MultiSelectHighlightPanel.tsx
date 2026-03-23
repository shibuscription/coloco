import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { pccsAchromatic, pccsPoints } from "../data";
import type { AchromaticToneCode, ChromaticToneCode } from "../data";

type MultiSelectHighlightPanelProps = {
  selectedIds: string[];
  onToggleTile: (id: string) => void;
  onSetTilesSelected: (ids: string[], selected: boolean) => void;
  onClearAll: () => void;
  onOpenMixingPanel: () => void;
  onFocusPanel: () => void;
};

type ListSelectableTone = ChromaticToneCode | "achromatic";
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

type ToneListOption = {
  value: ListSelectableTone;
  label: string;
  hex: string;
};

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const LONG_PRESS_DELAY_MS = 360;
const LONG_PRESS_CANCEL_MOVE_THRESHOLD = 10;
const AUTO_SCROLL_TOP_EDGE_THRESHOLD = 44;
const AUTO_SCROLL_BOTTOM_EDGE_THRESHOLD = 88;
const AUTO_SCROLL_SIDE_EDGE_THRESHOLD = 44;
const AUTO_SCROLL_STEP_PX = 9;

const EVEN_HUE_INDICES = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24] as const;
const ODD_HUE_INDICES = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23] as const;
const ALL_HUE_INDICES = Array.from({ length: 24 }, (_, index) => index + 1);
const ACHROMATIC_ORDER: AchromaticToneCode[] = ["W", "ltGy", "Gy7.5", "mGy", "Gy5.5", "Gy4.5", "dkGy", "Gy2.5", "Bk"];
const CHROMATIC_ROW_ORDER: Array<{
  key: string;
  toneCode: ChromaticToneCode;
  hueIndices: readonly number[];
}> = [
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

const TONE_LIST_OPTIONS: ToneListOption[] = [
  { value: "v", label: "v（ビビッド）", hex: "#f2d533" },
  { value: "b", label: "b（ブライト）", hex: "#f0d56a" },
  { value: "s", label: "s（ストロング）", hex: "#d6b743" },
  { value: "dp", label: "dp（ディープ）", hex: "#8b6f23" },
  { value: "lt", label: "lt（ライト）", hex: "#f4e6a5" },
  { value: "sf", label: "sf（ソフト）", hex: "#d9c78e" },
  { value: "d", label: "d（ダル）", hex: "#a89157" },
  { value: "dk", label: "dk（ダーク）", hex: "#6c5c2a" },
  { value: "p", label: "p（ペール）", hex: "#f7efc8" },
  { value: "ltg", label: "ltg（ライトグレイッシュ）", hex: "#d9d0a7" },
  { value: "g", label: "g（グレイッシュ）", hex: "#9a9272" },
  { value: "dkg", label: "dkg（ダークグレイッシュ）", hex: "#5d5642" },
  { value: "achromatic", label: "無彩色", hex: "#a1a1a1" },
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
        label: point.shortLabel,
        hex: point.hex,
      })),
  };

  return [...chromaticRows, achromaticRow];
};

const getDropdownPosition = (trigger: HTMLElement): DropdownPosition => {
  const rect = trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const preferredWidth = Math.max(rect.width, 280);
  const width = Math.min(preferredWidth, viewportWidth - 32);
  const left = Math.min(rect.left, viewportWidth - width - 16);
  const top = rect.bottom + 6;
  const maxHeight = Math.max(180, viewportHeight - top - 16);

  return {
    top,
    left: Math.max(16, left),
    width,
    maxHeight,
  };
};

export function MultiSelectHighlightPanel({
  selectedIds,
  onToggleTile,
  onSetTilesSelected,
  onClearAll,
  onOpenMixingPanel,
  onFocusPanel,
}: MultiSelectHighlightPanelProps) {
  const listPickerRef = useRef<HTMLDivElement>(null);
  const listPickerButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownPortalRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const pendingDragRef = useRef<{ pointerId: number; tileId: string; startPoint: Point } | null>(null);
  const dragSelectionRef = useRef<{
    pointerId: number;
    selected: boolean;
    processedIds: Set<string>;
    lastClientX: number;
    lastClientY: number;
  } | null>(null);
  const [isBulkSelecting, setIsBulkSelecting] = useState(false);
  const [listPickerStage, setListPickerStage] = useState<"tone" | "color" | null>(null);
  const [pendingTone, setPendingTone] = useState<ListSelectableTone | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const tileRows = useMemo(() => buildTileRows(), []);
  const chromaticMap = useMemo(
    () => new Map(pccsPoints.map((point) => [`${point.toneCode}-${point.hueIndex24}`, point] as const)),
    [],
  );
  const achromaticMap = useMemo(
    () => new Map(pccsAchromatic.map((point) => [point.toneCode, point] as const)),
    [],
  );

  const listSelectableColorOptions = useMemo(() => {
    if (!pendingTone) {
      return [];
    }

    if (pendingTone === "achromatic") {
      return ACHROMATIC_ORDER.map((toneCode) => achromaticMap.get(toneCode))
        .filter((point): point is NonNullable<typeof point> => Boolean(point))
        .map((point) => ({
          id: point.id,
          label: point.shortLabel,
          hex: point.hex,
        }));
    }

    const hueIndices = pendingTone === "v" ? ALL_HUE_INDICES : [...EVEN_HUE_INDICES];

    return hueIndices
      .map((hueIndex24) => chromaticMap.get(`${pendingTone}-${hueIndex24}`))
      .filter((point): point is NonNullable<typeof point> => Boolean(point))
      .map((point) => ({
        id: point.id,
        label: `${point.toneCode}${point.hueIndex24}`,
        hex: point.hex,
      }));
  }, [achromaticMap, chromaticMap, pendingTone]);
  const canOpenMixing = selectedIds.length >= 2;

  const updateDropdownPosition = () => {
    const trigger = listPickerButtonRef.current;
    if (!trigger || !listPickerStage) {
      setDropdownPosition(null);
      return;
    }

    setDropdownPosition(getDropdownPosition(trigger));
  };

  useEffect(() => {
    if (!listPickerStage) {
      setDropdownPosition(null);
      return;
    }

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [listPickerStage, pendingTone]);

  useEffect(() => {
    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      const insideTrigger = listPickerRef.current?.contains(target) ?? false;
      const insideDropdown = dropdownPortalRef.current?.contains(target) ?? false;
      if (!insideTrigger && !insideDropdown) {
        setListPickerStage(null);
        setPendingTone(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, []);

  useEffect(() => () => endBulkSelection(), []);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }

    const preventTouchScrollDuringBulkSelection = (event: TouchEvent) => {
      if (!dragSelectionRef.current) {
        return;
      }

      event.preventDefault();
    };

    scrollElement.addEventListener("touchmove", preventTouchScrollDuringBulkSelection, { passive: false });
    return () => {
      scrollElement.removeEventListener("touchmove", preventTouchScrollDuringBulkSelection);
    };
  }, []);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const stopAutoScroll = () => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const endBulkSelection = () => {
    clearLongPressTimer();
    stopAutoScroll();
    pendingDragRef.current = null;
    dragSelectionRef.current = null;
    setIsBulkSelecting(false);
  };

  const applyBulkSelectionToTile = (tileId: string | null) => {
    const dragSelection = dragSelectionRef.current;
    if (!dragSelection || !tileId || dragSelection.processedIds.has(tileId)) {
      return;
    }

    dragSelection.processedIds.add(tileId);
    onSetTilesSelected([tileId], dragSelection.selected);
  };

  const getTileIdFromPoint = (clientX: number, clientY: number): string | null => {
    const target = document.elementFromPoint(clientX, clientY);
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    const tileElement = target.closest<HTMLButtonElement>("[data-multi-tile-id]");
    return tileElement?.dataset.multiTileId ?? null;
  };

  const runAutoScroll = () => {
    const scrollElement = scrollRef.current;
    const dragSelection = dragSelectionRef.current;
    if (!scrollElement || !dragSelection) {
      autoScrollFrameRef.current = null;
      return;
    }

    applyBulkSelectionToTile(getTileIdFromPoint(dragSelection.lastClientX, dragSelection.lastClientY));

    const rect = scrollElement.getBoundingClientRect();
    let scrollDeltaX = 0;
    let scrollDeltaY = 0;

    if (dragSelection.lastClientX < rect.left + AUTO_SCROLL_SIDE_EDGE_THRESHOLD) {
      scrollDeltaX = -AUTO_SCROLL_STEP_PX;
    } else if (dragSelection.lastClientX > rect.right - AUTO_SCROLL_SIDE_EDGE_THRESHOLD) {
      scrollDeltaX = AUTO_SCROLL_STEP_PX;
    }

    if (dragSelection.lastClientY < rect.top + AUTO_SCROLL_TOP_EDGE_THRESHOLD) {
      scrollDeltaY = -AUTO_SCROLL_STEP_PX;
    } else if (dragSelection.lastClientY > rect.bottom - AUTO_SCROLL_BOTTOM_EDGE_THRESHOLD) {
      scrollDeltaY = AUTO_SCROLL_STEP_PX;
    }

    if (scrollDeltaX !== 0 || scrollDeltaY !== 0) {
      const previousScrollLeft = scrollElement.scrollLeft;
      const previousScrollTop = scrollElement.scrollTop;
      scrollElement.scrollLeft += scrollDeltaX;
      scrollElement.scrollTop += scrollDeltaY;
      applyBulkSelectionToTile(getTileIdFromPoint(dragSelection.lastClientX, dragSelection.lastClientY));

      if (
        scrollElement.scrollLeft !== previousScrollLeft ||
        scrollElement.scrollTop !== previousScrollTop
      ) {
        autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll);
        return;
      }
    }

    autoScrollFrameRef.current = null;
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

  const handleTileClick = (event: ReactMouseEvent<HTMLButtonElement>, tileId: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    event.stopPropagation();

    // Stage 1 reset: keep tile interaction to a single, explicit tap/click toggle.
    // Stage 2 keeps tap stable and layers only a minimal drag-selection mode on top.
    onToggleTile(tileId);
  };

  const handleTilePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, tileId: string) => {
    onFocusPanel();

    if (event.pointerType !== "touch") {
      return;
    }

    clearLongPressTimer();
    endBulkSelection();

    pendingDragRef.current = {
      pointerId: event.pointerId,
      tileId,
      startPoint: { x: event.clientX, y: event.clientY },
    };

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const startPoint = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      const pendingDrag = pendingDragRef.current;
      if (!pendingDrag || pendingDrag.pointerId !== event.pointerId || pendingDrag.tileId !== tileId) {
        return;
      }

      beginBulkSelection(event.pointerId, tileId, startPoint.x, startPoint.y);
      pendingDragRef.current = null;
      clearLongPressTimer();
    }, LONG_PRESS_DELAY_MS);
  };

  const handleTilePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }

    const dragSelection = dragSelectionRef.current;
    if (dragSelection?.pointerId === event.pointerId) {
      event.preventDefault();
      event.stopPropagation();
      dragSelection.lastClientX = event.clientX;
      dragSelection.lastClientY = event.clientY;
      applyBulkSelectionToTile(getTileIdFromPoint(event.clientX, event.clientY));
      ensureAutoScroll();
      return;
    }

    const pendingDrag = pendingDragRef.current;
    if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) {
      return;
    }

    const moveDistance = getDistance(pendingDrag.startPoint, {
      x: event.clientX,
      y: event.clientY,
    });
    if (moveDistance > LONG_PRESS_CANCEL_MOVE_THRESHOLD) {
      clearLongPressTimer();
      pendingDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const handleTilePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const wasBulkSelecting = dragSelectionRef.current?.pointerId === event.pointerId;
    const wasPendingDrag = pendingDragRef.current?.pointerId === event.pointerId;

    if (wasBulkSelecting) {
      event.preventDefault();
      event.stopPropagation();
      endBulkSelection();
      return;
    }

    if (wasPendingDrag) {
      clearLongPressTimer();
      pendingDragRef.current = null;
    }
  };

  const handleOpenListPicker = () => {
    onFocusPanel();
    setPendingTone(null);
    setListPickerStage((current) => (current === "tone" ? null : "tone"));
  };

  const handleToneSelection = (toneValue: ListSelectableTone | null) => {
    onFocusPanel();

    if (toneValue === null) {
      setPendingTone(null);
      setListPickerStage(null);
      return;
    }

    setPendingTone(toneValue);
    setListPickerStage("color");
  };

  const handleColorToggle = (tileId: string) => {
    onFocusPanel();
    onToggleTile(tileId);
  };

  const handleBackToToneSelection = () => {
    onFocusPanel();
    setPendingTone(null);
    setListPickerStage("tone");
  };

  const dropdown = listPickerStage && dropdownPosition
    ? createPortal(
        <div
          ref={dropdownPortalRef}
          className="multi-select-dropdown-portal"
          style={{
            position: "fixed",
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          {listPickerStage === "tone" ? (
            <div
              className="custom-dropdown-menu multi-select-dropdown-menu"
              role="listbox"
              aria-label="トーン選択"
              style={{ maxHeight: dropdownPosition.maxHeight }}
            >
              <button type="button" className="custom-dropdown-option" onClick={() => handleToneSelection(null)}>
                <span>キャンセル</span>
              </button>
              {TONE_LIST_OPTIONS.map((toneOption) => (
                <button
                  key={toneOption.value}
                  type="button"
                  className="custom-dropdown-option"
                  style={{
                    background: toneOption.hex,
                    color: getContrastTextColor(toneOption.hex),
                  }}
                  onClick={() => handleToneSelection(toneOption.value)}
                >
                  <span>{toneOption.label}</span>
                </button>
              ))}
            </div>
          ) : null}

          {listPickerStage === "color" ? (
            <div
              className="custom-dropdown-menu multi-select-dropdown-menu"
              role="listbox"
              aria-label="色ID選択"
              style={{ maxHeight: dropdownPosition.maxHeight }}
            >
              <button type="button" className="custom-dropdown-option" onClick={handleBackToToneSelection}>
                <span>戻る</span>
              </button>
              {listSelectableColorOptions.map((colorOption) => {
                const isSelected = selectedIdSet.has(colorOption.id);
                return (
                  <button
                    key={colorOption.id}
                    type="button"
                    className={`custom-dropdown-option ${isSelected ? "is-selected" : ""}`}
                    style={{
                      background: colorOption.hex,
                      color: getContrastTextColor(colorOption.hex),
                    }}
                    onClick={() => handleColorToggle(colorOption.id)}
                  >
                    <span>{colorOption.label}</span>
                    {isSelected ? (
                      <span className="analysis-check" aria-hidden="true">
                        ✔
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div className="multi-select-card" onPointerDown={onFocusPanel}>
        <div className="multi-select-body">
          <div className="multi-select-header">
            <div className="multi-select-header-actions">
              <div ref={listPickerRef} className="multi-select-header-actions-left">
                <div className="multi-select-list-picker">
                <button
                  ref={listPickerButtonRef}
                  type="button"
                  className="secondary-button secondary-button-small"
                  onClick={handleOpenListPicker}
                >
                  リストから選択
                </button>
                </div>

                <button
                  type="button"
                  className="secondary-button secondary-button-small"
                  disabled={!canOpenMixing}
                  title={canOpenMixing ? "選択色で混色画面を開く" : "混色は2色以上で利用できます"}
                  aria-label={canOpenMixing ? "混色画面を開く" : "混色は2色以上で利用できます"}
                  onClick={onOpenMixingPanel}
                >
                  混色
                </button>
              </div>

              <div className="multi-select-clear-button-wrap">
                <button
                  type="button"
                  className="secondary-button secondary-button-small multi-select-clear-button"
                  disabled={selectedIds.length === 0}
                  onClick={onClearAll}
                >
                  全解除
                </button>
                {selectedIds.length > 0 ? (
                  <span className="multi-select-selection-badge" aria-hidden="true">
                    {selectedIds.length}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div ref={scrollRef} className={`multi-select-scroll ${isBulkSelecting ? "is-bulk-selecting" : ""}`}>
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
                        onClick={(event) => handleTileClick(event, tile.id)}
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
                            ✔
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
      {dropdown}
    </>
  );
}
