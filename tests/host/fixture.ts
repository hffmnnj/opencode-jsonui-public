import assert from "node:assert/strict";
import { mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { registerJsonui } from "../../src/index.ts";

const root = process.argv[2]!;
const temporary = process.argv[3]!;
assert(root === resolve(root) && dirname(root) === resolve(temporary) && root.startsWith(join(temporary, "opencode-jsonui-host-")) && process.env.TMPDIR === root && process.env.HOME === join(root, "home"));
const directory = join(root, "workspace");
await mkdir(directory, { recursive: true });
let step = 0;
let mode: "direct" | "code" | "denied" | "installed" = "direct";
const requests: unknown[] = [];
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
  const body = await request.json() as { stream?: boolean };
  requests.push(body);
  const call = mode === "code" || mode === "installed"
    ? { name: "execute", arguments: JSON.stringify({ code: 'return await tools.jsonui.render({ example: "insight" });' }) }
    : { name: "jsonui_render", arguments: JSON.stringify({ example: "insight" }) };
  const tool = step++ === 0 ? { id: `call_${mode}`, type: "function", function: call } : undefined;
  const base = { id: `response_${step}`, created: 1, model: "fixture" };
  if (!body.stream) return Response.json({ ...base, object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: "Done" }, finish_reason: "stop" }] });
  return new Response([
    { ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: tool ? { role: "assistant", tool_calls: [{ index: 0, ...tool }] } : { role: "assistant", content: "Image received" }, finish_reason: null }] },
    { ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: tool ? "tool_calls" : "stop" }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } },
  ].map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
} });

const { OpenCode } = await import("@opencode/sdk");
const { Plugin, Provider, Model } = await import("@opencode/plugin");
const fixture = Plugin.define({ id: "jsonui.fixture", async setup(ctx) {
  await ctx.session.hook("title", event => { event.result = "JSONUI fixture"; });
  const providerID = Provider.ID.make("jsonuitest");
  const model = Model.Info.default(providerID, Model.ID.make("fixture"));
  await ctx.provider.transform(editor => editor.add({
    info: { ...Provider.Info.empty(providerID), activation: "enabled", package: "@opencode/ai/providers/openai-compatible", settings: { baseURL: `http://127.0.0.1:${server.port}/v1`, apiKey: "synthetic" } },
    models: [{ ...model, capabilities: { ...model.capabilities, tools: true, input: ["text", "image"] }, limit: { context: 32768, output: 4096 } }],
  }));
   if (mode !== "installed") return await registerJsonui(ctx, { outputDirectory: join(root, "artifacts") }, mode === "code");
} });

const hostOptions = { app: { name: "jsonui-tests", version: "2.0.18" }, database: { path: join(root, "host.sqlite") },
  config: { directory: join(root, "config"), project: false, content: JSON.stringify({ update: "disable", model: "jsonuitest/fixture", plugins: ["*", "-opencode.provider.*"] }) },
  models: { fetch: false, snapshot: false }, fs: { filewatcher: false, fff: false }, plugins: [fixture] };
const persisted: { sessionID: string; png: string }[] = [];
const createHost = () => OpenCode.create(mode !== "installed" ? hostOptions : {
  ...hostOptions,
  config: { ...hostOptions.config, content: JSON.stringify({ update: "disable", model: "jsonuitest/fixture", plugins: ["*", "-opencode.provider.*", { package: fileURLToPath(new URL("../../", import.meta.url)), options: { outputDirectory: join(root, "artifacts") } }] }) },
});
try {
  for (const scenario of ["direct", "code", "denied", "installed"] as const) {
    mode = scenario; step = 0; requests.length = 0;
    const host = await createHost();
    try {
      const session = await host.session.create({ location: { directory }, agent: "build", model: { providerID: "jsonuitest", id: "fixture" },
        permissions: [{ action: "*", resource: "*", effect: "allow" }, ...(mode === "denied" ? [{ action: "jsonui_render", resource: "*", effect: "deny" as const }] : [])],
      });
      const artifactsBefore = (await readdir(join(root, "artifacts"), { recursive: true }).catch(() => [])).sort();
      await host.session.prompt({ sessionID: session.id, text: "Render one delivery proof" });
      await host.session.wait({ sessionID: session.id }, { signal: AbortSignal.timeout(30_000) });
      const raw = JSON.stringify(await host.session.context({ sessionID: session.id }));
      const urls = raw.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g) ?? [];
      if (mode === "denied") {
        assert.equal(urls.length, 0, "Denied render must not produce an image"); assert.match(raw, /denied|permission/i);
        assert.deepEqual((await readdir(join(root, "artifacts"), { recursive: true })).sort(), artifactsBefore, "Denied tool must not write any artifact");
      }
      else {
        assert(urls.length > 0, `${mode}: native history must contain PNG media, not just a path. ${raw.slice(-3000)}`);
        const png = urls[0]!;
        const metadata = await sharp(Buffer.from(png.split(",")[1]!, "base64")).metadata();
        assert.equal(metadata.width, 1200); assert(metadata.height! > 300 && metadata.height! <= 1600);
        assert(JSON.stringify(requests.slice(1)).includes(png), `${mode}: actual PNG bytes must reach model continuation`);
        assert(raw.includes("-page-1.png"));
        persisted.push({ sessionID: session.id, png });
      }
    } finally { await host.close(); }
  }
   const reopened = await createHost();
  try {
    for (const entry of persisted) assert(JSON.stringify(await reopened.session.context({ sessionID: entry.sessionID })).includes(entry.png), "Image bytes must survive a host restart");
  } finally { await reopened.close(); }
   console.log(JSON.stringify({ nativeDelivery: "verified", modes: ["direct", "code", "installed"], persisted: persisted.length, denied: true, root }));
} finally { await server.stop(true); }
