import type { PccsRenderablePoint } from "./pccs3d";

export type HighlightState = {
  toneValue: string;
  hueValue: string;
};

const isToneMatch = (point: PccsRenderablePoint, toneValue: string): boolean => {
  if (!toneValue) {
    return false;
  }

  if (toneValue === "achromatic") {
    return point.kind === "achromatic";
  }

  return point.kind === "chromatic" && point.toneCode === toneValue;
};

const isHueMatch = (point: PccsRenderablePoint, hueValue: string): boolean => {
  if (!hueValue) {
    return false;
  }

  if (point.kind === "achromatic") {
    return true;
  }

  return point.hueCode24 === hueValue;
};

export const hasActiveHighlight = (highlight: HighlightState): boolean =>
  Boolean(highlight.toneValue || highlight.hueValue);

export const isPointHighlighted = (point: PccsRenderablePoint, highlight: HighlightState): boolean => {
  if (!hasActiveHighlight(highlight)) {
    return true;
  }

  return isToneMatch(point, highlight.toneValue) || isHueMatch(point, highlight.hueValue);
};

export const shouldDimPoint = (point: PccsRenderablePoint, highlight: HighlightState): boolean => {
  if (!hasActiveHighlight(highlight)) {
    return false;
  }

  return !isPointHighlighted(point, highlight);
};
