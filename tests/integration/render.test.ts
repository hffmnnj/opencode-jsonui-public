import { expect, test } from "bun:test";
import sharp from "sharp";
import { getExamples, report } from "../../examples/catalog.ts";
import { renderReport } from "../../src/render/engine.ts";
import { RenderPool } from "../../src/render/pool.ts";

test("real image composition renders different supplied values and correct scale", async () => {
  const one = { spec: report("An explicit value", [{ type: "Metric", props: { label: "Customers", value: 1357 } }]) };
  const two = { spec: report("An explicit value", [{ type: "Metric", props: { label: "Customers", value: 2468 } }]) };
  const a = await renderReport(one, "2026-09-01T00:00:00Z"), b = await renderReport(two, "2026-09-01T00:00:00Z");
  expect(a.pages[0]!.png.equals(b.pages[0]!.png)).toBe(false);
  const high = await renderReport({ ...one, scale: 2 }, "2026-09-01T00:00:00Z");
  expect((await sharp(high.pages[0]!.png).metadata()).width).toBe(2400);
  expect(high.pages[0]!.height).toBe(a.pages[0]!.height * 2);
}, 30000);
test("renderer works with fetch disabled and rejects disguised SVG assets", async () => {
  const original = globalThis.fetch;
  const noNetwork = () => { throw new Error("No network allowed"); };
  globalThis.fetch = Object.assign(noNetwork, { preconnect: noNetwork });
  try {
    const example = (await getExamples()).find(example => example.id === "line")!;
    const result = await renderReport({ spec: example.spec });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]!.png.length).toBeGreaterThan(1000);
    const src = `data:image/png;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>').toString("base64")}`;
    await expect(renderReport({ spec: report("Asset", [{ type: "Image", props: { title: "Asset", src } }]) })).rejects.toThrow("actual raster format");
  } finally { globalThis.fetch = original; }
}, 30000);
test("isolated worker queue is bounded, cancelled queued work never runs, and unload stops new work", async () => {
  const spec = (await getExamples()).find(example => example.id === "line")!.spec;
  const pool = new RenderPool({ concurrency: 1, queueLimit: 1 });
  try {
    const first = pool.run({ spec }, new AbortController().signal);
    const controller = new AbortController();
    const second = pool.run({ spec }, controller.signal);
    const cancelled = second.then(() => "unexpected success", error => String(error.message));
    controller.abort();
    const replacement = pool.run({ spec }, new AbortController().signal);
    await expect(pool.run({ spec }, new AbortController().signal)).rejects.toThrow("queue is full");
    expect(await cancelled).toBe("Render cancelled before starting.");
    expect((await first).pages).toHaveLength(1);
    expect((await replacement).pages).toHaveLength(1);
  } finally { await pool.close(); }
  await expect(pool.run({ spec }, new AbortController().signal)).rejects.toThrow("cancelled");
}, 30000);
test("a render timeout kills the isolated worker rather than hanging OpenCode", async () => {
  const spec = (await getExamples()).find(example => example.id === "line")!.spec;
  const pool = new RenderPool({ timeoutMs: 1 });
  try { await expect(pool.run({ spec }, new AbortController().signal)).rejects.toThrow("time limit"); }
  finally { await pool.close(); }
}, 10000);

test("cancelling an active render terminates it and lets the next job complete", async () => {
  const spec = (await getExamples()).find(example => example.id === "line")!.spec;
  const pool = new RenderPool({ concurrency: 1 });
  const controller = new AbortController();
  try {
    const outcome = pool.run({ spec }, controller.signal).then(() => ({ code: "unexpected-success" }), error => error);
    controller.abort();
    expect(await outcome).toMatchObject({ code: "CANCELLED" });
    expect((await pool.run({ spec }, new AbortController().signal)).pages).toHaveLength(1);
  } finally { await pool.close(); }
}, 10000);
