import { resolve } from "node:path";
import { VisualService } from "../src/service.ts";
import { getExamples } from "../examples/catalog.ts";

const id = process.argv[2] ?? "dashboard", theme = process.argv[3] ?? "light";
const example = (await getExamples()).find(example => example.id === id);
if (!example) throw new Error("Unknown example");
const service = new VisualService({ outputDirectory: resolve(".artifacts") });
try {
  const result = await service.render("local-preview", { spec: example.spec, theme, chartSvg: true }, AbortSignal.timeout(60000));
  console.log(JSON.stringify(result.output, null, 2));
} finally { await service.close(); }
