import { ArtifactStore, type Artifact } from "./artifacts/store.ts";
import { RenderPool } from "./render/pool.ts";

export class VisualService {
  readonly pool: RenderPool;
  readonly store: ArtifactStore;
  constructor(options: { outputDirectory: string; timeoutMs?: number; maxArtifactsPerSession?: number }) {
    this.pool = new RenderPool({ timeoutMs: options.timeoutMs });
    this.store = new ArtifactStore(options.outputDirectory, options.maxArtifactsPerSession);
  }
  async render(sessionID: string, input: unknown, signal: AbortSignal) {
    const report = await this.pool.run(input, signal);
    const output = await this.store.save(sessionID, report, signal);
    return { output, content: [
      { type: "text" as const, text: JSON.stringify({ ...output, presentation: "Present the attached PNG(s). If browser.preview is available, preview each page path. Explain the findings briefly; a filesystem path alone is not delivery." }) },
      ...report.pages.map((page, index) => ({ type: "file" as const, mime: "image/png", name: `jsonui-${output.id}-page-${index + 1}.png`, uri: `data:image/png;base64,${page.preview.toString("base64")}` })),
    ] } satisfies { output: Artifact; content: unknown[] };
  }
  async close() { await this.pool.close(); }
}
