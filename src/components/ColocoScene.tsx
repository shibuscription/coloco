import { forwardRef, Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Spherical, Vector3 } from "three";
import {
  CAMERA_FOV,
  INITIAL_CAMERA_POSITION,
  MOBILE_CAMERA_FOV,
  MOBILE_INITIAL_CAMERA_POSITION,
} from "../constants/viewConfig";
import { ColorCloud } from "./ColorCloud";
import { SceneControls } from "./SceneControls";
import type { SceneControlsHandle, SceneViewState } from "./SceneControls";
import { SceneGuides } from "./SceneGuides";
import type { HighlightState } from "../utils/highlight";
import type { PccsRenderablePoint } from "../utils/pccs3d";

const SCENE_GROUP_OFFSET_Y = -2.5;

function alignInitialCameraAzimuth(
  basePosition: [number, number, number],
  azimuth: number | null,
): [number, number, number] {
  if (azimuth === null) {
    return basePosition;
  }

  const baseVector = new Vector3(...basePosition);
  const spherical = new Spherical().setFromVector3(baseVector);
  spherical.theta = azimuth;

  const alignedVector = new Vector3().setFromSpherical(spherical);
  return [alignedVector.x, alignedVector.y, alignedVector.z];
}

type ColocoSceneProps = {
  points: PccsRenderablePoint[];
  highlight: HighlightState;
  selectedId: string | null;
  sphereScale: number;
  autoRotateMode: "cw" | "ccw" | "off";
  autoRotateRpm: number;
  northLockEnabled: boolean;
  showToneGuides: boolean;
  showHueGuides: boolean;
  showLightnessGuides: boolean;
  initialViewState?: SceneViewState | null;
  onViewStateChange?: (state: SceneViewState) => void;
  keyboardInput: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  };
  onSelectPoint: (id: string) => void;
  onClearSelection: () => void;
};

export const ColocoScene = forwardRef<SceneControlsHandle, ColocoSceneProps>(function ColocoScene({
  points,
  highlight,
  selectedId,
  sphereScale,
  autoRotateMode,
  autoRotateRpm,
  northLockEnabled,
  showToneGuides,
  showHueGuides,
  showLightnessGuides,
  initialViewState = null,
  onViewStateChange,
  keyboardInput,
  onSelectPoint,
  onClearSelection,
}: ColocoSceneProps, ref) {
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

  const yellowPoint = points.find(
    (point) => point.kind === "chromatic" && point.toneCode === "v" && point.hueIndex24 === 8,
  );
  const yellowUpAzimuth = yellowPoint
    // PCCS の hue angle は +X 基準だが、OrbitControls の azimuth(theta) は +Z 基準。
    // 真上視点で Y が 12 時方向に来る基準方位へ合わせるため、座標系の差をここで補正する。
    ? (Math.PI * 3) / 2 - Math.atan2(yellowPoint.position.z, yellowPoint.position.x)
    : null;
  const initialCameraPosition = useMemo(
    () => alignInitialCameraAzimuth(INITIAL_CAMERA_POSITION, yellowUpAzimuth),
    [yellowUpAzimuth],
  );
  const initialMobileCameraPosition = useMemo(
    () => alignInitialCameraAzimuth(MOBILE_INITIAL_CAMERA_POSITION, yellowUpAzimuth),
    [yellowUpAzimuth],
  );

  return (
    <Canvas
      className="viewer-canvas"
      style={{ width: "100%", height: "100%", display: "block" }}
      camera={{
        position: isMobileView ? initialMobileCameraPosition : initialCameraPosition,
        fov: isMobileView ? MOBILE_CAMERA_FOV : CAMERA_FOV,
        near: 0.1,
        far: 100,
      }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={onClearSelection}
    >
      <color attach="background" args={["#bfc3c9"]} />
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
        <group position={[0, SCENE_GROUP_OFFSET_Y, 0]}>
          <SceneGuides />
          <ColorCloud
            points={points}
            selectedId={selectedId}
            sphereScale={sphereScale}
            highlight={highlight}
            showToneGuides={showToneGuides}
            showHueGuides={showHueGuides}
            showLightnessGuides={showLightnessGuides}
            onSelectPoint={onSelectPoint}
          />
        </group>
      </Suspense>
      <SceneControls
        ref={ref}
        isMobileView={isMobileView}
        autoRotateMode={autoRotateMode}
        autoRotateRpm={autoRotateRpm}
        northLockEnabled={northLockEnabled}
        yellowUpAzimuth={yellowUpAzimuth}
        initialViewState={initialViewState}
        onViewStateChange={onViewStateChange}
        keyboardInput={keyboardInput}
      />
    </Canvas>
  );
});
