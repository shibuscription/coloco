import { useRef } from "react";
import type { Mesh } from "three";
import { useFrame } from "@react-three/fiber";
import {
  DEFAULT_OPACITY,
  DIMMED_OPACITY,
  HIGHLIGHT_SCALE,
  POINT_RADIUS,
  SELECTED_SCALE,
} from "../constants/viewConfig";
import type { PccsRenderablePoint } from "../utils/pccs3d";

type ColorPointProps = {
  point: PccsRenderablePoint;
  selected: boolean;
  sphereScale: number;
  highlighted: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
};

export function ColorPoint({ point, selected, sphereScale, highlighted, dimmed, onSelect }: ColorPointProps) {
  const meshRef = useRef<Mesh>(null);
  const relativeScale = selected ? SELECTED_SCALE : highlighted ? HIGHLIGHT_SCALE : 1;
  const targetScale = sphereScale * relativeScale;

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const lerpFactor = 0.16;
    mesh.scale.x += (targetScale - mesh.scale.x) * lerpFactor;
    mesh.scale.y += (targetScale - mesh.scale.y) * lerpFactor;
    mesh.scale.z += (targetScale - mesh.scale.z) * lerpFactor;
  });

  return (
    <mesh
      ref={meshRef}
      position={[point.position.x, point.position.y, point.position.z]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(point.id);
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <sphereGeometry args={[POINT_RADIUS, 24, 24]} />
      <meshStandardMaterial
        color={point.hex}
        transparent
        opacity={dimmed ? DIMMED_OPACITY : DEFAULT_OPACITY}
        emissive={selected ? point.hex : "#000000"}
        emissiveIntensity={selected ? 0.7 : highlighted ? 0.18 : 0}
        roughness={0.35}
        metalness={0.08}
      />
    </mesh>
  );
}
