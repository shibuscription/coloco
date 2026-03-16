import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { INITIAL_CAMERA_POSITION } from "../constants/viewConfig";
import { ColorCloud } from "./ColorCloud";
import { SceneControls } from "./SceneControls";
import { SceneGuides } from "./SceneGuides";
import type { HighlightState } from "../utils/highlight";
import type { PccsRenderablePoint } from "../utils/pccs3d";

type ColocoSceneProps = {
  points: PccsRenderablePoint[];
  highlight: HighlightState;
  selectedId: string;
  onSelectPoint: (id: string) => void;
};

export function ColocoScene({ points, highlight, selectedId, onSelectPoint }: ColocoSceneProps) {
  return (
    <Canvas
      camera={{ position: INITIAL_CAMERA_POSITION, fov: 42, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={["#f7f0e3"]} />
      <fog attach="fog" args={["#f7f0e3", 10, 22]} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[5, 8, 6]} intensity={1.1} />
      <directionalLight position={[-4, 5, -5]} intensity={0.55} />
      <Suspense
        fallback={
          <Html center>
            <div>Loading 3D scene...</div>
          </Html>
        }
      >
        <group position={[0, -2.5, 0]}>
          <SceneGuides />
          <ColorCloud
            points={points}
            selectedId={selectedId}
            highlight={highlight}
            onSelectPoint={onSelectPoint}
          />
        </group>
      </Suspense>
      <SceneControls />
    </Canvas>
  );
}
