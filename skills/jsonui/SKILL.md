---
name: JSONUI visual reports
description: Render charts, metrics, dashboards, tables, planning diagrams and annotated images through the native OpenCode V2 JSONUI plugin, then present the PNGs to the user.
---

# JSONUI

Use native `jsonui` tools for data-driven visual explanations. Rendering is local,
offline, deterministic, and uses Vercel json-render with Apache ECharts.

1. Discover `catalog` and `examples` through Code Mode. Request the schema for only
   the component/chart kind you need. `examples({name})` returns a complete spec.
2. A spec is `{root, elements: {id: {type, props, children}}}`. Root is `Report`;
   supply its title and truthful source, with period and caveats when relevant.
   Mark invented/sample data `synthetic: true`. Never invent data to fill a chart.
3. Call `render({spec, theme})`, or `render({example: "dashboard", theme: "dark"})`.
   Provide exactly one of `spec` or `example`. PNG is always produced. Optional
   `chartSvg: true` exports standalone charts, not vector dashboards.
4. **Present the actual PNG(s) immediately after rendering.** Native file content
   already contains the preview bytes. If `browser.preview` is available and
   connected, call it for each returned `pages[].previewPath`. Do not finish with
   only a filesystem path or “image saved.” Explain the result briefly and offer
   the full-resolution `pages[].path` and `specPath` for reuse. If the desktop
   bridge is disconnected, say so once; do not repeatedly retry it.

## Choosing a visual

- Line/area: change over ordered categories. `null` is a gap, not zero.
- Bar: comparison; horizontal bars help with longer category labels.
- Histogram/boxplot: distributions; do not substitute averages for distributions.
- Scatter/bubble: relationships, not proof of causation. Bubble `size` is data.
- Pie/donut: a small composition with a positive total. Use a table for detail.
- Heatmap/cohort: a matrix. Cohorts use percentage units 0–100, not fractions.
- Metric: explicit value plus optional change/history. Format `percent` uses
   fractions (0.82 → 82%); metric `change` uses percent or percentage-point units.
- Timeline/Gantt/Flow/Hierarchy: milestones, plans, and relationships.

Use one or two chart columns; three-column rows are best for compact metrics.
Charts require at least 400 logical pixels. Reports automatically paginate
top-level tables and blocks. A nested layout is kept together and will produce a
clear layout error if it is too tall. Source data is never silently truncated.

Images accept bounded PNG/JPEG/WebP data URLs only. There is no raw HTML,
JavaScript, arbitrary chart-option escape hatch, remote fetching, or file path
input. Strings are plain text. Assets, fonts, and charts share light/dark tokens.

For the full library, call `jsonui.gallery({})` only when requested. It attaches
ten overview sheets and returns a self-contained gallery with every example in
both themes. This is substantially more work than a single render.

The package also provides `bun run examples`. It creates all
examples in both themes, JSON specs, optional chart SVGs, overview sheets, and a
self-contained HTML image index. This is a static export, not an interactive app.
