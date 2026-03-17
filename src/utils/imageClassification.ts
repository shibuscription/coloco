import type { RgbColor } from "../data";
import type { LabColor } from "./color";
import { getLabDistance, rgbToLab } from "./color";
import type { PccsRenderablePoint } from "./pccs3d";

export type PccsLabEntry = {
  id: string;
  pccsLabel: string;
  pccsShortLabel: string;
  hex: string;
  rgb: RgbColor;
  lab: LabColor;
};

export type ImagePccsCluster = {
  pccsId: string;
  pccsLabel: string;
  pccsShortLabel: string;
  hex: string;
  rgb: RgbColor;
  count: number;
  ratio: number;
  selected: boolean;
};

export type ImagePccsAnalysis = {
  clusters: ImagePccsCluster[];
  mapWidth: number;
  mapHeight: number;
  classificationMap: Int16Array;
  paletteIds: string[];
};

type AnalyzeImageOptions = {
  maxDimension?: number;
  alphaThreshold?: number;
};

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("画像の読み込みに失敗しました。"));
    };

    image.src = objectUrl;
  });

const getResizedDimensions = (
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number; needsResize: boolean } => {
  const longestSide = Math.max(width, height);
  if (longestSide <= maxDimension) {
    return { width, height, needsResize: false };
  }

  const scale = maxDimension / longestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    needsResize: true,
  };
};

const getImageDataFromImage = (image: HTMLImageElement): ImageData => {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("解析用の元画像 ImageData を取得できませんでした。");
  }

  context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
  return context.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
};

export const resizeImageForAnalysisByMajority = (
  sourceImageData: ImageData,
  targetWidth: number,
  targetHeight: number,
  alphaThreshold: number,
): Uint8ClampedArray => {
  const { data: sourceData, width: sourceWidth, height: sourceHeight } = sourceImageData;

  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    return sourceData;
  }

  const resizedData = new Uint8ClampedArray(targetWidth * targetHeight * 4);

  for (let targetY = 0; targetY < targetHeight; targetY += 1) {
    const sourceYStart = Math.floor((targetY * sourceHeight) / targetHeight);
    const sourceYEnd = Math.min(
      sourceHeight,
      Math.max(sourceYStart + 1, Math.floor(((targetY + 1) * sourceHeight) / targetHeight)),
    );

    for (let targetX = 0; targetX < targetWidth; targetX += 1) {
      const sourceXStart = Math.floor((targetX * sourceWidth) / targetWidth);
      const sourceXEnd = Math.min(
        sourceWidth,
        Math.max(sourceXStart + 1, Math.floor(((targetX + 1) * sourceWidth) / targetWidth)),
      );
      const targetIndex = (targetY * targetWidth + targetX) * 4;
      const voteCounts = new Map<number, number>();
      let winningColorKey = -1;
      let winningVoteCount = 0;

      for (let sourceY = sourceYStart; sourceY < sourceYEnd; sourceY += 1) {
        for (let sourceX = sourceXStart; sourceX < sourceXEnd; sourceX += 1) {
          const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
          const alpha = sourceData[sourceIndex + 3];

          if (alpha < alphaThreshold) {
            continue;
          }

          const colorKey =
            (sourceData[sourceIndex] << 16) |
            (sourceData[sourceIndex + 1] << 8) |
            sourceData[sourceIndex + 2];
          const nextVoteCount = (voteCounts.get(colorKey) ?? 0) + 1;
          voteCounts.set(colorKey, nextVoteCount);

          // 同票時は最初に最大票へ到達した色をそのまま残す。
          if (nextVoteCount > winningVoteCount) {
            winningVoteCount = nextVoteCount;
            winningColorKey = colorKey;
          }
        }
      }

      if (winningColorKey === -1) {
        resizedData[targetIndex + 3] = 0;
        continue;
      }

      resizedData[targetIndex] = (winningColorKey >> 16) & 0xff;
      resizedData[targetIndex + 1] = (winningColorKey >> 8) & 0xff;
      resizedData[targetIndex + 2] = winningColorKey & 0xff;
      resizedData[targetIndex + 3] = 255;
    }
  }

  return resizedData;
};

const findNearestPccsIndex = (
  rgb: RgbColor,
  palette: PccsLabEntry[],
  cache: Map<number, number>,
): number => {
  const cacheKey = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const pixelLab = rgbToLab(rgb);
  let nearestIndex = 0;
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < palette.length; index += 1) {
    const distance = getLabDistance(pixelLab, palette[index].lab);
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestIndex = index;
    }
  }

  cache.set(cacheKey, nearestIndex);
  return nearestIndex;
};

export const createPccsLabPalette = (points: PccsRenderablePoint[]): PccsLabEntry[] =>
  points.map((point) => ({
    id: point.id,
    pccsLabel: point.pccsNotation ?? point.label,
    pccsShortLabel: point.label,
    hex: point.hex,
    rgb: point.rgb,
    lab: rgbToLab(point.rgb),
  }));

export const analyzeImageToPccs = async (
  file: File,
  palette: PccsLabEntry[],
  options: AnalyzeImageOptions = {},
): Promise<ImagePccsAnalysis> => {
  const { maxDimension = 384, alphaThreshold = 16 } = options;
  const image = await loadImage(file);
  const resized = getResizedDimensions(image.naturalWidth, image.naturalHeight, maxDimension);
  const sourceImageData = getImageDataFromImage(image);
  const data = resizeImageForAnalysisByMajority(
    sourceImageData,
    resized.width,
    resized.height,
    alphaThreshold,
  );
  const counts = new Map<number, number>();
  const cache = new Map<number, number>();
  const classificationMap = new Int16Array(resized.width * resized.height);
  classificationMap.fill(-1);
  const paletteIds = palette.map((entry) => entry.id);
  let validPixelCount = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < alphaThreshold) {
      continue;
    }

    const rgb = {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
    };

    const paletteIndex = findNearestPccsIndex(rgb, palette, cache);
    const pixelIndex = index / 4;
    classificationMap[pixelIndex] = paletteIndex;
    counts.set(paletteIndex, (counts.get(paletteIndex) ?? 0) + 1);
    validPixelCount += 1;
  }

  if (validPixelCount === 0) {
    return {
      clusters: [],
      mapWidth: resized.width,
      mapHeight: resized.height,
      classificationMap,
      paletteIds,
    };
  }

  const clusters = palette
    .map((color, index) => ({
      pccsId: color.id,
      pccsLabel: color.pccsLabel,
      pccsShortLabel: color.pccsShortLabel,
      hex: color.hex,
      rgb: color.rgb,
      count: counts.get(index) ?? 0,
    }))
    .filter((cluster) => cluster.count > 0)
    .map((cluster) => ({
      ...cluster,
      ratio: cluster.count / validPixelCount,
      selected: cluster.count / validPixelCount >= 0.01,
    }))
    .sort((left, right) => right.count - left.count)
    .map((cluster) => ({
      ...cluster,
    }));

  return {
    clusters,
    mapWidth: resized.width,
    mapHeight: resized.height,
    classificationMap,
    paletteIds,
  };
};
