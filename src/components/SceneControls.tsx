import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PerspectiveCamera, Spherical, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  AUTO_ROTATE_RESUME_DELAY_MS,
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
  autoRotateMode: "cw" | "ccw" | "off";
  autoRotateRpm: number;
  northLockEnabled: boolean;
  yellowUpAzimuth: number | null;
  initialViewState?: SceneViewState | null;
  onViewStateChange?: (state: SceneViewState) => void;
  keyboardInput: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  };
};

export type SceneViewState = {
  azimuth: number;
  polar: number;
  distance: number;
  target: [number, number, number];
};

export type SceneControlsHandle = {
  nudgeAzimuth: (delta: number) => void;
  nudgePolar: (delta: number) => void;
  getViewState: () => SceneViewState | null;
  applyViewState: (state: SceneViewState) => void;
};

const KEYBOARD_AZIMUTH_SPEED = Math.PI * 0.9;
const KEYBOARD_POLAR_SPEED = Math.PI * 0.72;
const KEYBOARD_EASING_FACTOR = 0.22;
const KEYBOARD_SETTLE_EPSILON = 0.0008;

export const SceneControls = forwardRef<SceneControlsHandle, SceneControlsProps>(function SceneControls({
  isMobileView,
  autoRotateMode,
  autoRotateRpm,
  northLockEnabled,
  yellowUpAzimuth,
  initialViewState = null,
  onViewStateChange,
  keyboardInput,
}: SceneControlsProps, ref) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const onViewStateChangeRef = useRef(onViewStateChange);
  const resumeTimerRef = useRef<number | null>(null);
  const alignFrameRef = useRef<number | null>(null);
  const keyboardFrameRef = useRef<number | null>(null);
  const keyboardLastTickRef = useRef<number | null>(null);
  const keyboardTargetRef = useRef<{ azimuth: number; polar: number } | null>(null);
  const keyboardInputRef = useRef(keyboardInput);
  const northLockEnabledRef = useRef(northLockEnabled);
  const yellowUpAzimuthRef = useRef(yellowUpAzimuth);
  const previousNorthLockRef = useRef(false);
  const [isInteractionPaused, setIsInteractionPaused] = useState(false);
  const [isAligning, setIsAligning] = useState(false);

  useEffect(() => {
    onViewStateChangeRef.current = onViewStateChange;
  }, [onViewStateChange]);

  const getCurrentViewState = (): SceneViewState | null => {
    const controls = controlsRef.current;
    if (!controls) {
      return null;
    }

    return {
      azimuth: controls.getAzimuthalAngle(),
      polar: controls.getPolarAngle(),
      distance: controls.getDistance(),
      target: [controls.target.x, controls.target.y, controls.target.z],
    };
  };

  const emitViewStateChange = () => {
    const nextViewState = getCurrentViewState();
    if (nextViewState) {
      onViewStateChangeRef.current?.(nextViewState);
    }
  };

  const cancelAlignment = () => {
    if (alignFrameRef.current !== null) {
      window.cancelAnimationFrame(alignFrameRef.current);
      alignFrameRef.current = null;
    }
    setIsAligning(false);
  };

  const cancelKeyboardAnimation = () => {
    if (keyboardFrameRef.current !== null) {
      window.cancelAnimationFrame(keyboardFrameRef.current);
      keyboardFrameRef.current = null;
    }
    keyboardLastTickRef.current = null;
  };

  const applySphericalPosition = (
    azimuth: number,
    polar: number,
    {
      radius,
      target,
    }: {
      radius?: number;
      target?: Vector3;
    } = {},
  ) => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const camera = controls.object as PerspectiveCamera;
    const nextTarget = target ?? controls.target.clone();
    const nextRadius = radius ?? controls.getDistance();
    controls.target.copy(nextTarget);
    const spherical = new Spherical(nextRadius, polar, azimuth);
    const nextOffset = new Vector3().setFromSpherical(spherical);

    camera.position.copy(nextTarget).add(nextOffset);
    camera.up.set(0, 1, 0);
    camera.lookAt(nextTarget);
    camera.updateProjectionMatrix();
    controls.update();
    emitViewStateChange();
  };

  useImperativeHandle(
    ref,
    () => ({
      nudgeAzimuth(delta: number) {
        const controls = controlsRef.current;
        if (!controls || northLockEnabled) {
          return;
        }

        cancelAlignment();
        applySphericalPosition(controls.getAzimuthalAngle() + delta, controls.getPolarAngle());
      },
      nudgePolar(delta: number) {
        const controls = controlsRef.current;
        if (!controls) {
          return;
        }

        cancelAlignment();
        const nextPolar = Math.min(MAX_POLAR_ANGLE, Math.max(MIN_POLAR_ANGLE, controls.getPolarAngle() + delta));
        applySphericalPosition(controls.getAzimuthalAngle(), nextPolar);
      },
      getViewState() {
        return getCurrentViewState();
      },
      applyViewState(state: SceneViewState) {
        cancelAlignment();
        keyboardTargetRef.current = null;
        cancelKeyboardAnimation();
        const nextTarget = new Vector3(...state.target);
        applySphericalPosition(state.azimuth, state.polar, {
          radius: state.distance,
          target: nextTarget,
        });
      },
    }),
    [northLockEnabled],
  );

  const hasKeyboardInput = keyboardInput.left || keyboardInput.right || keyboardInput.up || keyboardInput.down;

  useEffect(() => {
    keyboardInputRef.current = keyboardInput;
  }, [keyboardInput]);

  useEffect(() => {
    northLockEnabledRef.current = northLockEnabled;
  }, [northLockEnabled]);

  useEffect(() => {
    yellowUpAzimuthRef.current = yellowUpAzimuth;
  }, [yellowUpAzimuth]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || isInteractionPaused || isAligning || hasKeyboardInput || autoRotateMode === "off") {
      return;
    }

    const direction = autoRotateMode === "cw" ? 1 : -1;
    const rotationsPerSecond = autoRotateRpm / 60;
    const rotationDelta = direction * rotationsPerSecond * (Math.PI * 2) * delta;

    applySphericalPosition(controls.getAzimuthalAngle() + rotationDelta, controls.getPolarAngle());
  });

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
      keyboardTargetRef.current = null;
      cancelKeyboardAnimation();
      setIsInteractionPaused(true);
    };

    const handleEnd = () => {
      resumeTimerRef.current = window.setTimeout(() => {
        setIsInteractionPaused(false);
      }, AUTO_ROTATE_RESUME_DELAY_MS);
    };

    controls.addEventListener("start", handleStart);
    controls.addEventListener("end", handleEnd);
    controls.addEventListener("change", emitViewStateChange);
    emitViewStateChange();

    return () => {
      controls.removeEventListener("start", handleStart);
      controls.removeEventListener("end", handleEnd);
      controls.removeEventListener("change", emitViewStateChange);
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }
      cancelAlignment();
      cancelKeyboardAnimation();
    };
  }, []);

  useEffect(() => {
    if (!initialViewState) {
      return;
    }

    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const nextTarget = new Vector3(...initialViewState.target);
    applySphericalPosition(initialViewState.azimuth, initialViewState.polar, {
      radius: initialViewState.distance,
      target: nextTarget,
    });
  }, [initialViewState]);

  useEffect(() => {
    if (autoRotateMode !== "off") {
      return;
    }

    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }

    setIsInteractionPaused(false);
  }, [autoRotateMode]);

  useEffect(() => {
    const controls = controlsRef.current;
    const wasNorthLocked = previousNorthLockRef.current;
    previousNorthLockRef.current = northLockEnabled;

    if (!controls || yellowUpAzimuth === null || !northLockEnabled || wasNorthLocked) {
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
  }, [northLockEnabled, yellowUpAzimuth]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || isAligning) {
      return;
    }

    const step = (now: number) => {
      const activeControls = controlsRef.current;
      if (!activeControls) {
        cancelKeyboardAnimation();
        return;
      }

      const latestKeyboardInput = keyboardInputRef.current;
      const latestHasKeyboardInput =
        latestKeyboardInput.left || latestKeyboardInput.right || latestKeyboardInput.up || latestKeyboardInput.down;
      const latestNorthLockEnabled = northLockEnabledRef.current;
      const latestYellowUpAzimuth = yellowUpAzimuthRef.current;

      const currentAzimuth = activeControls.getAzimuthalAngle();
      const currentPolar = activeControls.getPolarAngle();
      const previousTarget = keyboardTargetRef.current ?? {
        azimuth: currentAzimuth,
        polar: currentPolar,
      };
      const previousTick = keyboardLastTickRef.current ?? now;
      const deltaSeconds = Math.min(0.05, Math.max(0.001, (now - previousTick) / 1000));
      keyboardLastTickRef.current = now;

      let nextTargetAzimuth =
        latestNorthLockEnabled && latestYellowUpAzimuth !== null ? latestYellowUpAzimuth : previousTarget.azimuth;
      let nextTargetPolar = previousTarget.polar;

      if (latestHasKeyboardInput && !(latestNorthLockEnabled && latestYellowUpAzimuth !== null)) {
        if (latestKeyboardInput.left) {
          nextTargetAzimuth -= KEYBOARD_AZIMUTH_SPEED * deltaSeconds;
        }
        if (latestKeyboardInput.right) {
          nextTargetAzimuth += KEYBOARD_AZIMUTH_SPEED * deltaSeconds;
        }
      }

      if (latestHasKeyboardInput) {
        if (latestKeyboardInput.up) {
          nextTargetPolar -= KEYBOARD_POLAR_SPEED * deltaSeconds;
        }
        if (latestKeyboardInput.down) {
          nextTargetPolar += KEYBOARD_POLAR_SPEED * deltaSeconds;
        }
      }

      nextTargetPolar = Math.min(MAX_POLAR_ANGLE, Math.max(MIN_POLAR_ANGLE, nextTargetPolar));
      keyboardTargetRef.current = {
        azimuth: nextTargetAzimuth,
        polar: nextTargetPolar,
      };

      const nextAzimuth =
        latestNorthLockEnabled && latestYellowUpAzimuth !== null
          ? latestYellowUpAzimuth
          : currentAzimuth + normalizeAngle(nextTargetAzimuth - currentAzimuth) * KEYBOARD_EASING_FACTOR;
      const nextPolar = currentPolar + (nextTargetPolar - currentPolar) * KEYBOARD_EASING_FACTOR;

      applySphericalPosition(nextAzimuth, nextPolar);

      const azimuthDelta =
        latestNorthLockEnabled && latestYellowUpAzimuth !== null ? 0 : Math.abs(normalizeAngle(nextTargetAzimuth - nextAzimuth));
      const polarDelta = Math.abs(nextTargetPolar - nextPolar);
      const shouldContinue = latestHasKeyboardInput || azimuthDelta > KEYBOARD_SETTLE_EPSILON || polarDelta > KEYBOARD_SETTLE_EPSILON;

      if (!shouldContinue) {
        keyboardTargetRef.current = {
          azimuth: nextAzimuth,
          polar: nextPolar,
        };
        cancelKeyboardAnimation();
        return;
      }

      keyboardFrameRef.current = window.requestAnimationFrame(step);
    };

    if (keyboardFrameRef.current === null && (hasKeyboardInput || keyboardTargetRef.current !== null)) {
      keyboardFrameRef.current = window.requestAnimationFrame(step);
    }
  }, [hasKeyboardInput, isAligning, keyboardInput, northLockEnabled, yellowUpAzimuth]);

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
      minAzimuthAngle={northLockEnabled && !isAligning && yellowUpAzimuth !== null ? yellowUpAzimuth : -Infinity}
      maxAzimuthAngle={northLockEnabled && !isAligning && yellowUpAzimuth !== null ? yellowUpAzimuth : Infinity}
      autoRotate={false}
    />
  );
});
