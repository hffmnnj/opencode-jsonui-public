import { expect, test } from "bun:test";
import sharp from "sharp";
import { getExamples } from "../examples/catalog.ts";
import { definitions } from "../src/catalog/schema.ts";
import { chartSchemas } from "../src/catalog/charts.ts";
import { renderReport } from "../src/render/engine.ts";

const examples = await getExamples();
test("gallery exercises every public component and chart kind", () => {
  const components = new Set<string>(), kinds = new Set<string>();
  for (const example of examples) for (const element of Object.values(example.spec.elements)) {
    components.add(element.type);
    if (element.type === "Chart") kinds.add(String(element.props.kind));
  }
  expect([...components].sort()).toEqual(Object.keys(definitions).sort());
  expect([...kinds].sort()).toEqual(Object.keys(chartSchemas).sort());
  expect(new Set(examples.map(example => example.id)).size).toBe(examples.length);
});
for (const example of examples) for (const theme of ["light", "dark"] as const) {
  test(`${example.id}: real ${theme} output retains visible content within declared dimensions`, async () => {
    const result = await renderReport({ spec: example.spec, theme, chartSvg: true }, "2026-09-01T00:00:00Z");
    expect(result.pages.length).toBeGreaterThan(0);
    for (const page of result.pages) {
      const image = sharp(page.png), metadata = await image.metadata();
      expect(metadata.format).toBe("png"); expect(metadata.width).toBe(page.width); expect(metadata.height).toBe(page.height);
      expect(page.height).toBeLessThanOrEqual(1600);
      const stats = await image.extract({ left: 60, top: Math.floor(page.height * 0.3), width: page.width - 120, height: Math.floor(page.height * 0.4) }).stats();
      expect(Math.max(...stats.channels.slice(0, 3).map(channel => channel.stdev))).toBeGreaterThan(3);
      expect(page.alt).toContain("Synthetic example data");
    }
    const count = Object.values(example.spec.elements).filter(element => element.type === "Chart").length;
    expect(result.charts).toHaveLength(count);
    for (const chart of result.charts) { expect(chart.svg).toContain("<svg"); expect(chart.svg).toContain("data:font/ttf;base64,"); expect(chart.svg).not.toContain('href="http'); }
  }, 30000);
}
