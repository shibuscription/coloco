export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type CmykColor = {
  c: number;
  m: number;
  y: number;
  k: number;
};

export type PccsHueDefinition = {
  hueIndex24: number;
  hueCode24: string;
  hueNameJa: string;
  angleDeg: number;
  isRepresentative12: boolean;
  representativeIndex12?: number;
};

export type ChromaticToneCode =
  | "v"
  | "b"
  | "s"
  | "dp"
  | "lt"
  | "sf"
  | "d"
  | "dk"
  | "p"
  | "ltg"
  | "g"
  | "dkg";

export type ChromaticPccsPoint = {
  id: string;
  kind: "chromatic";
  toneCode: ChromaticToneCode;
  toneNameJa?: string;
  hueIndex24: number;
  hueCode24: string;
  hueNameJa: string;
  hueIndex12?: number;
  isRepresentative12: boolean;
  pccsNotation: string;
  pccsLightness: number;
  pccsSaturation: number;
  munsellNotation: string;
  hex: string;
  rgb: RgbColor;
  cmyk: CmykColor;
};

export type AchromaticToneCode =
  | "W"
  | "ltGy"
  | "Gy7.5"
  | "mGy"
  | "Gy5.5"
  | "Gy4.5"
  | "dkGy"
  | "Gy2.5"
  | "Bk";

export type AchromaticPccsPoint = {
  id: string;
  kind: "achromatic";
  toneCode: AchromaticToneCode;
  shortLabel: string;
  toneNameJa: string;
  pccsNotation?: string;
  pccsLightness: number;
  pccsSaturation: 0;
  munsellNotation?: string;
  hex: string;
  rgb: RgbColor;
  cmyk: CmykColor;
};

export type PccsDisplayColor = {
  id: string;
  hex: string;
  rgb: RgbColor;
  cmyk: CmykColor;
};
