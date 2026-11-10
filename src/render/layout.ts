import type { Element, Props, VisualSpec } from "../catalog/schema.ts";
import { dagLayers, type ValidatedInput } from "../catalog/validate.ts";
import type { Chart, TreeNode } from "../catalog/charts.ts";
import { textMetrics } from "../design/fonts.ts";
import { spacing } from "../design/theme.ts";
import { VisualError } from "../errors.ts";
import { formatValue } from "../charts/math.ts";

export interface Box {
  width: number;
  height: number;
  lines: Record<string, string[]>;
  rowHeights?: number[];
  columns?: number[];
  plotHeight?: number;
}
export interface PageLayout { spec: VisualSpec; boxes: Map<string, Box>; width: number; height: number; index: number; count: number }
export type Metrics = Awaited<ReturnType<typeof textMetrics>>;
export const tableValue = (value: string | number | null | undefined, format?: Props<"Table">["columns"][number]["format"]) => value == null ? "—" : typeof value === "number" ? formatValue(value, format) : value;

function chartLabelBudget(chart: Chart, width: number, metrics: Metrics, id: string): void {
  const fail = () => { throw new VisualError("LAYOUT", "Chart labels are too dense. Use a wider report, shorter labels, or split the data into separate charts.", id); };
  const categoryLabels = "categories" in chart ? chart.categories : chart.kind === "boxplot" ? chart.groups.map(group => group.name) : chart.kind === "candlestick" ? chart.candles.map(candle => candle.label) : chart.kind === "waterfall" ? ["Opening", ...chart.steps.map(step => step.name), "Closing"] : [];
  if (chart.kind === "bar" && chart.horizontal) {
    if (categoryLabels.some(label => metrics.measure(label, 14) > width * 0.4) || categoryLabels.length * 24 > chart.height - 65) fail();
  } else if (categoryLabels.some(label => metrics.measure(label, 14) > (width - 130) / categoryLabels.length - 8)) fail();
  if ("series" in chart && chart.series.some(series => metrics.measure(series.name, 14) > 190)) fail();
  if (chart.kind === "pie" || chart.kind === "donut") {
    if (width < 540 || chart.items.some(item => metrics.measure(`${item.name}  ${formatValue(item.value, chart.format)}`, 15) > width * 0.4)) fail();
  }
  if (chart.kind === "heatmap" || chart.kind === "cohort") {
    if (chart.xLabels.some(label => metrics.measure(label, 14) > (width - 150) / chart.xLabels.length - 8) || chart.yLabels.some(label => metrics.measure(label, 14) > 125) || chart.yLabels.length * 23 > chart.height - 100) fail();
  }
}

function treeDimensions(node: TreeNode): { depth: number; leaves: number } {
  const children = node.children?.map(treeDimensions);
  return children ? { depth: 1 + Math.max(...children.map(child => child.depth)), leaves: children.reduce((sum, child) => sum + child.leaves, 0) } : { depth: 1, leaves: 1 };
}

export async function layoutPages(input: ValidatedInput): Promise<PageLayout[]> {
  const metrics = await textMetrics();
  const root = input.spec.elements[input.spec.root]!;
  if (root.type !== "Report") throw new VisualError("VALIDATION", "Root must be a Report.");
  const elements = { ...input.spec.elements };
  const contentWidth = input.width - spacing.page * 2;
  const titleSize = input.width < 1000 ? 34 : 42;
  const rootLines = {
    title: metrics.lines(root.props.title, contentWidth, titleSize, 600),
    subtitle: root.props.subtitle ? metrics.lines(root.props.subtitle, contentWidth, 20) : [],
    source: metrics.lines(`Source: ${root.props.source}${root.props.period ? `  ·  ${root.props.period}` : ""}`, contentWidth, 14),
    note: root.props.note ? metrics.lines(root.props.note, contentWidth, 14) : [],
  };
  const header = 22 + 18 + rootLines.title.length * titleSize * 1.2 + (rootLines.subtitle.length ? 12 + rootLines.subtitle.length * 28 : 0) + 28;
  const footer = 30 + rootLines.source.length * 21 + rootLines.note.length * 21 + 22;
  const overhead = spacing.page * 2 + header + footer;
  const budget = input.pageHeight - overhead;
  if (budget < 300) throw new VisualError("LAYOUT", "Report header/footer leave too little room. Shorten text or increase pageHeight.");

  function measure(id: string, width: number, boxes: Map<string, Box>): Box {
    const element = elements[id]!;
    if (width < 190) throw new VisualError("LAYOUT", "A column is too narrow. Use fewer columns or a wider report.", id);
    const inner = width - spacing.panel * 2;
    const lines: Record<string, string[]> = {};
    const wrap = (key: string, text: string, size = 18, weight = 400, available = inner) => {
      lines[key] = metrics.lines(text, available, size, weight);
      return lines[key]!.length * size * 1.4;
    };
    let height = 0;
    const box: Box = { width, height, lines };
    switch (element.type) {
      case "Row": {
        const each = (width - element.props.gap * (element.children.length - 1)) / element.children.length;
        height = Math.max(0, ...element.children.map(child => measure(child, each, boxes).height)); break;
      }
      case "Column": height = element.children.reduce((sum, child) => sum + measure(child, width, boxes).height, 0) + element.props.gap * Math.max(0, element.children.length - 1); break;
      case "Card": height = 48 + (element.props.title ? wrap("title", element.props.title, 21, 600) + 16 : 0) + element.children.reduce((sum, child) => sum + measure(child, inner, boxes).height, 0) + 16 * Math.max(0, element.children.length - 1); break;
      case "Heading": height = wrap("text", element.props.text, element.props.level === "section" ? 28 : 22, 600, width) + 8; break;
      case "Text": height = wrap("text", element.props.text, 19, 400, width); break;
      case "Badge": height = wrap("text", element.props.text, 16, 400, width - 24) + 16; break;
      case "Divider": height = 1; break;
      case "Icon": height = wrap("text", element.props.label, 18, 400, width - 40); break;
      case "Metric": {
        height = 48 + wrap("label", element.props.label, 17) + 14 + 58;
        const value = formatValue(element.props.value, element.props.format);
        if (metrics.measure(value, 44, 400, true) > inner) throw new VisualError("LAYOUT", "Metric value is too wide. Use compact formatting or fewer columns.", id);
        if (element.props.change !== undefined) height += 36;
        if (element.props.comparison) height += wrap("comparison", element.props.comparison, 14) + 4;
        if (element.props.history) height += 78;
        break;
      }
      case "Sparkline": height = 48 + wrap("title", element.props.title, 19, 600) + 110; break;
      case "Progress": height = 48 + wrap("label", element.props.label, 18, 600) + 64; break;
      case "Chart": {
        if (width < 400) throw new VisualError("LAYOUT", "Charts need at least 400 logical pixels. Use one or two columns.", id);
        chartLabelBudget(element.props, inner, metrics, id);
        height = 48 + wrap("title", element.props.title, 21, 600) + 20 + element.props.height;
        if (element.props.caption) height += 14 + wrap("caption", element.props.caption, 15);
        if ((element.props.kind === "pie" || element.props.kind === "donut") && element.props.items.length * 32 > element.props.height) throw new VisualError("LAYOUT", "Increase chart height to fit the composition legend.", id);
        break;
      }
      case "Table": {
        if (width < 420) throw new VisualError("LAYOUT", "Tables need at least 420 logical pixels.", id);
        const columnWidth = inner / element.props.columns.length;
        if (columnWidth < 78) throw new VisualError("LAYOUT", "Table columns are too narrow.", id);
        box.columns = element.props.columns.map(() => columnWidth);
        const rowHeights = element.props.rows.map((row, index) => Math.max(38, ...element.props.columns.map((column, col) => wrap(`cell:${index}:${col}`, tableValue(row[column.key], column.format), 15, 400, columnWidth - 18) + 20)));
        const headingHeight = Math.max(...element.props.columns.map((column, col) => wrap(`column:${col}`, column.label, 14, 600, columnWidth - 18))) + 24;
        box.rowHeights = [headingHeight, ...rowHeights];
        height = 48 + wrap("title", element.props.title, 21, 600) + 20 + box.rowHeights.reduce((sum, value) => sum + value, 0);
        break;
      }
      case "Insight": height = 48 + wrap("title", element.props.title, 22, 600) + 14 + wrap("text", element.props.text, 20) + (element.props.caveat ? wrap("caveat", element.props.caveat, 15) + 22 : 0); break;
      case "Timeline":
        if (width < 420) throw new VisualError("LAYOUT", "Timeline needs at least 420 pixels.", id);
        height = 48 + wrap("title", element.props.title, 21, 600) + 20 + element.props.events.reduce((sum, event, index) => sum + 28 + wrap(`event:${index}`, event.title, 18, 600, inner - 155) + (event.detail ? wrap(`detail:${index}`, event.detail, 16, 400, inner - 155) : 0), 0); break;
      case "Gantt": {
        if (width < 540) throw new VisualError("LAYOUT", "Gantt needs at least 540 pixels.", id);
        const labelWidth = Math.min(190, inner * 0.3);
        box.rowHeights = element.props.tasks.map((task, index) => Math.max(50, wrap(`task:${index}`, task.label, 15, 400, labelWidth - 12) + 16));
        height = 48 + wrap("title", element.props.title, 21, 600) + 76 + box.rowHeights.reduce((sum, value) => sum + value, 0); break;
      }
      case "Flow": {
        const layers = dagLayers(element.props.nodes.map(node => node.id), element.props.edges);
        const nodeWidth = Math.min(120, inner / Math.max(2, layers.length) - 24);
        if (nodeWidth < 100 || layers.some(layer => layer.length > 5)) throw new VisualError("LAYOUT", "Flow is too dense. Use a wider report or split the graph.", id);
        for (const node of element.props.nodes) {
          wrap(`node:${node.id}`, node.label, 14, 400, nodeWidth - 20);
          if (lines[`node:${node.id}`]!.length > 2) throw new VisualError("LAYOUT", "Flow labels must fit two lines. Shorten labels or widen the report.", id);
        }
        box.plotHeight = Math.max(280, Math.max(...layers.map(layer => layer.length)) * (nodeWidth + 40) + 40);
        height = 48 + wrap("title", element.props.title, 21, 600) + 20 + box.plotHeight; break;
      }
      case "Hierarchy": {
        const dimensions = treeDimensions(element.props.data);
        if (inner < dimensions.depth * 160 || dimensions.leaves > 8) throw new VisualError("LAYOUT", "Hierarchy is too dense. Use a wider report or split into subtrees (at most eight leaves).", id);
        const visit = (node: TreeNode) => {
          if (metrics.lines(node.name, 120, 15).length > 2) throw new VisualError("LAYOUT", "Hierarchy labels must fit two lines. Shorten the label.", id);
          node.children?.forEach(visit);
        };
        visit(element.props.data);
        height = 48 + wrap("title", element.props.title, 21, 600) + 20 + 420; break;
      }
      case "Image": height = 48 + wrap("title", element.props.title, 21, 600) + 20 + 320 + (element.props.caption ? 14 + wrap("caption", element.props.caption, 15) : 0) + element.props.markers.reduce((sum, marker, index) => sum + 8 + wrap(`marker:${index}`, `${index + 1}. ${marker.label}`, 15), 0); break;
      case "Report": throw new VisualError("VALIDATION", "Nested reports are not supported.", id);
    }
    box.height = Math.ceil(height);
    boxes.set(id, box);
    return box;
  }

  // Split only top-level tables; nested layouts stay together rather than losing content.
  const blocks: string[] = [];
  for (const id of root.children) {
    const element = elements[id]!;
    const box = measure(id, contentWidth, new Map());
    if (box.height <= budget || element.type !== "Table") { blocks.push(id); continue; }
    const rowHeights = box.rowHeights!.slice(1);
    const fixed = box.height - rowHeights.reduce((sum, height) => sum + height, 0);
    let begin = 0;
    while (begin < element.props.rows.length) {
      let end = begin, height = fixed;
      while (end < rowHeights.length && height + rowHeights[end]! <= budget) height += rowHeights[end++]!;
      if (end === begin) throw new VisualError("LAYOUT", "A table row is too tall for a page.", id);
      const newID = `${id}--part-${begin}`;
      if (elements[newID]) throw new VisualError("VALIDATION", "Component ID collides with pagination ID.", id);
      elements[newID] = { ...element, props: { ...element.props, rows: element.props.rows.slice(begin, end) } };
      blocks.push(newID); begin = end;
    }
  }
  const groups: string[][] = [];
  let group: string[] = [], used = 0;
  for (const id of blocks) {
    const height = measure(id, contentWidth, new Map()).height;
    if (height > budget) throw new VisualError("LAYOUT", "A content block is too tall. Split nested content or increase pageHeight.", id);
    if (group.length && used + spacing.gap + height > budget) { groups.push(group); group = []; used = 0; }
    used += (group.length ? spacing.gap : 0) + height; group.push(id);
  }
  if (group.length || !groups.length) groups.push(group);
  if (groups.length > 8) throw new VisualError("LIMIT", "A report may contain at most eight pages. Split it into smaller reports.");
  return groups.map((children, index) => {
    const boxes = new Map<string, Box>();
    const height = Math.ceil(overhead + children.reduce((sum, id) => sum + measure(id, contentWidth, boxes).height, 0) + spacing.gap * Math.max(0, children.length - 1));
    const subset: Record<string, Element> = { [input.spec.root]: { ...root, children } };
    const copy = (id: string) => { subset[id] = elements[id]!; for (const child of elements[id]!.children) copy(child); };
    children.forEach(copy);
    boxes.set(input.spec.root, { width: input.width, height, lines: rootLines });
    return { spec: { root: input.spec.root, elements: subset }, boxes, width: input.width, height, index, count: groups.length };
  });
}
