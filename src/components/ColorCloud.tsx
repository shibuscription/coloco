import { ColorPoint } from "./ColorPoint";
import { PccsGuideLines } from "./PccsGuideLines";
import { isPointHighlighted, shouldDimPoint } from "../utils/highlight";
import type { HighlightState } from "../utils/highlight";
import type { PccsRenderablePoint } from "../utils/pccs3d";

type ColorCloudProps = {
  points: PccsRenderablePoint[];
  selectedId: string | null;
  highlight: HighlightState;
  showToneGuides: boolean;
  showHueGuides: boolean;
  showLightnessGuides: boolean;
  onSelectPoint: (id: string) => void;
};

export function ColorCloud({
  points,
  selectedId,
  highlight,
  showToneGuides,
  showHueGuides,
  showLightnessGuides,
  onSelectPoint,
}: ColorCloudProps) {
  return (
    <>
      <PccsGuideLines
        points={points}
        showToneGuides={showToneGuides}
        showHueGuides={showHueGuides}
        showLightnessGuides={showLightnessGuides}
      />
      {points.map((point) => (
        <ColorPoint
          key={point.id}
          point={point}
          selected={point.id === selectedId}
          highlighted={isPointHighlighted(point, highlight)}
          dimmed={shouldDimPoint(point, highlight)}
          onSelect={onSelectPoint}
        />
      ))}
    </>
  );
}
