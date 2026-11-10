import { renderReport } from "./engine.ts";
import { publicError } from "../errors.ts";

try {
  const raw = await Bun.stdin.text();
  if (Buffer.byteLength(raw) > 5 * 1024 * 1024) throw new Error("Worker input exceeds budget");
  const request = JSON.parse(raw) as { input: unknown; createdAt: string };
  const report = await renderReport(request.input, request.createdAt);
  process.stdout.write(JSON.stringify({ ok: true, report: { ...report, pages: report.pages.map(page => ({ ...page, png: page.png.toString("base64"), preview: page.preview.toString("base64") })) } }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: JSON.parse(publicError(error)) }));
  process.exitCode = 1;
}
