import { getRepresentativeIndex12, pccsHueMapByIndex24 } from "./pccsHues";

const PCCS_NOTATION_PATTERN =
  /^(?<hueIndex24>\d{1,2}):(?<hueCode24>[A-Za-z]+)-(?<pccsLightness>\d+(?:\.\d+)?)-(?<pccsSaturation>\d+(?:\.\d+)?)s$/;

export const normalizePccsNotation = (notation: string): string => {
  const trimmed = notation.trim();
  return /s$/i.test(trimmed) ? trimmed : `${trimmed}s`;
};

export const parsePccsNotation = (notation: string) => {
  const normalizedNotation = normalizePccsNotation(notation);
  const match = normalizedNotation.match(PCCS_NOTATION_PATTERN);

  if (!match?.groups) {
    throw new Error(`Unsupported PCCS notation: ${notation}`);
  }

  return {
    normalizedNotation,
    hueIndex24: Number(match.groups.hueIndex24),
    hueCode24: match.groups.hueCode24,
    pccsLightness: Number(match.groups.pccsLightness),
    pccsSaturation: Number(match.groups.pccsSaturation),
  };
};

export const getHueInfoFromNotation = (notation: string) => {
  const parsed = parsePccsNotation(notation);
  const hue = pccsHueMapByIndex24.get(parsed.hueIndex24);

  if (!hue) {
    throw new Error(`Unknown PCCS hue index: ${parsed.hueIndex24}`);
  }

  return {
    ...parsed,
    hueNameJa: hue.hueNameJa,
    isRepresentative12: hue.isRepresentative12,
    representativeIndex12: getRepresentativeIndex12(parsed.hueIndex24),
  };
};
