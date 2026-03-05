export type AccentId = "blue" | "purple" | "green" | "orange" | "red" | "pink";

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
];

export const DEFAULT_ACCENT: AccentId = "blue";

export function getAccentPalette(id: string): AccentPalette {
  return ACCENT_PALETTES.find((p) => p.id === id) ?? ACCENT_PALETTES[0];
}
