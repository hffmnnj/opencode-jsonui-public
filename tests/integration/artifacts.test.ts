import { expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, mkdir, symlink, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactStore } from "../../src/artifacts/store.ts";
import { renderReport } from "../../src/render/engine.ts";
import { report } from "../../examples/catalog.ts";

test("artifacts preserve exact bytes, isolate sessions and never overwrite", async () => {
  const root = await mkdtemp(join(tmpdir(), "jsonui-artifacts-"));
  const rendered = await renderReport({ spec: report("Persisted evidence", [{ type: "Text", props: { text: "An explicit observation." } }]) });
  const store = new ArtifactStore(root);
  const signal = new AbortController().signal;
  const first = await store.save("ses_first", rendered, signal), second = await store.save("ses_second", rendered, signal), third = await store.save("ses_first", rendered, signal);
  expect(first.directory).not.toBe(second.directory); expect(first.directory).not.toBe(third.directory);
  expect(first.directory.split("/").slice(0, -1)).not.toEqual(second.directory.split("/").slice(0, -1));
  expect(await readFile(first.pages[0]!.path)).toEqual(rendered.pages[0]!.png);
  expect(JSON.parse(await readFile(first.specPath, "utf8")).spec.elements.n1.props.text).toBe("An explicit observation.");
  expect(JSON.parse(await readFile(first.manifestPath, "utf8"))).toEqual(first);
  expect((await stat(first.pages[0]!.path)).mode & 0o777).toBe(0o600);
  expect((await stat(first.directory)).mode & 0o777).toBe(0o700);
});

test("concurrent publications cannot exceed a session quota or overwrite its first artifact", async () => {
  const root = await mkdtemp(join(tmpdir(), "jsonui-quota-"));
  const rendered = await renderReport({ spec: report("Quota", [{ type: "Text", props: { text: "Keep this evidence" } }]) });
  const stores = [new ArtifactStore(root, 1), new ArtifactStore(root, 1)];
  const results = await Promise.allSettled(stores.map(store => store.save("same-session", rendered, new AbortController().signal)));
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  const rejected = results.find(result => result.status === "rejected")!;
  expect(rejected.status === "rejected" ? rejected.reason : undefined).toMatchObject({ code: "LIMIT" });
  const names = await readdir(root, { recursive: true });
  expect(names.filter(name => name.endsWith("/manifest.json"))).toHaveLength(1);
  expect(names.some(name => name.includes(".pending-"))).toBe(false);
});
test("cancellation publishes nothing and symlink output roots cannot redirect writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "jsonui-boundaries-"));
  const rendered = await renderReport({ spec: report("Evidence", [{ type: "Text", props: { text: "A value" } }]) });
  const controller = new AbortController(); controller.abort();
  await expect(new ArtifactStore(join(root, "cancelled")).save("ses_a", rendered, controller.signal)).rejects.toThrow();
  expect(await readdir(root)).toEqual([]);
  const outside = join(root, "outside"); await mkdir(outside);
  await symlink(outside, join(root, "redirect"));
  await expect(new ArtifactStore(join(root, "redirect")).save("ses_a", rendered, new AbortController().signal)).rejects.toThrow("symlinks");
  expect(await readdir(outside)).toEqual([]);
});
