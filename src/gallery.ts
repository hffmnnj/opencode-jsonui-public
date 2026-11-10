import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getExamples, report, type Node } from "../examples/catalog.ts";
import { VisualService } from "./service.ts";
import type { Artifact } from "./artifacts/store.ts";
import type { ThemeName } from "./design/theme.ts";
import { fontPaths } from "./design/fonts.ts";

export interface GalleryEntry { id: string; title: string; category: string; theme: ThemeName; artifact: Artifact }
export interface Gallery { directory: string; indexPath: string; manifestPath: string; entries: GalleryEntry[]; overviews: Artifact[] }
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const dataUrl = (bytes: Buffer, mime = "image/png") => `data:${mime};base64,${bytes.toString("base64")}`;

/** User-requested gallery generation uses the same isolated service as native render. */
export async function generateGallery(baseDirectory: string, signal: AbortSignal, selected: ThemeName[] = ["light", "dark"], progress?: (message: string) => Promise<void>): Promise<Gallery> {
  const directory = join(resolve(baseDirectory), `gallery-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`);
  const service = new VisualService({ outputDirectory: directory, maxArtifactsPerSession: 500 });
  const entries: GalleryEntry[] = [], overviews: Artifact[] = [];
  const examples = await getExamples();
  try {
    for (const example of examples) for (const theme of selected) {
      signal.throwIfAborted();
      await progress?.(`Rendering ${example.id} (${theme})`);
      const { output } = await service.render("gallery", { spec: example.spec, theme, chartSvg: true }, signal);
      entries.push({ id: example.id, title: example.title, category: example.category, theme, artifact: output });
    }
    for (let offset = 0; offset < examples.length; offset += 4) {
      signal.throwIfAborted();
      const selectedExamples = examples.slice(offset, offset + 4);
      const cards: Node[] = [];
      for (const [index, example] of selectedExamples.entries()) {
        const theme = selected[index % selected.length]!;
        const entry = entries.find(entry => entry.id === example.id && entry.theme === theme)!;
        const bytes = await readFile(entry.artifact.pages[0]!.previewPath);
        cards.push({ type: "Image", props: { title: `${example.id} / ${theme}`, src: dataUrl(bytes), caption: example.title } });
      }
      const rows: Node[] = [];
      for (let index = 0; index < cards.length; index += 2) rows.push({ type: "Row", props: {}, children: cards.slice(index, index + 2) });
      const { output } = await service.render("gallery", { width: 1600, pageHeight: 2000, spec: report(`Visual atlas · ${Math.floor(offset / 4) + 1} of ${Math.ceil(examples.length / 4)}`, rows, "A preview of the library. Open the gallery for each full-size PNG and its exact JSON spec.") }, signal);
      overviews.push(output);
    }
    const indexPath = join(directory, "index.html"), manifestPath = join(directory, "gallery.json");
    const gallery: Gallery = { directory, indexPath, manifestPath, entries, overviews };
    const regular = dataUrl(await readFile(fontPaths[0]!), "font/ttf");
    const semibold = dataUrl(await readFile(fontPaths[1]!), "font/ttf");
    const sections: string[] = [];
    for (const category of [...new Set(examples.map(example => example.category))]) {
      const cards: string[] = [];
      for (const example of examples.filter(example => example.category === category)) {
        const variants: string[] = [];
        for (const entry of entries.filter(entry => entry.id === example.id)) {
          const spec = dataUrl(await readFile(entry.artifact.specPath), "application/json");
          const pages: string[] = [];
          for (const [index, page] of entry.artifact.pages.entries()) {
            const png = dataUrl(await readFile(page.path));
            pages.push(`<figure><button class="preview" aria-label="Enlarge ${escape(example.title)} ${entry.theme} page ${index + 1}"><img loading="lazy" src="${png}" alt="${escape(page.alt)}"></button><figcaption><span>${entry.theme} · ${page.width} × ${page.height}</span><a download="${entry.id}-${entry.theme}-${index + 1}.png" href="${png}">PNG ↓</a></figcaption></figure>`);
          }
          const vectors = await Promise.all(entry.artifact.charts.map(async (chart, index) => `<a download="${entry.id}-${entry.theme}-chart-${index + 1}.svg" href="${dataUrl(await readFile(chart.path), "image/svg+xml")}">Chart SVG ↓</a>`));
          variants.push(`<div class="variant">${pages.join("")}<div class="downloads"><a download="${entry.id}-${entry.theme}.json" href="${spec}">JSON spec ↓</a>${vectors.join("")}</div></div>`);
        }
        cards.push(`<article id="${example.id}"><div class="card-heading"><code>${escape(example.id)}</code><h3>${escape(example.title)}</h3></div><div class="variants">${variants.join("")}</div></article>`);
      }
      sections.push(`<section id="${category.toLowerCase()}"><h2>${escape(category)}</h2><div class="cards">${cards.join("")}</div></section>`);
    }
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'sha256-PLACEHOLDER'"><title>JSONUI — Visual library</title><style>
@font-face{font-family:Plex;src:url(${regular}) format('truetype');font-weight:400}@font-face{font-family:Plex;src:url(${semibold}) format('truetype');font-weight:600}
*{box-sizing:border-box}body{margin:0;background:#eef3f9;color:#152a40;font:16px/1.5 Plex,system-ui,sans-serif}header,main,footer{max-width:1400px;margin:auto;padding:40px}header{padding-top:64px}header p{max-width:760px;color:#53697e;font-size:20px}h1{font-size:clamp(38px,5vw,64px);line-height:1.08;letter-spacing:-2px;font-weight:600;margin:24px 0}h2{font-size:30px;font-weight:600;margin:48px 0 20px}h3{font-size:20px;font-weight:600;margin:8px 0 0}.eyebrow,code{color:#086b82;font-size:13px;letter-spacing:1px}.eyebrow{text-transform:uppercase;letter-spacing:3px}nav{display:flex;gap:12px;flex-wrap:wrap}nav a,.downloads a{padding:8px 12px;background:#e0ebf3;border-radius:8px}a{color:#086b82;text-decoration:none}a:hover{text-decoration:underline}a:focus-visible,button:focus-visible{outline:3px solid #086b82;outline-offset:4px}article{background:#fff;border:1px solid #d8e2ed;border-radius:20px;padding:24px;margin:24px 0}.card-heading{margin-bottom:20px}.variants{display:grid;grid-template-columns:repeat(${selected.length},minmax(0,1fr));gap:24px}.variant{min-width:0}figure{margin:0 0 12px}.preview{display:block;cursor:zoom-in;border:0;padding:0;background:none;width:100%}img{display:block;width:100%;height:auto;border-radius:12px}figcaption,.downloads{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;color:#53697e;margin-top:12px}.downloads{justify-content:flex-start}footer{color:#53697e;border-top:1px solid #d8e2ed}dialog{border:0;border-radius:16px;padding:16px;background:#eef3f9;width:min(96vw,1500px);max-height:96vh}dialog::backdrop{background:#0d1724cc}dialog button{position:sticky;top:0;display:block;margin:0 0 12px auto;border:0;background:#152a40;color:#fff;border-radius:8px;padding:10px 20px;cursor:pointer;font:inherit}@media(max-width:760px){header,main,footer{padding:24px}.variants{grid-template-columns:1fr}article{padding:16px}h1{letter-spacing:-1px}}
</style></head><body><header><div class="eyebrow">OpenCode V2 / Vercel json-render</div><h1>Data worth seeing.</h1><p>${examples.length} examples. ${selected.length === 2 ? "Two carefully tuned themes." : "One carefully tuned theme."} Charts, diagrams, metrics, and reports, with the exact inputs behind every image. All data is explicitly synthetic.</p><nav>${[...new Set(examples.map(example => example.category))].map(category => `<a href="#${category.toLowerCase()}">${escape(category)}</a>`).join("")}</nav></header><main>${sections.join("")}</main><footer>Generated locally · No external scripts, fonts, tracking, or image requests. PNG is the full report; SVG downloads contain standalone charts only.</footer><dialog><button type="button">Close preview</button><img alt="Expanded visual"></dialog><script>PREVIEW_SCRIPT</script></body></html>`;
    const script = `const d=document.querySelector('dialog'),i=d.querySelector('img');document.querySelectorAll('.preview').forEach(b=>b.addEventListener('click',()=>{const s=b.querySelector('img');i.src=s.src;i.alt=s.alt;d.showModal()}));d.querySelector('button').addEventListener('click',()=>d.close());d.addEventListener('click',e=>{if(e.target===d)d.close()});`;
    const hash = new Bun.CryptoHasher("sha256").update(script).digest("base64");
    signal.throwIfAborted();
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(indexPath, html.replace("sha256-PLACEHOLDER", `sha256-${hash}`).replace("PREVIEW_SCRIPT", script), { flag: "wx", mode: 0o600 });
    await writeFile(manifestPath, JSON.stringify(gallery, null, 2), { flag: "wx", mode: 0o600 });
    return gallery;
  } finally { await service.close(); }
}
