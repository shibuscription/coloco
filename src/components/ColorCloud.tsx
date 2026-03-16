import { ColorPoint } from "./ColorPoint";
import { isPointHighlighted, shouldDimPoint } from "../utils/highlight";
import type { HighlightState } from "../utils/highlight";
import type { PccsRenderablePoint } from "../utils/pccs3d";

type ColorCloudProps = {
  points: PccsRenderablePoint[];
  selectedId: string;
  highlight: HighlightState;
  onSelectPoint: (id: string) => void;
};

export function ColorCloud({ points, selectedId, highlight, onSelectPoint }: ColorCloudProps) {
  return (
    <>
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
