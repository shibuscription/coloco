import { useMemo, useState } from "react";
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
] as const;

export default function App() {
  const points = useMemo(() => createRenderablePoints(pccsPoints, pccsAchromatic), []);
  const [selectedId, setSelectedId] = useState<string>(points[0]?.id ?? "");
  const [highlight, setHighlight] = useState<HighlightState>({ type: "none" });
  const [isMobileHighlightOpen, setIsMobileHighlightOpen] = useState(false);

  const selectedPoint = points.find((point) => point.id === selectedId) ?? null;
  const toneSelectOptions = toneOptions.map((tone) => ({
    ...tone,
    label: `${tone.label} トーン`,
  }));
  const hueSelectOptions = pccsRepresentativeHues12.map((hue) => ({
    value: hue.hueCode24,
    label: `${hue.hueCode24} (${hue.hueNameJa})`,
  }));

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="viewer-stack">
          <div className="viewer-card">
            <ColocoScene
              points={points}
              highlight={highlight}
              selectedId={selectedId}
              onSelectPoint={setSelectedId}
            />
          </div>
        </section>

        <aside className="sidebar">
          <div className="desktop-only">
            <HighlightControls
              highlight={highlight}
              onChange={setHighlight}
              toneOptions={toneSelectOptions}
              hueOptions={hueSelectOptions}
            />
          </div>
          <ColorInfoPanel selectedPoint={selectedPoint} />
        </aside>
      </main>

      <button
        type="button"
        className="mobile-highlight-toggle mobile-only"
        onClick={() => setIsMobileHighlightOpen(true)}
      >
        設定
      </button>

      {isMobileHighlightOpen ? (
        <div className="mobile-sheet-backdrop mobile-only" onClick={() => setIsMobileHighlightOpen(false)}>
          <div className="mobile-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-sheet-header">
              <button type="button" className="sheet-close" onClick={() => setIsMobileHighlightOpen(false)}>
                閉じる
              </button>
            </div>
            <HighlightControls
              bare
              highlight={highlight}
              onChange={setHighlight}
              toneOptions={toneSelectOptions}
              hueOptions={hueSelectOptions}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
