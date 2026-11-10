import { expect, test } from "bun:test";
import { report } from "../../examples/catalog.ts";
import { dagLayers, validateInput } from "../../src/catalog/validate.ts";

const line = () => ({ spec: report("Observed readings", [{ type: "Chart", props: { kind: "line", title: "Readings", categories: ["A", "B", "C"], series: [{ name: "Observed", values: [0, null, -8] }] } }]) });

test("validation retains zero, negative values and a missing-data gap", () => {
  const validated = validateInput(line());
  const chart = Object.values(validated.spec.elements).find(element => element.type === "Chart")!;
  expect(chart.type).toBe("Chart");
  if (chart.type !== "Chart" || chart.props.kind !== "line") throw new Error("Expected line fixture");
  expect(chart.props.series[0]!.values).toEqual([0, null, -8]);
});
test("rejects mismatched series rather than truncating or filling data", () => {
  expect(() => validateInput({ spec: report("Bad input", [{ type: "Chart", props: { kind: "line", title: "Data", categories: ["A", "B"], series: [{ name: "X", values: [5] }] } }]) })).toThrow("exactly one value");
});
test("rejects unknown props, dynamic expressions, unreachable components and repeated children", () => {
  const unknown = line(); unknown.spec.elements.n1!.props["rawOption"] = {};
  expect(() => validateInput(unknown)).toThrow("Unrecognized key");
  const expression = line(); expression.spec.elements.n1!.props["$state"] = "/secret";
  expect(() => validateInput(expression)).toThrow("dynamic expressions");
  const orphan = line(); orphan.spec.elements.orphan = { type: "Text", props: { text: "Must not disappear" }, children: [] };
  expect(() => validateInput(orphan)).toThrow("unreachable");
  const shared = line(); shared.spec.elements.n0!.children.push("n1");
  expect(() => validateInput(shared)).toThrow("shared children");
});
test("rejects cyclic/deep input before recursive parsing", () => {
  const cycle: Record<string, unknown> = {}; cycle.child = cycle;
  expect(() => validateInput(cycle)).toThrow("cyclic");
  let deep: unknown = {};
  for (let i = 0; i < 40; i++) deep = { next: deep };
  expect(() => validateInput(deep)).toThrow("nesting limit");
});
test("DAG validation rejects cycles/dangling edges but orders a diamond", () => {
  expect(dagLayers(["a", "b", "c", "d"], [{ from: "a", to: "b" }, { from: "a", to: "c" }, { from: "b", to: "d" }, { from: "c", to: "d" }])).toEqual([["a"], ["b", "c"], ["d"]]);
  expect(() => dagLayers(["a", "b"], [{ from: "a", to: "b" }, { from: "b", to: "a" }])).toThrow("cycle");
  expect(() => dagLayers(["a"], [{ from: "a", to: "missing" }])).toThrow("missing node");
});
test("rejects duplicate heatmap cells and out-of-domain cohort percentages", () => {
  for (const cells of [[[0, 0, 50], [0, 0, 60]], [[0, 0, 101]], [[1, 0, 50]]]) {
    expect(() => validateInput({ spec: report("Retention", [{ type: "Chart", props: { kind: "cohort", title: "Retention", xLabels: ["W1"], yLabels: ["C1"], cells } }]) })).toThrow();
  }
});
test("rejects remote images, file paths, SVG images and executable props", () => {
  for (const src of ["https://example.com/private.png", "file:///etc/passwd", "data:image/svg+xml;base64,PHN2Zz4=", "javascript:alert(1)"]) {
    expect(() => validateInput({ spec: report("Image", [{ type: "Image", props: { title: "Image", src } }]) })).toThrow();
  }
});
test("validates real dates, hierarchy totals, and candle envelopes", () => {
  expect(() => validateInput({ spec: report("Dates", [{ type: "Timeline", props: { title: "Dates", events: [{ date: "2026-02-30", title: "Invalid" }] } }]) })).toThrow("valid ISO");
  expect(() => validateInput({ spec: report("Tree", [{ type: "Hierarchy", props: { title: "Tree", data: { name: "Total", value: 12, children: [{ name: "A", value: 10 }] } } }]) })).toThrow("sum of its children");
  expect(() => validateInput({ spec: report("Prices", [{ type: "Chart", props: { kind: "candlestick", title: "Prices", candles: [{ label: "A", open: 5, close: 8, low: 6, high: 10 }] } }]) })).toThrow("enclose");
});

test("resource limits reject oversized input before rendering", () => {
  expect(() => validateInput({ text: "x".repeat(4 * 1024 * 1024) })).toThrow("JSON budget");
  expect(() => validateInput({ values: Array.from({ length: 2401 }, () => 1) })).toThrow("collection is too large");
  const excessive = line();
  for (let index = 0; index < 256; index++) excessive.spec.elements[`extra${index}`] = { type: "Text", props: { text: "Value" }, children: [] };
  expect(() => validateInput(excessive)).toThrow("256 components");
});

test("component errors identify the element and unsupported references are not ignored", () => {
  const invalid = line(); invalid.spec.elements.n1!.props["title"] = "";
  try { validateInput(invalid); throw new Error("Validation unexpectedly succeeded"); }
  catch (error) { expect(error).toMatchObject({ code: "VALIDATION", path: "elements.n1.props.title" }); }
  expect(() => validateInput({ spec: report("Allocation", [{ type: "Chart", props: { kind: "pie", title: "Allocation", items: [{ name: "One", value: 1 }], reference: { label: "Ignored", value: 8 } } }]) })).toThrow("Reference lines");
});
