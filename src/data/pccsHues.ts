import type { PccsHueDefinition } from "./types";

const REPRESENTATIVE_HUE_INDICES_12 = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24] as const;

const representativeIndexByHueIndex24 = new Map<number, number>(
  REPRESENTATIVE_HUE_INDICES_12.map((hueIndex24, index) => [hueIndex24, index + 1]),
);

export const pccsHues: PccsHueDefinition[] = [
  { hueIndex24: 1, hueCode24: "pR", hueNameJa: "紫みの赤", angleDeg: 0, isRepresentative12: false },
  { hueIndex24: 2, hueCode24: "R", hueNameJa: "赤", angleDeg: 15, isRepresentative12: true, representativeIndex12: 1 },
  { hueIndex24: 3, hueCode24: "yR", hueNameJa: "黄みの赤", angleDeg: 30, isRepresentative12: false },
  { hueIndex24: 4, hueCode24: "rO", hueNameJa: "赤みの橙", angleDeg: 45, isRepresentative12: true, representativeIndex12: 2 },
  { hueIndex24: 5, hueCode24: "O", hueNameJa: "橙", angleDeg: 60, isRepresentative12: false },
  { hueIndex24: 6, hueCode24: "yO", hueNameJa: "黄みの橙", angleDeg: 75, isRepresentative12: true, representativeIndex12: 3 },
  { hueIndex24: 7, hueCode24: "rY", hueNameJa: "赤みの黄", angleDeg: 90, isRepresentative12: false },
  { hueIndex24: 8, hueCode24: "Y", hueNameJa: "黄", angleDeg: 105, isRepresentative12: true, representativeIndex12: 4 },
  { hueIndex24: 9, hueCode24: "gY", hueNameJa: "緑みの黄", angleDeg: 120, isRepresentative12: false },
  { hueIndex24: 10, hueCode24: "YG", hueNameJa: "黄緑", angleDeg: 135, isRepresentative12: true, representativeIndex12: 5 },
  { hueIndex24: 11, hueCode24: "yG", hueNameJa: "黄みの緑", angleDeg: 150, isRepresentative12: false },
  { hueIndex24: 12, hueCode24: "G", hueNameJa: "緑", angleDeg: 165, isRepresentative12: true, representativeIndex12: 6 },
  { hueIndex24: 13, hueCode24: "bG", hueNameJa: "青みの緑", angleDeg: 180, isRepresentative12: false },
  { hueIndex24: 14, hueCode24: "BG", hueNameJa: "青緑", angleDeg: 195, isRepresentative12: true, representativeIndex12: 7 },
  { hueIndex24: 15, hueCode24: "BG", hueNameJa: "青緑", angleDeg: 210, isRepresentative12: false },
  { hueIndex24: 16, hueCode24: "gB", hueNameJa: "緑みの青", angleDeg: 225, isRepresentative12: true, representativeIndex12: 8 },
  { hueIndex24: 17, hueCode24: "B", hueNameJa: "青", angleDeg: 240, isRepresentative12: false },
  { hueIndex24: 18, hueCode24: "B", hueNameJa: "青", angleDeg: 255, isRepresentative12: true, representativeIndex12: 9 },
  { hueIndex24: 19, hueCode24: "pB", hueNameJa: "紫みの青", angleDeg: 270, isRepresentative12: false },
  { hueIndex24: 20, hueCode24: "V", hueNameJa: "青紫", angleDeg: 285, isRepresentative12: true, representativeIndex12: 10 },
  { hueIndex24: 21, hueCode24: "bP", hueNameJa: "青みの紫", angleDeg: 300, isRepresentative12: false },
  { hueIndex24: 22, hueCode24: "P", hueNameJa: "紫", angleDeg: 315, isRepresentative12: true, representativeIndex12: 11 },
  { hueIndex24: 23, hueCode24: "rP", hueNameJa: "赤みの紫", angleDeg: 330, isRepresentative12: false },
  { hueIndex24: 24, hueCode24: "RP", hueNameJa: "赤紫", angleDeg: 345, isRepresentative12: true, representativeIndex12: 12 },
];

export const pccsRepresentativeHueIndices12 = [...REPRESENTATIVE_HUE_INDICES_12];

export const pccsRepresentativeHues12 = pccsHues.filter((hue) => hue.isRepresentative12);

export const pccsHueMapByIndex24 = new Map<number, PccsHueDefinition>(
  pccsHues.map((hue) => [hue.hueIndex24, hue]),
);

export const getRepresentativeIndex12 = (hueIndex24: number): number | undefined =>
  representativeIndexByHueIndex24.get(hueIndex24);
