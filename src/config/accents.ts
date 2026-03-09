export type AccentId = "blue" | "indigo" | "purple" | "violet" | "green" | "teal" | "cyan" | "orange" | "amber" | "red" | "pink" | "rose" | "slate" | "brown" | "mint";

export interface AccentPalette {
  id: AccentId;
  label: string;
  light: { accent: string; accentHover: string };
  dark: { accent: string; accentHover: string };
}

export const ACCENT_PALETTES: AccentPalette[] = [
  {
    id: "blue",
    label: "Blue",
    light: { accent: "#007AFF", accentHover: "#0066D6" },
    dark: { accent: "#0A84FF", accentHover: "#409CFF" },
  },
  {
    id: "purple",
    label: "Purple",
    light: { accent: "#AF52DE", accentHover: "#9A40C9" },
    dark: { accent: "#BF5AF2", accentHover: "#D084F5" },
  },
  {
    id: "green",
    label: "Green",
    light: { accent: "#34C759", accentHover: "#2AA147" },
    dark: { accent: "#30D158", accentHover: "#5EDD7E" },
  },
  {
    id: "orange",
    label: "Orange",
    light: { accent: "#FF9500", accentHover: "#D67E00" },
    dark: { accent: "#FF9F0A", accentHover: "#FFB840" },
  },
  {
    id: "red",
    label: "Red",
    light: { accent: "#FF3B30", accentHover: "#D63028" },
    dark: { accent: "#FF453A", accentHover: "#FF6961" },
  },
  {
    id: "pink",
    label: "Pink",
    light: { accent: "#FF2D55", accentHover: "#D62548" },
    dark: { accent: "#FF375F", accentHover: "#FF6482" },
  },
  {
    id: "indigo",
    label: "Indigo",
    light: { accent: "#5856D6", accentHover: "#4A48B8" },
    dark: { accent: "#5E5CE6", accentHover: "#7A78EE" },
  },
  {
    id: "violet",
    label: "Violet",
    light: { accent: "#8B5CF6", accentHover: "#7C3AED" },
    dark: { accent: "#A78BFA", accentHover: "#C4B5FD" },
  },
  {
    id: "teal",
    label: "Teal",
    light: { accent: "#0D9488", accentHover: "#0B7C72" },
    dark: { accent: "#14B8A6", accentHover: "#2DD4BF" },
  },
  {
    id: "cyan",
    label: "Cyan",
    light: { accent: "#06B6D4", accentHover: "#0891B2" },
    dark: { accent: "#22D3EE", accentHover: "#67E8F9" },
  },
  {
    id: "amber",
    label: "Amber",
    light: { accent: "#D97706", accentHover: "#B45309" },
    dark: { accent: "#F59E0B", accentHover: "#FBBF24" },
  },
  {
    id: "rose",
    label: "Rose",
    light: { accent: "#E11D48", accentHover: "#BE123C" },
    dark: { accent: "#FB7185", accentHover: "#FDA4AF" },
  },
  {
    id: "slate",
    label: "Slate",
    light: { accent: "#475569", accentHover: "#334155" },
    dark: { accent: "#94A3B8", accentHover: "#CBD5E1" },
  },
  {
    id: "brown",
    label: "Brown",
    light: { accent: "#92400E", accentHover: "#78350F" },
    dark: { accent: "#B45309", accentHover: "#D97706" },
  },
  {
    id: "mint",
    label: "Mint",
    light: { accent: "#00C7BE", accentHover: "#00A89F" },
    dark: { accent: "#63E6BE", accentHover: "#96F2D7" },
  },
];

export const DEFAULT_ACCENT: AccentId = "blue";

export function getAccentPalette(id: string): AccentPalette {
  return ACCENT_PALETTES.find((p) => p.id === id) ?? ACCENT_PALETTES[0];
}
