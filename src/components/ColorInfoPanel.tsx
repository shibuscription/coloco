import type { PccsRenderablePoint } from "../utils/pccs3d";

type ColorInfoPanelProps = {
  selectedPoint: PccsRenderablePoint | null;
};

const getContrastTextColor = (hex: string): string => {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;

  return luminance > 145 ? "#2b251d" : "#fffaf1";
};

export function ColorInfoPanel({ selectedPoint }: ColorInfoPanelProps) {
  if (!selectedPoint) {
    return null;
  }

  return (
    <section className="panel info-panel info-overlay-card">
      <div
        className="color-chip color-chip-large"
        style={{
          background: selectedPoint.hex,
          color: getContrastTextColor(selectedPoint.hex),
        }}
      >
        <strong>{selectedPoint.label}</strong>
      </div>

      <dl className="info-grid info-grid-compact">
        <dt>PCCS記号</dt>
        <dd>{selectedPoint.pccsNotation ?? "-"}</dd>
        <dt>マンセル記号</dt>
        <dd>{selectedPoint.munsellNotation ?? "-"}</dd>
        <dt>HEX</dt>
        <dd>{selectedPoint.hex}</dd>
        <dt>RGB</dt>
        <dd>
          {selectedPoint.rgb.r}, {selectedPoint.rgb.g}, {selectedPoint.rgb.b}
        </dd>
      </dl>
    </section>
  );
}
