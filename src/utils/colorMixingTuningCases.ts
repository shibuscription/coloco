export type TuningColorInput = {
  label: string;
  hex: string;
};

export type TuningMixInput = {
  answer: string;
  colors: TuningColorInput[];
  ratios: number[];
  note: string;
};

export type ColorMixingTuningCase = {
  id: string;
  label: string;
  targetHex: string;
  additive: TuningMixInput;
  subtractive: TuningMixInput;
  note?: string;
};

const WHITE = "#F6F5F6";
const BLACK = "#1A1A1A";
const GREEN = "#86D130";
const PURPLE = "#AE6CBA";
const ORANGE = "#FF7859";
const YELLOW = "#F7F627";
const CYAN = "#2AC6F6";
const MAGENTA = "#EC22A7";

export const COLOR_MIXING_TUNING_CASES: ColorMixingTuningCase[] = [
  {
    id: "case-1",
    label: "問題1",
    targetHex: "#ACACB0",
    additive: {
      answer: "ウ",
      colors: [
        { label: "白", hex: WHITE },
        { label: "黒", hex: BLACK },
      ],
      ratios: [30, 70],
      note: "白 + 黒",
    },
    subtractive: {
      answer: "エ",
      colors: [
        { label: "白", hex: WHITE },
        { label: "黒", hex: BLACK },
      ],
      ratios: [90, 10],
      note: "白9 : 黒1",
    },
  },
  {
    id: "case-2",
    label: "問題2",
    targetHex: "#B7E0A0",
    additive: {
      answer: "ア",
      colors: [
        { label: "緑", hex: GREEN },
        { label: "白", hex: WHITE },
      ],
      ratios: [90, 10],
      note: "緑 + 白",
    },
    subtractive: {
      answer: "オ",
      colors: [
        { label: "黄", hex: YELLOW },
        { label: "シアン", hex: CYAN },
        { label: "白", hex: WHITE },
      ],
      ratios: [30, 10, 60],
      note: "黄3 : シアン1 : 白6",
    },
  },
  {
    id: "case-3",
    label: "問題3",
    targetHex: "#B797B8",
    additive: {
      answer: "イ",
      colors: [
        { label: "紫", hex: PURPLE },
        { label: "黒", hex: BLACK },
        { label: "白", hex: WHITE },
      ],
      ratios: [35, 50, 15],
      note: "紫 + 黒 + 白",
    },
    subtractive: {
      answer: "エ",
      colors: [
        { label: "マゼンタ", hex: MAGENTA },
        { label: "白", hex: WHITE },
        { label: "黒", hex: BLACK },
      ],
      ratios: [36.36, 54.55, 9.09],
      note: "マゼンタ4 : 白6 : 黒1",
    },
  },
  {
    id: "case-4",
    label: "問題4",
    targetHex: "#AF7681",
    additive: {
      answer: "ア",
      colors: [
        { label: "橙", hex: ORANGE },
        { label: "黒", hex: BLACK },
      ],
      ratios: [25, 75],
      note: "橙 + 黒",
    },
    subtractive: {
      answer: "カ",
      colors: [
        { label: "黄", hex: YELLOW },
        { label: "マゼンタ", hex: MAGENTA },
        { label: "黒", hex: BLACK },
      ],
      ratios: [42.86, 50, 7.14],
      note: "黄6 : マゼンタ7 : 黒1",
    },
  },
];
