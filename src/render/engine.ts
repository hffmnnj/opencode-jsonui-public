import { renderToSvg } from "@json-render/image";
import type { Spec } from "@json-render/core";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { validateInput, type ValidatedInput } from "../catalog/validate.ts";
import { themes } from "../design/theme.ts";
import { fontPaths, loadFonts } from "../design/fonts.ts";
import { componentRegistry } from "../components/registry.tsx";
import { embedSvgFonts } from "../charts/render.ts";
import { prepareGraphics } from "./graphics.ts";
import { layoutPages } from "./layout.ts";
import { VisualError } from "../errors.ts";

export interface RenderedPage { png: Buffer; preview: Buffer; width: number; height: number; alt: string }
export interface RenderedReport { pages: RenderedPage[]; charts: { name: string; svg: string }[]; input: ValidatedInput; createdAt: string }

/** Runs in the private renderer worker. No filesystem input is taken from the spec. */
export async function renderReport(raw: unknown, createdAt = new Date().toISOString()): Promise<RenderedReport> {
  const input = validateInput(raw), theme = themes[input.theme];
  const layouts = await layoutPages(input);
  const fonts = await loadFonts();
  const pages: RenderedPage[] = [], charts: RenderedReport["charts"] = [];
  let outputBytes = 0, previewBytes = 0;
  for (const layout of layouts) {
    if (layout.width * layout.height * input.scale ** 2 > 12_800_000) throw new VisualError("LIMIT", "A page exceeds the physical pixel budget.");
    const graphics = await prepareGraphics(layout, input, theme);
    // The private node key binds precomputed layout to the official registry API.
    const spec: Spec = { root: layout.spec.root, elements: Object.fromEntries(Object.entries(layout.spec.elements).map(([id, element]) => [id, { ...element, props: { ...element.props, __node: id } }])) };
    const svg = await renderToSvg(spec, { includeStandard: false, registry: componentRegistry(layout, theme, graphics, createdAt), width: layout.width, height: layout.height, fonts });
    const png = Buffer.from(new Resvg(svg, { fitTo: { mode: "zoom", value: input.scale }, font: { fontFiles: fontPaths, loadSystemFonts: false } }).render().asPng());
    const preview = await sharp(png).resize({ width: 1440, height: 2000, fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
    if (preview.length > 2 * 1024 * 1024) throw new VisualError("LIMIT", "Preview exceeds 2 MiB. Split or simplify the report.");
    previewBytes += preview.length;
    if (previewBytes > 8 * 1024 * 1024) throw new VisualError("LIMIT", "Attached previews exceed 8 MiB. Split the report.");
    outputBytes += png.length + preview.length;
    if (outputBytes > 24 * 1024 * 1024) throw new VisualError("LIMIT", "Report exceeds the total artifact byte budget.");
    const report = layout.spec.elements[layout.spec.root]!;
    if (report.type !== "Report") throw new VisualError("RENDER", "Report root is missing.");
    pages.push({ png, preview, width: layout.width * input.scale, height: layout.height * input.scale, alt: `${report.props.title}. Page ${layout.index + 1} of ${layout.count}. Source: ${report.props.source}.${report.props.synthetic ? " Synthetic example data." : ""}` });
    if (input.chartSvg) for (const [name, graphic] of graphics) if (graphic.svg && layout.spec.elements[name]?.type === "Chart") {
      const svg = await embedSvgFonts(graphic.svg);
      outputBytes += Buffer.byteLength(svg);
      if (outputBytes > 24 * 1024 * 1024) throw new VisualError("LIMIT", "Report exceeds the total artifact byte budget. Disable chartSvg or split the report.");
      charts.push({ name, svg });
    }
  }
  return { pages, charts, input, createdAt };
}
