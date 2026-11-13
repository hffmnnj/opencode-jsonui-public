import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("V2 persists PNG bytes and forwards them to the next model request, directly and through Code Mode", async () => {
  const temporary = tmpdir();
  const root = await mkdtemp(join(temporary, "opencode-jsonui-host-"));
  const child = Bun.spawn([process.execPath, fileURLToPath(new URL("fixture.ts", import.meta.url)), root, temporary], {
    cwd: root,
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: join(root, "home"), TMPDIR: root,
      XDG_CONFIG_HOME: join(root, "config-home"), XDG_DATA_HOME: join(root, "data"),
      XDG_CACHE_HOME: join(root, "cache"), XDG_STATE_HOME: join(root, "state"), OPENCODE_CONFIG_DIR: join(root, "config") },
    stdout: "pipe", stderr: "pipe", timeout: 90_000,
  });
  const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  expect({ exit, stderr, stdout }).toMatchObject({ exit: 0 });
  expect(stdout).toContain('"nativeDelivery":"verified"');
}, 100_000);
