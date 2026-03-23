import type { PccsRenderablePoint } from "./pccs3d";

export type SwipeDirection = "left" | "right" | "up" | "down";

const chromaticToneOrder = ["v", "b", "s", "dp", "lt", "sf", "d", "dk", "p", "ltg", "g", "dkg"] as const;
const achromaticToneOrder = ["W", "ltGy", "Gy7.5", "mGy", "Gy5.5", "Gy4.5", "dkGy", "Gy2.5", "Bk"] as const;

const isChromaticPoint = (
  point: PccsRenderablePoint,
): point is Extract<PccsRenderablePoint, { kind: "chromatic" }> => point.kind === "chromatic";

const isAchromaticPoint = (
  point: PccsRenderablePoint,
): point is Extract<PccsRenderablePoint, { kind: "achromatic" }> => point.kind === "achromatic";

const wrapIndex = (value: number, length: number): number => {
  if (length === 0) {
    return 0;
  }

  return (value % length + length) % length;
};

const getAdjacentHueId = (
  points: PccsRenderablePoint[],
  currentPoint: Extract<PccsRenderablePoint, { kind: "chromatic" }>,
  step: number,
): string => {
  const tonePoints = points
    .filter(isChromaticPoint)
    .filter((point) => point.toneCode === currentPoint.toneCode)
    .sort((left, right) => left.hueIndex24 - right.hueIndex24);

  const currentIndex = tonePoints.findIndex((point) => point.id === currentPoint.id);
  if (currentIndex < 0 || tonePoints.length === 0) {
    return currentPoint.id;
  }

  const nextIndex = (currentIndex + step + tonePoints.length) % tonePoints.length;
  return tonePoints[nextIndex].id;
};

const getNearestHueIdInTone = (
  points: PccsRenderablePoint[],
  targetToneCode: string,
  sourceHueIndex24: number,
): string | null => {
  const targetPoints = points
    .filter(isChromaticPoint)
    .filter((point) => point.toneCode === targetToneCode)
    .sort((left, right) => left.hueIndex24 - right.hueIndex24);

  if (targetPoints.length === 0) {
    return null;
  }

  const exactMatch = targetPoints.find((point) => point.hueIndex24 === sourceHueIndex24);
  if (exactMatch) {
    return exactMatch.id;
  }

  let nearestPoint = targetPoints[0];
  let nearestDistance = Math.abs(nearestPoint.hueIndex24 - sourceHueIndex24);

  for (let index = 1; index < targetPoints.length; index += 1) {
    const point = targetPoints[index];
    const distance = Math.abs(point.hueIndex24 - sourceHueIndex24);

    if (distance < nearestDistance) {
      nearestPoint = point;
      nearestDistance = distance;
      continue;
    }

    if (distance === nearestDistance && point.hueIndex24 < nearestPoint.hueIndex24) {
      nearestPoint = point;
    }
  }

  return nearestPoint.id;
};

const getAdjacentToneId = (
  points: PccsRenderablePoint[],
  currentPoint: PccsRenderablePoint,
  step: number,
): string => {
  if (isAchromaticPoint(currentPoint)) {
    const currentIndex = achromaticToneOrder.indexOf(currentPoint.toneCode);
    if (currentIndex < 0) {
      return currentPoint.id;
    }

    const nextIndex = wrapIndex(currentIndex + step, achromaticToneOrder.length);
    const nextToneCode = achromaticToneOrder[nextIndex];
    const nextPoint = points.find(
      (point): point is Extract<PccsRenderablePoint, { kind: "achromatic" }> =>
        isAchromaticPoint(point) && point.toneCode === nextToneCode,
    );

    return nextPoint?.id ?? currentPoint.id;
  }

  const currentIndex = chromaticToneOrder.indexOf(currentPoint.toneCode);
  if (currentIndex < 0) {
    return currentPoint.id;
  }

  const nextIndex = wrapIndex(currentIndex + step, chromaticToneOrder.length);
  const nextToneCode = chromaticToneOrder[nextIndex];

  return getNearestHueIdInTone(points, nextToneCode, currentPoint.hueIndex24) ?? currentPoint.id;
};

export const getSwipeNavigationTargetId = (
  points: PccsRenderablePoint[],
  selectedId: string | null,
  direction: SwipeDirection,
): string | null => {
  if (!selectedId) {
    return null;
  }

  const currentPoint = points.find((point) => point.id === selectedId);
  if (!currentPoint) {
    return null;
  }

  if (direction === "left" && isChromaticPoint(currentPoint)) {
    return getAdjacentHueId(points, currentPoint, 1);
  }

  if (direction === "right" && isChromaticPoint(currentPoint)) {
    return getAdjacentHueId(points, currentPoint, -1);
  }

  if (direction === "up") {
    return getAdjacentToneId(points, currentPoint, -1);
  }

  if (direction === "down") {
    return getAdjacentToneId(points, currentPoint, 1);
  }

  return currentPoint.id;
};
