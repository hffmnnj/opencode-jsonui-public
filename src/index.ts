import { Plugin, Skill } from "@opencode/plugin";
import { Error as ToolError } from "@opencode/plugin/promise/tool";
import { z } from "zod";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { definitions, rawSpecSchema, renderInputSchema } from "./catalog/schema.ts";
import { chartSchemas } from "./catalog/charts.ts";
import { artifactSchema } from "./artifacts/store.ts";
import { getExamples } from "../examples/catalog.ts";
import { VisualService } from "./service.ts";
import { publicError, VisualError } from "./errors.ts";
import { generateGallery } from "./gallery.ts";

export const optionsSchema = z.object({
  outputDirectory: z.string().min(1).max(2048).optional(),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
  maxArtifactsPerSession: z.number().int().min(1).max(500).default(100),
}).strict();
const toolInput = renderInputSchema.omit({ spec: true }).extend({ spec: rawSpecSchema.optional(), example: z.string().min(1).max(80).optional() })
  .refine(value => Boolean(value.spec) !== Boolean(value.example), "Provide exactly one of spec or example.");

export async function registerJsonui(ctx: Plugin.Context, rawOptions: unknown = {}, codemode = true): Promise<() => Promise<void>> {
  const options = optionsSchema.parse(rawOptions);
  const service = new VisualService({ ...options, outputDirectory: options.outputDirectory ? resolve(ctx.location.directory, options.outputDirectory) : join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "opencode-jsonui", "artifacts") });
  const shutdown = new AbortController();
  let galleryRunning = false;
  const skillPath = fileURLToPath(new URL("../skills/jsonui/SKILL.md", import.meta.url));
  const content = (await readFile(skillPath, "utf8")).replace(/^---\n[\s\S]*?\n---\n/, "");
  await ctx.skill.transform(editor => editor.add({ id: Skill.ID.make("jsonui"), name: Skill.Name.make("JSONUI visual reports"), description: "Create polished charts, analytics, diagrams and image reports using the native JSONUI tools, then present the generated PNGs to the user.", path: Skill.Info.fields.path.make(skillPath), content }));
  await ctx.tool.transform(editor => {
    editor.namespace({ name: "jsonui", description: "Native offline visual reports using Vercel json-render. Discover schemas/examples, render charts and diagrams, and always present the generated PNG images to the user." });
    editor.add({ name: "catalog", description: "Discover the visual library. Start without a name for a concise inventory, then request the schema for one component or chart kind.",
      input: z.object({ category: z.enum(["components", "charts"]).default("components"), name: z.string().max(80).optional() }).strict(),
      options: { namespace: "jsonui", codemode: true },
      execute: async ({ category, name }) => {
        if (category === "charts") {
          if (name && !Object.hasOwn(chartSchemas, name)) throw new ToolError({ message: "Unknown chart kind. List the chart catalog first." });
          const result = name ? z.toJSONSchema(chartSchemas[name as keyof typeof chartSchemas]) : { kinds: Object.keys(chartSchemas), component: "Chart", details: "Request a kind by name to see its props schema. Bar supports horizontal, grouped and stacked variants; line/area support multiple series and missing-data gaps." };
          return { content: JSON.stringify(result) };
        }
        if (name && !Object.hasOwn(definitions, name)) throw new ToolError({ message: "Unknown component. List the component catalog first." });
        const result = name ? { name, ...definitions[name as keyof typeof definitions], props: z.toJSONSchema(definitions[name as keyof typeof definitions].props) } : { format: "{root, elements: {id: {type, props, children}}}", root: "Report", components: Object.entries(definitions).map(([name, definition]) => ({ name, description: definition.description, children: definition.slots.length > 0 })) };
        return { content: JSON.stringify(result) };
      },
    });
    editor.add({ name: "examples", description: "List curated synthetic examples, or retrieve one complete json-render spec by name. Pass its name to render to generate and attach its PNGs.",
      input: z.object({ name: z.string().min(1).max(80).optional() }).strict(), options: { namespace: "jsonui", codemode: true },
      execute: async ({ name }) => {
        const examples = await getExamples();
        if (!name) return { content: JSON.stringify(examples.map(({ id, title, category, description }) => ({ id, title, category, description }))) };
        const example = examples.find(example => example.id === name);
        if (!example) throw new ToolError({ message: "Unknown example. List examples first." });
        return { content: JSON.stringify(example) };
      },
    });
    editor.add({ name: "render", description: "Render a json-render spec or a named synthetic example into PNG pages. Returns ACTUAL image attachments plus full artifact paths. Always present the images to the user; call browser.preview on each previewPath when available, then explain briefly. Offline; no arbitrary paths, HTML or JavaScript.",
      input: toolInput, output: artifactSchema,
      options: { namespace: "jsonui", codemode, permission: "jsonui_render" },
      execute: async ({ example, spec, ...renderOptions }, context) => {
        const signal = AbortSignal.any([context.signal, shutdown.signal]);
        signal.throwIfAborted();
        try {
          const resolvedSpec = spec ?? (await getExamples()).find(item => item.id === example)?.spec;
          if (!resolvedSpec) throw new VisualError("VALIDATION", "Unknown example. Use jsonui.examples to list available names.");
          await context.progress({ status: "Rendering local visual report" });
          return await service.render(context.sessionID, { ...renderOptions, spec: resolvedSpec }, signal);
        } catch (error) {
          if (signal.aborted) throw error;
          throw new ToolError({ message: publicError(error) });
        }
      },
    });
    editor.add({ name: "gallery", description: "Generate the complete synthetic example library in both themes, a self-contained HTML gallery with PNG/JSON/chart-SVG downloads, and attached PNG overview sheets covering every example. Takes about a minute. Use when the user asks for the full library, not for an ordinary report. Present the attached sheets and gallery path.",
      input: z.object({}).strict(),
      output: z.object({ indexPath: z.string(), manifestPath: z.string(), variants: z.number(), overviews: z.array(artifactSchema) }),
      options: { namespace: "jsonui", codemode, permission: "jsonui_render" },
      execute: async (_input, context) => {
        if (galleryRunning) throw new ToolError({ message: "A gallery is already rendering. Wait for it to finish." });
        galleryRunning = true;
        const signal = AbortSignal.any([context.signal, shutdown.signal, AbortSignal.timeout(180_000)]);
        try {
          const owner = createHash("sha256").update(context.sessionID).digest("hex").slice(0, 32);
          const base = join(service.store.root, owner, "galleries");
          const existing = await readdir(base).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return []; throw error; });
          if (existing.length >= 3) throw new VisualError("LIMIT", "Session gallery quota reached. Reuse or archive previous galleries.");
          const gallery = await generateGallery(base, signal, ["light", "dark"], async status => { await context.progress({ status }); });
          const output = { indexPath: gallery.indexPath, manifestPath: gallery.manifestPath, variants: gallery.entries.length, overviews: gallery.overviews };
          const images = await Promise.all(gallery.overviews.flatMap(artifact => artifact.pages).map(async (page, index) => ({
            type: "file" as const, mime: "image/png", name: `jsonui-atlas-${index + 1}.png`, uri: `data:image/png;base64,${(await readFile(page.previewPath)).toString("base64")}`,
          })));
          if (images.reduce((sum, image) => sum + image.uri.length, 0) > 12 * 1024 * 1024) throw new VisualError("LIMIT", "Gallery previews exceed the attachment budget.");
          return { output, content: [{ type: "text" as const, text: JSON.stringify({ ...output, presentation: "Present the attached overview sheets. Open indexPath with browser.preview when connected. Full-size PNGs, exact JSON inputs and chart-only SVGs are in the standalone gallery." }) }, ...images] };
        } catch (error) {
          if (signal.aborted) throw error;
          throw new ToolError({ message: publicError(error) });
        } finally { galleryRunning = false; }
      },
    });
  });
  return async () => { shutdown.abort(); await service.close(); };
}

export default Plugin.define({ id: "jsonui", async setup(ctx) { return await registerJsonui(ctx, ctx.options); } });
