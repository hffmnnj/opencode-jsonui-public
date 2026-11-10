import type { ValueFormat } from "../catalog/charts.ts";

export function formatValue(value: number, format?: Partial<ValueFormat>): string {
  const decimals = format?.decimals ?? 0;
  if (format?.style === "duration") {
    const absolute = Math.abs(value);
    const [amount, unit] = absolute >= 3600 ? [value / 3600, "h"] : absolute >= 60 ? [value / 60, "min"] : [value, "s"];
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(amount as number)} ${unit}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: format?.style === "currency" ? "currency" : format?.style === "percent" ? "percent" : "decimal",
    currency: format?.currency ?? "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    notation: format?.compact ? "compact" : "standard",
  }).format(value);
}

export function histogram(samples: readonly number[], bins: number) {
  const min = Math.min(...samples), max = Math.max(...samples);
  const width = max === min ? 1 : (max - min) / bins;
  const count = max === min ? 1 : bins;
  const result = Array.from({ length: count }, (_, index) => ({ low: min + index * width, high: min + (index + 1) * width, count: 0 }));
  for (const sample of samples) result[Math.min(count - 1, Math.floor((sample - min) / width))]!.count++;
  return result;
}

/** R-7 / linear interpolation. Whiskers are Tukey fences clipped to observed data. */
export function boxSummary(samples: readonly number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const quantile = (q: number) => {
    const position = (sorted.length - 1) * q, index = Math.floor(position), fraction = position - index;
    return sorted[index]! + fraction * (sorted[Math.min(index + 1, sorted.length - 1)]! - sorted[index]!);
  };
  const q1 = quantile(0.25), median = quantile(0.5), q3 = quantile(0.75), iqr = q3 - q1;
  const inside = sorted.filter(value => value >= q1 - 1.5 * iqr && value <= q3 + 1.5 * iqr);
  const low = inside[0]!, high = inside[inside.length - 1]!;
  return { values: [low, q1, median, q3, high], outliers: sorted.filter(value => value < low || value > high) };
}

export function waterfall(start: number, steps: readonly { name: string; value: number }[]) {
  let running = start;
  const bars = [{ name: "Start", from: 0, to: start, delta: start, total: true }];
  for (const step of steps) {
    const from = running; running += step.value;
    bars.push({ name: step.name, from, to: running, delta: step.value, total: false });
  }
  bars.push({ name: "Total", from: 0, to: running, delta: running, total: true });
  return bars;
}

export const day = (value: string) => Date.parse(`${value}T00:00:00Z`) / 86_400_000;
