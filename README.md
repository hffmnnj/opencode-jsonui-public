# JSONUI

Native visual reports for OpenCode V2: charts, metrics, tables, diagrams, and
multi-page image reports. Every render returns real PNG attachments alongside
full-resolution files on disk. Rendering is local and offline.

<img src="https://unpkg.com/hffmnnj.jsonui/assets/jsonui-example.png" alt="A JSONUI dashboard with metrics, a revenue chart, and a service reliability table using synthetic data" width="640">

*A dashboard rendered by JSONUI with synthetic data.*

Built with Vercel json-render 0.21.0, Apache ECharts 6.1.0, and resvg 2.6.2.
Verified against OpenCode 2.0.18 and Bun 1.4.2. No MCP server, V1 adapter, paid
inference, browser renderer, or external data service.

## Install

Requires OpenCode V2 and Bun 1.4.2 or newer.

Add the package to your OpenCode V2 config:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["hffmnnj.jsonui"]
}
```

Plugin options are optional:

```jsonc
{
  "plugins": [
    {
      "package": "hffmnnj.jsonui",
      "options": {
        "timeoutMs": 30000,
        "maxArtifactsPerSession": 100
      }
    }
  ]
}
```

| Option | Default | Range | Purpose |
| --- | --- | --- | --- |
| `timeoutMs` | `30000` | 1,000–120,000 | Per-render deadline |
| `maxArtifactsPerSession` | `100` | 1–500 | Retained regular artifacts |
| `outputDirectory` | XDG data directory | Up to 2048 chars | Operator-controlled storage root |

The default output directory is `$XDG_DATA_HOME/opencode-jsonui/artifacts`, or
`~/.local/share/opencode-jsonui/artifacts` when `XDG_DATA_HOME` is unset.
Relative paths resolve from the OpenCode Location directory. `outputDirectory`
is a plugin option, never a render argument.

## Use

The plugin registers the **JSONUI visual reports** skill and four native tools:

| Tool | Purpose |
| --- | --- |
| `jsonui.catalog` | Discover components, chart kinds, and exact props schemas |
| `jsonui.examples` | List examples or retrieve one complete synthetic spec |
| `jsonui.render` | Render supplied data or a named example; attach PNG pages |
| `jsonui.gallery` | Render the full library; attach overview sheets and return the gallery |

From Code Mode:

```ts
return await tools.jsonui.render({ example: "dashboard", theme: "dark" });
```

After rendering, present the image and explain it briefly. Native file parts
already carry PNG bytes. If the desktop bridge is connected, call
`browser.preview` on each `pages[].previewPath`; keep the full-resolution
`pages[].path` and `specPath` available for reuse. A filesystem path alone is not
delivery.

`render` and `gallery` require the `jsonui_render` permission. Discovery tools
are read-only, and a permission denial happens before rendering or artifact
writes.

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
          source: "Dataset supplied in this request",
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

Provide exactly one of `spec` or `example`. A spec is
`{root, elements: {id: {type, props, children}}}`. Only documented components
and strict props are accepted. Raw HTML, callbacks, expressions, bindings, and
arbitrary ECharts options are intentionally excluded.

## Library

**20 components:** Report, Row, Column, Card, Heading, Text, Badge, Divider,
Icon, Metric, Sparkline, Progress, Chart, Table, Insight, Timeline, Gantt, Flow,
Hierarchy, and Image.

**19 chart kinds:** line, area, bar, pie, donut, funnel, treemap, sunburst,
scatter, bubble, histogram, boxplot, heatmap, cohort, calendar, waterfall,
Sankey, candlestick, and bullet/target. Variants include horizontal, grouped,
and stacked bars; stacked area; multi-series lines; and explicit missing-data
gaps.

**37 examples** cover KPI cards, sparklines, formatted tables, insights,
timelines, roadmaps, directed acyclic flows, hierarchy trees, annotated image
boards, primitives, a dashboard, an executive brief, and a paginated report.
The gallery test checks every advertised component and chart kind against the
actual example specs.

Light and dark themes share semantic colors, measured typography, explicit
captions, sources, and time windows. IBM Plex Sans and Mono are bundled locally.
Dense or oversized layouts fail with an actionable error instead of silently
dropping labels, shrinking content to illegibility, or truncating data.

### Data semantics

- `null` means missing, not zero. Missing table cells show `—`; all-null line
  charts show an explicit empty state. Empty required datasets are rejected.
- Percent formatting uses fractions: `0.82` → `82%`. Metric `change` is in
  percentage units (`12.4` → `+12.4%`) or explicit percentage points (`pp`).
  Cohort values use the range 0–100. Duration values are seconds.
- Histograms use equal-width bins and include the maximum in the final bin.
  Boxplots use R7 quartiles and Tukey 1.5-IQR whiskers; outliers remain visible.
- Waterfalls retain signed deltas across zero. Bubble **area**, not diameter, is
  proportional to `size`. A zero-size bubble has zero area.
- Gantt dates are inclusive UTC calendar days. The saturated part of each bar is
  completion; the paler part is the full planned interval.
- Parent hierarchy totals, when supplied, must equal their children. Flow and
  Sankey inputs must be acyclic with valid references. A flow is constrained
  left-to-right layout, not general-purpose graph routing.
- The renderer never infers causation, fetches data, or invents a conclusion.
  All bundled examples are explicitly labeled synthetic.

## Gallery

Ask the agent for `jsonui.gallery({})`, or run `bun run examples` in a checkout.
Each invocation creates a new gallery directory under `examples/generated/`;
`examples/generated/latest.json` points to the newest export. The result has:

- 74 theme variants and 76 full report PNG pages (the long table has two pages).
- 52 standalone chart SVGs with embedded fonts.
- Exact normalized JSON render inputs and manifests for every report.
- 10 PNG overview sheets covering every example; multi-page previews show the
  first page while the gallery retains every page.
- A self-contained HTML image gallery with enlarge controls and PNG/JSON/SVG
  downloads. It embeds images and fonts, needs no HTTP server, and makes no
  external asset requests.

The HTML is a static image gallery, not an interactive report renderer. SVG is
chart-only, not a vector dashboard. PNG is first-class for every output type.
PDF, animation, interactive charts, and arbitrary remote images are not
implemented.

## Limits and storage

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

Chart, table, and diagram schemas impose additional item limits. Crowded charts
may reach layout limits earlier. Top-level tables paginate with repeated
headers; other top-level blocks move as a unit. Nested compositions are never
split or silently truncated.

CPU-heavy rendering runs in killable Bun subprocesses with a small environment,
bounded stdout/stderr, cancellation, and deadlines. This is process isolation,
not an OS security sandbox. It uses installed trusted libraries and does not
accept executable input. There is no network access in the rendering design.

Session IDs are hashed, artifact IDs are random, files are created exclusively,
and symlink storage paths are rejected. Files use mode 0600 and new directories
0700. Publication is a final directory rename only after all files succeed.
Existing artifacts are not overwritten. Publication and quota checks are
serialized within one host; multiple independent processes sharing one output
root are not supported. Use separate roots per host.

Original data remains in `spec.json` and is sensitive if your inputs are
sensitive. Native PNG preview bytes also persist in OpenCode history and go to
the configured image-capable model on continuation. Artifacts have no automatic
expiry or global disk quota, so archive them deliberately. Cancellation cleans
only exact files from the current unfinished publication; completed reports from
a partly generated gallery are retained. A crashed process can leave a private
`.pending-*` directory for operator review.

## Development

```sh
bun run check         # strict TypeScript and focused unit/integration contracts
bun run test:host     # isolated @opencode/sdk 2.0.18 host
bun run test:gallery  # every example, both themes, real render adapters
bun run examples      # materialize and inspect the complete export
```

Host tests use isolated HOME/XDG/config/database directories and a deterministic
loopback provider. They exercise production rendering, direct and Code Mode
tools, permission denial, native PNG bytes forwarded to model continuation,
installed local-directory discovery, and persistence after host reopening. They
do not use OAuth, paid inference, or a running OpenCode service. They do not by
themselves prove that a particular desktop client's preview bridge is connected;
that remains a separate live presentation check.

Implementation entry points: `src/catalog/` owns typed definitions and semantic
validation; `src/components/registry.tsx` implements the image registry;
`src/charts/` adapts ECharts; `src/render/` handles layout and workers;
`src/artifacts/` publishes session artifacts; `src/index.ts` registers native
tools and guidance. See [third-party notices](https://unpkg.com/hffmnnj.jsonui/THIRD_PARTY_NOTICES.md).

## License

MIT. Bundled IBM Plex fonts are licensed under the SIL Open Font License 1.1;
dependency licenses and attribution are in
[THIRD_PARTY_NOTICES.md](https://unpkg.com/hffmnnj.jsonui/THIRD_PARTY_NOTICES.md).
