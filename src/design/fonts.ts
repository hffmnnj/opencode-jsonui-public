import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { RenderOptions } from "@json-render/image";
import { create, type Font } from "fontkit";

export const fontPaths = [
  "IBMPlexSans-Regular.ttf", "IBMPlexSans-SemiBold.ttf", "IBMPlexMono-Regular.ttf",
].map(name => fileURLToPath(new URL(`../../assets/fonts/${name}`, import.meta.url)));

let cached: Promise<NonNullable<RenderOptions["fonts"]>> | undefined;
export function loadFonts(): Promise<NonNullable<RenderOptions["fonts"]>> {
  return cached ??= Promise.all(fontPaths.map(async (path, index) => ({
    name: index === 2 ? "IBM Plex Mono" : "IBM Plex Sans",
    data: await readFile(path), weight: index === 1 ? 600 as const : 400 as const,
    style: "normal" as const,
  })));
}

let faces: Promise<Font[]> | undefined;
export async function textMetrics() {
  const fonts = await (faces ??= Promise.all(fontPaths.map(async path => {
    const face = create(await readFile(path));
    if ("fonts" in face) throw new Error("Expected a single static font.");
    return face;
  })));
  const measure = (text: string, size: number, weight = 400, mono = false) => {
    const face = fonts[mono ? 2 : weight >= 600 ? 1 : 0]!;
    return face.layout(text).positions.reduce((sum, position) => sum + position.xAdvance, 0) * size / face.unitsPerEm;
  };
  const lines = (text: string, width: number, size: number, weight = 400) => {
    const result: string[] = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (measure(word, size, weight) > width) {
          if (line) { result.push(line); line = ""; }
          for (const character of word) {
            if (line && measure(line + character, size, weight) > width) { result.push(line); line = ""; }
            line += character;
          }
        } else {
          const candidate = line ? `${line} ${word}` : word;
          if (line && measure(candidate, size, weight) > width) { result.push(line); line = word; }
          else line = candidate;
        }
      }
      result.push(line);
    }
    return result;
  };
  return { measure, lines };
}
