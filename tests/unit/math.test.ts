import { describe, expect, test } from "bun:test";
import { boxSummary, formatValue, histogram, waterfall } from "../../src/charts/math.ts";

describe("analytical calculations", () => {
  test("histogram includes its maximum in the final bin and conserves observations", () => {
    expect(histogram([0, 1, 2, 3, 4], 2)).toEqual([{ low: 0, high: 2, count: 2 }, { low: 2, high: 4, count: 3 }]);
    expect(histogram([7, 7, 7], 10)).toEqual([{ low: 7, high: 8, count: 3 }]);
  });
  test("Tukey whiskers exclude an outlier without dropping it", () => {
    expect(boxSummary([0, 1, 2, 3, 4, 5, 6, 7, 100])).toEqual({ values: [0, 2, 4, 6, 7], outliers: [100] });
    expect(boxSummary([2, 4])).toEqual({ values: [2, 2.5, 3, 3.5, 4], outliers: [] });
  });
  test("waterfall retains signed deltas across zero and the independent closing total", () => {
    expect(waterfall(10, [{ name: "Expense", value: -25 }, { name: "Revenue", value: 8 }])).toEqual([
      { name: "Start", from: 0, to: 10, delta: 10, total: true },
      { name: "Expense", from: 10, to: -15, delta: -25, total: false },
      { name: "Revenue", from: -15, to: -7, delta: 8, total: false },
      { name: "Total", from: 0, to: -7, delta: -7, total: true },
    ]);
  });
  test("formatting has explicit percent, currency and duration semantics", () => {
    expect(formatValue(0.825, { style: "percent", decimals: 1 })).toBe("82.5%");
    expect(formatValue(-1240.25, { style: "currency", currency: "USD", decimals: 2 })).toBe("-$1,240.25");
    expect(formatValue(90, { style: "duration", decimals: 1 })).toBe("1.5 min");
    expect(formatValue(0)).toBe("0");
  });
});
