import { pccsAchromatic } from "./pccsAchromatic";
import { pccsPoints } from "./pccsPoints";
import type { PccsDisplayColor } from "./types";

export const pccsDisplayColors: Record<string, PccsDisplayColor> = [...pccsPoints, ...pccsAchromatic].reduce<
  Record<string, PccsDisplayColor>
>((acc, point) => {
  acc[point.id] = {
    id: point.id,
    hex: point.hex,
    rgb: point.rgb,
  };

  return acc;
}, {});
