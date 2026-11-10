import { expect, test } from "bun:test";
import sharp from "sharp";
import { getExamples, report } from "../../examples/catalog.ts";
import { validateInput } from "../../src/catalog/validate.ts";
import { layoutPages } from "../../src/render/layout.ts";
import { prepareGraphics } from "../../src/render/graphics.ts";
import { themes } from "../../src/design/theme.ts";
import { chartSchemas } from "../../src/catalog/charts.ts";
import { chartOptions, renderOption } from "../../src/charts/render.ts";
import { textMetrics } from "../../src/design/fonts.ts";

test("a straight flow retains bounded nodes and visible connections", async () => {
  const spec = (await getExamples()).find(example => example.id === "flow")!.spec;
  const input = validateInput({ spec });
  const page = (await layoutPages(input))[0]!;
  const graphic = (await prepareGraphics(page, input, themes.light)).get("n1")!;
  const pixel = async (left: number, top: number) => [...await sharp(graphic.png).extract({ left, top, width: 1, height: 1 }).removeAlpha().raw().toBuffer()];
  // Collinear nodes must not be stretched to the full plot height by graph auto-fit.
  expect(await pixel(100, 30)).toEqual([255, 255, 255]);
  expect(await pixel(100, 115)).toEqual([229, 243, 246]);
  const connection = await sharp(graphic.png).extract({ left: 200, top: 115, width: 70, height: 45 }).stats();
  expect(Math.max(...connection.channels.map(channel => channel.stdev))).toBeGreaterThan(5);
});

test("empty observations produce a readable state rather than an invented zero", async () => {
  const input = validateInput({ spec: report("No reading yet", [{ type: "Chart", props: { kind: "line", title: "Measurements", categories: ["A", "B"], series: [{ name: "Observed", values: [null, null] }] } }]) });
  const page = (await layoutPages(input))[0]!;
  const graphic = (await prepareGraphics(page, input, themes.light)).get("n1")!;
  expect(graphic.svg).toContain("No observations supplied");
  const pixels = await sharp(graphic.png).stats();
  expect(pixels.channels[0]!.stdev).toBeGreaterThan(5);
});

test("numeric x-axis titles appear once and stay fully inside the exported chart", async () => {
  const width = 1072, label = "Qualified opportunities";
  const charts = [
    chartSchemas.bullet.parse({ kind: "bullet", title: "Target", value: 82, target: 90, maximum: 120, xLabel: label }),
    chartSchemas.scatter.parse({ kind: "scatter", title: "Relationship", points: [{ x: 8, y: 15 }, { x: 16, y: 26 }], xLabel: label }),
  ];
  const metrics = await textMetrics();
  for (const chart of charts) {
    const { svg } = await renderOption(chartOptions(chart, themes.light, width), width, chart.height);
    const titles = [...svg.matchAll(/<text\b([^>]*)>Qualified opportunities<\/text>/g)];
    expect(titles).toHaveLength(1);
    const attributes = titles[0]![1]!;
    const position = attributes.match(/transform="translate\(([-\d.]+) ([-\d.]+)\)"/);
    expect(position).not.toBeNull();
    const textWidth = metrics.measure(label, 14);
    const offset = attributes.includes('text-anchor="middle"') ? textWidth / 2 : attributes.includes('text-anchor="end"') ? textWidth : 0;
    const left = Number(position![1]) - offset;
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + textWidth).toBeLessThanOrEqual(width);
    expect(Number(position![2])).toBeLessThan(chart.height - 7);
  }
});
