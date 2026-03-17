import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { CatmullRomCurve3, Vector3 } from "three";
import type { ChromaticToneCode } from "../data";
import type { PccsRenderablePoint } from "../utils/pccs3d";

type PccsGuideLinesProps = {
  points: PccsRenderablePoint[];
  visible: boolean;
};

type CurveLine = {
  key: string;
  points: [number, number, number][];
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

export function PccsGuideLines({ points, visible }: PccsGuideLinesProps) {
  const curveLines = useMemo(() => {
    if (!visible) {
      return [] as CurveLine[];
    }

    const latitudes: CurveLine[] = latitudeToneOrder
      .map((toneCode) => {
        const tonePoints = points
          .filter((point): point is Extract<PccsRenderablePoint, { kind: "chromatic" }> => point.kind === "chromatic" && point.toneCode === toneCode)
          .sort((left, right) => left.hueIndex24 - right.hueIndex24)
          .map((point) => new Vector3(point.position.x, point.position.y, point.position.z));

        const curvePoints = toCurvePoints(tonePoints, true, toneCode === "v" ? 240 : 160);

        return {
          key: `latitude-${toneCode}`,
          points: curvePoints,
          opacity: toneCode === "v" ? 0.34 : 0.2,
        };
      })
      .filter((curve) => curve.points.length > 0);

    const whitePoint = points.find((point) => point.kind === "achromatic" && point.toneCode === "W");
    const blackPoint = points.find((point) => point.kind === "achromatic" && point.toneCode === "Bk");

    const meridians: CurveLine[] = meridianHueIndices
      .map((hueIndex24) => {
        const meridianVectors = meridianToneOrder
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
          .filter((point): point is PccsRenderablePoint => Boolean(point))
          .map((point) => new Vector3(point.position.x, point.position.y, point.position.z));

        return {
          key: `meridian-${hueIndex24}`,
          points: toCurvePoints(meridianVectors, false, 120),
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
          color="#3b2d1f"
          lineWidth={1.1}
          transparent
          opacity={curve.opacity}
          raycast={() => null}
        />
      ))}
    </>
  );
}
