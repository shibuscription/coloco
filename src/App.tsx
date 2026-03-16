import { useEffect, useMemo, useState } from "react";
import { pccsAchromatic, pccsPoints, pccsRepresentativeHues12 } from "./data";
import { ColorInfoPanel } from "./components/ColorInfoPanel";
import { ColocoScene } from "./components/ColocoScene";
import { HighlightControls } from "./components/HighlightControls";
import { createRenderablePoints } from "./utils/pccs3d";
import type { HighlightState } from "./utils/highlight";

const toneOptions = [
  { value: "v", label: "v" },
  { value: "b", label: "b" },
  { value: "s", label: "s" },
  { value: "dp", label: "dp" },
  { value: "lt", label: "lt" },
  { value: "sf", label: "sf" },
  { value: "d", label: "d" },
  { value: "dk", label: "dk" },
  { value: "p", label: "p" },
  { value: "ltg", label: "ltg" },
  { value: "g", label: "g" },
  { value: "dkg", label: "dkg" },
  { value: "achromatic", label: "無彩色" },
] as const;

const INITIAL_HIGHLIGHT: HighlightState = {
  toneValue: "",
  hueValue: "",
};

export default function App() {
  const points = useMemo(() => createRenderablePoints(pccsPoints, pccsAchromatic), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<HighlightState>(INITIAL_HIGHLIGHT);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const selectedPoint = points.find((point) => point.id === selectedId) ?? null;
  const toneSelectOptions = toneOptions.map((tone) => ({
    ...tone,
    label: `${tone.label}${tone.value === "achromatic" ? "" : " トーン"}`,
  }));
  const hueSelectOptions = pccsRepresentativeHues12.map((hue) => ({
    value: hue.hueCode24,
    label: `${hue.hueCode24} (${hue.hueNameJa})`,
  }));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
            className={`menu-toggle ${isSettingsOpen ? "is-open" : ""}`}
            aria-label="設定を開く"
            aria-expanded={isSettingsOpen}
            onClick={() => setIsSettingsOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>

          <div
            className={`settings-backdrop ${isSettingsOpen ? "is-open" : ""}`}
            onClick={() => setIsSettingsOpen(false)}
          />

          <section
            className={`settings-overlay ${isSettingsOpen ? "is-open" : ""}`}
            onClick={(event) => event.stopPropagation()}
          >
            <HighlightControls
              toneValue={highlight.toneValue}
              hueValue={highlight.hueValue}
              onToneChange={(value) =>
                setHighlight({
                  toneValue: value,
                  hueValue: value ? "" : highlight.hueValue,
                })
              }
              onHueChange={(value) =>
                setHighlight({
                  toneValue: value ? "" : highlight.toneValue,
                  hueValue: value,
                })
              }
              toneOptions={toneSelectOptions}
              hueOptions={hueSelectOptions}
            />
          </section>

          <div className={`info-overlay ${selectedPoint ? "is-visible" : ""}`}>
            <ColorInfoPanel selectedPoint={selectedPoint} />
          </div>
        </section>
      </main>
    </div>
  );
}
