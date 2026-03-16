import { pccsHueMapByIndex24 } from "../data";
import { CHROMA_SCALE, VERTICAL_SCALE } from "../constants/viewConfig";
import type { AchromaticPccsPoint, ChromaticPccsPoint } from "../data";

export type Point3D = {
  x: number;
  y: number;
  z: number;
};

export type PccsRenderablePoint = (ChromaticPccsPoint | AchromaticPccsPoint) & {
  position: Point3D;
  label: string;
};

export const getPccsPosition = (point: ChromaticPccsPoint | AchromaticPccsPoint): Point3D => {
  const y = point.pccsLightness * VERTICAL_SCALE;

  if (point.kind === "achromatic") {
    return { x: 0, y, z: 0 };
  }

  const hue = pccsHueMapByIndex24.get(point.hueIndex24);
  const angleDeg = hue?.angleDeg ?? 0;
  const theta = (angleDeg * Math.PI) / 180;
  const radius = point.pccsSaturation * CHROMA_SCALE;

  return {
    x: radius * Math.cos(theta),
    y,
    z: radius * Math.sin(theta),
  };
};

export const getPointLabel = (point: ChromaticPccsPoint | AchromaticPccsPoint): string => {
  if (point.kind === "achromatic") {
    return point.toneCode;
  }

  return `${point.toneCode}${point.hueIndex24}`;
};

export const createRenderablePoints = (
  chromaticPoints: ChromaticPccsPoint[],
  achromaticPoints: AchromaticPccsPoint[],
): PccsRenderablePoint[] =>
  [...chromaticPoints, ...achromaticPoints].map((point) => ({
    ...point,
    position: getPccsPosition(point),
    label: getPointLabel(point),
  }));
