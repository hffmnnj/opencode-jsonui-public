import { fileURLToPath } from "node:url";
import { z } from "zod";
import { validateInput, type ValidatedInput } from "../catalog/validate.ts";
import { VisualError } from "../errors.ts";
import type { RenderedReport } from "./engine.ts";

const responseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(false), error: z.object({ code: z.enum(["VALIDATION", "LIMIT", "LAYOUT", "RENDER", "BUSY", "CANCELLED", "ARTIFACT"]), message: z.string().max(1000), path: z.string().optional() }) }),
  z.object({ ok: z.literal(true), report: z.object({ pages: z.array(z.object({ png: z.string(), preview: z.string(), width: z.number().int().positive(), height: z.number().int().positive(), alt: z.string() })).min(1).max(8), charts: z.array(z.object({ name: z.string(), svg: z.string() })).max(256), createdAt: z.string() }) }),
]);
interface Job { input: ValidatedInput; signal: AbortSignal; resolve: (report: RenderedReport) => void; reject: (error: unknown) => void; removeListener: () => void }

async function boundedRead(stream: ReadableStream<Uint8Array>, limit: number): Promise<Buffer> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new VisualError("LIMIT", "Renderer exceeded its output budget.");
      parts.push(value);
    }
    return Buffer.concat(parts);
  } finally { reader.releaseLock(); }
}

export class RenderPool {
  private readonly shutdown = new AbortController();
  private readonly waiting: Job[] = [];
  private readonly active = new Set<Promise<void>>();
  constructor(private readonly options: { concurrency?: number; queueLimit?: number; timeoutMs?: number; executable?: string } = {}) {}

  run(raw: unknown, signal: AbortSignal): Promise<RenderedReport> {
    const input = validateInput(raw);
    if (signal.aborted || this.shutdown.signal.aborted) return Promise.reject(new VisualError("CANCELLED", "Render cancelled."));
    if (this.waiting.length >= (this.options.queueLimit ?? 8)) return Promise.reject(new VisualError("BUSY", "Render queue is full; try again after the current reports finish."));
    return new Promise((resolve, reject) => {
      const abort = () => { const index = this.waiting.indexOf(job); if (index >= 0) { this.waiting.splice(index, 1); job.removeListener(); reject(new VisualError("CANCELLED", "Render cancelled before starting.")); } };
      const job: Job = { input, signal, resolve, reject, removeListener: () => signal.removeEventListener("abort", abort) };
      signal.addEventListener("abort", abort, { once: true });
      this.waiting.push(job); this.pump();
    });
  }

  private pump(): void {
    while (!this.shutdown.signal.aborted && this.active.size < (this.options.concurrency ?? 2) && this.waiting.length) {
      const job = this.waiting.shift()!; job.removeListener();
      const pending = this.execute(job).then(job.resolve, job.reject).finally(() => { this.active.delete(pending); this.pump(); });
      this.active.add(pending);
    }
  }

  private async execute(job: Job): Promise<RenderedReport> {
    const executable = this.options.executable ?? Bun.which("bun");
    if (!executable) throw new VisualError("RENDER", "Bun is required on PATH for the isolated renderer.");
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 30_000);
    const signal = AbortSignal.any([job.signal, this.shutdown.signal, timeout]);
    if (signal.aborted) throw new VisualError("CANCELLED", "Render cancelled.");
    const input = JSON.stringify({ input: job.input, createdAt: new Date().toISOString() });
    const child = Bun.spawn([executable, fileURLToPath(new URL("./worker.ts", import.meta.url))], {
      stdin: new Blob([input]), stdout: "pipe", stderr: "pipe",
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin", TZ: "UTC", LANG: "en_US.UTF-8", NO_COLOR: "1" },
    });
    const abort = () => child.kill("SIGKILL");
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    try {
      const [stdout, , exit] = await Promise.all([boundedRead(child.stdout, 48 * 1024 * 1024), boundedRead(child.stderr, 32 * 1024), child.exited]);
      if (signal.aborted) throw new VisualError(timeout.aborted ? "LIMIT" : "CANCELLED", timeout.aborted ? "Render exceeded its time limit." : "Render cancelled.");
      const result = responseSchema.parse(JSON.parse(stdout.toString("utf8")));
      if (!result.ok) throw new VisualError(result.error.code, result.error.message, result.error.path);
      if (exit !== 0) throw new VisualError("RENDER", "Renderer exited without a complete report.");
      return { ...result.report, input: job.input, pages: result.report.pages.map(page => ({ ...page, png: Buffer.from(page.png, "base64"), preview: Buffer.from(page.preview, "base64") })) };
    } catch (error) {
      if (error instanceof VisualError) throw error;
      throw new VisualError("RENDER", "Isolated renderer failed; no artifact was published.");
    } finally {
      signal.removeEventListener("abort", abort);
      if (child.exitCode === null) child.kill("SIGKILL");
      await child.exited;
    }
  }

  async close(): Promise<void> {
    this.shutdown.abort();
    for (const job of this.waiting.splice(0)) { job.removeListener(); job.reject(new VisualError("CANCELLED", "Renderer unloaded.")); }
    await Promise.allSettled(this.active);
  }
}
