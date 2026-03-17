import { ColorPoint } from "./ColorPoint";
import { PccsGuideLines } from "./PccsGuideLines";
import { isPointHighlighted, shouldDimPoint } from "../utils/highlight";
import type { HighlightState } from "../utils/highlight";
import type { PccsRenderablePoint } from "../utils/pccs3d";

type ColorCloudProps = {
  points: PccsRenderablePoint[];
  selectedId: string | null;
  highlight: HighlightState;
  guideLinesVisible: boolean;
  onSelectPoint: (id: string) => void;
};

export function ColorCloud({ points, selectedId, highlight, guideLinesVisible, onSelectPoint }: ColorCloudProps) {
  return (
    <>
      <PccsGuideLines points={points} visible={guideLinesVisible} />
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
