# OpenCode JSONUI

Native OpenCode **V2 only** plugin for polished, data-driven PNG reports. Target
OpenCode 2.0.18 and Bun 1.4.2. Desktop/web is the primary delivery surface.

## Boundaries

- This is a new package. The prior `/home/example/Documents/prior-renderer`
  is read-only inspiration, not a dependency or a migration target.
- Do not modify unrelated projects, the old renderer, shared OpenCode configuration, or the
  running service during package development. The coordinator owns installation.
- No V1 adapter, MCP server, deployment, paid inference, or external data service.
- Preserve concurrent changes. Do not commit, reset, clean, stash, or recursively
  delete files. Use the patch tool for source edits.
- Managed workers must not delegate or start nested runs.

## Architecture

- Use `@opencode/plugin` 2.0.18 native tools and lifecycle; plain `opencode` on this
  machine is V1. The V2 executable is `/home/example/.local/bin/opencodev2`.
- Use actual `@json-render/core` and `@json-render/image` 0.21.0 catalog/registry
  and rendering APIs. Do not recreate a giant renderer or patch library internals.
- One chart engine: Apache ECharts 6.1.0 SVG SSR. Compose chart layers with Vercel's
  image renderer and rasterize with resvg. Bundle licensed static font files.
- Keep input schemas, components, catalog documentation, and example inventory
  derived from one typed definition. No arbitrary ECharts options, JS callbacks,
  raw HTML, remote asset fetches, or caller-controlled output paths.
- Render locally and offline. Isolate CPU-heavy rendering with cancellation,
  bounded queue/concurrency, timeouts, and strict byte/pixel/data/graph limits.
- Use plugin-owned, session-scoped artifacts. A result is published only after
  complete success; preserve existing files and do not log raw datasets.

## Delivery is a product requirement

- A local image path alone is not delivery. Return bounded native PNG file content
  plus compact artifact metadata and a full-resolution on-disk artifact.
- In OpenCode 2.0.18, tool-result `file://` URIs are NOT resolved to model image
  bytes by `@opencode/ai`'s `toolFileMedia`. Use an actual PNG data URL in file
  content, including MIME and name. Verify this in a real isolated host.
- Check both direct tool calls and Code Mode. Keep rendering direct if Code Mode
  loses image content. Do not synthesize user prompts to insert an image.
- Bundle concise agent guidance: after rendering, present the image, using the
  desktop `browser.preview` tool when available, and give a brief explanation.
- PNG is first-class for every output. Retain JSON specs; chart-only SVG must be
  labeled honestly. A static HTML gallery is not an interactive report renderer.

## Visual and analytical contract

- Provide light/dark themes with semantic tokens and bundled IBM Plex Sans/Mono
  static fonts (or a documented equivalent if unavailable), readable captions,
  direct annotations, and source/time-window footers. Check actual font licenses.
- Include metric cards, charts, formatted tables, report/dashboard composition,
  hierarchies/flow/planning diagrams, and annotated image/insight boards.
- Chart families: line, area, bar (horizontal/grouped/stacked), donut/pie,
  scatter/bubble, histogram, boxplot, heatmap/calendar/cohort, waterfall, funnel,
  treemap, sunburst, Sankey, candlestick, target/bullet, and sparkline.
- Planning outputs: timeline, Gantt/roadmap, hierarchy, and constrained flow.
- Missing data is not zero. Do not silently truncate, aggregate, or invent data.
  Distinguish percent changes from percentage points. Label demo data synthetic.
- Gallery completeness means every advertised chart/diagram/template and export
  format has a real rendered example, with both themes exercised.

## Verification

- Load `testing-on-the-toilet` before writing tests and a design skill for visual
  implementation. Tests must assert observable contracts, not source strings or
  a mock's own configured result. PNG magic bytes alone are insufficient.
- Use real installed json-render/ECharts/resvg adapters. Test numerical cases,
  empty/missing/negative data, long labels, invalid references, resource limits,
  cancellation, permissions, artifact isolation, and native media persistence.
- Host tests use `@opencode/sdk` 2.0.18, isolated HOME/XDG/config/database under
  `/var/tmp/example/opencode`, and a deterministic loopback provider, not real OAuth
  or paid inference. the unrelated project's `tests/host` provide read-only integration examples.
- Provide `bun run check`, `bun run test:host`, `bun run test:gallery`, and
  `bun run examples` scripts. Inspect generated images before claiming polish.
- Report commands actually run, concrete results, and any unverified behavior.
