import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  CAMERA_FOV,
  INITIAL_CAMERA_POSITION,
  MOBILE_CAMERA_FOV,
  MOBILE_INITIAL_CAMERA_POSITION,
} from "../constants/viewConfig";
import { ColorCloud } from "./ColorCloud";
import { SceneControls } from "./SceneControls";
import { SceneGuides } from "./SceneGuides";
import type { HighlightState } from "../utils/highlight";
import type { PccsRenderablePoint } from "../utils/pccs3d";

type ColocoSceneProps = {
  points: PccsRenderablePoint[];
  highlight: HighlightState;
  selectedId: string | null;
  onSelectPoint: (id: string) => void;
  onClearSelection: () => void;
};

export function ColocoScene({
  points,
  highlight,
  selectedId,
  onSelectPoint,
  onClearSelection,
}: ColocoSceneProps) {
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 980px)").matches : false,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const handleChange = () => setIsMobileView(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <Canvas
      style={{ width: "100%", height: "100%", display: "block" }}
      camera={{
        position: isMobileView ? MOBILE_INITIAL_CAMERA_POSITION : INITIAL_CAMERA_POSITION,
        fov: isMobileView ? MOBILE_CAMERA_FOV : CAMERA_FOV,
        near: 0.1,
        far: 100,
      }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={onClearSelection}
    >
      <color attach="background" args={["#bfc3c9"]} />
      <fog attach="fog" args={["#bfc3c9", 10, 22]} />
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
      <SceneControls isMobileView={isMobileView} />
    </Canvas>
  );
}
