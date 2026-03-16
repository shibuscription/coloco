import type { PccsRenderablePoint } from "./pccs3d";

export type HighlightState =
  | { type: "none" }
  | { type: "tone"; value: string }
  | { type: "hue"; value: string }
  | { type: "achromatic" };

export const isPointHighlighted = (point: PccsRenderablePoint, highlight: HighlightState): boolean => {
  switch (highlight.type) {
    case "none":
      return true;
    case "tone":
      return point.kind === "chromatic" && point.toneCode === highlight.value;
    case "hue":
      return point.kind === "chromatic" && point.hueCode24 === highlight.value;
    case "achromatic":
      return point.kind === "achromatic";
    default:
      return true;
  }
};

export const shouldDimPoint = (point: PccsRenderablePoint, highlight: HighlightState): boolean => {
  if (highlight.type === "none") {
    return false;
  }

  return !isPointHighlighted(point, highlight);
};
