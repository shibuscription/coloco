import { useEffect, useRef, useState } from "react";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  AUTO_ROTATE_RESUME_DELAY_MS,
  AUTO_ROTATE_SPEED,
  MAX_DISTANCE,
  MAX_POLAR_ANGLE,
  MIN_DISTANCE,
  MIN_POLAR_ANGLE,
} from "../constants/viewConfig";

export function SceneControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const handleStart = () => {
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }
      setAutoRotate(false);
    };

    const handleEnd = () => {
      resumeTimerRef.current = window.setTimeout(() => {
        setAutoRotate(true);
      }, AUTO_ROTATE_RESUME_DELAY_MS);
    };

    controls.addEventListener("start", handleStart);
    controls.addEventListener("end", handleEnd);

    return () => {
      controls.removeEventListener("start", handleStart);
      controls.removeEventListener("end", handleEnd);
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }
    };
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={MIN_POLAR_ANGLE}
      maxPolarAngle={MAX_POLAR_ANGLE}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      autoRotate={autoRotate}
      autoRotateSpeed={AUTO_ROTATE_SPEED}
    />
  );
}
