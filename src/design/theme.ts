export const themes = {
  light: {
    background: "#EEF3F9", surface: "#FFFFFF", inset: "#F4F7FB", ink: "#152A40",
    muted: "#53697E", border: "#D8E2ED", accent: "#086B82", accentSoft: "#E5F3F6",
    positive: "#18754B", negative: "#B23F53", warning: "#8E6015",
    series: ["#147D9A", "#7961AD", "#BF7130", "#27825E", "#B65370", "#567CA5"],
  },
  dark: {
    background: "#0D1724", surface: "#172638", inset: "#203146", ink: "#ECF2FA",
    muted: "#ADBFD1", border: "#344A60", accent: "#68C4D6", accentSoft: "#213E4C",
    positive: "#74C9A0", negative: "#F19AAD", warning: "#E9BF75",
    series: ["#6CC6DC", "#BAA2EE", "#F0B36D", "#81CBA6", "#F197B1", "#95B6E6"],
  },
} as const;

export type ThemeName = keyof typeof themes;
export type Theme = (typeof themes)[ThemeName];
export const sans = "IBM Plex Sans";
export const mono = "IBM Plex Mono";
export const spacing = { page: 40, panel: 24, gap: 20 } as const;
