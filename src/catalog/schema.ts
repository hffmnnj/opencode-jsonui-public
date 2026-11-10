import { z } from "zod";
import { defineCatalog } from "@json-render/core";
import { schema as imageSchema } from "@json-render/image/server";
import { chartSchema, date, formatSchema, label, number, treeSchema } from "./charts.ts";

const gap = z.number().int().min(0).max(48).default(20);
const flowNodes = z.array(z.object({ id: z.string().regex(/^[a-zA-Z][\w-]{0,39}$/), label: z.string().min(1).max(40) }).strict()).min(1).max(16);
export const definitions = {
  Report: { props: z.object({ title: z.string().min(1).max(120), subtitle: z.string().max(240).optional(), source: z.string().min(1).max(180), period: z.string().max(100).optional(), note: z.string().max(240).optional(), synthetic: z.boolean().default(false) }).strict(), description: "Root report with title, source, time window, and automatic pagination.", slots: ["default"] },
  Row: { props: z.object({ gap }).strict(), description: "One to three equal-width columns. Use full width for dense charts.", slots: ["default"] },
  Column: { props: z.object({ gap }).strict(), description: "Vertical content stack.", slots: ["default"] },
  Card: { props: z.object({ title: label.optional() }).strict(), description: "A quiet inset container for text and small primitives.", slots: ["default"] },
  Heading: { props: z.object({ text: z.string().min(1).max(160), level: z.enum(["section", "subsection"]).default("section") }).strict(), description: "Section heading.", slots: [] },
  Text: { props: z.object({ text: z.string().min(1).max(2000), tone: z.enum(["normal", "muted"]).default("normal") }).strict(), description: "Readable wrapped body text, not HTML or Markdown.", slots: [] },
  Badge: { props: z.object({ text: z.string().min(1).max(60), tone: z.enum(["neutral", "positive", "negative"]).default("neutral") }).strict(), description: "Labeled status, never color alone.", slots: [] },
  Divider: { props: z.object({}).strict(), description: "Subtle section rule.", slots: [] },
  Icon: { props: z.object({ name: z.enum(["chart", "trend", "clock", "check", "alert", "layers"]), label: z.string().min(1).max(70) }).strict(), description: "A contextual vector icon with visible label.", slots: [] },
  Metric: { props: z.object({ label, value: number, format: formatSchema.optional(), change: number.optional(), changeUnit: z.enum(["percent", "percentagePoints", "absolute"]).default("percent"), favorable: z.enum(["up", "down", "neutral"]).default("up"), comparison: z.string().max(100).optional(), history: z.array(number.nullable()).min(2).max(40).optional() }).strict(), description: "KPI with explicit delta semantics and optional sparkline. Change is in percentage units when percent/percentagePoints.", slots: [] },
  Sparkline: { props: z.object({ title: label, values: z.array(number.nullable()).min(2).max(80) }).strict(), description: "Compact trend with missing-data gaps.", slots: [] },
  Progress: { props: z.object({ label, value: number.min(0), maximum: number.positive(), format: formatSchema.optional() }).strict(), description: "A bounded progress bar with value and total.", slots: [] },
  Chart: { props: chartSchema, description: "Typed ECharts analytics. Discover individual kinds through catalog(category: charts).", slots: [] },
  Table: { props: z.object({ title: label, columns: z.array(z.object({ key: z.string().regex(/^[a-zA-Z][\w-]{0,39}$/), label: z.string().min(1).max(50), format: formatSchema.optional() }).strict()).min(1).max(6), rows: z.array(z.record(z.string(), z.union([number, z.string().max(140), z.null()]))).min(1).max(200) }).strict(), description: "Formatted table; long top-level tables are paginated without dropping rows. Missing cells display an em dash.", slots: [] },
  Insight: { props: z.object({ title: label, text: z.string().min(1).max(800), caveat: z.string().max(240).optional() }).strict(), description: "Takeaway and caveat. Content is supplied, not inferred by the renderer.", slots: [] },
  Timeline: { props: z.object({ title: label, events: z.array(z.object({ date, title: z.string().min(1).max(70), detail: z.string().max(180).optional() }).strict()).min(1).max(12) }).strict(), description: "Chronologically ordered milestones with detail.", slots: [] },
  Gantt: { props: z.object({ title: label, tasks: z.array(z.object({ label: z.string().min(1).max(40), start: date, end: date, progress: z.number().min(0).max(1).default(0) }).strict()).min(1).max(14) }).strict(), description: "Inclusive calendar-day roadmap with completion overlays.", slots: [] },
  Flow: { props: z.object({ title: label, nodes: flowNodes, edges: z.array(z.object({ from: z.string(), to: z.string() }).strict()).max(24) }).strict(), description: "Deterministic left-to-right DAG. No cycles or force simulation.", slots: [] },
  Hierarchy: { props: z.object({ title: label, data: treeSchema }).strict(), description: "Labeled hierarchical tree; leaf values supplied explicitly.", slots: [] },
  Image: { props: z.object({ title: label, src: z.string().max(1_500_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/), caption: z.string().max(240).optional(), markers: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), label: z.string().min(1).max(70) }).strict()).max(6).default([]) }).strict(), description: "Offline raster image with numbered annotations. PNG/JPEG/WebP data URLs only, bounded decoded dimensions.", slots: [] },
} satisfies Record<string, { props: z.ZodType; description: string; slots: string[] }>;

export const catalog = defineCatalog(imageSchema, { components: definitions });
export type ComponentName = keyof typeof definitions;
export type Props<K extends ComponentName> = z.infer<(typeof definitions)[K]["props"]>;
export type Element = { [K in ComponentName]: { type: K; props: Props<K>; children: string[] } }[ComponentName];
export interface VisualSpec { root: string; elements: Record<string, Element> }

const elementSchema = z.object({ type: z.string().min(1).max(40), props: z.record(z.string(), z.unknown()), children: z.array(z.string().max(80)).max(64).default([]) }).strict();
export const rawSpecSchema = z.object({ root: z.string().min(1).max(80), elements: z.record(z.string().min(1).max(80), elementSchema) }).strict();
export const renderInputSchema = z.object({
  spec: rawSpecSchema,
  theme: z.enum(["light", "dark"]).default("light"),
  width: z.number().int().min(720).max(1600).default(1200),
  pageHeight: z.number().int().min(900).max(2000).default(1600),
  scale: z.union([z.literal(1), z.literal(2)]).default(1),
  chartSvg: z.boolean().default(false),
}).strict();
export type RenderInput = z.infer<typeof renderInputSchema>;
