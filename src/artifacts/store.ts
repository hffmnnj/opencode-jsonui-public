import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, rename, rmdir, unlink } from "node:fs/promises";
import { join, parse, resolve } from "node:path";
import { z } from "zod";
import type { RenderedReport } from "../render/engine.ts";
import { VisualError } from "../errors.ts";

export const artifactSchema = z.object({
  id: z.string(), directory: z.string(), specPath: z.string(), manifestPath: z.string(), createdAt: z.string(),
  pages: z.array(z.object({ path: z.string(), previewPath: z.string(), width: z.number(), height: z.number(), alt: z.string() })),
  charts: z.array(z.object({ name: z.string(), path: z.string() })),
});
export type Artifact = z.infer<typeof artifactSchema>;
// Serialize publications sharing a session across service instances in this host.
const publications = new Map<string, Promise<unknown>>();

async function privateDirectory(directory: string): Promise<void> {
  const absolute = resolve(directory), root = parse(absolute).root;
  let current = root;
  for (const segment of absolute.slice(root.length).split("/").filter(Boolean)) {
    current = join(current, segment);
    try { await mkdir(current, { mode: 0o700 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new VisualError("ARTIFACT", "Artifact storage must not contain symlinks or non-directories.");
  }
}

export class ArtifactStore {
  constructor(readonly root: string, private readonly maxPerSession = 100) {}

  async save(sessionID: string, report: RenderedReport, signal: AbortSignal): Promise<Artifact> {
    signal.throwIfAborted();
    const owner = createHash("sha256").update(sessionID).digest("hex").slice(0, 32);
    const parent = join(resolve(this.root), owner);
    const previous = publications.get(parent) ?? Promise.resolve();
    const publication = previous.catch(() => {}).then(() => this.publish(parent, report, signal));
    publications.set(parent, publication);
    try { return await publication; }
    finally { if (publications.get(parent) === publication) publications.delete(parent); }
  }

  private async publish(parent: string, report: RenderedReport, signal: AbortSignal): Promise<Artifact> {
    signal.throwIfAborted();
    await privateDirectory(parent);
    if ((await readdir(parent)).length >= this.maxPerSession) throw new VisualError("LIMIT", "Session artifact quota reached. Archive existing exports before generating more.");
    const id = randomUUID(), destination = join(parent, id), pending = join(parent, `.pending-${id}`);
    await mkdir(pending, { mode: 0o700 });
    const owned: string[] = [];
    const write = async (name: string, content: Uint8Array | string) => {
      signal.throwIfAborted();
      const path = join(pending, name);
      const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      owned.push(path);
      try { await handle.writeFile(content); } finally { await handle.close(); }
    };
    const artifact: Artifact = { id, directory: destination, specPath: join(destination, "spec.json"), manifestPath: join(destination, "manifest.json"), createdAt: report.createdAt, pages: [], charts: [] };
    try {
      await write("spec.json", JSON.stringify(report.input, null, 2));
      for (const [index, page] of report.pages.entries()) {
        const name = `page-${index + 1}.png`, preview = `preview-${index + 1}.png`;
        await write(name, page.png); await write(preview, page.preview);
        artifact.pages.push({ path: join(destination, name), previewPath: join(destination, preview), width: page.width, height: page.height, alt: page.alt });
      }
      for (const [index, chart] of report.charts.entries()) {
        const name = `chart-${index + 1}.svg`; await write(name, chart.svg);
        artifact.charts.push({ name: chart.name, path: join(destination, name) });
      }
      await write("manifest.json", JSON.stringify(artifact, null, 2));
      signal.throwIfAborted();
      await rename(pending, destination);
      return artifact;
    } catch (error) {
      // Remove only exact files created by this failed publication, never a recursive tree.
      for (const path of owned) await unlink(path).catch(() => {});
      await rmdir(pending).catch(() => {});
      if (signal.aborted) throw new VisualError("CANCELLED", "Render cancelled before publication.");
      if (error instanceof VisualError) throw error;
      throw new VisualError("ARTIFACT", "Could not publish the report. Check storage permissions and available space.");
    }
  }
}
