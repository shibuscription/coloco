import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { CatmullRomCurve3, Color, Vector3 } from "three";
import type { ChromaticToneCode } from "../data";
import type { PccsRenderablePoint } from "../utils/pccs3d";

type PccsGuideLinesProps = {
  points: PccsRenderablePoint[];
  showToneGuides: boolean;
  showHueGuides: boolean;
  showLightnessGuides: boolean;
};

type CurveLine = {
  key: string;
  points: [number, number, number][];
  colors: Color[];
  opacity: number;
};

type CurveAnchor = {
  position: Vector3;
  color: Color;
  lightness: number;
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
const lightnessLevels = [2, 3, 4, 5, 6, 7, 8, 9];

const toCurvePoints = (vectors: Vector3[], closed: boolean, divisions: number): [number, number, number][] => {
  if (vectors.length < (closed ? 3 : 2)) {
    return [];
  }

  const curve = new CatmullRomCurve3(vectors, closed, "centripetal");
  return curve.getPoints(divisions).map((point) => [point.x, point.y, point.z] as [number, number, number]);
};

const toHexColor = (value: string) => new Color(value);

const interpolateColorStops = (anchorColors: Color[], sampleCount: number, closed: boolean): Color[] => {
  if (anchorColors.length === 0 || sampleCount <= 0) {
    return [];
  }

  if (anchorColors.length === 1) {
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

const createCurveLine = (
  key: string,
  anchors: CurveAnchor[],
  {
    closed,
    divisions,
    opacity,
  }: {
    closed: boolean;
    divisions: number;
    opacity: number;
  },
): CurveLine | null => {
  if (anchors.length < (closed ? 3 : 2)) {
    return null;
  }

  const curvePoints = toCurvePoints(
    anchors.map((anchor) => anchor.position),
    closed,
    divisions,
  );

  if (curvePoints.length === 0) {
    return null;
  }

  const curveColors = interpolateColorStops(
    anchors.map((anchor) => anchor.color),
    curvePoints.length,
    closed,
  );

  return {
    key,
    points: curvePoints,
    colors: curveColors,
    opacity,
  };
};

const getMeridianAnchors = (points: PccsRenderablePoint[], hueIndex24: number): CurveAnchor[] => {
  const whitePoint = points.find((point) => point.kind === "achromatic" && point.toneCode === "W");
  const blackPoint = points.find((point) => point.kind === "achromatic" && point.toneCode === "Bk");

  return meridianToneOrder
    .map((toneCode) => {
      const point =
        toneCode === "W"
          ? whitePoint
          : toneCode === "Bk"
            ? blackPoint
            : points.find(
                (candidate): candidate is Extract<PccsRenderablePoint, { kind: "chromatic" }> =>
                  candidate.kind === "chromatic" && candidate.toneCode === toneCode && candidate.hueIndex24 === hueIndex24,
              );

      if (!point) {
        return null;
      }

      return {
        position: new Vector3(point.position.x, point.position.y, point.position.z),
        color: toHexColor(point.hex),
        lightness: point.pccsLightness,
      } satisfies CurveAnchor;
    })
    .filter((anchor): anchor is CurveAnchor => Boolean(anchor));
};

const createLatitudeLines = (points: PccsRenderablePoint[]): CurveLine[] =>
  latitudeToneOrder
    .map((toneCode) => {
      const toneAnchors = points
        .filter((point): point is Extract<PccsRenderablePoint, { kind: "chromatic" }> => point.kind === "chromatic" && point.toneCode === toneCode)
        .sort((left, right) => left.hueIndex24 - right.hueIndex24)
        .map((point) => ({
          position: new Vector3(point.position.x, point.position.y, point.position.z),
          color: toHexColor(point.hex),
          lightness: point.pccsLightness,
        }));

      return createCurveLine(`latitude-${toneCode}`, toneAnchors, {
        closed: true,
        divisions: toneCode === "v" ? 240 : 160,
        opacity: toneCode === "v" ? 0.34 : 0.2,
      });
    })
    .filter((curve): curve is CurveLine => Boolean(curve));

const createMeridianLines = (points: PccsRenderablePoint[]) =>
  meridianHueIndices
    .map((hueIndex24) =>
      createCurveLine(`meridian-${hueIndex24}`, getMeridianAnchors(points, hueIndex24), {
        closed: false,
        divisions: 120,
        opacity: 0.24,
      }),
    )
    .filter((curve): curve is CurveLine => Boolean(curve));

const createLightnessLines = (points: PccsRenderablePoint[]): CurveLine[] =>
  lightnessLevels
    .map((targetY) => {
      const anchors = meridianHueIndices
        .map((hueIndex24) => {
          const meridianAnchors = getMeridianAnchors(points, hueIndex24);

          for (let index = 0; index < meridianAnchors.length - 1; index += 1) {
            const start = meridianAnchors[index];
            const end = meridianAnchors[index + 1];
            const minLightness = Math.min(start.lightness, end.lightness);
            const maxLightness = Math.max(start.lightness, end.lightness);

            if (targetY < minLightness || targetY > maxLightness || start.lightness === end.lightness) {
              continue;
            }

            const t = (targetY - start.lightness) / (end.lightness - start.lightness);
            const position = new Vector3().lerpVectors(start.position, end.position, t);
            const color = new Color().lerpColors(start.color, end.color, t);

            return { position, color, lightness: targetY } satisfies CurveAnchor;
          }

          return null;
        })
        .filter((anchor): anchor is CurveAnchor => Boolean(anchor));

      return createCurveLine(`lightness-${targetY}`, anchors, {
        closed: true,
        divisions: 180,
        opacity: 0.18,
      });
    })
    .filter((curve): curve is CurveLine => Boolean(curve));

export function PccsGuideLines({
  points,
  showToneGuides,
  showHueGuides,
  showLightnessGuides,
}: PccsGuideLinesProps) {
  const curveLines = useMemo(() => {
    const lines: CurveLine[] = [];

    if (showToneGuides) {
      lines.push(...createLatitudeLines(points));
    }

    if (showHueGuides) {
      lines.push(...createMeridianLines(points));
    }

    if (showLightnessGuides) {
      lines.push(...createLightnessLines(points));
    }

    return lines;
  }, [points, showToneGuides, showHueGuides, showLightnessGuides]);

  if (curveLines.length === 0) {
    return null;
  }

  return (
    <>
      {curveLines.map((curve) => (
        <Line
          key={curve.key}
          points={curve.points}
          vertexColors={curve.colors}
          lineWidth={1.9}
          transparent
          opacity={curve.opacity}
          raycast={() => null}
        />
      ))}
    </>
  );
}
