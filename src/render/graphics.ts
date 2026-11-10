import sharp from "sharp";
import type { ValidatedInput } from "../catalog/validate.ts";
import type { PageLayout } from "./layout.ts";
import type { Theme } from "../design/theme.ts";
import { chartOptions, flowOptions, hierarchyOptions, renderOption, sparklineOptions } from "../charts/render.ts";
import { VisualError } from "../errors.ts";
import { textMetrics } from "../design/fonts.ts";

export interface Graphic { png: Buffer; svg?: string; width: number; height: number; imageBounds?: { left: number; top: number; width: number; height: number } }

export async function prepareGraphics(page: PageLayout, input: ValidatedInput, theme: Theme): Promise<Map<string, Graphic>> {
  const graphics = new Map<string, Graphic>();
  for (const [id, element] of Object.entries(page.spec.elements)) {
    const box = page.boxes.get(id)!;
    const width = Math.floor(box.width - 48);
    if (element.type === "Chart") graphics.set(id, await renderOption(chartOptions(element.props, theme, width), width, element.props.height, input.scale));
    if (element.type === "Metric" && element.props.history) graphics.set(id, await renderOption(sparklineOptions(element.props.history, theme), width, 64, input.scale));
    if (element.type === "Sparkline") graphics.set(id, await renderOption(sparklineOptions(element.props.values, theme), width, 94, input.scale));
    if (element.type === "Flow") {
      const height = box.plotHeight!;
      graphics.set(id, await renderOption(flowOptions(element.props, theme, width, height, box.lines), width, height, input.scale));
    }
    if (element.type === "Hierarchy") {
      const metrics = await textMetrics();
      graphics.set(id, await renderOption(hierarchyOptions(element.props, theme, name => metrics.lines(name, 120, 15).join("\n")), width, 420, input.scale));
    }
    if (element.type === "Image") {
      const [prefix, content] = element.props.src.split(",");
      const bytes = Buffer.from(content!, "base64");
      if (bytes.length > 1_100_000) throw new VisualError("LIMIT", "Image exceeds the 1.1 MB encoded-asset budget.", id);
      try {
        const image = sharp(bytes, { limitInputPixels: 8_000_000, failOn: "warning" });
        const metadata = await image.metadata();
        if (!metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096 || (metadata.pages ?? 1) > 1) throw new VisualError("LIMIT", "Image dimensions/frames exceed limits.", id);
        if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format) || prefix !== `data:image/${metadata.format};base64`) throw new VisualError("VALIDATION", "Image MIME must match its actual raster format.", id);
        const fit = Math.min(width / metadata.width, 320 / metadata.height);
        const imageWidth = metadata.width * fit, imageHeight = metadata.height * fit;
        const png = await image.resize(width * input.scale, 320 * input.scale, { fit: "contain", background: theme.inset }).png().toBuffer();
        graphics.set(id, { png, width, height: 320, imageBounds: { left: (width - imageWidth) / 2, top: (320 - imageHeight) / 2, width: imageWidth, height: imageHeight } });
      } catch (error) {
        if (error instanceof VisualError) throw error;
        throw new VisualError("VALIDATION", "Image is invalid or exceeds decoded limits.", id);
      }
    }
  }
  return graphics;
}
