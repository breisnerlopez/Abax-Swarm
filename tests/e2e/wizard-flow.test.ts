// E2E test for the wizard: spawns the real `node dist/cli/app.js init --dry-run`
// in a PTY, sends keystrokes, asserts on the rendered output. Catches regressions
// that ink-testing-library can't (real Ink rendering, real keyboard handling, real
// step transitions including the new permissions/isolation steps in 0.1.14).
//
// One happy-path scenario covering all 12 wizard steps with defaults. Optimised
// for speed: short sleeps, tight waitFor patterns, single test file. ~20s total.
//
// Runs separately from `npm test` via `npm run test:e2e` to keep the unit/integration
// suite fast for CI.
import { describe, it, expect, beforeAll } from "vitest";
import { spawn as ptySpawn, IPty } from "node-pty";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../..");
const CLI = join(REPO_ROOT, "dist/cli/app.js");

beforeAll(() => {
  if (!existsSync(CLI)) {
    throw new Error(
      `Built CLI not found at ${CLI}. Run 'npm run build' before running E2E tests.`,
    );
  }
});

function spawn(args: string[]): { proc: IPty; buf: { value: string } } {
  // cwd is /tmp so that even if the TextInput-backspace clearing fails
  // partially, the concat path still resolves to something inside /tmp
  // (which the sandbox allows). The wizard uses process.cwd() as the
  // pre-filled value of the target-dir input since 0.1.7.
  const proc = ptySpawn("node", [CLI, ...args], {
    cols: 140,
    rows: 50,
    cwd: "/tmp",
    env: { ...process.env, TERM: "xterm-256color", FORCE_COLOR: "0" },
  });
  const buf = { value: "" };
  proc.onData((d) => { buf.value += d; });
  return { proc, buf };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitFor(buf: { value: string }, pattern: RegExp, ms = 5000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (pattern.test(buf.value)) return;
    await sleep(50);
  }
  throw new Error(
    `Timeout waiting for ${pattern}.\nLast 800 chars:\n${buf.value.slice(-800)}`,
  );
}

describe("E2E wizard: full new-mode flow with all defaults", () => {
  it("navigates 12 steps including new permissions+isolation and reaches dry-run summary", async () => {
    const targetDir = mkdtempSync(join(tmpdir(), "abax-e2e-"));
    const { proc, buf } = spawn(["init", "--dry-run"]);
    try {
      await waitFor(buf, /Directorio del proyecto/);

      // Clear the cwd-prefilled TextInput then type the target dir.
      // Use BS (\x08) which ink-text-input handles natively. Send in chunks
      // of 20 with 100ms sleeps so ink processes each batch.
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 20; j++) proc.write("\b");
        await sleep(100);
      }
      proc.write(targetDir);
      await sleep(200);
      proc.write("\r");

      // Step 2: project-mode (NEW) — pick "Implementar algo nuevo" (default)
      await waitFor(buf, /Modo de proyecto/);
      expect(buf.value).toMatch(/Implementar algo nuevo/);
      expect(buf.value).toMatch(/Documentar algo existente/);
      proc.write("\r");

      // Step 3: platform = OpenCode (default)
      await waitFor(buf, /Plataforma destino/);
      proc.write("\r");

      // Step 3b: model-strategy = Personalizado (default)
      await waitFor(buf, /Asignación de modelos/);
      proc.write("\r");

      // Step 3c: provider = Anthropic (default)
      await waitFor(buf, /Proveedor de IA/);
      proc.write("\r");

      // Step 3d: permissions (NEW in 0.1.14)
      await waitFor(buf, /Permisos de OpenCode/);
      expect(buf.value).toMatch(/Recomendado/);
      expect(buf.value).toMatch(/Acceso completo/);
      proc.write("\r");

      // Step 3e: isolation (NEW in 0.1.14)
      await waitFor(buf, /Aislamiento del entorno/);
      expect(buf.value).toMatch(/Devcontainer/);
      expect(buf.value).toMatch(/Host/);
      proc.write("\r");

      // Step 4: description (defaults)
      await waitFor(buf, /Información del proyecto/);
      proc.write("\r");

      // Step 5: size = Pequeño (default)
      await waitFor(buf, /Clasificación del proyecto/);
      proc.write("\r");

      // Step 5b: criteria — confirm with empty selection
      await waitFor(buf, /Características del proyecto/);
      proc.write("\r");

      // Step 6: stack — first option (default)
      await waitFor(buf, /Selección de stack tecnológico/);
      proc.write("\r");

      // Step 7: role-scope = full (default)
      await waitFor(buf, /Revisión de equipo/);
      proc.write("\r");

      // Step 7b: role-edit — confirm with C
      await waitFor(buf, /Equipo actual.*roles/, 8000);
      proc.write("\r");

      // Step 8: confirm — verify sidebar shows the new fields
      await waitFor(buf, /Confirmación y generación/, 10000);
      expect(buf.value).toMatch(/Permisos/);
      expect(buf.value).toMatch(/Aislamiento/);
      proc.write("\r");

      // Final: dry-run summary
      await waitFor(buf, /Modo dry-run.*archivos se generarían/, 10000);
    } finally {
      proc.kill();
      rmSync(targetDir, { recursive: true, force: true });
    }
  }, 45000);
});
