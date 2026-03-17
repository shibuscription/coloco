import { useEffect, useRef, useState } from "react";
import { OrbitControls } from "@react-three/drei";
import { PerspectiveCamera, Spherical, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  AUTO_ROTATE_RESUME_DELAY_MS,
  AUTO_ROTATE_SPEED,
  MAX_DISTANCE,
  MOBILE_MAX_DISTANCE,
  MAX_POLAR_ANGLE,
  MIN_DISTANCE,
  MIN_POLAR_ANGLE,
} from "../constants/viewConfig";

const ALIGN_ANIMATION_DURATION_MS = 340;

const normalizeAngle = (angle: number): number => ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

const easeOutCubic = (value: number): number => 1 - (1 - value) ** 3;

type SceneControlsProps = {
  isMobileView: boolean;
  autoRotateEnabled: boolean;
  alignYellowUpSignal: number;
  yellowUpAzimuth: number | null;
};

export function SceneControls({
  isMobileView,
  autoRotateEnabled,
  alignYellowUpSignal,
  yellowUpAzimuth,
}: SceneControlsProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const alignFrameRef = useRef<number | null>(null);
  const [isInteractionPaused, setIsInteractionPaused] = useState(false);
  const [isAligning, setIsAligning] = useState(false);

  const cancelAlignment = () => {
    if (alignFrameRef.current !== null) {
      window.cancelAnimationFrame(alignFrameRef.current);
      alignFrameRef.current = null;
    }
    setIsAligning(false);
  };

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const handleStart = () => {
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }
      cancelAlignment();
      setIsInteractionPaused(true);
    };

    const handleEnd = () => {
      resumeTimerRef.current = window.setTimeout(() => {
        setIsInteractionPaused(false);
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
      cancelAlignment();
    };
  }, []);

  useEffect(() => {
    if (autoRotateEnabled) {
      return;
    }

    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }

    setIsInteractionPaused(false);
  }, [autoRotateEnabled]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || alignYellowUpSignal === 0 || yellowUpAzimuth === null) {
      return;
    }

    cancelAlignment();

    const camera = controls.object as PerspectiveCamera;
    const target = controls.target.clone();
    const radius = controls.getDistance();
    const polar = controls.getPolarAngle();
    const startAzimuth = controls.getAzimuthalAngle();
    const azimuthDelta = normalizeAngle(yellowUpAzimuth - startAzimuth);
    const startTime = performance.now();

    setIsAligning(true);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / ALIGN_ANIMATION_DURATION_MS);
      const easedProgress = easeOutCubic(progress);
      const spherical = new Spherical(radius, polar, startAzimuth + azimuthDelta * easedProgress);
      const nextOffset = new Vector3().setFromSpherical(spherical);

      camera.position.copy(target).add(nextOffset);
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      controls.update();

      if (progress < 1) {
        alignFrameRef.current = window.requestAnimationFrame(step);
        return;
      }

      alignFrameRef.current = null;
      setIsAligning(false);
    };

    alignFrameRef.current = window.requestAnimationFrame(step);
  }, [alignYellowUpSignal, yellowUpAzimuth]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={MIN_POLAR_ANGLE}
      maxPolarAngle={MAX_POLAR_ANGLE}
      minDistance={MIN_DISTANCE}
      maxDistance={isMobileView ? MOBILE_MAX_DISTANCE : MAX_DISTANCE}
      autoRotate={autoRotateEnabled && !isInteractionPaused && !isAligning}
      autoRotateSpeed={AUTO_ROTATE_SPEED}
    />
  );
}
