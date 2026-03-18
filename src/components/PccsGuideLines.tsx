import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { CatmullRomCurve3, Color, Vector3 } from "three";
import type { ChromaticToneCode } from "../data";
import type { PccsRenderablePoint } from "../utils/pccs3d";

type PccsGuideLinesProps = {
  points: PccsRenderablePoint[];
  visible: boolean;
};

type CurveLine = {
  key: string;
  points: [number, number, number][];
  colors: Color[];
  opacity: number;
};

const latitudeToneOrder: ChromaticToneCode[] = [
  "p",
  "lt",
  "b",
  "v",
  "dp",
  "s",
  "sf",
  "d",
  "dk",
  "ltg",
  "g",
  "dkg",
];

const meridianHueIndices = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
const meridianToneOrder: Array<ChromaticToneCode | "W" | "Bk"> = ["W", "p", "lt", "b", "v", "dp", "dk", "dkg", "Bk"];

const toCurvePoints = (vectors: Vector3[], closed: boolean, divisions: number): [number, number, number][] => {
  if (vectors.length < (closed ? 3 : 2)) {
    return [];
  }

  const curve = new CatmullRomCurve3(vectors, closed, "centripetal");
  return curve.getPoints(divisions).map((point) => [point.x, point.y, point.z] as [number, number, number]);
};

const toHexColor = (value: string) => new Color(value);

const interpolateColorStops = (anchorHexes: string[], sampleCount: number, closed: boolean): Color[] => {
  if (anchorHexes.length === 0 || sampleCount <= 0) {
    return [];
  }

  const anchorColors = anchorHexes.map(toHexColor);

  if (anchorHexes.length === 1) {
    return Array.from({ length: sampleCount }, () => anchorColors[0].clone());
  }
  const segmentCount = closed ? anchorColors.length : anchorColors.length - 1;
  const maxIndex = Math.max(sampleCount - 1, 1);

  return Array.from({ length: sampleCount }, (_, sampleIndex) => {
    const progress = closed ? sampleIndex / sampleCount : sampleIndex / maxIndex;
    const scaled = progress * segmentCount;
    const startIndex = Math.floor(scaled) % anchorColors.length;
    const endIndex = closed ? (startIndex + 1) % anchorColors.length : Math.min(startIndex + 1, anchorColors.length - 1);
    const localT = scaled - Math.floor(scaled);
    return new Color().lerpColors(anchorColors[startIndex], anchorColors[endIndex], localT);
  });
};

export function PccsGuideLines({ points, visible }: PccsGuideLinesProps) {
  const curveLines = useMemo(() => {
    if (!visible) {
      return [] as CurveLine[];
    }

    const latitudes: CurveLine[] = latitudeToneOrder
      .map((toneCode) => {
        const tonePoints = points
          .filter((point): point is Extract<PccsRenderablePoint, { kind: "chromatic" }> => point.kind === "chromatic" && point.toneCode === toneCode)
          .sort((left, right) => left.hueIndex24 - right.hueIndex24);

        const curvePoints = toCurvePoints(
          tonePoints.map((point) => new Vector3(point.position.x, point.position.y, point.position.z)),
          true,
          toneCode === "v" ? 240 : 160,
        );
        const curveColors = interpolateColorStops(
          tonePoints.map((point) => point.hex),
          curvePoints.length,
          true,
        );

        return {
          key: `latitude-${toneCode}`,
          points: curvePoints,
          colors: curveColors,
          opacity: toneCode === "v" ? 0.34 : 0.2,
        };
      })
      .filter((curve) => curve.points.length > 0);

    const whitePoint = points.find((point) => point.kind === "achromatic" && point.toneCode === "W");
    const blackPoint = points.find((point) => point.kind === "achromatic" && point.toneCode === "Bk");

    const meridians: CurveLine[] = meridianHueIndices
      .map((hueIndex24) => {
        const meridianPoints = meridianToneOrder
          .map((toneCode) => {
            if (toneCode === "W") {
              return whitePoint;
            }

            if (toneCode === "Bk") {
              return blackPoint;
            }

            return points.find(
              (point): point is Extract<PccsRenderablePoint, { kind: "chromatic" }> =>
                point.kind === "chromatic" && point.toneCode === toneCode && point.hueIndex24 === hueIndex24,
            );
          })
          .filter((point): point is PccsRenderablePoint => Boolean(point));

        const meridianVectors = meridianPoints.map((point) => new Vector3(point.position.x, point.position.y, point.position.z));
        const curvePoints = toCurvePoints(meridianVectors, false, 120);
        const curveColors = interpolateColorStops(
          meridianPoints.map((point) => point.hex),
          curvePoints.length,
          false,
        );

        return {
          key: `meridian-${hueIndex24}`,
          points: curvePoints,
          colors: curveColors,
          opacity: 0.24,
        };
      })
      .filter((curve) => curve.points.length > 0);

    return [...latitudes, ...meridians];
  }, [points, visible]);

  if (!visible || curveLines.length === 0) {
    return null;
  }

  return (
    <>
      {curveLines.map((curve) => (
        <Line
          key={curve.key}
          points={curve.points}
          vertexColors={curve.colors}
          lineWidth={1.6}
          transparent
          opacity={curve.opacity}
          raycast={() => null}
        />
      ))}
    </>
  );
}
