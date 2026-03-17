import { useEffect, useMemo, useState } from "react";
import { ColocoScene } from "./components/ColocoScene";
import { ColorInfoPanel } from "./components/ColorInfoPanel";
import { HighlightControls } from "./components/HighlightControls";
import { ImageAnalysisPanel } from "./components/ImageAnalysisPanel";
import { Wordmark } from "./components/Wordmark";
import { pccsAchromatic, pccsPoints, pccsRepresentativeHues12 } from "./data";
import { analyzeImageToPccs, createPccsLabPalette } from "./utils/imageClassification";
import type { ImagePccsAnalysis } from "./utils/imageClassification";
import type { HighlightState } from "./utils/highlight";
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

export default function App() {
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
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const selectAnalysisColorDetail = (pccsId: string) => {
    setActiveOverlay("image");
    setSelectedId(pccsId);
  };

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="viewer-stage">
          <div className="viewer-card">
            <ColocoScene
              points={points}
              highlight={highlight}
              selectedId={selectedId}
              onSelectPoint={setSelectedId}
              onClearSelection={() => setSelectedId(null)}
            />
          </div>

          <button
            type="button"
            className={`image-toggle ${isImageModalOpen ? "is-open" : ""}`}
            aria-label={isImageModalOpen ? "画像解析を閉じる" : "画像解析を開く"}
            aria-expanded={isImageModalOpen}
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
            onPointerDown={() => setActiveOverlay("settings")}
          >
            <HighlightControls
              toneValue={highlight.toneValue}
              hueValue={highlight.hueValue}
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
            <ColorInfoPanel selectedPoint={selectedPoint} />
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
                  onFocusPanel={() => setActiveOverlay("image")}
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
                  onClearAll={() => {
                    setActiveOverlay("image");
                    clearImageHighlight();
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
