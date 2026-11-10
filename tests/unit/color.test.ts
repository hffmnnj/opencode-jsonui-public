import { expect, test } from "bun:test";
import { contrastText, luminance, mixColor } from "../../src/design/color.ts";
import { themes } from "../../src/design/theme.ts";

test("chart cell text maintains WCAG AA contrast across both sequential palettes", () => {
  expect(luminance("#000000")).toBe(0);
  expect(luminance("#FFFFFF")).toBe(1);
  expect(mixColor("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  for (const theme of Object.values(themes)) {
    const colors = [...theme.series, ...Array.from({ length: 101 }, (_, index) => mixColor(theme.inset, theme.accent, index / 100))];
    for (const background of colors) {
      const a = luminance(background), b = luminance(contrastText(background));
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
    const ink = luminance(theme.muted), surface = luminance(theme.surface);
    expect((Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});
