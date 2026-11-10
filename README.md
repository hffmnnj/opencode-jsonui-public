# OpenCode JSONUI

Native **OpenCode V2** tools for charts, analytics, diagrams, and useful image
reports. Every render returns real PNG attachments, not just a path on disk.

Built with Vercel **json-render 0.21.0**, Apache **ECharts 6.1.0** SVG SSR, and
**resvg 2.6.2**. Verified against **OpenCode 2.0.18** and **Bun 1.4.2**. No MCP
server, V1 adapter, paid inference, browser renderer, or external data service.

## Install locally

```sh
cd /home/example/Documents/opencode-jsonui
bun install --ignore-scripts
bun run check
bun run test:host
```

Add this directory to the **V2** config, preserving all other plugin entries:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "/home/example/Documents/opencode-jsonui"
  ]
}
```

On this workstation the V2 config is
`/home/example/.config/opencode-v2/opencode.json`, and the V2 executable is
`/home/example/.local/bin/opencodev2`. Plain `opencode` is a different, V1 install.
Watched configuration changes reload automatically; changes to an unwatched
local dependency can require a later reload. Do not restart an active service
just to install this package without coordinating with its owner.

Optional plugin configuration:

```jsonc
{
  "plugins": [{
    "package": "/home/example/Documents/opencode-jsonui",
    "options": {
      "timeoutMs": 30000,
      "maxArtifactsPerSession": 100
    }
  }]
}
```

`outputDirectory` is an optional **operator-controlled plugin option**, never a
render argument. The default is `$XDG_DATA_HOME/opencode-jsonui/artifacts`, or
`~/.local/share/opencode-jsonui/artifacts` when XDG_DATA_HOME is unset. Relative
configured paths resolve from the OpenCode Location directory.

## Agent workflow

The plugin registers the **JSONUI visual reports** skill and four native tools:

| Tool | Purpose |
| --- | --- |
| `jsonui.catalog` | Discover component/chart inventory and exact props schemas |
| `jsonui.examples` | List examples or retrieve one complete synthetic spec |
| `jsonui.render` | Render supplied data or one named example; attach PNG pages |
| `jsonui.gallery` | Render the entire library; attach overview sheets and return the gallery |

In Code Mode:

```ts
return await tools.jsonui.render({ example: "dashboard", theme: "dark" });
```

Then **present the image and explain it briefly**. If the desktop bridge is
connected, call `browser.preview` on the returned `pages[].previewPath`. Native
file parts already carry PNG bytes. Keep the full-resolution `pages[].path` and
`specPath` available for download/reuse. A filesystem path by itself is not
delivery. Do not synthesize a new user message to insert the image.

`render` and `gallery` use the native `jsonui_render` permission. Discovery tools
are read-only. A permission denial occurs before rendering or artifact writes.
Code Mode preserves file content in the verified 2.0.18 SDK host.

### Render your own data

```ts
return await tools.jsonui.render({
  theme: "light",
  width: 1200,
  scale: 2,
  chartSvg: true,
  spec: {
    root: "report",
    elements: {
      report: {
        type: "Report",
        props: {
          title: "Weekly observations",
          source: "Example dataset supplied in this request",
          period: "September 2026",
          synthetic: true
        },
        children: ["trend"]
      },
      trend: {
        type: "Chart",
        props: {
          kind: "line",
          title: "Missing readings remain gaps",
          yLabel: "Observations",
          categories: ["Mon", "Tue", "Wed", "Thu", "Fri"],
          series: [{ name: "Recorded", values: [14, 18, null, 23, 21] }]
        }
      }
    }
  }
});
```

Provide exactly one of `spec` or `example`. The flat `{root, elements}` tree uses
the real json-render catalog and image registry. Only the documented components
and strict props are accepted; raw HTML, callbacks, expressions, bindings, and
arbitrary ECharts options are intentionally excluded.

## Library

**20 components:** Report, Row, Column, Card, Heading, Text, Badge, Divider, Icon,
Metric, Sparkline, Progress, Chart, Table, Insight, Timeline, Gantt, Flow,
Hierarchy, and Image.

**19 chart kinds:** line, area, bar, pie, donut, funnel, treemap, sunburst,
scatter, bubble, histogram, boxplot, heatmap, cohort, calendar, waterfall,
Sankey, candlestick, and bullet/target. Variants include horizontal, grouped, and
stacked bars; stacked area; multi-series lines; and explicit missing-data gaps.

**37 examples** also cover KPI cards, sparklines, formatted tables, insights,
timelines, roadmaps, directed acyclic flows, hierarchy trees, annotated image
boards, primitives, a dashboard, an executive brief, and a paginated report.
Every advertised component and chart kind is checked against the actual example
specs by the gallery test, rather than a manually maintained coverage list.

Light and dark themes share semantic colors, measured typography, explicit
captions, sources, and time windows. IBM Plex Sans/Mono are bundled locally.
Dense or oversized layouts fail with an actionable error rather than silently
dropping labels, shrinking content to illegibility, or truncating data.

### Data semantics

- `null` means missing, not zero. Missing table cells show `—`; all-null line
  charts show an explicit empty state. Empty required datasets are rejected.
- Percent formatting uses fractions: `0.82` → `82%`. Metric `change` is already
  in percentage units (`12.4` → `+12.4%`) or explicit percentage points (`pp`).
  Cohort values use the range **0–100**. Duration values are seconds.
- Histograms use equal-width bins and include the maximum in the final bin.
  Boxplots use R7 quartiles and Tukey 1.5-IQR whiskers; outliers remain visible.
- Waterfalls retain signed deltas across zero. Bubble **area**, not diameter,
  is proportional to `size`. A zero-size bubble has zero area.
- Gantt dates are inclusive UTC calendar days. The saturated part of each bar
  is completion; the paler part is the full planned interval.
- Parent hierarchy totals, when supplied, must equal their children. Flow and
  Sankey inputs must be acyclic with valid references. A flow is constrained
  left-to-right layout, not a general-purpose graph routing engine.
- The renderer never infers causation, fetches data, or invents a conclusion.
  All bundled examples are explicitly labeled **synthetic**.

## Complete example gallery

Ask the agent for `jsonui.gallery({})`, or run:

```sh
bun run examples
```

Each invocation creates a new gallery directory under `examples/generated/`.
`examples/generated/latest.json` points to the newest export. The result has:

- **74 theme variants / 76 full report PNG pages** (the long table has two pages).
- **52 standalone chart SVGs**, with embedded fonts.
- Exact normalized JSON render inputs and manifests for every report.
- **10 PNG overview sheets**, showing every example; multi-page previews show
  the first page, while the gallery retains every page.
- A self-contained HTML image gallery with enlarge controls and PNG/JSON/SVG
  downloads. It is about 65 MiB because images and fonts are embedded. It does
  not need an HTTP server or make external asset requests.

The HTML is a **static image gallery**, not an interactive report renderer.
SVG is **chart-only**, not a vector dashboard. PNG is first-class for all output
types. PDF, animation, interactive charts, and arbitrary remote images are not
advertised or implemented.

## Boundaries and storage

| Resource | Bound |
| --- | --- |
| Input | 4 MiB string/key budget; 24,000 JSON nodes; 256 components |
| Graph depth | JSON 32 levels; component tree 16 levels |
| Report | 720–1600 logical px wide; page cap 900–2000 px; 1× or 2× scale |
| Pages | At most 8; up to 12.8 million physical pixels per page |
| Attachments | 2 MiB per preview; 8 MiB total preview bytes |
| Rendered output | 24 MiB total PNG/preview/chart-SVG bytes per report |
| Workers | 2 concurrent renders, 8 waiting; 30 s per render by default |
| Gallery | One at a time, one additional worker; 180 s tool deadline; 3/session |
| Raster input | PNG/JPEG/WebP data URL; 1.1 MB encoded; 8 MP; 4096 px/side; no animation |
| Session retention | 100 regular artifacts by default; configurable up to 500 |

Chart/table/diagram schemas impose additional item limits. Crowded charts may
reach layout limits earlier. Top-level tables paginate with repeated headers;
other top-level blocks move as a unit. Nested compositions are never split or
silently truncated.

CPU-heavy rendering runs in killable Bun subprocesses with a small environment,
bounded stdout/stderr, cancellation, and deadlines. This is **process isolation,
not an OS security sandbox**. It uses installed trusted libraries; it does not
accept executable input. There is no network access in the rendering design.

Session IDs are hashed, artifact IDs are random, files are created exclusively,
and symlink storage paths are rejected. Files use mode 0600, new directories
0700. Publication is a final directory rename only after all files succeed.
Existing artifacts are not overwritten. Publication/quota checks are serialized
within one host; multiple independent processes sharing the same output root
are not supported. Use separate roots for separate hosts.

Original data remains in `spec.json` and is sensitive if your inputs are
sensitive. Native PNG preview bytes also persist in OpenCode history and go to
the configured image-capable model on continuation. Artifacts have **no automatic
expiry or global disk quota**: archive them deliberately when no longer needed.
Cancellation cleans only exact files from the current unfinished publication;
completed reports from a partly generated gallery are retained. A crashed
process can leave a private `.pending-*` directory for operator review.

## Verification and development

```sh
bun run check         # strict TypeScript + focused unit/integration contracts
bun run test:host     # actual isolated @opencode/sdk 2.0.18 host
bun run test:gallery  # every example, both themes, real render adapters
bun run examples     # materialize and inspect the complete export
```

Host tests use isolated HOME/XDG/config/database directories under
`/var/tmp/example/opencode/`, plus a deterministic loopback provider. They exercise
production rendering, direct and Code Mode tools, permission denial, native PNG
bytes forwarded to model continuation, installed local-directory discovery, and
persistence after host reopening.
They do not use OAuth, paid inference, or the running OpenCode service. They do
not by themselves prove that a particular desktop client's preview bridge is
connected; that is a separate live presentation check.

Implementation entry points: `src/catalog/` owns typed definitions and semantic
validation; `src/components/registry.tsx` implements the real image registry;
`src/charts/` adapts ECharts; `src/render/` handles layout/workers;
`src/artifacts/` publishes session artifacts; `src/index.ts` registers native
tools and guidance. See [architecture research](docs/architecture.md) and
[third-party notices](THIRD_PARTY_NOTICES.md).
