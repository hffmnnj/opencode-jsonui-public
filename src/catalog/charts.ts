import { z } from "zod";

export const number = z.number().finite().min(-1e12).max(1e12);
export const label = z.string().min(1).max(90);
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}, "Use a valid ISO calendar date (YYYY-MM-DD).");
export const formatSchema = z.object({
  style: z.enum(["number", "currency", "percent", "duration"]).default("number"),
  currency: z.enum(["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "INR"]).default("USD"),
  decimals: z.number().int().min(0).max(4).default(0), compact: z.boolean().default(false),
}).strict();
export type ValueFormat = z.infer<typeof formatSchema>;
const common = {
  title: label,
  caption: z.string().max(240).optional(),
  height: z.number().int().min(300).max(720).default(400),
  xLabel: z.string().max(70).optional(), yLabel: z.string().max(70).optional(),
  format: formatSchema.optional(),
  reference: z.object({ value: number, label }).strict().optional(),
};
const cartesian = {
  categories: z.array(z.string().min(1).max(48)).min(1).max(32),
  series: z.array(z.object({ name: label, values: z.array(number.nullable()).min(1).max(32) }).strict()).min(1).max(6),
  stacked: z.boolean().default(false),
};
const items = z.array(z.object({ name: label, value: number.min(0) }).strict()).min(1).max(18);
export interface TreeNode { name: string; value?: number; children?: TreeNode[] }
export const treeSchema: z.ZodType<TreeNode> = z.lazy(() => z.object({
  name: label, value: number.min(0).optional(), children: z.array(treeSchema).min(1).max(12).optional(),
}).strict().refine(node => node.children !== undefined || node.value !== undefined, "Leaves require a value."));
const matrix = {
  xLabels: z.array(z.string().min(1).max(36)).min(1).max(31),
  yLabels: z.array(z.string().min(1).max(36)).min(1).max(16),
  cells: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative(), number.nullable()])).max(496),
};

export const chartSchemas = {
  line: z.object({ ...common, kind: z.literal("line"), ...cartesian }).strict(),
  area: z.object({ ...common, kind: z.literal("area"), ...cartesian }).strict(),
  bar: z.object({ ...common, kind: z.literal("bar"), ...cartesian, horizontal: z.boolean().default(false) }).strict(),
  pie: z.object({ ...common, kind: z.literal("pie"), items }).strict(),
  donut: z.object({ ...common, kind: z.literal("donut"), items }).strict(),
  funnel: z.object({ ...common, kind: z.literal("funnel"), items }).strict(),
  treemap: z.object({ ...common, kind: z.literal("treemap"), items }).strict(),
  sunburst: z.object({ ...common, kind: z.literal("sunburst"), data: z.array(treeSchema).min(1).max(12) }).strict(),
  scatter: z.object({ ...common, kind: z.literal("scatter"), points: z.array(z.object({ x: number, y: number, name: label.optional() }).strict()).min(1).max(500) }).strict(),
  bubble: z.object({ ...common, kind: z.literal("bubble"), points: z.array(z.object({ x: number, y: number, size: number.min(0), name: label.optional() }).strict()).min(1).max(500) }).strict(),
  histogram: z.object({ ...common, kind: z.literal("histogram"), samples: z.array(number).min(1).max(2000), bins: z.number().int().min(2).max(30).default(10) }).strict(),
  boxplot: z.object({ ...common, kind: z.literal("boxplot"), groups: z.array(z.object({ name: label, samples: z.array(number).min(2).max(500) }).strict()).min(1).max(12) }).strict(),
  heatmap: z.object({ ...common, kind: z.literal("heatmap"), ...matrix }).strict(),
  cohort: z.object({ ...common, kind: z.literal("cohort"), ...matrix }).strict(),
  calendar: z.object({ ...common, kind: z.literal("calendar"), year: z.number().int().min(1970).max(2100), points: z.array(z.object({ date, value: number.min(0) }).strict()).min(1).max(366) }).strict(),
  waterfall: z.object({ ...common, kind: z.literal("waterfall"), start: number.default(0), steps: z.array(z.object({ name: label, value: number }).strict()).min(1).max(20) }).strict(),
  sankey: z.object({ ...common, kind: z.literal("sankey"), nodes: z.array(label).min(2).max(24), links: z.array(z.object({ source: label, target: label, value: number.positive() }).strict()).min(1).max(48) }).strict(),
  candlestick: z.object({ ...common, kind: z.literal("candlestick"), candles: z.array(z.object({ label, open: number, close: number, low: number, high: number }).strict()).min(1).max(32) }).strict(),
  bullet: z.object({ ...common, kind: z.literal("bullet"), value: number.min(0), target: number.positive(), maximum: number.positive() }).strict(),
} as const;

export const chartSchema = z.discriminatedUnion("kind", [
  chartSchemas.line, chartSchemas.area, chartSchemas.bar, chartSchemas.pie, chartSchemas.donut,
  chartSchemas.funnel, chartSchemas.treemap, chartSchemas.sunburst, chartSchemas.scatter,
  chartSchemas.bubble, chartSchemas.histogram, chartSchemas.boxplot, chartSchemas.heatmap,
  chartSchemas.cohort, chartSchemas.calendar, chartSchemas.waterfall, chartSchemas.sankey,
  chartSchemas.candlestick, chartSchemas.bullet,
]);
export type Chart = z.infer<typeof chartSchema>;
export type ChartKind = Chart["kind"];
