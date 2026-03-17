import { Line, Text } from "@react-three/drei";
import { pccsRepresentativeHues12 } from "../data";
import { CHROMA_SCALE, VERTICAL_SCALE } from "../constants/viewConfig";

const hueGuideRadius = 10 * CHROMA_SCALE;
const lightnessTicks = [1.5, 3.5, 5.5, 7.5, 9.5];

const ringPoints = Array.from({ length: 65 }, (_, index) => {
  const angle = (index / 64) * Math.PI * 2;
  return [Math.cos(angle) * hueGuideRadius, 0, Math.sin(angle) * hueGuideRadius] as [number, number, number];
});

export function SceneGuides() {
  return (
    <group raycast={() => null}>
      <Line points={[[0, 0, 0], [0, 5.4, 0]]} color="#3b2d1f" lineWidth={1.2} />
      <Line points={[[0, 0.78, 0], [0, 1.82, 0]]} color="#6f6253" lineWidth={1} dashed dashSize={0.09} gapSize={0.06} />
      <Line points={ringPoints} color="#a89780" lineWidth={0.7} />

      {lightnessTicks.map((tick) => (
        <group key={tick} position={[0, tick * VERTICAL_SCALE, 0]}>
          <Line points={[[-0.16, 0, 0], [0.16, 0, 0]]} color="#6f6253" lineWidth={1} />
        </group>
      ))}

      {pccsRepresentativeHues12.map((hue) => {
        const theta = (hue.angleDeg * Math.PI) / 180;
        const x = Math.cos(theta) * (hueGuideRadius + 0.6);
        const z = Math.sin(theta) * (hueGuideRadius + 0.6);
        const outwardRotationY = Math.PI / 2 - theta;

        return (
          <Text
            key={hue.hueIndex24}
            position={[x, 0.2, z]}
            rotation={[0, outwardRotationY, 0]}
            fontSize={0.32}
            color="#5a4c3b"
            anchorX="center"
            anchorY="middle"
          >
            {hue.hueCode24}
          </Text>
        );
      })}
    </group>
  );
}
