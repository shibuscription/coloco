import { useEffect, useMemo, useRef, useState } from "react";
import { ColocoScene } from "./components/ColocoScene";
import { ColorInfoPanel } from "./components/ColorInfoPanel";
import { HighlightControls } from "./components/HighlightControls";
import { ImageAnalysisPanel } from "./components/ImageAnalysisPanel";
import { MultiSelectHighlightPanel } from "./components/MultiSelectHighlightPanel";
import { Wordmark } from "./components/Wordmark";
import type { SceneControlsHandle } from "./components/SceneControls";
import { pccsAchromatic, pccsPoints, pccsRepresentativeHues12 } from "./data";
import { analyzeImageDataToPccs, analyzeImageToPccs, createPccsLabPalette } from "./utils/imageClassification";
import type { ImagePccsAnalysis } from "./utils/imageClassification";
import type { HighlightState } from "./utils/highlight";
import { getSwipeNavigationTargetId } from "./utils/pccsNavigation";
import { createRenderablePoints } from "./utils/pccs3d";

type OverlayKind = "settings" | "image" | "multi" | null;
type AutoRotateMode = "cw" | "ccw" | "off";

type ToneOption = {
  value: string;
  shortLabel: string;
  fullLabel: string;
};

const toneOptions: ToneOption[] = [
  { value: "v", shortLabel: "v", fullLabel: "\u30d3\u30d3\u30c3\u30c9" },
  { value: "b", shortLabel: "b", fullLabel: "\u30d6\u30e9\u30a4\u30c8" },
  { value: "s", shortLabel: "s", fullLabel: "\u30b9\u30c8\u30ed\u30f3\u30b0" },
  { value: "dp", shortLabel: "dp", fullLabel: "\u30c7\u30a3\u30fc\u30d7" },
  { value: "lt", shortLabel: "lt", fullLabel: "\u30e9\u30a4\u30c8" },
  { value: "sf", shortLabel: "sf", fullLabel: "\u30bd\u30d5\u30c8" },
  { value: "d", shortLabel: "d", fullLabel: "\u30c0\u30eb" },
  { value: "dk", shortLabel: "dk", fullLabel: "\u30c0\u30fc\u30af" },
  { value: "p", shortLabel: "p", fullLabel: "\u30da\u30fc\u30eb" },
  { value: "ltg", shortLabel: "ltg", fullLabel: "\u30e9\u30a4\u30c8\u30b0\u30ec\u30a4\u30c3\u30b7\u30e5" },
  { value: "g", shortLabel: "g", fullLabel: "\u30b0\u30ec\u30a4\u30c3\u30b7\u30e5" },
  { value: "dkg", shortLabel: "dkg", fullLabel: "\u30c0\u30fc\u30af\u30b0\u30ec\u30a4\u30c3\u30b7\u30e5" },
  { value: "achromatic", shortLabel: "", fullLabel: "\u7121\u5f69\u8272" },
];

const hueNameMap: Record<string, string> = {
  R: "\u8d64",
  rO: "\u8d64\u6a59",
  yO: "\u9ec4\u6a59",
  Y: "\u9ec4",
  YG: "\u9ec4\u7dd1",
  G: "\u7dd1",
  BG: "\u9752\u7dd1",
  gB: "\u7dd1\u307f\u306e\u9752",
  B: "\u9752",
  V: "\u7d2b",
  P: "\u7d2b",
  RP: "\u8d64\u7d2b",
};

const INITIAL_HIGHLIGHT: HighlightState = {
  toneValue: "",
  hueValue: "",
  imageIds: [],
  customIds: [],
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
  const multiSelectedIdsRef = useRef<string[]>([]);
  const cameraRestoreStateRef = useRef<{
    analysis: ImagePccsAnalysis | null;
    sourceImageName: string;
    previewUrl: string;
    highlight: HighlightState;
  } | null>(null);
  const liveSelectionInitializedRef = useRef(false);
  const points = useMemo(() => createRenderablePoints(pccsPoints, pccsAchromatic), []);
  const pccsLabPalette = useMemo(() => createPccsLabPalette(points), [points]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<HighlightState>(INITIAL_HIGHLIGHT);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<OverlayKind>(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<ImagePccsAnalysis | null>(null);
  const [sourceImageName, setSourceImageName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 980px)").matches : false,
  );
  const [viewerKeyboardInput, setViewerKeyboardInput] = useState<ViewerKeyboardInput>(INITIAL_VIEWER_KEYBOARD_INPUT);
  const [isViewerKeyboardActive, setIsViewerKeyboardActive] = useState(false);
  const [sphereScale, setSphereScale] = useState(1);
  const [autoRotateMode, setAutoRotateMode] = useState<AutoRotateMode>("cw");
  const [autoRotateRpm, setAutoRotateRpm] = useState(1.0);
  const [isNorthLockEnabled, setIsNorthLockEnabled] = useState(false);
  const [showToneGuides, setShowToneGuides] = useState(false);
  const [showHueGuides, setShowHueGuides] = useState(false);
  const [showLightnessGuides, setShowLightnessGuides] = useState(false);

  useEffect(() => {
    multiSelectedIdsRef.current = multiSelectedIds;
  }, [multiSelectedIds]);

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
      label: "\u9078\u629e\u3057\u306a\u3044",
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

  const numberedHueSelectOptions = useMemo(() => {
    const emptyOption = {
      value: "",
      label: "\u9078\u629e\u3057\u306a\u3044",
      swatchHex: "#f3efe7",
    };

    const mapped = pccsRepresentativeHues12.map((hue) => ({
      value: String(hue.hueIndex24),
      label: `${hue.hueIndex24}:${hue.hueCode24}（${hueNameMap[hue.hueCode24] ?? hue.hueCode24}）`,
      swatchHex: pccsPoints.find((point) => point.toneCode === "v" && point.hueIndex24 === hue.hueIndex24)?.hex ?? "#ddd3bf",
    }));

    return [emptyOption, ...mapped];
  }, []);

  const getIdsForToneHighlight = (toneValue: string): string[] => {
    if (!toneValue) {
      return [];
    }

    return points
      .filter((point) =>
        toneValue === "achromatic"
          ? point.kind === "achromatic"
          : point.kind === "chromatic" && point.toneCode === toneValue,
      )
      .map((point) => point.id);
  };

  const getIdsForHueHighlight = (hueValue: string): string[] => {
    if (!hueValue) {
      return [];
    }

    return points
      .filter((point) => point.kind === "achromatic" || String(point.hueIndex24) === hueValue)
      .map((point) => point.id);
  };

  const getIdsForHighlightState = (nextHighlight: HighlightState): string[] => {
    if (nextHighlight.customIds.length > 0) {
      return nextHighlight.customIds;
    }

    if (nextHighlight.imageIds.length > 0) {
      return nextHighlight.imageIds;
    }

    if (nextHighlight.toneValue) {
      return getIdsForToneHighlight(nextHighlight.toneValue);
    }

    if (nextHighlight.hueValue) {
      return getIdsForHueHighlight(nextHighlight.hueValue);
    }

    return [];
  };

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

  const applyMultiSelectHighlight = (nextIds: string[]) => {
    setMultiSelectedIds(nextIds);
    clearImageHighlight();
    setHighlight({
      toneValue: "",
      hueValue: "",
      imageIds: [],
      customIds: nextIds,
    });
  };

  const applyImageAnalysisResult = (
    nextAnalysis: ImagePccsAnalysis,
    {
      preserveExistingSelection,
    }: {
      preserveExistingSelection: boolean;
    },
  ) => {
    setAnalysis((current) => {
      const selectedIds = preserveExistingSelection && current
        ? new Set(current.clusters.filter((cluster) => cluster.selected).map((cluster) => cluster.pccsId))
        : null;

      const nextClusters =
        selectedIds === null
          ? nextAnalysis.clusters
          : nextAnalysis.clusters.map((cluster) => ({
              ...cluster,
              selected: selectedIds.has(cluster.pccsId),
            }));

      const nextResolvedAnalysis = {
        ...nextAnalysis,
        clusters: nextClusters,
      };

      const nextHighlight = {
        toneValue: "",
        hueValue: "",
        imageIds: nextClusters.filter((cluster) => cluster.selected).map((cluster) => cluster.pccsId),
        customIds: [],
      };

      setHighlight(nextHighlight);
      setMultiSelectedIds(getIdsForHighlightState(nextHighlight));

      return nextResolvedAnalysis;
    });
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

      const nextHighlight = {
        toneValue: "",
        hueValue: "",
        imageIds: selected ? nextClusters.map((cluster) => cluster.pccsId) : [],
        customIds: [],
      };

      setHighlight(nextHighlight);
      setMultiSelectedIds(getIdsForHighlightState(nextHighlight));

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

      const nextHighlight = {
        toneValue: "",
        hueValue: "",
        imageIds: nextClusters.filter((cluster) => cluster.selected).map((cluster) => cluster.pccsId),
        customIds: [],
      };

      setHighlight(nextHighlight);
      setMultiSelectedIds(getIdsForHighlightState(nextHighlight));

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
        setIsMultiSelectOpen(false);
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

  const beginCameraMode = () => {
    cameraRestoreStateRef.current = {
      analysis,
      sourceImageName,
      previewUrl,
      highlight,
    };
    liveSelectionInitializedRef.current = false;
  };

  const cancelCameraMode = () => {
    const restoreState = cameraRestoreStateRef.current;
    liveSelectionInitializedRef.current = false;

    if (!restoreState) {
      return;
    }

    setAnalysis(restoreState.analysis);
    setSourceImageName(restoreState.sourceImageName);
    setHighlight(restoreState.highlight);
    setMultiSelectedIds(getIdsForHighlightState(restoreState.highlight));
    cameraRestoreStateRef.current = null;
  };

  const commitCameraCapture = async (file: File) => {
    cameraRestoreStateRef.current = null;
    liveSelectionInitializedRef.current = false;
    await handlePickedImage(file);
  };

  const applyLiveAnalysisFrame = (imageData: ImageData) => {
    const nextAnalysis = analyzeImageDataToPccs(imageData, pccsLabPalette, {
      maxDimension: 96,
      alphaThreshold: 16,
    });
    applyImageAnalysisResult(nextAnalysis, { preserveExistingSelection: false });
    liveSelectionInitializedRef.current = true;
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
    setHighlight((current) => {
      const nextHighlight = {
        ...current,
        imageIds: [],
      };
      setMultiSelectedIds(getIdsForHighlightState(nextHighlight));
      return nextHighlight;
    });
  };

  const handlePickedImage = async (file: File) => {
    const nextPreviewUrl = URL.createObjectURL(file);

    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return nextPreviewUrl;
    });

    const nextAnalysis = await analyzeImageToPccs(file, pccsLabPalette);
    setSourceImageName(file.name);
    applyImageAnalysisResult(nextAnalysis, { preserveExistingSelection: false });
  };

  const handleInfoPanelSwipeNavigate = (direction: "left" | "right" | "up" | "down") => {
    const nextId = getSwipeNavigationTargetId(points, selectedId, direction);

    if (nextId && nextId !== selectedId) {
      setSelectedId(nextId);
    }
  };

  const handleToggleAutoRotate = () => {
    setAutoRotateMode((current) => {
      const next: AutoRotateMode = current === "cw" ? "ccw" : current === "ccw" ? "off" : "cw";
      if (next !== "off") {
        setIsNorthLockEnabled(false);
      }
      return next;
    });
  };

  const handleToggleNorthLock = () => {
    setIsNorthLockEnabled((current) => {
      const next = !current;
      if (next) {
        setAutoRotateMode("off");
      }
      return next;
    });
  };

  const handleToggleMultiSelectTile = (pccsId: string) => {
    const currentIds = multiSelectedIdsRef.current;
    const nextIds = currentIds.includes(pccsId)
      ? currentIds.filter((id) => id !== pccsId)
      : [...currentIds, pccsId];

    applyMultiSelectHighlight(nextIds);
  };

  const handleSetMultiSelectTiles = (pccsIds: string[], selected: boolean) => {
    if (pccsIds.length === 0) {
      return;
    }

    const idSet = new Set(pccsIds);
    const currentIds = multiSelectedIdsRef.current;
    const nextIds = selected
      ? Array.from(new Set([...currentIds, ...pccsIds]))
      : currentIds.filter((id) => !idSet.has(id));

    applyMultiSelectHighlight(nextIds);
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
              sphereScale={sphereScale}
              autoRotateMode={autoRotateMode}
              autoRotateRpm={autoRotateRpm}
              northLockEnabled={isNorthLockEnabled}
              showToneGuides={showToneGuides}
              showHueGuides={showHueGuides}
            showLightnessGuides={showLightnessGuides}
            keyboardInput={viewerKeyboardInput}
            onSelectPoint={setSelectedId}
            onClearSelection={() => setSelectedId(null)}
            />
          </div>

          <button
            type="button"
            className={`image-toggle ${isImageModalOpen ? "is-open" : ""}`}
            aria-label={isImageModalOpen ? "\u753b\u50cf\u89e3\u6790\u3092\u9589\u3058\u308b" : "\u753b\u50cf\u89e3\u6790\u3092\u958b\u304f"}
            aria-expanded={isImageModalOpen}
            onPointerDown={() => deactivateViewerKeyboardControl()}
            onClick={() => {
              setIsImageModalOpen((open) => {
                const next = !open;

                if (next) {
                  setIsMultiSelectOpen(false);
                }

                if (isMobileView && next) {
                  setIsSettingsOpen(false);
                }

                setActiveOverlay(next ? "image" : isSettingsOpen ? "settings" : isMultiSelectOpen ? "multi" : null);
                return next;
              });
            }}
          >
            <span className="image-toggle-frame">
              <span className="image-toggle-sun" />
              <span className="image-toggle-mountain" />
            </span>
          </button>

          <button
            type="button"
            className={`selection-toggle ${isMultiSelectOpen ? "is-open" : ""}`}
            aria-label={isMultiSelectOpen ? "複数選択強調を閉じる" : "複数選択強調を開く"}
            aria-expanded={isMultiSelectOpen}
            onPointerDown={() => deactivateViewerKeyboardControl()}
            onClick={() => {
              setIsMultiSelectOpen((open) => {
                const next = !open;

                if (next) {
                  setIsImageModalOpen(false);
                }

                if (isMobileView && next) {
                  setIsSettingsOpen(false);
                }

                setActiveOverlay(next ? "multi" : isSettingsOpen ? "settings" : isImageModalOpen ? "image" : null);
                return next;
              });
            }}
          >
            <span className="selection-toggle-glyph" aria-hidden="true">
              {isMultiSelectOpen ? "×" : "☑"}
            </span>
          </button>

          <Wordmark />

          <button
            type="button"
            className={`menu-toggle ${isSettingsOpen ? "is-open" : ""}`}
            aria-label={isSettingsOpen ? "\u8a2d\u5b9a\u3092\u9589\u3058\u308b" : "\u8a2d\u5b9a\u3092\u958b\u304f"}
            aria-expanded={isSettingsOpen}
            onPointerDown={() => deactivateViewerKeyboardControl()}
            onClick={() => {
              setIsSettingsOpen((open) => {
                const next = !open;

                if (isMobileView && next) {
                  setIsImageModalOpen(false);
                  setIsMultiSelectOpen(false);
                }

                setActiveOverlay(next ? "settings" : isImageModalOpen ? "image" : isMultiSelectOpen ? "multi" : null);
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
              setActiveOverlay(isImageModalOpen ? "image" : isMultiSelectOpen ? "multi" : null);
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
              sphereScale={sphereScale}
              autoRotateMode={autoRotateMode}
              autoRotateRpm={autoRotateRpm}
              northLockEnabled={isNorthLockEnabled}
              showToneGuides={showToneGuides}
              showHueGuides={showHueGuides}
              showLightnessGuides={showLightnessGuides}
              onToggleAutoRotate={handleToggleAutoRotate}
              onSphereScaleChange={setSphereScale}
              onAutoRotateRpmChange={setAutoRotateRpm}
              onToggleNorthLock={handleToggleNorthLock}
              onToggleToneGuides={() => setShowToneGuides((current) => !current)}
              onToggleHueGuides={() => setShowHueGuides((current) => !current)}
              onToggleLightnessGuides={() => setShowLightnessGuides((current) => !current)}
              onToneChange={(value) => {
                if (value) {
                  clearImageHighlight();
                  const nextHighlight = {
                    toneValue: value,
                    hueValue: "",
                    imageIds: [],
                    customIds: [],
                  };
                  setMultiSelectedIds(getIdsForHighlightState(nextHighlight));
                  setHighlight(nextHighlight);
                  return;
                }

                setHighlight((current) => {
                  const nextHighlight = {
                    toneValue: value,
                    hueValue: value ? "" : current.hueValue,
                    imageIds: value ? [] : current.imageIds,
                    customIds: value ? [] : current.customIds,
                  };
                  setMultiSelectedIds(getIdsForHighlightState(nextHighlight));
                  return nextHighlight;
                });
              }}
              onHueChange={(value) => {
                if (value) {
                  clearImageHighlight();
                  const nextHighlight = {
                    toneValue: "",
                    hueValue: value,
                    imageIds: [],
                    customIds: [],
                  };
                  setMultiSelectedIds(getIdsForHighlightState(nextHighlight));
                  setHighlight(nextHighlight);
                  return;
                }

                setHighlight((current) => {
                  const nextHighlight = {
                    toneValue: value ? "" : current.toneValue,
                    hueValue: value,
                    imageIds: value ? [] : current.imageIds,
                    customIds: value ? [] : current.customIds,
                  };
                  setMultiSelectedIds(getIdsForHighlightState(nextHighlight));
                  return nextHighlight;
                });
              }}
              toneOptions={toneSelectOptions}
              hueOptions={numberedHueSelectOptions}
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
                    await handlePickedImage(file);
                  }}
                  onCameraModeStart={() => {
                    setActiveOverlay("image");
                    beginCameraMode();
                  }}
                  onCameraModeCancel={() => {
                    setActiveOverlay("image");
                    cancelCameraMode();
                  }}
                  onAnalyzeLiveFrame={(imageData) => {
                    setActiveOverlay("image");
                    applyLiveAnalysisFrame(imageData);
                  }}
                  onCaptureImage={async (file) => {
                    setActiveOverlay("image");
                    await commitCameraCapture(file);
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

                      const nextHighlight = {
                        toneValue: "",
                        hueValue: "",
                        imageIds: nextClusters.filter((cluster) => cluster.selected).map((cluster) => cluster.pccsId),
                        customIds: [],
                      };

                      setHighlight(nextHighlight);
                      setMultiSelectedIds(getIdsForHighlightState(nextHighlight));

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

          {isMultiSelectOpen ? (
            <>
              <div
                className={`multi-select-backdrop ${activeOverlay === "multi" ? "is-front" : ""}`}
                onClick={() => {
                  setIsMultiSelectOpen(false);
                  setActiveOverlay(isSettingsOpen ? "settings" : null);
                }}
              />
              <div className={`multi-select-shell ${activeOverlay === "multi" ? "is-front" : ""}`}>
                <MultiSelectHighlightPanel
                  selectedIds={multiSelectedIds}
                  onFocusPanel={() => {
                    deactivateViewerKeyboardControl();
                    setActiveOverlay("multi");
                  }}
                  onToggleTile={(pccsId) => {
                    setActiveOverlay("multi");
                    handleToggleMultiSelectTile(pccsId);
                  }}
                  onSetTilesSelected={(pccsIds, selected) => {
                    setActiveOverlay("multi");
                    handleSetMultiSelectTiles(pccsIds, selected);
                  }}
                  onClearAll={() => {
                    setActiveOverlay("multi");
                    applyMultiSelectHighlight([]);
                  }}
                />
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
