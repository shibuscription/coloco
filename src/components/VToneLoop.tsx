import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { CatmullRomCurve3, Vector3 } from "three";
import type { PccsRenderablePoint } from "../utils/pccs3d";

type VToneLoopProps = {
  points: PccsRenderablePoint[];
};

const isChromaticVTone = (
  point: PccsRenderablePoint,
): point is Extract<PccsRenderablePoint, { kind: "chromatic" }> =>
  point.kind === "chromatic" && point.toneCode === "v";

export function VToneLoop({ points }: VToneLoopProps) {
  const curvePoints = useMemo(() => {
    const vTonePoints = points
      .filter(isChromaticVTone)
      .sort((left, right) => left.hueIndex24 - right.hueIndex24)
      .map((point) => new Vector3(point.position.x, point.position.y, point.position.z));

    if (vTonePoints.length < 3) {
      return [] as [number, number, number][];
    }

    const curve = new CatmullRomCurve3(vTonePoints, true, "centripetal");

    return curve
      .getPoints(240)
      .map((point) => [point.x, point.y, point.z] as [number, number, number]);
  }, [points]);

  if (curvePoints.length === 0) {
    return null;
  }

  return (
    <Line
      points={curvePoints}
      color="#3b2d1f"
      lineWidth={0.95}
      transparent
      opacity={0.42}
      raycast={() => null}
    />
  );
}
