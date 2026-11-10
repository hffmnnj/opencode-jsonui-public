import * as echarts from "echarts";
import type { EChartsOption, CustomSeriesRenderItem, SeriesOption } from "echarts";
import { Resvg } from "@resvg/resvg-js";
import type { Chart, TreeNode } from "../catalog/charts.ts";
import type { Props } from "../catalog/schema.ts";
import { dagLayers } from "../catalog/validate.ts";
import { fontPaths, loadFonts, textMetrics } from "../design/fonts.ts";
import { sans, type Theme } from "../design/theme.ts";
import { boxSummary, formatValue, histogram, waterfall } from "./math.ts";
import { contrastText, mixColor } from "../design/color.ts";

const noObservations = (theme: Theme) => [{ type: "text" as const, left: "center", top: "middle", style: { text: "No observations supplied", fill: theme.muted, fontFamily: sans, fontSize: 16 } }];

const axis = (theme: Theme) => ({
  axisLine: { lineStyle: { color: theme.border } }, axisTick: { show: false },
  axisLabel: { color: theme.muted, fontFamily: sans, fontSize: 14, margin: 12 },
  nameTextStyle: { color: theme.muted, fontFamily: sans, fontSize: 14 },
  splitLine: { lineStyle: { color: theme.border, type: "dashed" as const } },
});

export function chartOptions(chart: Chart, theme: Theme, width: number): EChartsOption {
  const valueFormat = (value: number | string) => formatValue(Number(value), chart.format);
  const base: EChartsOption = {
    animation: false, backgroundColor: theme.surface, color: [...theme.series],
    textStyle: { fontFamily: sans, color: theme.ink, fontSize: 15 },
    tooltip: { show: false }, aria: { enabled: false },
    grid: { left: 16, right: 26, top: 38, bottom: chart.xLabel ? 52 : 20, containLabel: true },
  };
  const valueAxis = { ...axis(theme), type: "value" as const, name: chart.yLabel, nameLocation: "end" as const,
    axisLabel: { ...axis(theme).axisLabel, formatter: valueFormat } };
  const category = (data: string[]) => ({ ...axis(theme), type: "category" as const, data,
    name: chart.xLabel, nameLocation: "middle" as const, nameGap: 44,
    axisLabel: { ...axis(theme).axisLabel, interval: 0, rotate: data.length > 12 ? 40 : 0 }, splitLine: { show: false } });
  const reference = chart.reference ? { symbol: "none" as const, silent: true, lineStyle: { type: "dashed" as const, color: theme.muted }, label: { color: theme.ink, formatter: chart.reference.label, position: "insideEndTop" as const }, data: [{ yAxis: chart.reference.value }] } : undefined;
  if (chart.kind === "line" || chart.kind === "area" || chart.kind === "bar") {
    const horizontal = chart.kind === "bar" && chart.horizontal;
    const legendRows = Math.ceil(chart.series.length / Math.max(1, Math.floor(width / 230)));
    return { ...base,
      grid: { left: 16, right: 30, top: chart.series.length > 1 ? 26 * legendRows + 24 : 30, bottom: chart.xLabel ? 58 : 22, containLabel: true },
      legend: { show: chart.series.length > 1, top: 0, left: 12, right: 12, itemWidth: 18, itemHeight: 8, textStyle: { color: theme.muted, fontSize: 14, fontFamily: sans } },
      xAxis: horizontal ? { ...valueAxis, name: chart.xLabel, nameLocation: "middle", nameGap: 40 } : category(chart.categories),
      yAxis: horizontal ? { ...category(chart.categories), inverse: true, name: chart.yLabel, nameLocation: "end", axisLabel: { ...axis(theme).axisLabel, interval: 0 } } : valueAxis,
      series: chart.series.map((series, index): SeriesOption => ({
        type: chart.kind === "bar" ? "bar" : "line", name: series.name, data: series.values,
        ...(chart.stacked ? { stack: "total" } : {}),
        ...(chart.kind === "area" ? { areaStyle: { opacity: chart.stacked ? 0.65 : 0.18 } } : {}),
        ...(chart.kind === "bar" ? { barMaxWidth: 42, itemStyle: { borderRadius: chart.stacked ? 0 : 4 }, label: { show: chart.categories.length <= 10 && !chart.stacked && chart.series.length === 1, position: horizontal ? "right" : "top", color: theme.ink, fontSize: 14, formatter: (params: { value: unknown }) => valueFormat(Number(params.value)) } } : { connectNulls: false, symbol: "circle", symbolSize: 7, showSymbol: chart.categories.length <= 16, lineStyle: { width: 3 } }),
        ...(index === 0 && reference ? { markLine: horizontal ? { ...reference, data: [{ xAxis: chart.reference!.value }] } : reference } : {}),
      })),
      ...(chart.series.every(series => series.values.every(value => value === null)) ? { graphic: noObservations(theme) } : {}),
    };
  }
  if (chart.kind === "pie" || chart.kind === "donut") return { ...base,
    legend: { orient: "vertical", right: 8, top: "middle", itemGap: 16, formatter: name => `${name}  ${valueFormat(chart.items.find(item => item.name === name)!.value)}`, textStyle: { color: theme.ink, fontSize: 15, fontFamily: sans } },
    series: [{ type: "pie", radius: chart.kind === "donut" ? ["49%", "72%"] : [0, "72%"], center: ["35%", "50%"], avoidLabelOverlap: true,
      label: { show: false }, itemStyle: { borderColor: theme.surface, borderWidth: 4 }, data: chart.items,
    }],
    ...(chart.kind === "donut" ? { graphic: [{ type: "text", x: width * 0.35, y: chart.height * 0.5, style: { text: formatValue(chart.items.reduce((sum, item) => sum + item.value, 0), chart.format), fill: theme.ink, fontFamily: sans, fontWeight: 600, fontSize: 32, align: "center", verticalAlign: "middle" } }] } : {}),
  };
  if (chart.kind === "funnel") return { ...base, series: [{ type: "funnel", left: "10%", right: "26%", top: 10, bottom: 10, sort: "none", gap: 6, data: chart.items,
    label: { color: theme.ink, fontFamily: sans, fontSize: 15, formatter: params => `${params.name}: ${valueFormat(Number(params.value))}` }, labelLine: { length: 16, lineStyle: { color: theme.muted } }, itemStyle: { borderColor: theme.surface, borderWidth: 2 },
  }] };
  if (chart.kind === "treemap") return { ...base, series: [{ type: "treemap", data: chart.items.map((item, index) => ({ ...item, itemStyle: { color: theme.series[index % theme.series.length] }, label: { color: contrastText(theme.series[index % theme.series.length]!) } })), roam: false, nodeClick: false, breadcrumb: { show: false }, left: 0, right: 0, top: 0, bottom: 0,
    label: { fontFamily: sans, fontSize: 17, formatter: params => `${params.name}\n${valueFormat(Number(params.value))}` }, itemStyle: { borderColor: theme.surface, borderWidth: 4, gapWidth: 4 },
  }] };
  if (chart.kind === "sunburst") {
    const colored = (node: TreeNode, color: string): TreeNode & { itemStyle: { color: string }; label: { color: string } } => ({
      ...node, itemStyle: { color }, label: { color: contrastText(color) },
      ...(node.children ? { children: node.children.map(child => colored(child, mixColor(color, theme.surface, 0.18))) } : {}),
    });
    return { ...base, series: [{ type: "sunburst", data: chart.data.map((node, index) => colored(node, theme.series[index % theme.series.length]!)), radius: [0, "92%"], sort: undefined, nodeClick: false,
      label: { fontFamily: sans, fontSize: 14, rotate: "radial", formatter: params => `${params.name}\n${valueFormat(Number(params.value))}` }, itemStyle: { borderColor: theme.surface, borderWidth: 3 },
    }] };
  }
  if (chart.kind === "scatter" || chart.kind === "bubble") {
    const maxSize = chart.kind === "bubble" ? Math.max(1, ...chart.points.map(point => point.size)) : 1;
    return { ...base, xAxis: { ...valueAxis, name: chart.xLabel, nameLocation: "middle", nameGap: 40, axisLabel: axis(theme).axisLabel }, yAxis: valueAxis,
      series: [{ type: "scatter", data: chart.points.map(point => ({ name: point.name ?? "", value: [point.x, point.y, "size" in point ? point.size : 1] })),
        symbolSize: chart.kind === "bubble" ? (value: number[]) => Math.sqrt(value[2]! / maxSize) * 60 : 12,
        itemStyle: { opacity: 0.75, borderColor: theme.surface, borderWidth: 2 },
        label: { show: true, formatter: "{b}", position: "top", color: theme.muted, fontSize: 13, fontFamily: sans },
        markLine: reference,
      }],
    };
  }
  if (chart.kind === "histogram") {
    const bins = histogram(chart.samples, chart.bins);
    return { ...base, xAxis: category(bins.map(bin => `${formatValue(bin.low, { decimals: 1 })}–${formatValue(bin.high, { decimals: 1 })}`)), yAxis: { ...valueAxis, name: "Count", minInterval: 1 },
      series: [{ type: "bar", barCategoryGap: "5%", data: bins.map(bin => bin.count), itemStyle: { borderRadius: [3, 3, 0, 0] } }],
    };
  }
  if (chart.kind === "boxplot") {
    const summaries = chart.groups.map(group => boxSummary(group.samples));
    return { ...base, xAxis: category(chart.groups.map(group => group.name)), yAxis: valueAxis,
      series: [{ type: "boxplot", data: summaries.map(summary => summary.values), markLine: reference, itemStyle: { color: theme.accentSoft, borderColor: theme.accent, borderWidth: 2 } },
        { type: "scatter", data: summaries.flatMap((summary, index) => summary.outliers.map(value => [index, value])), symbolSize: 7, itemStyle: { color: theme.negative } }],
    };
  }
  if (chart.kind === "heatmap" || chart.kind === "cohort") {
    const values = chart.cells.flatMap(cell => cell[2] === null ? [] : [cell[2]]);
    const minimum = Math.min(0, ...values), maximum = chart.kind === "cohort" ? 100 : Math.max(1, ...values);
    return { ...base, grid: { left: 16, right: 20, top: 10, bottom: 72, containLabel: true },
      xAxis: { ...category(chart.xLabels), splitArea: { show: false } }, yAxis: { ...category(chart.yLabels), name: chart.yLabel, nameLocation: "end", nameGap: 15, inverse: true, splitArea: { show: false }, axisLabel: { ...axis(theme).axisLabel, interval: 0 } },
      visualMap: { min: minimum, max: maximum, text: [chart.kind === "cohort" ? "100%" : valueFormat(maximum), chart.kind === "cohort" ? "0%" : valueFormat(minimum)], calculable: false, orient: "horizontal", left: "center", bottom: 0, itemWidth: 12, itemHeight: 160, textStyle: { color: theme.muted }, inRange: { color: [theme.inset, theme.accent] } },
      series: [{ type: "heatmap", data: chart.cells.filter(cell => cell[2] !== null).map(cell => ({ value: cell, label: { color: contrastText(mixColor(theme.inset, theme.accent, (cell[2]! - minimum) / (maximum - minimum))) } })), itemStyle: { borderColor: theme.surface, borderWidth: 3 },
        label: { show: chart.xLabels.length <= 12, fontFamily: sans, fontSize: 13, color: theme.ink, formatter: params => { const value = (params.value as number[])[2]!; return chart.kind === "cohort" ? `${value}%` : formatValue(value, chart.format); } },
      }],
      ...(values.length === 0 ? { graphic: noObservations(theme) } : {}),
    };
  }
  if (chart.kind === "calendar") return { ...base,
    calendar: { top: 45, left: 45, right: 20, bottom: 100, range: String(chart.year), cellSize: "auto", yearLabel: { show: false }, dayLabel: { color: theme.muted, fontFamily: sans }, monthLabel: { color: theme.muted, fontFamily: sans, fontSize: 14 }, itemStyle: { color: theme.surface, borderWidth: 3, borderColor: theme.surface }, splitLine: { show: false } },
    visualMap: { min: 0, max: Math.max(1, ...chart.points.map(point => point.value)), text: [valueFormat(Math.max(1, ...chart.points.map(point => point.value))), "0"], orient: "horizontal", left: "center", bottom: 20, textStyle: { color: theme.muted }, inRange: { color: [theme.inset, theme.accent] } },
    series: [{ type: "heatmap", coordinateSystem: "calendar", data: chart.points.map(point => [point.date, point.value]) }],
  };
  if (chart.kind === "waterfall") {
    const bars = waterfall(chart.start, chart.steps);
    const renderItem: CustomSeriesRenderItem = (_params, api) => {
      const index = Number(api.value(0)), from = api.coord([index, Number(api.value(1))]), to = api.coord([index, Number(api.value(2))]);
      const barWidth = Math.abs((api.size!([1, 0]) as number[])[0]!) * 0.58;
      const bar = bars[index]!;
      return { type: "rect", shape: { x: from[0]! - barWidth / 2, y: Math.min(from[1]!, to[1]!), width: barWidth, height: Math.max(1, Math.abs(from[1]! - to[1]!)), r: 3 }, style: { fill: bar.total ? theme.accent : bar.delta >= 0 ? theme.positive : theme.negative } };
    };
    return { ...base, xAxis: category(bars.map(bar => bar.name)), yAxis: valueAxis,
      series: [{ type: "custom", renderItem, markLine: reference, encode: { x: 0, y: [1, 2] }, data: bars.map((bar, index) => [index, bar.from, bar.to]) }],
    };
  }
  if (chart.kind === "sankey") return { ...base, series: [{ type: "sankey", left: 16, top: 20, right: 140, bottom: 20,
    data: chart.nodes.map(name => ({ name })), links: chart.links, nodeWidth: 16, nodeGap: 24, layoutIterations: 32,
    label: { color: theme.ink, fontFamily: sans, fontSize: 15 }, lineStyle: { color: "source", opacity: 0.25, curveness: 0.5 },
  }] };
  if (chart.kind === "candlestick") return { ...base, xAxis: category(chart.candles.map(candle => candle.label)), yAxis: { ...valueAxis, scale: true },
    series: [{ type: "candlestick", data: chart.candles.map(candle => [candle.open, candle.close, candle.low, candle.high]), markLine: reference, itemStyle: { color: theme.positive, color0: theme.negative, borderColor: theme.positive, borderColor0: theme.negative } }],
  };
  return { ...base, grid: { left: 20, right: 40, top: "35%", bottom: "30%", containLabel: true },
    xAxis: { ...valueAxis, min: 0, max: chart.maximum, name: chart.xLabel, nameLocation: "middle", nameGap: 40 }, yAxis: { ...category(["Actual"]), name: chart.yLabel, nameLocation: "end", nameGap: 15, axisLine: { show: false } },
    series: [{ type: "bar", data: [chart.value], barWidth: 52, showBackground: true, backgroundStyle: { color: theme.inset, borderRadius: 8 }, itemStyle: { color: theme.accent, borderRadius: 8 },
      label: { show: true, position: "right", color: theme.ink, fontSize: 22, formatter: valueFormat(chart.value) },
      markLine: { symbol: "none", data: [{ xAxis: chart.target }], lineStyle: { width: 3, color: theme.warning }, label: { color: theme.ink, formatter: `Target ${valueFormat(chart.target)}`, fontSize: 15 } },
    }],
  };
}

export async function renderOption(option: EChartsOption, width: number, height: number, scale = 1) {
  const metrics = await textMetrics();
  echarts.setPlatformAPI({ measureText: (text, font) => {
    const size = Number(font?.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 14);
    return { width: metrics.measure(text, size, /600|bold/.test(font ?? "") ? 600 : 400) };
  } });
  const chart = echarts.init(null, undefined, { renderer: "svg", ssr: true, width, height });
  try {
    chart.setOption(option);
    const svg = chart.renderToSVGString();
    const png = new Resvg(svg, { fitTo: { mode: "zoom", value: scale }, font: { fontFiles: fontPaths, loadSystemFonts: false } }).render().asPng();
    return { svg, png: Buffer.from(png), width, height };
  } finally { chart.dispose(); }
}

export async function embedSvgFonts(svg: string): Promise<string> {
  const fonts = await loadFonts();
  const faces = fonts.map(font => `@font-face{font-family:'${font.name}';font-weight:${font.weight};src:url(data:font/ttf;base64,${Buffer.from(font.data instanceof ArrayBuffer ? new Uint8Array(font.data) : font.data).toString("base64")}) format('truetype');}`).join("");
  return svg.replace(/(<svg\b[^>]*>)/, `$1<style>${faces}</style>`);
}

export function flowOptions(props: Props<"Flow">, theme: Theme, width: number, height: number, lines: Record<string, string[]>): EChartsOption {
  const layers = dagLayers(props.nodes.map(node => node.id), props.edges);
  // Explicit axes avoid view auto-fit stretching a collinear graph. Square symbols
  // match ECharts' circular edge clearance, keeping arrowheads outside the nodes.
  return { animation: false, backgroundColor: theme.surface,
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    xAxis: { type: "value", min: 0, max: width, show: false },
    yAxis: { type: "value", min: 0, max: height, show: false, inverse: true },
    series: [{ type: "graph", coordinateSystem: "cartesian2d", layout: "none", roam: false,
    symbol: "roundRect", symbolSize: Math.min(120, width / Math.max(2, layers.length) - 24),
    data: props.nodes.map(node => { const x = layers.findIndex(layer => layer.includes(node.id)), layer = layers[x]!; return { id: node.id, name: lines[`node:${node.id}`]!.join("\n"), value: [layers.length === 1 ? width / 2 : 100 + x * (width - 200) / (layers.length - 1), (layer.indexOf(node.id) + 0.5) * height / layer.length], itemStyle: { color: theme.accentSoft, borderColor: theme.accent, borderWidth: 2 } }; }),
    links: props.edges.map(edge => ({ source: edge.from, target: edge.to })), edgeSymbol: ["none", "arrow"], edgeSymbolSize: 9,
    label: { show: true, color: theme.ink, fontSize: 14, fontFamily: sans }, lineStyle: { color: theme.accent, opacity: 0.6, width: 2, curveness: 0.08 },
  }] };
}

export function hierarchyOptions(props: Props<"Hierarchy">, theme: Theme, wrap: (name: string) => string): EChartsOption {
  return { animation: false, backgroundColor: theme.surface, series: [{ type: "tree", data: [props.data], top: 30, bottom: 30, left: 100, right: 140, symbolSize: 13, initialTreeDepth: -1, expandAndCollapse: false,
    label: { position: "left", formatter: params => wrap(params.name), color: theme.ink, fontFamily: sans, fontSize: 15 }, leaves: { label: { position: "right" } }, itemStyle: { color: theme.accent, borderColor: theme.surface, borderWidth: 2 }, lineStyle: { color: theme.border, width: 2 },
  }] };
}

export function sparklineOptions(values: readonly (number | null)[], theme: Theme): EChartsOption {
  return { animation: false, grid: { left: 2, top: 8, right: 2, bottom: 4 }, xAxis: { type: "category", show: false, data: values.map((_, index) => index) }, yAxis: { type: "value", show: false, scale: true },
    series: [{ type: "line", data: [...values], connectNulls: false, showSymbol: false, lineStyle: { width: 3, color: theme.accent }, areaStyle: { color: theme.accent, opacity: 0.1 } }],
  };
}
