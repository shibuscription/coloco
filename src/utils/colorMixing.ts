export const MIN_MIX_RATIO = 5;

export type AdditiveMixResult = {
  r: number;
  g: number;
  b: number;
  hex: string;
};

export type AdditiveMixMode = "linear-rgb" | "srgb-average" | "perceptual-average";
export type SubtractiveMixMode = "multiply" | "soft-multiply" | "cmy-average";

export type AdditiveTuningParams = {
  mode: AdditiveMixMode;
  gamma: number;
  saturationBoost: number;
  brightnessBias: number;
  mixExponent: number;
  perceptualWeight: number;
};

export type SubtractiveTuningParams = {
  mode: SubtractiveMixMode;
  blackInfluence: number;
  chromaRetention: number;
  softness: number;
  cmyWeight: number;
  darkeningCurve: number;
};

type MixableColor = {
  hex: string;
};

const roundRatio = (value: number): number => Number(value.toFixed(2));

const clampChannel = (value: number): number => Math.min(255, Math.max(0, Math.round(value)));

const srgbHexToChannel = (value: string): number => Number.parseInt(value, 16);

export const DEFAULT_ADDITIVE_TUNING_PARAMS: AdditiveTuningParams = {
  mode: "linear-rgb",
  gamma: 1,
  saturationBoost: 1,
  brightnessBias: 0.25,
  mixExponent: 1.5,
  perceptualWeight: 0.3,
};

export const DEFAULT_SUBTRACTIVE_TUNING_PARAMS: SubtractiveTuningParams = {
  mode: "soft-multiply",
  blackInfluence: 1,
  chromaRetention: 1,
  softness: 0,
  cmyWeight: 0,
  darkeningCurve: 1,
};

export const hexToRgb = (hex: string): AdditiveMixResult | null => {
  const normalized = hex.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return null;
  }

  const r = srgbHexToChannel(normalized.slice(0, 2));
  const g = srgbHexToChannel(normalized.slice(2, 4));
  const b = srgbHexToChannel(normalized.slice(4, 6));

  return {
    r,
    g,
    b,
    hex: `#${normalized.toUpperCase()}`,
  };
};

export const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0").toUpperCase())
    .join("")}`;

export const srgbChannelToLinear = (value: number): number => {
  const normalized = clampChannel(value) / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

export const linearChannelToSrgb = (value: number): number => {
  const normalized = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return clampChannel(normalized * 255);
};

const xyzToLabComponent = (value: number): number =>
  value > 0.008856 ? value ** (1 / 3) : 7.787 * value + 16 / 116;

const labToXyzComponent = (value: number): number => {
  const cubed = value ** 3;
  return cubed > 0.008856 ? cubed : (value - 16 / 116) / 7.787;
};

const rgbToLab = ({ r, g, b }: AdditiveMixResult) => {
  const linearR = srgbChannelToLinear(r);
  const linearG = srgbChannelToLinear(g);
  const linearB = srgbChannelToLinear(b);

  const x = (linearR * 0.4124564 + linearG * 0.3575761 + linearB * 0.1804375) / 0.95047;
  const y = linearR * 0.2126729 + linearG * 0.7151522 + linearB * 0.072175;
  const z = (linearR * 0.0193339 + linearG * 0.119192 + linearB * 0.9503041) / 1.08883;

  const fx = xyzToLabComponent(x);
  const fy = xyzToLabComponent(y);
  const fz = xyzToLabComponent(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
};

const labToRgb = (l: number, a: number, b: number): AdditiveMixResult => {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;

  const x = 0.95047 * labToXyzComponent(fx);
  const y = labToXyzComponent(fy);
  const z = 1.08883 * labToXyzComponent(fz);

  const linearR = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const linearG = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  const linearB = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  const r = linearChannelToSrgb(Math.max(0, linearR));
  const g = linearChannelToSrgb(Math.max(0, linearG));
  const blue = linearChannelToSrgb(Math.max(0, linearB));

  return {
    r,
    g,
    b: blue,
    hex: rgbToHex(r, g, blue),
  };
};

type HslColor = {
  h: number;
  s: number;
  l: number;
};

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

const rgbToHsl = ({ r, g, b }: AdditiveMixResult): HslColor => {
  const red = clampUnit(r / 255);
  const green = clampUnit(g / 255);
  const blue = clampUnit(b / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
      break;
    case green:
      hue = (blue - red) / delta + 2;
      break;
    default:
      hue = (red - green) / delta + 4;
      break;
  }

  return {
    h: hue / 6,
    s: saturation,
    l: lightness,
  };
};

const hueToRgb = (p: number, q: number, t: number): number => {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
};

const hslToRgb = ({ h, s, l }: HslColor): AdditiveMixResult => {
  if (s === 0) {
    const gray = clampChannel(l * 255);
    return { r: gray, g: gray, b: gray, hex: rgbToHex(gray, gray, gray) };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = clampChannel(hueToRgb(p, q, h + 1 / 3) * 255);
  const g = clampChannel(hueToRgb(p, q, h) * 255);
  const b = clampChannel(hueToRgb(p, q, h - 1 / 3) * 255);

  return { r, g, b, hex: rgbToHex(r, g, b) };
};

const blendResults = (left: AdditiveMixResult, right: AdditiveMixResult, weight: number): AdditiveMixResult => {
  const w = clampUnit(weight);
  const inverse = 1 - w;
  const r = clampChannel(left.r * inverse + right.r * w);
  const g = clampChannel(left.g * inverse + right.g * w);
  const b = clampChannel(left.b * inverse + right.b * w);
  return { r, g, b, hex: rgbToHex(r, g, b) };
};

const adjustResultByHsl = (
  result: AdditiveMixResult,
  saturationBoost: number,
  brightnessBias: number,
): AdditiveMixResult => {
  const hsl = rgbToHsl(result);
  return hslToRgb({
    h: hsl.h,
    s: clampUnit(hsl.s * saturationBoost),
    l: clampUnit(hsl.l + brightnessBias),
  });
};

const applyGammaToResult = (result: AdditiveMixResult, gamma: number): AdditiveMixResult => {
  const safeGamma = Math.max(0.01, gamma);
  const toGamma = (channel: number) => clampChannel(clampUnit(channel / 255) ** (1 / safeGamma) * 255);
  const r = toGamma(result.r);
  const g = toGamma(result.g);
  const b = toGamma(result.b);
  return { r, g, b, hex: rgbToHex(r, g, b) };
};

const normalizeWeightsForExponent = (ratios: number[], exponent: number): number[] => {
  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
  if (total <= 0) {
    return ratios;
  }

  const powered = ratios.map((ratio) => (ratio / total) ** Math.max(0.01, exponent));
  const poweredTotal = powered.reduce((sum, value) => sum + value, 0);
  if (poweredTotal <= 0) {
    return ratios;
  }

  return powered.map((value) => (value / poweredTotal) * 100);
};

const getRelativeLuminance = ({ r, g, b }: AdditiveMixResult): number =>
  0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);

export const normalizeMixRatios = (ratios: number[]): number[] => {
  if (ratios.length === 0) {
    return [];
  }

  const normalized = ratios.map((ratio) => roundRatio(ratio));
  const trailingSum = normalized.slice(0, -1).reduce((sum, ratio) => sum + ratio, 0);
  normalized[normalized.length - 1] = roundRatio(Math.max(0, 100 - trailingSum));
  return normalized;
};

export const getEqualMixRatios = (count: number): number[] => {
  if (count < 2 || count > 4) {
    return [];
  }

  const baseRatio = 100 / count;
  return normalizeMixRatios(Array.from({ length: count }, () => baseRatio));
};

export const clampMixRatiosAroundBoundary = (
  ratios: number[],
  boundaryIndex: number,
  nextBoundaryPercent: number,
  minimumRatio = MIN_MIX_RATIO,
): number[] => {
  if (boundaryIndex < 0 || boundaryIndex >= ratios.length - 1) {
    return ratios;
  }

  const prefixBeforeBoundary = ratios.slice(0, boundaryIndex).reduce((sum, ratio) => sum + ratio, 0);
  const segmentTotal = ratios[boundaryIndex] + ratios[boundaryIndex + 1];
  const minBoundary = prefixBeforeBoundary + minimumRatio;
  const maxBoundary = prefixBeforeBoundary + segmentTotal - minimumRatio;
  const clampedBoundary = Math.min(maxBoundary, Math.max(minBoundary, nextBoundaryPercent));
  const leftRatio = clampedBoundary - prefixBeforeBoundary;
  const rightRatio = segmentTotal - leftRatio;
  const nextRatios = [...ratios];

  nextRatios[boundaryIndex] = roundRatio(leftRatio);
  nextRatios[boundaryIndex + 1] = roundRatio(rightRatio);

  return normalizeMixRatios(nextRatios);
};

const normalizeWithMinimum = (values: number[], total: number, minimumRatio: number): number[] => {
  if (values.length === 0) {
    return [];
  }

  const nextRatios = Array.from({ length: values.length }, () => minimumRatio);
  const freeIndexes = new Set(values.map((_, index) => index));
  let remainingTotal = total;

  while (freeIndexes.size > 0) {
    const freeList = Array.from(freeIndexes);
    const freeValueSum = freeList.reduce((sum, index) => sum + Math.max(0, values[index]), 0);

    if (freeValueSum <= 0) {
      const evenValue = remainingTotal / freeList.length;
      freeList.forEach((index) => {
        nextRatios[index] = evenValue;
      });
      return normalizeMixRatios(nextRatios);
    }

    let fixedAny = false;
    for (const index of freeList) {
      const weightedValue = (remainingTotal * Math.max(0, values[index])) / freeValueSum;
      if (weightedValue < minimumRatio) {
        nextRatios[index] = minimumRatio;
        remainingTotal -= minimumRatio;
        freeIndexes.delete(index);
        fixedAny = true;
      }
    }

    if (!fixedAny) {
      for (const index of freeList) {
        nextRatios[index] = (remainingTotal * Math.max(0, values[index])) / freeValueSum;
      }
      return normalizeMixRatios(nextRatios);
    }
  }

  return normalizeMixRatios(nextRatios);
};

export const updateMixRatioByIndex = (
  ratios: number[],
  index: number,
  nextValue: number,
  minimumRatio = MIN_MIX_RATIO,
): number[] => {
  if (index < 0 || index >= ratios.length || ratios.length === 0) {
    return ratios;
  }

  if (ratios.length === 1) {
    return [100];
  }

  const maxValue = 100 - minimumRatio * (ratios.length - 1);
  const clampedValue = Math.min(maxValue, Math.max(minimumRatio, nextValue));
  const remainingTotal = 100 - clampedValue;
  const otherValues = ratios.filter((_, currentIndex) => currentIndex !== index);
  const normalizedOthers = normalizeWithMinimum(otherValues, remainingTotal, minimumRatio);
  const nextRatios = [...ratios];
  let otherCursor = 0;

  for (let currentIndex = 0; currentIndex < nextRatios.length; currentIndex += 1) {
    if (currentIndex === index) {
      nextRatios[currentIndex] = clampedValue;
    } else {
      nextRatios[currentIndex] = normalizedOthers[otherCursor];
      otherCursor += 1;
    }
  }

  return normalizeMixRatios(nextRatios);
};

export const getMixRatioPartnerIndex = (count: number, index: number): number => {
  if (count <= 1 || index < 0 || index >= count) {
    return -1;
  }

  return index === count - 1 ? index - 1 : index + 1;
};

export const updateMixRatioWithSinglePartner = (
  ratios: number[],
  index: number,
  nextValue: number,
  minimumRatio = MIN_MIX_RATIO,
): number[] => {
  if (index < 0 || index >= ratios.length || ratios.length <= 1) {
    return ratios;
  }

  const partnerIndex = getMixRatioPartnerIndex(ratios.length, index);
  if (partnerIndex < 0) {
    return ratios;
  }

  const pairTotal = ratios[index] + ratios[partnerIndex];
  const clampedValue = Math.min(pairTotal - minimumRatio, Math.max(minimumRatio, nextValue));
  const nextRatios = [...ratios];

  nextRatios[index] = roundRatio(clampedValue);
  nextRatios[partnerIndex] = roundRatio(pairTotal - clampedValue);

  return normalizeMixRatios(nextRatios);
};

export const mixAdditiveColors = (
  colors: MixableColor[],
  ratios: number[],
  mode: AdditiveMixMode = "linear-rgb",
): AdditiveMixResult | null => {
  if (colors.length < 2 || colors.length > 4 || colors.length !== ratios.length) {
    return null;
  }

  const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
  if (totalRatio <= 0) {
    return null;
  }

  if (mode === "srgb-average") {
    let mixedR = 0;
    let mixedG = 0;
    let mixedB = 0;

    for (let index = 0; index < colors.length; index += 1) {
      const rgb = hexToRgb(colors[index].hex);
      if (!rgb) {
        return null;
      }

      const weight = ratios[index] / totalRatio;
      mixedR += rgb.r * weight;
      mixedG += rgb.g * weight;
      mixedB += rgb.b * weight;
    }

    const r = clampChannel(mixedR);
    const g = clampChannel(mixedG);
    const b = clampChannel(mixedB);

    return {
      r,
      g,
      b,
      hex: rgbToHex(r, g, b),
    };
  }

  if (mode === "perceptual-average") {
    let mixedL = 0;
    let mixedA = 0;
    let mixedB = 0;

    for (let index = 0; index < colors.length; index += 1) {
      const rgb = hexToRgb(colors[index].hex);
      if (!rgb) {
        return null;
      }

      const weight = ratios[index] / totalRatio;
      const lab = rgbToLab(rgb);
      mixedL += lab.l * weight;
      mixedA += lab.a * weight;
      mixedB += lab.b * weight;
    }

    return labToRgb(mixedL, mixedA, mixedB);
  }

  let mixedLinearR = 0;
  let mixedLinearG = 0;
  let mixedLinearB = 0;

  for (let index = 0; index < colors.length; index += 1) {
    const rgb = hexToRgb(colors[index].hex);
    if (!rgb) {
      return null;
    }

    const weight = ratios[index] / totalRatio;
    mixedLinearR += srgbChannelToLinear(rgb.r) * weight;
    mixedLinearG += srgbChannelToLinear(rgb.g) * weight;
    mixedLinearB += srgbChannelToLinear(rgb.b) * weight;
  }

  const r = linearChannelToSrgb(mixedLinearR);
  const g = linearChannelToSrgb(mixedLinearG);
  const b = linearChannelToSrgb(mixedLinearB);

  return {
    r,
    g,
    b,
    hex: rgbToHex(r, g, b),
  };
};

export const mixSubtractiveColors = (
  colors: MixableColor[],
  ratios: number[],
  mode: SubtractiveMixMode = "soft-multiply",
): AdditiveMixResult | null => {
  if (colors.length < 2 || colors.length > 4 || colors.length !== ratios.length) {
    return null;
  }

  const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
  if (totalRatio <= 0) {
    return null;
  }

  if (mode === "cmy-average") {
    let mixedC = 0;
    let mixedM = 0;
    let mixedY = 0;

    for (let index = 0; index < colors.length; index += 1) {
      const rgb = hexToRgb(colors[index].hex);
      if (!rgb) {
        return null;
      }

      const weight = ratios[index] / totalRatio;
      mixedC += (1 - rgb.r / 255) * weight;
      mixedM += (1 - rgb.g / 255) * weight;
      mixedY += (1 - rgb.b / 255) * weight;
    }

    const r = clampChannel((1 - mixedC) * 255);
    const g = clampChannel((1 - mixedM) * 255);
    const b = clampChannel((1 - mixedY) * 255);

    return {
      r,
      g,
      b,
      hex: rgbToHex(r, g, b),
    };
  }

  let mixedR = 1;
  let mixedG = 1;
  let mixedB = 1;

  for (let index = 0; index < colors.length; index += 1) {
    const rgb = hexToRgb(colors[index].hex);
    if (!rgb) {
      return null;
    }

    const weight = ratios[index] / totalRatio;
    const red = rgb.r / 255;
    const green = rgb.g / 255;
    const blue = rgb.b / 255;

    if (mode === "soft-multiply") {
      const softenedRed = Math.max(0.05, red);
      const softenedGreen = Math.max(0.05, green);
      const softenedBlue = Math.max(0.05, blue);

      mixedR *= softenedRed ** weight;
      mixedG *= softenedGreen ** weight;
      mixedB *= softenedBlue ** weight;
    } else {
      mixedR *= red ** weight;
      mixedG *= green ** weight;
      mixedB *= blue ** weight;
    }
  }

  const r = clampChannel(mixedR * 255);
  const g = clampChannel(mixedG * 255);
  const b = clampChannel(mixedB * 255);

  return {
    r,
    g,
    b,
    hex: rgbToHex(r, g, b),
  };
};

export const mixAdditiveColorsTuned = (
  colors: MixableColor[],
  ratios: number[],
  params: AdditiveTuningParams,
): AdditiveMixResult | null => {
  const weightedRatios = normalizeWeightsForExponent(ratios, params.mixExponent);
  const baseResult = mixAdditiveColors(colors, weightedRatios, params.mode);
  if (!baseResult) {
    return null;
  }

  const perceptualResult =
    params.perceptualWeight > 0 ? mixAdditiveColors(colors, weightedRatios, "perceptual-average") : null;
  const blendedResult =
    perceptualResult && params.mode !== "perceptual-average"
      ? blendResults(baseResult, perceptualResult, params.perceptualWeight)
      : baseResult;

  const gammaAdjustedResult = applyGammaToResult(blendedResult, params.gamma);
  return adjustResultByHsl(gammaAdjustedResult, params.saturationBoost, params.brightnessBias);
};

export const mixSubtractiveColorsTuned = (
  colors: MixableColor[],
  ratios: number[],
  params: SubtractiveTuningParams,
): AdditiveMixResult | null => {
  const baseResult = mixSubtractiveColors(colors, ratios, params.mode);
  if (!baseResult) {
    return null;
  }

  const softenedResult =
    params.softness > 0 && params.mode !== "soft-multiply"
      ? mixSubtractiveColors(colors, ratios, "soft-multiply")
      : null;
  const cmyResult =
    params.cmyWeight > 0 && params.mode !== "cmy-average" ? mixSubtractiveColors(colors, ratios, "cmy-average") : null;

  let mixedResult = baseResult;
  if (softenedResult) {
    mixedResult = blendResults(mixedResult, softenedResult, params.softness);
  }
  if (cmyResult) {
    mixedResult = blendResults(mixedResult, cmyResult, params.cmyWeight);
  }

  const curve = Math.max(0.2, params.darkeningCurve);
  const curveAdjusted = {
    r: clampChannel(clampUnit((mixedResult.r / 255) ** curve) * 255),
    g: clampChannel(clampUnit((mixedResult.g / 255) ** curve) * 255),
    b: clampChannel(clampUnit((mixedResult.b / 255) ** curve) * 255),
    hex: mixedResult.hex,
  };

  const averageSourceLuminance =
    colors.reduce((sum, color, index) => {
      const rgb = hexToRgb(color.hex);
      if (!rgb) {
        return sum;
      }
      const weight = (ratios[index] ?? 0) / Math.max(1, ratios.reduce((ratioSum, ratio) => ratioSum + ratio, 0));
      return sum + getRelativeLuminance(rgb) * weight;
    }, 0) || getRelativeLuminance(curveAdjusted);
  const darknessFactor = clampUnit((1 - averageSourceLuminance) * params.blackInfluence);
  const darkenedResult = blendResults(curveAdjusted, { r: 0, g: 0, b: 0, hex: "#000000" }, darknessFactor);

  return adjustResultByHsl(darkenedResult, params.chromaRetention, 0);
};
