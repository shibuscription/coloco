import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import type { ImagePccsAnalysis } from "../utils/imageClassification";

type ImageAnalysisPanelProps = {
  analysis: ImagePccsAnalysis | null;
  sourceImageName: string;
  previewUrl: string;
  onPickImage: (file: File) => void;
  onCameraModeStart: () => void;
  onCameraModeCancel: () => void;
  onAnalyzeLiveFrame: (imageData: ImageData) => void;
  onCaptureImage: (file: File) => void;
  onClearImage: () => void;
  onToggleCluster: (pccsId: string) => void;
  onSetClustersSelected: (pccsIds: string[], selected: boolean) => void;
  onSetAllSelected: (selected: boolean) => void;
  onFocusPanel: () => void;
  onInspectCluster: (pccsId: string) => void;
};

type Point = { x: number; y: number };

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.18;
const TAP_MOVE_THRESHOLD = 6;
const DOUBLE_CLICK_DELAY_MS = 220;
const LONG_PRESS_DELAY_MS = 360;
const LONG_PRESS_CANCEL_MOVE_THRESHOLD = 10;
const AUTO_SCROLL_TOP_EDGE_THRESHOLD = 44;
const AUTO_SCROLL_BOTTOM_EDGE_THRESHOLD = 88;
const AUTO_SCROLL_STEP_PX = 9;
const LIVE_ANALYSIS_INTERVAL_MS = 500;
const LIVE_ANALYSIS_MAX_DIMENSION = 96;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const getContrastTextColor = (hex: string): string => {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;

  return luminance > 145 ? "#2b251d" : "#fffaf1";
};

const getDistance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

const formatRatioPercent = (ratio: number): string => {
  const percent = ratio * 100;

  if (percent < 0.01) {
    return "<0.01%";
  }

  if (percent < 1) {
    return `${percent.toFixed(2)}%`;
  }

  return `${percent.toFixed(1)}%`;
};

type CameraFacingMode = "environment" | "user";

const waitForVideoReady = (videoElement: HTMLVideoElement): Promise<void> =>
  new Promise((resolve, reject) => {
    let timeoutId: number | null = null;

    const cleanup = () => {
      videoElement.removeEventListener("loadedmetadata", checkReady);
      videoElement.removeEventListener("loadeddata", checkReady);
      videoElement.removeEventListener("canplay", checkReady);
      videoElement.removeEventListener("playing", checkReady);
      videoElement.removeEventListener("error", handleError);

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };

    const checkReady = () => {
      if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0 && videoElement.readyState >= 2) {
        cleanup();
        resolve();
      }
    };

    const handleError = () => {
      cleanup();
      reject(new Error("ライブ映像の準備に失敗しました。"));
    };

    videoElement.addEventListener("loadedmetadata", checkReady);
    videoElement.addEventListener("loadeddata", checkReady);
    videoElement.addEventListener("canplay", checkReady);
    videoElement.addEventListener("playing", checkReady);
    videoElement.addEventListener("error", handleError);

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("ライブ映像の準備がタイムアウトしました。"));
    }, 4000);

    checkReady();
  });

const getCoverCropRect = (
  sourceWidth: number,
  sourceHeight: number,
  frameWidth: number,
  frameHeight: number,
): { sx: number; sy: number; sw: number; sh: number } => {
  const sourceAspect = sourceWidth / sourceHeight;
  const frameAspect = frameWidth / frameHeight;

  if (Math.abs(sourceAspect - frameAspect) < 0.0001) {
    return {
      sx: 0,
      sy: 0,
      sw: sourceWidth,
      sh: sourceHeight,
    };
  }

  if (sourceAspect > frameAspect) {
    const sw = sourceHeight * frameAspect;
    const sx = (sourceWidth - sw) / 2;
    return {
      sx,
      sy: 0,
      sw,
      sh: sourceHeight,
    };
  }

  const sh = sourceWidth / frameAspect;
  const sy = (sourceHeight - sh) / 2;
  return {
    sx: 0,
    sy,
    sw: sourceWidth,
    sh,
  };
};

export function ImageAnalysisPanel({
  analysis,
  sourceImageName,
  previewUrl,
  onPickImage,
  onCameraModeStart,
  onCameraModeCancel,
  onAnalyzeLiveFrame,
  onCaptureImage,
  onClearImage,
  onToggleCluster,
  onSetClustersSelected,
  onSetAllSelected,
  onFocusPanel,
  onInspectCluster,
}: ImageAnalysisPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tilesScrollRef = useRef<HTMLDivElement>(null);
  const liveAnalysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const liveAnalysisIntervalRef = useRef<number | null>(null);
  const isAnalyzingFrameRef = useRef(false);
  const videoReadyRef = useRef(false);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  const clickTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const pendingTilePressRef = useRef<{ pointerId: number; pccsId: string; startPoint: Point } | null>(null);
  const dragSelectionRef = useRef<{
    pointerId: number;
    selected: boolean;
    processedIds: Set<string>;
    lastClientX: number;
    lastClientY: number;
  } | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const dragRef = useRef<{ pointerId: number; startPointer: Point; startPan: Point; moved: boolean } | null>(null);
  const pinchRef = useRef<{ startDistance: number; startScale: number; startPan: Point; startCenter: Point } | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [referencedPccsId, setReferencedPccsId] = useState<string | null>(null);
  const [referencePoint, setReferencePoint] = useState<Point | null>(null);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 980px)").matches : false,
  );
  const [isBulkSelecting, setIsBulkSelecting] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [currentFacingMode, setCurrentFacingMode] = useState<CameraFacingMode>("environment");
  const [cameraSessionKey, setCameraSessionKey] = useState(0);

  const clusters = analysis?.clusters ?? [];
  const areAllClustersSelected = clusters.length > 0 && clusters.every((cluster) => cluster.selected);
  const selectedClusters = useMemo(() => clusters.filter((cluster) => cluster.selected), [clusters]);
  const selectedRatioTotal = useMemo(
    () => selectedClusters.reduce((total, cluster) => total + cluster.ratio, 0),
    [selectedClusters],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const updateMatch = () => setIsMobileView(mediaQuery.matches);

    updateMatch();
    mediaQuery.addEventListener("change", updateMatch);
    return () => mediaQuery.removeEventListener("change", updateMatch);
  }, []);

  const stopCameraStream = () => {
    if (liveAnalysisIntervalRef.current !== null) {
      window.clearInterval(liveAnalysisIntervalRef.current);
      liveAnalysisIntervalRef.current = null;
    }

    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.pause();
        videoElement.srcObject = null;
      }

    isAnalyzingFrameRef.current = false;
    videoReadyRef.current = false;
  };

  const analyzeLiveFrame = async () => {
    const videoElement = videoRef.current;
    const previewElement = viewportRef.current;
    if (!videoElement || !previewElement || !videoReadyRef.current || isAnalyzingFrameRef.current) {
      return;
    }

    if (
      videoElement.videoWidth === 0 ||
      videoElement.videoHeight === 0 ||
      previewElement.clientWidth === 0 ||
      previewElement.clientHeight === 0
    ) {
      return;
    }

    isAnalyzingFrameRef.current = true;

    try {
      const canvas = liveAnalysisCanvasRef.current ?? document.createElement("canvas");
      liveAnalysisCanvasRef.current = canvas;

      const cropRect = getCoverCropRect(
        videoElement.videoWidth,
        videoElement.videoHeight,
        previewElement.clientWidth,
        previewElement.clientHeight,
      );
      const maxDimension = LIVE_ANALYSIS_MAX_DIMENSION;
      const scaleRatio = Math.min(1, maxDimension / Math.max(cropRect.sw, cropRect.sh));
      const width = Math.max(1, Math.round(cropRect.sw * scaleRatio));
      const height = Math.max(1, Math.round(cropRect.sh * scaleRatio));

      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context) {
        throw new Error("ライブ解析用のCanvasコンテキストを取得できませんでした。");
      }

      context.drawImage(
        videoElement,
        cropRect.sx,
        cropRect.sy,
        cropRect.sw,
        cropRect.sh,
        0,
        0,
        width,
        height,
      );
      const imageData = context.getImageData(0, 0, width, height);
      onAnalyzeLiveFrame(imageData);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "ライブ解析に失敗しました。");
    } finally {
      isAnalyzingFrameRef.current = false;
    }
  };

  const startLiveAnalysisLoop = () => {
    if (liveAnalysisIntervalRef.current !== null) {
      window.clearInterval(liveAnalysisIntervalRef.current);
    }

    liveAnalysisIntervalRef.current = window.setInterval(() => {
      void analyzeLiveFrame();
    }, LIVE_ANALYSIS_INTERVAL_MS);
  };

  const startCameraMode = async (
    facingMode: CameraFacingMode = currentFacingMode,
    { preserveCameraMode = false }: { preserveCameraMode?: boolean } = {},
  ) => {
    stopCameraStream();
    setCameraError("");
    videoReadyRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setCurrentFacingMode(facingMode);
      setCameraMode(true);
      setCameraSessionKey((current) => current + 1);
      if (!preserveCameraMode) {
        onCameraModeStart();
      }
    } catch (error) {
      stopCameraStream();
      setCameraMode(false);
      setCameraError(error instanceof Error ? error.message : "カメラを起動できませんでした。");
      if (!preserveCameraMode) {
        onCameraModeCancel();
      }
    }
  };

  const cancelCameraMode = () => {
    stopCameraStream();
    setCameraMode(false);
    setCameraError("");
    onCameraModeCancel();
  };

  const captureFromCamera = async () => {
    const videoElement = videoRef.current;
    const previewElement = viewportRef.current;
    if (
      !videoElement ||
      !previewElement ||
      !videoReadyRef.current ||
      videoElement.videoWidth === 0 ||
      videoElement.videoHeight === 0 ||
      previewElement.clientWidth === 0 ||
      previewElement.clientHeight === 0
    ) {
      setCameraError("撮影できる状態ではありません。");
      return;
    }

    try {
      const canvas = captureCanvasRef.current ?? document.createElement("canvas");
      captureCanvasRef.current = canvas;
      const cropRect = getCoverCropRect(
        videoElement.videoWidth,
        videoElement.videoHeight,
        previewElement.clientWidth,
        previewElement.clientHeight,
      );
      canvas.width = Math.max(1, Math.round(cropRect.sw));
      canvas.height = Math.max(1, Math.round(cropRect.sh));

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("撮影用のCanvasコンテキストを取得できませんでした。");
      }

      context.drawImage(
        videoElement,
        cropRect.sx,
        cropRect.sy,
        cropRect.sw,
        cropRect.sh,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (nextBlob) {
            resolve(nextBlob);
            return;
          }
          reject(new Error("撮影画像の生成に失敗しました。"));
        }, "image/jpeg", 0.92);
      });

      const file = new File([blob], `coloco-camera-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      stopCameraStream();
      setCameraMode(false);
      setCameraError("");
      await onCaptureImage(file);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "撮影に失敗しました。");
    }
  };

  const toggleFacingMode = async () => {
    const nextFacingMode: CameraFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    await startCameraMode(nextFacingMode, { preserveCameraMode: true });
  };

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setReferencedPccsId(null);
    setReferencePoint(null);
    pointersRef.current.clear();
    dragRef.current = null;
    pinchRef.current = null;
  }, [previewUrl]);

  useEffect(() => {
    if (!cameraMode) {
      return;
    }

    const videoElement = videoRef.current;
    const stream = cameraStreamRef.current;
    if (!videoElement || !stream) {
      return;
    }

    let cancelled = false;

    const setupVideo = async () => {
      try {
        videoElement.srcObject = stream;
        await videoElement.play();
        await waitForVideoReady(videoElement);
        if (cancelled) {
          return;
        }

        if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          throw new Error("切り替え後のカメラ映像サイズを取得できませんでした。");
        }

        videoReadyRef.current = true;
        void analyzeLiveFrame();
        startLiveAnalysisLoop();
      } catch (error) {
        if (cancelled) {
          return;
        }
        stopCameraStream();
        setCameraMode(false);
        setCameraError(error instanceof Error ? error.message : "ライブ映像の準備に失敗しました。");
        onCameraModeCancel();
      }
    };

    void setupVideo();

    return () => {
      cancelled = true;
      if (cameraStreamRef.current === stream) {
        stopCameraStream();
      }
    };
  }, [cameraMode, cameraSessionKey]);

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
      }
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!referencedPccsId) {
      return;
    }

    const tileElement = tileRefs.current.get(referencedPccsId);
    tileElement?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [referencedPccsId]);

  useEffect(() => {
    const tilesScrollElement = tilesScrollRef.current;
    if (!tilesScrollElement) {
      return;
    }

    const preventTouchScrollDuringBulkSelection = (event: TouchEvent) => {
      if (!dragSelectionRef.current) {
        return;
      }

      event.preventDefault();
    };

    tilesScrollElement.addEventListener("touchmove", preventTouchScrollDuringBulkSelection, {
      passive: false,
    });

    return () => {
      tilesScrollElement.removeEventListener("touchmove", preventTouchScrollDuringBulkSelection);
    };
  }, []);

  const metrics = useMemo(() => {
    if (!analysis || viewportSize.width === 0 || viewportSize.height === 0) {
      return null;
    }

    const fitScale = Math.min(viewportSize.width / analysis.mapWidth, viewportSize.height / analysis.mapHeight);
    const baseWidth = analysis.mapWidth * fitScale;
    const baseHeight = analysis.mapHeight * fitScale;

    return {
      baseWidth,
      baseHeight,
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
    };
  }, [analysis, viewportSize.height, viewportSize.width]);

  const clampPan = (nextPan: Point, nextScale: number): Point => {
    if (!metrics) {
      return nextPan;
    }

    const scaledWidth = metrics.baseWidth * nextScale;
    const scaledHeight = metrics.baseHeight * nextScale;
    const maxX = Math.max(0, (scaledWidth - metrics.viewportWidth) / 2 + 24);
    const maxY = Math.max(0, (scaledHeight - metrics.viewportHeight) / 2 + 24);

    return {
      x: clamp(nextPan.x, -maxX, maxX),
      y: clamp(nextPan.y, -maxY, maxY),
    };
  };

  const applyScale = (nextScale: number, nextPan: Point = pan) => {
    const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    setScale(clampedScale);
    setPan(clampPan(nextPan, clampedScale));
  };

  const findReferencedPixel = (clientX: number, clientY: number) => {
    if (!analysis || !metrics) {
      return null;
    }

    const viewportRect = viewportRef.current?.getBoundingClientRect();
    if (!viewportRect) {
      return null;
    }

    const pointerX = clientX - viewportRect.left;
    const pointerY = clientY - viewportRect.top;
    const centerX = metrics.viewportWidth / 2 + pan.x;
    const centerY = metrics.viewportHeight / 2 + pan.y;
    const localX = (pointerX - centerX) / scale + metrics.baseWidth / 2;
    const localY = (pointerY - centerY) / scale + metrics.baseHeight / 2;

    if (localX < 0 || localY < 0 || localX > metrics.baseWidth || localY > metrics.baseHeight) {
      return null;
    }

    const normalizedX = localX / metrics.baseWidth;
    const normalizedY = localY / metrics.baseHeight;
    const pixelX = clamp(Math.floor(normalizedX * analysis.mapWidth), 0, analysis.mapWidth - 1);
    const pixelY = clamp(Math.floor(normalizedY * analysis.mapHeight), 0, analysis.mapHeight - 1);
    const pixelIndex = pixelY * analysis.mapWidth + pixelX;
    const paletteIndex = analysis.classificationMap[pixelIndex];
    const pccsId = paletteIndex >= 0 ? (analysis.paletteIds[paletteIndex] ?? null) : null;

    return {
      pccsId,
      normalizedX,
      normalizedY,
    };
  };

  const handleReference = (clientX: number, clientY: number) => {
    const referenced = findReferencedPixel(clientX, clientY);
    if (!referenced?.pccsId) {
      setReferencedPccsId(null);
      setReferencePoint(null);
      return;
    }

    setReferencedPccsId(referenced.pccsId);
    setReferencePoint({
      x: referenced.normalizedX,
      y: referenced.normalizedY,
    });
    onInspectCluster(referenced.pccsId);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (cameraMode) {
      stopCameraStream();
      setCameraMode(false);
      setCameraError("");
      onCameraModeCancel();
    }

    onFocusPanel();
    onPickImage(file);
    event.target.value = "";
  };

  const openFilePicker = () => {
    onFocusPanel();
    inputRef.current?.click();
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const stopAutoScroll = () => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const endBulkSelection = () => {
    clearLongPressTimer();
    stopAutoScroll();
    pendingTilePressRef.current = null;
    dragSelectionRef.current = null;
    setIsBulkSelecting(false);
  };

  const applyBulkSelectionToTile = (pccsId: string | null) => {
    const dragSelection = dragSelectionRef.current;
    if (!dragSelection || !pccsId || dragSelection.processedIds.has(pccsId)) {
      return;
    }

    dragSelection.processedIds.add(pccsId);
    onSetClustersSelected([pccsId], dragSelection.selected);
  };

  const getTileIdFromPoint = (clientX: number, clientY: number): string | null => {
    const target = document.elementFromPoint(clientX, clientY);
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    const tileElement = target.closest<HTMLButtonElement>(".analysis-tile");
    return tileElement?.dataset.pccsId ?? null;
  };

  const runAutoScroll = () => {
    const tilesScrollElement = tilesScrollRef.current;
    const dragSelection = dragSelectionRef.current;

    if (!tilesScrollElement || !dragSelection) {
      autoScrollFrameRef.current = null;
      return;
    }

    applyBulkSelectionToTile(getTileIdFromPoint(dragSelection.lastClientX, dragSelection.lastClientY));

    const rect = tilesScrollElement.getBoundingClientRect();
    let scrollDelta = 0;
    const bottomEdgeThreshold = isMobileView ? AUTO_SCROLL_BOTTOM_EDGE_THRESHOLD : AUTO_SCROLL_TOP_EDGE_THRESHOLD;

    if (dragSelection.lastClientY > rect.bottom - bottomEdgeThreshold) {
      scrollDelta = AUTO_SCROLL_STEP_PX;
    } else if (dragSelection.lastClientY < rect.top + AUTO_SCROLL_TOP_EDGE_THRESHOLD) {
      scrollDelta = -AUTO_SCROLL_STEP_PX;
    }

    if (scrollDelta !== 0) {
      const previousScrollTop = tilesScrollElement.scrollTop;
      tilesScrollElement.scrollTop += scrollDelta;
      applyBulkSelectionToTile(getTileIdFromPoint(dragSelection.lastClientX, dragSelection.lastClientY));

      if (tilesScrollElement.scrollTop !== previousScrollTop) {
        autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll);
        return;
      }
    }

    autoScrollFrameRef.current = null;
  };

  const ensureAutoScroll = () => {
    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll);
    }
  };

  const beginBulkSelection = (pointerId: number, pccsId: string, clientX: number, clientY: number) => {
    const initialCluster = clusters.find((cluster) => cluster.pccsId === pccsId);
    if (!initialCluster) {
      return;
    }

    const nextSelectedState = !initialCluster.selected;
    suppressClickRef.current = true;
    dragSelectionRef.current = {
      pointerId,
      selected: nextSelectedState,
      processedIds: new Set(),
      lastClientX: clientX,
      lastClientY: clientY,
    };
    setIsBulkSelecting(true);
    applyBulkSelectionToTile(pccsId);
    ensureAutoScroll();
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!previewUrl || cameraMode) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onFocusPanel();
    applyScale(scale + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewUrl || cameraMode) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onFocusPanel();
    event.currentTarget.setPointerCapture(event.pointerId);

    const nextPoint = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, nextPoint);

    if (pointersRef.current.size === 1) {
      dragRef.current = {
        pointerId: event.pointerId,
        startPointer: nextPoint,
        startPan: pan,
        moved: false,
      };
      pinchRef.current = null;
      return;
    }

    if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      pinchRef.current = {
        startDistance: getDistance(first, second),
        startScale: scale,
        startPan: pan,
        startCenter: {
          x: (first.x + second.x) / 2,
          y: (first.y + second.y) / 2,
        },
      };
      dragRef.current = null;
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewUrl || cameraMode || !pointersRef.current.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const nextPoint = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, nextPoint);

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [first, second] = Array.from(pointersRef.current.values());
      const nextDistance = getDistance(first, second);
      const distanceRatio = pinchRef.current.startDistance === 0 ? 1 : nextDistance / pinchRef.current.startDistance;
      const nextScale = clamp(pinchRef.current.startScale * distanceRatio, MIN_SCALE, MAX_SCALE);
      const center = {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      };
      const nextPan = clampPan(
        {
          x: pinchRef.current.startPan.x + (center.x - pinchRef.current.startCenter.x),
          y: pinchRef.current.startPan.y + (center.y - pinchRef.current.startCenter.y),
        },
        nextScale,
      );

      setScale(nextScale);
      setPan(nextPan);
      return;
    }

    if (dragRef.current?.pointerId === event.pointerId) {
      const deltaX = nextPoint.x - dragRef.current.startPointer.x;
      const deltaY = nextPoint.y - dragRef.current.startPointer.y;
      const movedDistance = Math.hypot(deltaX, deltaY);

      if (movedDistance > TAP_MOVE_THRESHOLD) {
        dragRef.current.moved = true;
      }

      setPan(
        clampPan(
          {
            x: dragRef.current.startPan.x + deltaX,
            y: dragRef.current.startPan.y + deltaY,
          },
          scale,
        ),
      );
    }
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (cameraMode || !pointersRef.current.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const dragState = dragRef.current;
    const shouldReference = dragState?.pointerId === event.pointerId && !dragState.moved && pointersRef.current.size === 1;

    pointersRef.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (shouldReference) {
      handleReference(event.clientX, event.clientY);
    }

    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    if (pointersRef.current.size === 1) {
      const [remainingPointerId, remainingPoint] = Array.from(pointersRef.current.entries())[0];
      dragRef.current = {
        pointerId: remainingPointerId,
        startPointer: remainingPoint,
        startPan: pan,
        moved: false,
      };
    } else {
      dragRef.current = null;
    }
  };

  const handleTileClick = (event: ReactMouseEvent<HTMLButtonElement>, pccsId: string) => {
    event.stopPropagation();
    onFocusPanel();

    if (cameraMode) {
      event.preventDefault();
      return;
    }

    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      return;
    }

    if (isMobileView) {
      onToggleCluster(pccsId);
      return;
    }

    if (event.detail === 2) {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      onInspectCluster(pccsId);
      return;
    }

    clickTimerRef.current = window.setTimeout(() => {
      onToggleCluster(pccsId);
      clickTimerRef.current = null;
    }, DOUBLE_CLICK_DELAY_MS);
  };

  const handleTilePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, pccsId: string) => {
    if (cameraMode) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.pointerType !== "touch") {
      return;
    }

    clearLongPressTimer();
    endBulkSelection();
    onFocusPanel();

    const startPoint = { x: event.clientX, y: event.clientY };
    pendingTilePressRef.current = {
      pointerId: event.pointerId,
      pccsId,
      startPoint,
    };

    event.currentTarget.setPointerCapture(event.pointerId);

    longPressTimerRef.current = window.setTimeout(() => {
      beginBulkSelection(event.pointerId, pccsId, startPoint.x, startPoint.y);
      clearLongPressTimer();
    }, LONG_PRESS_DELAY_MS);
  };

  const handleTilePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }

    const dragSelection = dragSelectionRef.current;
    if (dragSelection?.pointerId === event.pointerId) {
      event.preventDefault();
      event.stopPropagation();
      dragSelection.lastClientX = event.clientX;
      dragSelection.lastClientY = event.clientY;
      applyBulkSelectionToTile(getTileIdFromPoint(event.clientX, event.clientY));
      ensureAutoScroll();
      return;
    }

    const pendingPress = pendingTilePressRef.current;
    if (!pendingPress || pendingPress.pointerId !== event.pointerId) {
      return;
    }

    const moveDistance = getDistance(pendingPress.startPoint, {
      x: event.clientX,
      y: event.clientY,
    });
    if (moveDistance > LONG_PRESS_CANCEL_MOVE_THRESHOLD) {
      clearLongPressTimer();
      pendingTilePressRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleTilePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const wasBulkSelecting = dragSelectionRef.current?.pointerId === event.pointerId;
    const wasPendingPress = pendingTilePressRef.current?.pointerId === event.pointerId;

    if (wasBulkSelecting) {
      event.preventDefault();
      event.stopPropagation();
      endBulkSelection();
      return;
    }

    if (wasPendingPress) {
      clearLongPressTimer();
      pendingTilePressRef.current = null;
    }
  };

  return (
    <section className="analysis-modal-card" onClick={(event) => event.stopPropagation()} onPointerDown={onFocusPanel}>
      <div className="analysis-modal-body">
        <div className="analysis-fixed-section">
          <div
            ref={viewportRef}
            className={`analysis-preview ${previewUrl && !cameraMode ? "has-image" : ""} ${cameraMode ? "is-live" : ""}`}
            onClick={() => {
              if (!previewUrl && !cameraMode) {
                openFilePicker();
              }
            }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
          >
            {(previewUrl && !cameraMode) || cameraMode ? (
              <button
                type="button"
                className="analysis-preview-clear"
                aria-label={cameraMode ? "カメラを終了" : "画像をクリア"}
                title={cameraMode ? "カメラを終了" : "画像をクリア"}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onFocusPanel();
                  if (cameraMode) {
                    cancelCameraMode();
                    return;
                  }
                  onClearImage();
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                ×
              </button>
            ) : null}
            {cameraMode && isMobileView ? (
              <button
                type="button"
                className="analysis-preview-switch"
                aria-label="前面カメラと背面カメラを切り替える"
                title="カメラ切り替え"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onFocusPanel();
                  void toggleFacingMode();
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                ↺
              </button>
            ) : null}
            {cameraMode ? (
              <>
                <video ref={videoRef} className="analysis-preview-video" autoPlay muted playsInline />
              </>
            ) : previewUrl && metrics ? (
              <div
                className="analysis-preview-stage"
                style={{
                  width: metrics.baseWidth,
                  height: metrics.baseHeight,
                  transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                }}
              >
                <img src={previewUrl} alt={sourceImageName || "解析対象画像"} draggable={false} />
                {referencePoint ? (
                  <span
                    className="analysis-reference-dot"
                    style={{
                      left: `${referencePoint.x * 100}%`,
                      top: `${referencePoint.y * 100}%`,
                    }}
                  />
                ) : null}
              </div>
            ) : (
              <div className="analysis-preview-placeholder" aria-hidden="true" />
            )}
          </div>

          <div className="analysis-meta-row">
            <div className="analysis-toolbar">
              <button
                type="button"
                className="secondary-button secondary-button-small analysis-action-button"
                onClick={() => {
                  onFocusPanel();
                  if (cameraMode) {
                    void captureFromCamera();
                    return;
                  }
                  void startCameraMode();
                }}
                title={cameraMode ? "撮影" : "カメラ起動"}
                aria-label={cameraMode ? "撮影" : "カメラ起動"}
              >
                <span className="analysis-action-icon" aria-hidden="true">
                  {cameraMode ? "●" : "◎"}
                </span>
                <span className="analysis-action-label">{cameraMode ? "撮影" : "カメラ起動"}</span>
              </button>
              <button
                type="button"
                className="secondary-button secondary-button-small analysis-action-button"
                onClick={openFilePicker}
                title="画像を選ぶ"
                aria-label="画像を選ぶ"
              >
                <span className="analysis-action-icon" aria-hidden="true">
                  ⤴
                </span>
                <span className="analysis-action-label">画像を選ぶ</span>
              </button>
              <button
                type="button"
                className="secondary-button secondary-button-small analysis-action-button"
                onClick={() => onSetAllSelected(!areAllClustersSelected)}
                disabled={clusters.length === 0}
                title={areAllClustersSelected ? "全解除" : "全選択"}
                aria-label={areAllClustersSelected ? "全解除" : "全選択"}
              >
                <span className="analysis-action-icon" aria-hidden="true">
                  {areAllClustersSelected ? "☐" : "☑"}
                </span>
                <span className="analysis-action-label">{areAllClustersSelected ? "全解除" : "全選択"}</span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden-input"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {cameraError ? <p className="analysis-camera-error">{cameraError}</p> : null}

          <div className="analysis-selection-bar" aria-hidden="true">
            {selectedClusters.length > 0 && selectedRatioTotal > 0 ? (
              selectedClusters.map((cluster) => (
                <span
                  key={cluster.pccsId}
                  className="analysis-selection-segment"
                  style={{
                    background: cluster.hex,
                    width: `${(cluster.ratio / selectedRatioTotal) * 100}%`,
                  }}
                />
              ))
            ) : (
              <span className="analysis-selection-empty" />
            )}
          </div>
        </div>

        <div className={`analysis-tiles-scroll ${isBulkSelecting ? "is-bulk-selecting" : ""}`} ref={tilesScrollRef}>
          {clusters.length > 0 ? (
            <div className="analysis-grid">
              {clusters.map((cluster) => (
                <button
                  key={cluster.pccsId}
                  ref={(element) => {
                    if (element) {
                      tileRefs.current.set(cluster.pccsId, element);
                    } else {
                      tileRefs.current.delete(cluster.pccsId);
                    }
                  }}
                  type="button"
                  className={`analysis-tile ${cluster.selected ? "is-selected" : ""} ${
                    referencedPccsId === cluster.pccsId ? "is-referenced" : ""
                  }`}
                  disabled={cameraMode}
                  data-pccs-id={cluster.pccsId}
                  style={{
                    background: cluster.hex,
                    color: getContrastTextColor(cluster.hex),
                  }}
                  onClick={(event) => handleTileClick(event, cluster.pccsId)}
                  onContextMenu={(event) => event.preventDefault()}
                  onPointerDown={(event) => handleTilePointerDown(event, cluster.pccsId)}
                  onPointerMove={handleTilePointerMove}
                  onPointerUp={handleTilePointerEnd}
                  onPointerCancel={handleTilePointerEnd}
                >
                  <span className="analysis-tile-text">
                    <strong>{cluster.pccsShortLabel}</strong>
                    <small>{formatRatioPercent(cluster.ratio)}</small>
                  </span>
                  {cluster.selected ? <span className="analysis-check">✔</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
