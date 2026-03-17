import type { RgbColor } from "../data";

export type LabColor = {
  l: number;
  a: number;
  b: number;
};

const srgbToLinear = (value: number): number => {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const xyzToLabComponent = (value: number): number =>
  value > 0.008856 ? value ** (1 / 3) : 7.787 * value + 16 / 116;

export const rgbToLab = ({ r, g, b }: RgbColor): LabColor => {
  const linearR = srgbToLinear(r);
  const linearG = srgbToLinear(g);
  const linearB = srgbToLinear(b);

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

export const getLabDistance = (left: LabColor, right: LabColor): number =>
  Math.sqrt(
    (left.l - right.l) ** 2 +
      (left.a - right.a) ** 2 +
      (left.b - right.b) ** 2,
  );
