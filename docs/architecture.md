# Architecture decisions

## Native V2, not an MCP wrapper

OpenCode 2.0.18 provides `Plugin.define`, native tool registration, lifecycle
cleanup, permissions, progress, and skill registration. These are a better fit
than starting a separate JSON-RPC/MCP process for a local renderer. The package
does not import or modify the earlier renderer.

The official sources used for API research were:

- [V2 plugin development](https://opencode.ai/v2/docs/build/plugins)
- [V2 plugin installation/reload](https://opencode.ai/v2/docs/plugins)
- [V2 embedded SDK](https://opencode.ai/v2/docs/build/sdk)
- [Vercel json-render image API](https://json-render.dev/docs/api/image)
- Installed, pinned ECharts/json-render/OpenCode implementation and types.

## Vercel composition with one chart engine

The shared Zod definitions feed the real `defineCatalog(imageSchema, …)` catalog,
schema discovery, input types, validation, component registry, and example
coverage checks. `@json-render/image` performs report composition through
`renderToSvg` and a custom registry; resvg rasterizes the report. ECharts owns
chart SVG generation. No library internals are patched.

Fontkit measures the exact bundled static fonts. Layout determines explicit
line breaks, row heights, page boundaries, and diagram limits before rendering.
Charts are raster layers inside report composition; optional standalone chart
SVGs retain their vectors and embed the font files. This avoids claiming a
vector export of a dashboard that actually contains raster chart layers.

## Media delivery is part of the tool contract

In the pinned OpenCode host, `file://` tool-result URIs are not resolved by the
model media adapter into image bytes. A successful tool therefore returns:

1. Compact typed artifact metadata and a text summary.
2. Native file content with `mime: "image/png"`, a name, and a real PNG data URL.
3. Full-resolution PNGs, exact input, optional chart SVGs, and a manifest on disk.

The SDK host fixture proves that direct calls and Code Mode preserve the bytes,
forward them to the next image-capable provider request, and keep them after
reopening the host. Discovery and rendering can consequently use Code Mode.
The bundled skill asks the agent to present these images immediately and use
the desktop `browser.preview` bridge when connected.

## Isolation and bounded work

A Bun subprocess per render makes CPU work cancellable even during synchronous
ECharts/resvg operations. It avoids blocking the OpenCode process and prevents
retained renderer state accumulating across requests. A bounded pool limits
parallelism. Native permission approval precedes the service call; cancellation
propagates through queue, process, and publication boundaries.

Strict schemas exclude arbitrary JavaScript, raw HTML, URLs, paths, dynamic
expressions, and arbitrary ECharts options. Raster decoding has its own pixel,
frame, MIME, and byte limits. The worker receives no provider credentials.
This is deliberately not a claim of kernel-level sandboxing.

## Non-obvious integration fixes

- The pinned 2.0.18 local-directory loader resolves root `server` or `index`
  files, not `package.json` exports. `index.ts` is a small forwarding entrypoint.
  The host test loads the directory from configuration in addition to testing
  programmatic registration, so an undiscoverable installed package cannot pass.
- ECharts SVG SSR emitted invalid XML when a graphic text style used a quoted
  shorthand such as `font: '600 32px "IBM Plex Sans"'`. Use separate `fontFamily`,
  `fontSize`, and `fontWeight`; the real donut renderer is a regression case.
- Graph `view` auto-fit stretched collinear flow nodes in ECharts 6.1.0. Hidden
  Cartesian axes with explicit coordinates avoid the degenerate bounding box.
  Square node symbols also match ECharts' edge-clearance calculation, keeping
  arrowheads outside nodes. A real raster regression checks bounds/connections.
- Bun's async test matchers can settle a promise before the next statement.
  Attach a rejection handler, abort, then assert the result when testing queued
  cancellation. Do not delay the cancellation behind a matcher waiting for it.

## Intentional limits

This is a local image-report library, not an unrestricted browser dashboard or
general graph-layout language. Inputs that would be illegible fail instead of
being silently aggregated or dropped. Static HTML indexes are explicitly
separate from the rendering contract. The old renderer remains inspiration
only, not a migration target or dependency.
