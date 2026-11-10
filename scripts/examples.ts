import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { generateGallery } from "../src/gallery.ts";

const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
const base = resolve("examples/generated");
const gallery = await generateGallery(base, controller.signal, ["light", "dark"], async message => { console.log(message); });
await mkdir(base, { recursive: true });
await writeFile(join(base, "latest.json"), JSON.stringify({ indexPath: gallery.indexPath, manifestPath: gallery.manifestPath, overviews: gallery.overviews.flatMap(artifact => artifact.pages.map(page => page.path)), examples: gallery.entries.length }, null, 2));
console.log(JSON.stringify({ gallery: gallery.indexPath, manifest: gallery.manifestPath, variants: gallery.entries.length, overviewSheets: gallery.overviews.length }, null, 2));
