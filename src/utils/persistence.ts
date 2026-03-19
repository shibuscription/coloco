import type { HighlightState } from "./highlight";

export const COLOCO_STORAGE_KEY = "coloco:persisted-state";
export const COLOCO_STORAGE_VERSION = 1;

const PREVIEW_IMAGE_MAX_DIMENSION = 960;
const ANALYSIS_IMAGE_MAX_DIMENSION = 384;

export type PersistedViewState = {
  azimuth: number;
  polar: number;
  distance: number;
  target: [number, number, number];
};

export type PersistedHighlightMode = "none" | "tone" | "hue" | "image" | "multi";

export type PersistedAppState = {
  version: number;
  view: {
    autoRotateMode: "cw" | "ccw" | "off";
    autoRotateRpm: number;
    sphereScale: number;
    northLockEnabled: boolean;
    showToneGuides: boolean;
    showHueGuides: boolean;
    showLightnessGuides: boolean;
    camera: PersistedViewState | null;
  };
  panels: {
    isSettingsOpen: boolean;
    isImageModalOpen: boolean;
    isMultiSelectOpen: boolean;
    activeOverlay: "settings" | "image" | "multi" | null;
  };
  highlight: {
    mode: PersistedHighlightMode;
    state: HighlightState;
    multiSelectedIds: string[];
  };
  selection: {
    selectedPointId: string | null;
  };
  image: {
    sourceImageName: string;
    previewDataUrl: string;
    analysisDataUrl: string;
    selectedClusterIds: string[];
  } | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    image.src = src;
  });

const drawResizedImageToDataUrl = (
  image: HTMLImageElement,
  maxDimension: number,
  quality: number,
): string => {
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("保存用画像の描画に失敗しました。");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
};

export const createPersistedImageAssetsFromFile = async (
  file: File,
): Promise<{ previewDataUrl: string; analysisDataUrl: string }> => {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    return {
      previewDataUrl: drawResizedImageToDataUrl(image, PREVIEW_IMAGE_MAX_DIMENSION, 0.88),
      analysisDataUrl: drawResizedImageToDataUrl(image, ANALYSIS_IMAGE_MAX_DIMENSION, 0.82),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const getImageDataFromDataUrl = async (dataUrl: string): Promise<ImageData> => {
  const image = await loadImageElement(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("保存画像から ImageData を取得できませんでした。");
  }

  context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
  return context.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
};

export const loadPersistedAppState = (): PersistedAppState | null => {
  try {
    const raw = window.localStorage.getItem(COLOCO_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== COLOCO_STORAGE_VERSION) {
      return null;
    }

    return parsed as PersistedAppState;
  } catch {
    return null;
  }
};

export const savePersistedAppState = (state: PersistedAppState): void => {
  try {
    window.localStorage.setItem(COLOCO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota and serialization failures. The app should continue safely.
  }
};
