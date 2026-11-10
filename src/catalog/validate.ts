import { z } from "zod";
import { VisualError } from "../errors.ts";
import { definitions, renderInputSchema, type Element, type RenderInput, type VisualSpec } from "./schema.ts";
import type { Chart, TreeNode } from "./charts.ts";

/** Bound hostile JSON before recursive Zod/catalog/render traversal. */
export function boundJson(value: unknown): void {
  const pending = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  let count = 0, bytes = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++count > 24000 || item.depth > 32) throw new VisualError("LIMIT", "JSON exceeds the node or nesting limit.");
    if (typeof item.value === "string") bytes += Buffer.byteLength(item.value);
    else if (item.value && typeof item.value === "object") {
      if (seen.has(item.value)) throw new VisualError("VALIDATION", "Input must be a JSON tree, without shared or cyclic objects.");
      seen.add(item.value);
      const entries = Object.entries(item.value);
      if (entries.length > 2400) throw new VisualError("LIMIT", "A JSON collection is too large.");
      for (const [key, child] of entries) {
        if (["__proto__", "constructor", "prototype"].includes(key) || key.startsWith("$")) throw new VisualError("VALIDATION", "Prototype keys and dynamic expressions are not supported.", key);
        bytes += Buffer.byteLength(key);
        pending.push({ value: child, depth: item.depth + 1 });
      }
    } else if (typeof item.value === "number" && !Number.isFinite(item.value)) throw new VisualError("VALIDATION", "Numbers must be finite.");
    else if (["function", "bigint", "symbol", "undefined"].includes(typeof item.value)) throw new VisualError("VALIDATION", "Input must contain only JSON values.");
    if (bytes > 4 * 1024 * 1024) throw new VisualError("LIMIT", "Input exceeds the 4 MiB JSON budget.");
  }
}

export function dagLayers(ids: readonly string[], edges: readonly { from: string; to: string }[], path = ""): string[][] {
  if (new Set(ids).size !== ids.length) throw new VisualError("VALIDATION", "Node IDs must be unique.", path);
  const incoming = new Map(ids.map(id => [id, 0]));
  const outgoing = new Map(ids.map(id => [id, [] as string[]]));
  const links = new Set<string>();
  for (const edge of edges) {
    if (!incoming.has(edge.from) || !incoming.has(edge.to)) throw new VisualError("VALIDATION", "An edge references a missing node.", path);
    const key = JSON.stringify([edge.from, edge.to]);
    if (links.has(key)) throw new VisualError("VALIDATION", "Duplicate edges are not supported.", path);
    links.add(key);
    incoming.set(edge.to, incoming.get(edge.to)! + 1);
    outgoing.get(edge.from)!.push(edge.to);
  }
  let ready = ids.filter(id => incoming.get(id) === 0);
  const layers: string[][] = [];
  let visited = 0;
  while (ready.length) {
    layers.push(ready); visited += ready.length;
    const next: string[] = [];
    for (const id of ready) for (const to of outgoing.get(id)!) {
      incoming.set(to, incoming.get(to)! - 1);
      if (incoming.get(to) === 0) next.push(to);
    }
    ready = next;
  }
  if (visited !== ids.length) throw new VisualError("VALIDATION", "The graph contains a cycle.", path);
  return layers;
}

export function treeTotal(node: TreeNode, path = "tree"): number {
  const total = node.children ? node.children.reduce((sum, child) => sum + treeTotal(child, path), 0) : node.value!;
  if (node.children && node.value !== undefined && Math.abs(node.value - total) > 1e-8 * Math.max(1, total)) throw new VisualError("VALIDATION", "A hierarchy parent value must equal the sum of its children.", path);
  return total;
}

function unique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) throw new VisualError("VALIDATION", "Labels must be unique.", path);
}

export function validateChart(chart: Chart, path: string): void {
  if (chart.reference && !["line", "area", "bar", "scatter", "bubble", "boxplot", "waterfall", "candlestick"].includes(chart.kind)) throw new VisualError("VALIDATION", "Reference lines are supported only on Cartesian value charts.", path);
  if ("categories" in chart) {
    unique(chart.categories, path); unique(chart.series.map(series => series.name), path);
    for (const series of chart.series) if (series.values.length !== chart.categories.length) throw new VisualError("VALIDATION", "Every series must have exactly one value (or null) per category.", path);
  }
  if ("items" in chart) {
    unique(chart.items.map(item => item.name), path);
    if (chart.items.every(item => item.value === 0)) throw new VisualError("VALIDATION", "Composition charts require a positive total.", path);
  }
  if (chart.kind === "sunburst" && chart.data.reduce((sum, node) => sum + treeTotal(node, path), 0) <= 0) throw new VisualError("VALIDATION", "Sunburst requires a positive total.", path);
  if (chart.kind === "heatmap" || chart.kind === "cohort") {
    unique(chart.xLabels, path); unique(chart.yLabels, path);
    const cells = new Set<string>();
    for (const [x, y, value] of chart.cells) {
      if (x >= chart.xLabels.length || y >= chart.yLabels.length) throw new VisualError("VALIDATION", "Cell index exceeds its matrix dimensions.", path);
      const key = `${x},${y}`;
      if (cells.has(key)) throw new VisualError("VALIDATION", "Matrix cells must be unique.", path);
      cells.add(key);
      if (chart.kind === "cohort" && value !== null && (value < 0 || value > 100)) throw new VisualError("VALIDATION", "Cohort values must be percentages from 0 to 100.", path);
    }
  }
  if (chart.kind === "calendar") {
    unique(chart.points.map(point => point.date), path);
    if (chart.points.some(point => !point.date.startsWith(`${chart.year}-`))) throw new VisualError("VALIDATION", "All calendar points must be in the selected year.", path);
  }
  if (chart.kind === "sankey") dagLayers(chart.nodes, chart.links.map(link => ({ from: link.source, to: link.target })), path);
  if (chart.kind === "candlestick") for (const candle of chart.candles) {
    if (candle.low > Math.min(candle.open, candle.close) || candle.high < Math.max(candle.open, candle.close)) throw new VisualError("VALIDATION", "Candle low/high must enclose open and close.", path);
  }
  if (chart.kind === "bullet" && Math.max(chart.value, chart.target) > chart.maximum) throw new VisualError("VALIDATION", "Bullet value and target cannot exceed maximum.", path);
}

function semantic(element: Element, path: string): void {
  if (element.type === "Chart") validateChart(element.props, path);
  if (element.type === "Progress" && element.props.value > element.props.maximum) throw new VisualError("VALIDATION", "Progress cannot exceed maximum.", path);
  if (element.type === "Flow") dagLayers(element.props.nodes.map(node => node.id), element.props.edges, path);
  if (element.type === "Hierarchy") treeTotal(element.props.data, path);
  if (element.type === "Gantt" && element.props.tasks.some(task => task.end < task.start)) throw new VisualError("VALIDATION", "Task end must not precede start.", path);
  if (element.type === "Timeline" && element.props.events.some((event, index, events) => index > 0 && event.date < events[index - 1]!.date)) throw new VisualError("VALIDATION", "Timeline events must be chronological.", path);
  if (element.type === "Table") {
    const keys = element.props.columns.map(column => column.key); unique(keys, path);
    for (const row of element.props.rows) {
      if (Object.keys(row).some(key => !keys.includes(key))) throw new VisualError("VALIDATION", "A table row contains an undeclared column.", path);
      for (const column of element.props.columns) if (column.format && typeof row[column.key] === "string") throw new VisualError("VALIDATION", "Formatted table cells require numbers or null.", path);
    }
  }
}

export function validateInput(raw: unknown): Omit<RenderInput, "spec"> & { spec: VisualSpec } {
  boundJson(raw);
  try {
    const parsed = renderInputSchema.parse(raw);
    const entries = Object.entries(parsed.spec.elements);
    if (entries.length > 256) throw new VisualError("LIMIT", "At most 256 components are supported.");
    const elements: Record<string, Element> = Object.create(null);
    for (const [id, item] of entries) {
      if (!Object.hasOwn(definitions, item.type)) throw new VisualError("VALIDATION", "Unknown component type.", `elements.${id}.type`);
      const definition = definitions[item.type as keyof typeof definitions];
      const result = definition.props.safeParse(item.props);
      if (!result.success) {
        const issue = result.error.issues[0]!;
        throw new VisualError("VALIDATION", issue.message, ["elements", id, "props", ...issue.path].join("."));
      }
      const props = result.data;
      const element = { type: item.type, props, children: item.children } as Element;
      if (definition.slots.length === 0 && element.children.length) throw new VisualError("VALIDATION", "Leaf components cannot have children.", `elements.${id}.children`);
      if (element.type === "Row" && (element.children.length < 1 || element.children.length > 3)) throw new VisualError("LAYOUT", "Rows contain one to three columns.", `elements.${id}`);
      semantic(element, `elements.${id}.props`);
      elements[id] = element;
    }
    if (elements[parsed.spec.root]?.type !== "Report") throw new VisualError("VALIDATION", "The root must reference a Report component.", "root");
    const visited = new Set<string>();
    const pending = [{ id: parsed.spec.root, depth: 0 }];
    while (pending.length) {
      const { id, depth } = pending.pop()!;
      if (depth > 16) throw new VisualError("LIMIT", "Component nesting exceeds 16 levels.", id);
      if (visited.has(id)) throw new VisualError("VALIDATION", "Components must form a tree; cycles and shared children are not supported.", id);
      visited.add(id);
      const element = elements[id];
      if (!element) throw new VisualError("VALIDATION", "A child reference does not exist.", id);
      if (id !== parsed.spec.root && element.type === "Report") throw new VisualError("VALIDATION", "Report may only appear at the root.", id);
      for (const child of element.children) pending.push({ id: child, depth: depth + 1 });
    }
    if (visited.size !== entries.length) throw new VisualError("VALIDATION", "Remove unreachable components; all supplied content must be rendered.", "elements");
    return { ...parsed, spec: { root: parsed.spec.root, elements } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0]!;
      throw new VisualError("VALIDATION", issue.message, issue.path.join("."));
    }
    throw error;
  }
}
export type ValidatedInput = ReturnType<typeof validateInput>;
