import { expect, test } from "bun:test";
import { report } from "../../examples/catalog.ts";
import { validateInput } from "../../src/catalog/validate.ts";
import { layoutPages } from "../../src/render/layout.ts";

test("pagination retains every table row exactly once and within page bounds", async () => {
  const rows = Array.from({ length: 70 }, (_, index) => ({ name: `Observation ${index + 1}`, value: index - 35 }));
  const input = validateInput({ pageHeight: 1000, spec: report("All observations", [{ type: "Table", props: { title: "Evidence", columns: [{ key: "name", label: "Observation" }, { key: "value", label: "Value" }], rows } }]) });
  const pages = await layoutPages(input);
  expect(pages.length).toBeGreaterThan(1);
  const actual = pages.flatMap(page => Object.values(page.spec.elements).flatMap(element => element.type === "Table" ? element.props.rows : []));
  expect(actual).toEqual(rows);
  expect(pages.every(page => page.height <= 1000 && page.width === 1200)).toBe(true);
});
test("narrow charts fail with a useful layout error instead of shrinking away", async () => {
  const chart = () => ({ type: "Chart" as const, props: { kind: "line", title: "Trend", categories: ["A", "B"], series: [{ name: "Value", values: [1, 2] }] } });
  const input = validateInput({ width: 900, spec: report("Too narrow", [{ type: "Row", props: {}, children: [chart(), chart(), chart()] }]) });
  await expect(layoutPages(input)).rejects.toThrow("at least 400");
});
test("long headings and unbroken body words wrap without dropping characters", async () => {
  const word = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(4);
  const input = validateInput({ width: 720, spec: report("A heading that must use more than one line without being clipped", [{ type: "Text", props: { text: word } }]) });
  const [page] = await layoutPages(input);
  const lines = page!.boxes.get("n1")!.lines.text!;
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.join("")).toBe(word);
  expect(page!.boxes.get(input.spec.root)!.lines.title!.length).toBeGreaterThan(1);
});

test("Gantt rows expand for long task names instead of clipping them", async () => {
  const label = "Verify representative workloads";
  const input = validateInput({ spec: report("Release plan", [{ type: "Gantt", props: { title: "Verification", tasks: [{ label, start: "2026-09-01", end: "2026-09-06" }] } }]) });
  const box = (await layoutPages(input))[0]!.boxes.get("n1")!;
  expect(box.lines["task:0"]!.join(" ")).toBe(label);
  expect(box.rowHeights![0]).toBeGreaterThan(50);
});

test("overcrowded chart labels fail explicitly rather than silently disappearing", async () => {
  const input = validateInput({ width: 720, spec: report("All regions", [{ type: "Chart", props: { kind: "bar", title: "Regions", categories: ["Northern Europe", "Southern Europe", "Central America", "Southeast Asia", "South America", "New Zealand"], series: [{ name: "Customers", values: [12, 18, 30, 15, 9, 5] }] } }]) });
  await expect(layoutPages(input)).rejects.toThrow("labels are too dense");
});
