import { useEffect, useMemo, useRef, useState } from "react";
import { ColocoScene } from "./components/ColocoScene";
import { ColorInfoPanel } from "./components/ColorInfoPanel";
import { HighlightControls } from "./components/HighlightControls";
import { ImageAnalysisPanel } from "./components/ImageAnalysisPanel";
import { Wordmark } from "./components/Wordmark";
import type { SceneControlsHandle } from "./components/SceneControls";
import { pccsAchromatic, pccsPoints, pccsRepresentativeHues12 } from "./data";
import { analyzeImageToPccs, createPccsLabPalette } from "./utils/imageClassification";
import type { ImagePccsAnalysis } from "./utils/imageClassification";
import type { HighlightState } from "./utils/highlight";
import { getSwipeNavigationTargetId } from "./utils/pccsNavigation";
import { createRenderablePoints } from "./utils/pccs3d";

type OverlayKind = "settings" | "image" | null;

type ToneOption = {
  value: string;
  shortLabel: string;
  fullLabel: string;
};

const toneOptions: ToneOption[] = [
  { value: "v", shortLabel: "v", fullLabel: "ビビッド" },
  { value: "b", shortLabel: "b", fullLabel: "ブライト" },
  { value: "s", shortLabel: "s", fullLabel: "ストロング" },
  { value: "dp", shortLabel: "dp", fullLabel: "ディープ" },
  { value: "lt", shortLabel: "lt", fullLabel: "ライト" },
  { value: "sf", shortLabel: "sf", fullLabel: "ソフト" },
  { value: "d", shortLabel: "d", fullLabel: "ダル" },
  { value: "dk", shortLabel: "dk", fullLabel: "ダーク" },
  { value: "p", shortLabel: "p", fullLabel: "ペール" },
  { value: "ltg", shortLabel: "ltg", fullLabel: "ライトグレイッシュ" },
  { value: "g", shortLabel: "g", fullLabel: "グレイッシュ" },
  { value: "dkg", shortLabel: "dkg", fullLabel: "ダークグレイッシュ" },
  { value: "achromatic", shortLabel: "", fullLabel: "無彩色" },
];

const hueNameMap: Record<string, string> = {
  R: "赤",
  rO: "赤みの橙",
  yO: "黄みの橙",
  Y: "黄",
  YG: "黄緑",
  G: "緑",
  BG: "青緑",
  gB: "緑みの青",
  B: "青",
  V: "青紫",
  P: "紫",
  RP: "赤紫",
};

const INITIAL_HIGHLIGHT: HighlightState = {
  toneValue: "",
  hueValue: "",
  imageIds: [],
};

type ViewerKeyboardInput = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
};

const INITIAL_VIEWER_KEYBOARD_INPUT: ViewerKeyboardInput = {
  left: false,
  right: false,
  up: false,
  down: false,
};

const clearViewerKeyboardInput = (): ViewerKeyboardInput => ({
  ...INITIAL_VIEWER_KEYBOARD_INPUT,
});

export default function App() {
  const viewerInteractionRef = useRef<HTMLDivElement | null>(null);
  const sceneControlsRef = useRef<SceneControlsHandle | null>(null);
  const viewerKeyboardInputRef = useRef<ViewerKeyboardInput>(INITIAL_VIEWER_KEYBOARD_INPUT);
  const isViewerKeyboardActiveRef = useRef(false);
  const points = useMemo(() => createRenderablePoints(pccsPoints, pccsAchromatic), []);
  const pccsLabPalette = useMemo(() => createPccsLabPalette(points), [points]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<HighlightState>(INITIAL_HIGHLIGHT);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<OverlayKind>(null);
  const [analysis, setAnalysis] = useState<ImagePccsAnalysis | null>(null);
  const [sourceImageName, setSourceImageName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 980px)").matches : false,
  );
  const [viewerKeyboardInput, setViewerKeyboardInput] = useState<ViewerKeyboardInput>(INITIAL_VIEWER_KEYBOARD_INPUT);
  const [isViewerKeyboardActive, setIsViewerKeyboardActive] = useState(false);
  const [isAutoRotateEnabled, setIsAutoRotateEnabled] = useState(true);
  const [isNorthLockEnabled, setIsNorthLockEnabled] = useState(false);
  const [isGuideLinesVisible, setIsGuideLinesVisible] = useState(false);

  const selectedPoint = points.find((point) => point.id === selectedId) ?? null;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const handleChange = () => setIsMobileView(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toneSelectOptions = useMemo(() => {
    const emptyOption = {
      value: "",
      label: "選択しない",
      swatchHex: "#f3efe7",
    };

    const mapped = toneOptions.map((tone) => {
      const swatchHex =
        tone.value === "achromatic"
          ? pccsAchromatic.find((point) => point.id === "achromatic-mGy")?.hex ?? "#A1A1A1"
          : pccsPoints.find((point) => point.toneCode === tone.value && point.hueCode24 === "Y")?.hex ?? "#ddd3bf";

      return {
        value: tone.value,
        label: tone.value === "achromatic" ? tone.fullLabel : `${tone.shortLabel}（${tone.fullLabel}）`,
        swatchHex,
      };
    });

    return [emptyOption, ...mapped];
  }, []);

  const hueSelectOptions = useMemo(() => {
    const emptyOption = {
      value: "",
      label: "選択しない",
      swatchHex: "#f3efe7",
    };

    const mapped = pccsRepresentativeHues12.map((hue) => ({
      value: hue.hueCode24,
      label: `${hue.hueCode24}（${hueNameMap[hue.hueCode24] ?? hue.hueCode24}）`,
      swatchHex: pccsPoints.find((point) => point.toneCode === "v" && point.hueIndex24 === hue.hueIndex24)?.hex ?? "#ddd3bf",
    }));

    return [emptyOption, ...mapped];
  }, []);

  const clearImageHighlight = () => {
    setAnalysis((current) =>
      current
        ? {
            ...current,
            clusters: current.clusters.map((cluster) => ({ ...cluster, selected: false })),
          }
        : current,
    );
    setHighlight((current) => ({
      ...current,
      imageIds: [],
    }));
  };

  const setAllAnalysisClustersSelected = (selected: boolean) => {
    setAnalysis((current) => {
      if (!current) {
        return current;
      }

      const nextClusters = current.clusters.map((cluster) => ({
        ...cluster,
        selected,
      }));

      setHighlight({
        toneValue: "",
        hueValue: "",
        imageIds: selected ? nextClusters.map((cluster) => cluster.pccsId) : [],
      });

      return {
        ...current,
        clusters: nextClusters,
      };
    });
  };

  const setAnalysisClustersSelected = (pccsIds: string[], selected: boolean) => {
    if (pccsIds.length === 0) {
      return;
    }

    const idSet = new Set(pccsIds);

    setAnalysis((current) => {
      if (!current) {
        return current;
      }

      const nextClusters = current.clusters.map((cluster) =>
        idSet.has(cluster.pccsId) ? { ...cluster, selected } : cluster,
      );

      setHighlight({
        toneValue: "",
        hueValue: "",
        imageIds: nextClusters.filter((cluster) => cluster.selected).map((cluster) => cluster.pccsId),
      });

      return {
        ...current,
        clusters: nextClusters,
      };
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
        setIsImageModalOpen(false);
        setActiveOverlay(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const setKeyboardInputState = (next: ViewerKeyboardInput) => {
      const current = viewerKeyboardInputRef.current;
      if (
        current.left === next.left &&
        current.right === next.right &&
        current.up === next.up &&
        current.down === next.down
      ) {
        return;
      }

      viewerKeyboardInputRef.current = next;
      setViewerKeyboardInput(next);
    };

    const updateArrowKeyState = (key: string, pressed: boolean) => {
      if (!isViewerKeyboardActiveRef.current) {
        return;
      }

      const current = viewerKeyboardInputRef.current;
      switch (key) {
        case "ArrowLeft":
          setKeyboardInputState({ ...current, left: pressed });
          break;
        case "ArrowRight":
          setKeyboardInputState({ ...current, right: pressed });
          break;
        case "ArrowUp":
          setKeyboardInputState({ ...current, up: pressed });
          break;
        case "ArrowDown":
          setKeyboardInputState({ ...current, down: pressed });
          break;
        default:
          break;
      }
    };

    const clearAllViewerKeys = () => {
      setKeyboardInputState(clearViewerKeyboardInput());
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (!isViewerKeyboardActiveRef.current) {
        return;
      }

      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        updateArrowKeyState(event.key, true);
      }
    };

    const handleWindowKeyUp = (event: KeyboardEvent) => {
      if (!isViewerKeyboardActiveRef.current) {
        return;
      }

      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        updateArrowKeyState(event.key, false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        clearAllViewerKeys();
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    window.addEventListener("keyup", handleWindowKeyUp);
    window.addEventListener("blur", clearAllViewerKeys);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
      window.removeEventListener("keyup", handleWindowKeyUp);
      window.removeEventListener("blur", clearAllViewerKeys);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    const viewerElement = viewerInteractionRef.current;
    if (!viewerElement) {
      return;
    }

    const preventSelectStart = (event: Event) => event.preventDefault();
    viewerElement.addEventListener("selectstart", preventSelectStart);

    return () => {
      viewerElement.removeEventListener("selectstart", preventSelectStart);
    };
  }, []);

  const activateViewerKeyboardControl = () => {
    isViewerKeyboardActiveRef.current = true;
    setIsViewerKeyboardActive(true);
  };

  const deactivateViewerKeyboardControl = () => {
    isViewerKeyboardActiveRef.current = false;
    setIsViewerKeyboardActive(false);
    viewerKeyboardInputRef.current = clearViewerKeyboardInput();
    setViewerKeyboardInput(clearViewerKeyboardInput());
  };

  const selectAnalysisColorDetail = (pccsId: string) => {
    setActiveOverlay("image");
    setSelectedId(pccsId);
  };

  const clearLoadedImage = () => {
    setAnalysis(null);
    setSourceImageName("");
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return "";
    });
    setHighlight((current) => ({
      ...current,
      imageIds: [],
    }));
  };

  const handleInfoPanelSwipeNavigate = (direction: "left" | "right" | "up" | "down") => {
    const nextId = getSwipeNavigationTargetId(points, selectedId, direction);

    if (nextId && nextId !== selectedId) {
      setSelectedId(nextId);
    }
  };

  const handleToggleAutoRotate = () => {
    setIsAutoRotateEnabled((current) => {
      const next = !current;
      if (next) {
        setIsNorthLockEnabled(false);
      }
      return next;
    });
  };

  const handleToggleNorthLock = () => {
    setIsNorthLockEnabled((current) => {
      const next = !current;
      if (next) {
        setIsAutoRotateEnabled(false);
      }
      return next;
    });
  };

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="viewer-stage">
          <div
            ref={viewerInteractionRef}
            className="viewer-card viewer-interaction-surface"
            tabIndex={0}
            aria-label="3Dビュー"
            data-keyboard-active={isViewerKeyboardActive ? "true" : "false"}
            onFocus={() => activateViewerKeyboardControl()}
            onBlur={() => {
              deactivateViewerKeyboardControl();
            }}
            onPointerDown={(event) => {
              activateViewerKeyboardControl();
              event.currentTarget.focus();
            }}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
          >
            <ColocoScene
              ref={sceneControlsRef}
              points={points}
              highlight={highlight}
              selectedId={selectedId}
              autoRotateEnabled={isAutoRotateEnabled}
              northLockEnabled={isNorthLockEnabled}
              guideLinesVisible={isGuideLinesVisible}
              keyboardInput={viewerKeyboardInput}
              onSelectPoint={setSelectedId}
              onClearSelection={() => setSelectedId(null)}
            />
          </div>

          <button
            type="button"
            className={`image-toggle ${isImageModalOpen ? "is-open" : ""}`}
            aria-label={isImageModalOpen ? "画像解析を閉じる" : "画像解析を開く"}
            aria-expanded={isImageModalOpen}
            onPointerDown={() => deactivateViewerKeyboardControl()}
            onClick={() => {
              setIsImageModalOpen((open) => {
                const next = !open;

                if (isMobileView && next) {
                  setIsSettingsOpen(false);
                }

                setActiveOverlay(next ? "image" : isSettingsOpen && !isMobileView ? "settings" : null);
                return next;
              });
            }}
          >
            <span className="image-toggle-frame">
              <span className="image-toggle-sun" />
              <span className="image-toggle-mountain" />
            </span>
          </button>

          <Wordmark />

          <button
            type="button"
            className={`menu-toggle ${isSettingsOpen ? "is-open" : ""}`}
            aria-label={isSettingsOpen ? "設定を閉じる" : "設定を開く"}
            aria-expanded={isSettingsOpen}
            onPointerDown={() => deactivateViewerKeyboardControl()}
            onClick={() => {
              setIsSettingsOpen((open) => {
                const next = !open;

                if (isMobileView && next) {
                  setIsImageModalOpen(false);
                }

                setActiveOverlay(next ? "settings" : isImageModalOpen && !isMobileView ? "image" : null);
                return next;
              });
            }}
          >
            <span />
            <span />
            <span />
          </button>

          <div
            className={`settings-backdrop ${isSettingsOpen ? "is-open" : ""} ${activeOverlay === "settings" ? "is-front" : ""}`}
            onClick={() => {
              setIsSettingsOpen(false);
              setActiveOverlay(isImageModalOpen ? "image" : null);
            }}
          />

          <section
            className={`settings-overlay ${isSettingsOpen ? "is-open" : ""} ${activeOverlay === "settings" ? "is-front" : ""}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={() => {
              deactivateViewerKeyboardControl();
              setActiveOverlay("settings");
            }}
          >
            <HighlightControls
              toneValue={highlight.toneValue}
              hueValue={highlight.hueValue}
              autoRotateEnabled={isAutoRotateEnabled}
              northLockEnabled={isNorthLockEnabled}
              guideLinesVisible={isGuideLinesVisible}
              onToggleAutoRotate={handleToggleAutoRotate}
              onToggleNorthLock={handleToggleNorthLock}
              onToggleGuideLines={() => setIsGuideLinesVisible((current) => !current)}
              onToneChange={(value) => {
                if (value) {
                  clearImageHighlight();
                }

                setHighlight((current) => ({
                  toneValue: value,
                  hueValue: value ? "" : current.hueValue,
                  imageIds: value ? [] : current.imageIds,
                }));
              }}
              onHueChange={(value) => {
                if (value) {
                  clearImageHighlight();
                }

                setHighlight((current) => ({
                  toneValue: value ? "" : current.toneValue,
                  hueValue: value,
                  imageIds: value ? [] : current.imageIds,
                }));
              }}
              toneOptions={toneSelectOptions}
              hueOptions={hueSelectOptions}
            />
          </section>

          <div className={`info-overlay ${selectedPoint ? "is-visible" : ""}`}>
            <ColorInfoPanel
              selectedPoint={selectedPoint}
              onSwipeNavigate={handleInfoPanelSwipeNavigate}
              onFocusPanel={deactivateViewerKeyboardControl}
            />
          </div>

          {isImageModalOpen ? (
            <>
              <div
                className={`analysis-modal-backdrop ${activeOverlay === "image" ? "is-front" : ""}`}
                onClick={() => {
                  setIsImageModalOpen(false);
                  setActiveOverlay(isSettingsOpen ? "settings" : null);
                }}
              />
              <div className={`analysis-modal-shell ${activeOverlay === "image" ? "is-front" : ""}`}>
                <ImageAnalysisPanel
                  analysis={analysis}
                  sourceImageName={sourceImageName}
                  previewUrl={previewUrl}
                  onFocusPanel={() => {
                    deactivateViewerKeyboardControl();
                    setActiveOverlay("image");
                  }}
                  onPickImage={async (file) => {
                    setActiveOverlay("image");
                    const nextPreviewUrl = URL.createObjectURL(file);

                    setPreviewUrl((current) => {
                      if (current) {
                        URL.revokeObjectURL(current);
                      }
                      return nextPreviewUrl;
                    });

                    const nextAnalysis = await analyzeImageToPccs(file, pccsLabPalette);
                    setAnalysis(nextAnalysis);
                    setSourceImageName(file.name);
                    setHighlight({
                      toneValue: "",
                      hueValue: "",
                      imageIds: nextAnalysis.clusters
                        .filter((cluster) => cluster.selected)
                        .map((cluster) => cluster.pccsId),
                    });
                  }}
                  onToggleCluster={(pccsId) =>
                    setAnalysis((current) => {
                      if (!current) {
                        return current;
                      }

                      setActiveOverlay("image");
                      const nextClusters = current.clusters.map((cluster) =>
                        cluster.pccsId === pccsId ? { ...cluster, selected: !cluster.selected } : cluster,
                      );

                      setHighlight({
                        toneValue: "",
                        hueValue: "",
                        imageIds: nextClusters.filter((cluster) => cluster.selected).map((cluster) => cluster.pccsId),
                      });

                      return {
                        ...current,
                        clusters: nextClusters,
                      };
                    })
                  }
                  onSetClustersSelected={setAnalysisClustersSelected}
                  onClearImage={() => {
                    setActiveOverlay("image");
                    clearLoadedImage();
                  }}
                  onSetAllSelected={(selected) => {
                    setActiveOverlay("image");
                    setAllAnalysisClustersSelected(selected);
                  }}
                  onInspectCluster={selectAnalysisColorDetail}
                />
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
