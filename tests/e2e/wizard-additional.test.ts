// Tier E ampliado — Wizard PTY tests for non-default flows.
//
// Complements wizard-flow.test.ts (the happy path with all defaults).
// These cover:
//   - Document mode (step 2: pick "Documentar algo existente")
//   - Claude target (step 3: arrow down to claude)
//   - OpenAI provider (step 3c: arrow down to openai)
//
// Same helpers as wizard-flow.test.ts; copied inline to avoid coupling.
// Each scenario is a separate test with its own PTY lifecycle.
import { describe, it, expect, beforeAll } from "vitest";
import { spawn as ptySpawn, IPty } from "node-pty";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../..");
const CLI = join(REPO_ROOT, "dist/cli/app.js");

beforeAll(() => {
  if (!existsSync(CLI)) {
    throw new Error(`Built CLI not found at ${CLI}. Run 'npm run build' first.`);
  }
});

function spawn(args: string[]): { proc: IPty; buf: { value: string } } {
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

async function clearAndType(proc: IPty, text: string): Promise<void> {
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 20; j++) proc.write("\b");
    await sleep(100);
  }
  proc.write(text);
  await sleep(200);
  proc.write("\r");
}

describe("E2E wizard: claude target flow", () => {
  it("navigates to claude target via arrow-down on platform step", async () => {
    const targetDir = mkdtempSync(join(tmpdir(), "abax-e2e-cc-"));
    const { proc, buf } = spawn(["init", "--dry-run"]);
    try {
      await waitFor(buf, /Directorio del proyecto/);
      await clearAndType(proc, targetDir);

      await waitFor(buf, /Modo de proyecto/);
      proc.write("\r"); // new

      // Step 3: platform — arrow down to "Claude Code", then Enter
      await waitFor(buf, /Plataforma destino/);
      expect(buf.value).toMatch(/OpenCode/);
      expect(buf.value).toMatch(/Claude Code/i);
      proc.write("\x1b[B"); // arrow down
      await sleep(150);
      proc.write("\r");

      // Continue defaults until we either complete or hit a target-specific step
      // Just verify we got past platform without crashing — that's the bug guard.
      await waitFor(buf, /Asignación de modelos/, 5000);
      // success: claude-targeted wizard advances normally
    } finally {
      proc.kill();
      rmSync(targetDir, { recursive: true, force: true });
    }
  }, 30000);
});

describe("E2E wizard: document mode flow", () => {
  it("step 2 selecting 'Documentar algo existente' enters document mode", async () => {
    const targetDir = mkdtempSync(join(tmpdir(), "abax-e2e-doc-"));
    const { proc, buf } = spawn(["init", "--dry-run"]);
    try {
      await waitFor(buf, /Directorio del proyecto/);
      await clearAndType(proc, targetDir);

      await waitFor(buf, /Modo de proyecto/);
      expect(buf.value).toMatch(/Documentar algo existente/);
      // Arrow down to document option
      proc.write("\x1b[B");
      await sleep(150);
      proc.write("\r");

      // Document mode lands on a different next step (typically the
      // doc-source multi-select). Assert the wizard advanced past step
      // 2 without crashing — the side panel updates to show step 3+.
      await waitFor(buf, /seleccionados de|Plataforma destino|Información del proyecto/, 5000);
      // success: document-mode selection didn't crash, wizard advanced
    } finally {
      proc.kill();
      rmSync(targetDir, { recursive: true, force: true });
    }
  }, 30000);
});

describe("E2E wizard: openai provider flow", () => {
  it("step 3c selecting OpenAI provider works without crash", async () => {
    const targetDir = mkdtempSync(join(tmpdir(), "abax-e2e-oai-"));
    const { proc, buf } = spawn(["init", "--dry-run"]);
    try {
      await waitFor(buf, /Directorio del proyecto/);
      await clearAndType(proc, targetDir);

      await waitFor(buf, /Modo de proyecto/);
      proc.write("\r"); // new

      await waitFor(buf, /Plataforma destino/);
      proc.write("\r"); // opencode

      await waitFor(buf, /Asignación de modelos/);
      proc.write("\r"); // personalizado

      await waitFor(buf, /Proveedor de IA/);
      expect(buf.value).toMatch(/Anthropic/i);
      expect(buf.value).toMatch(/OpenAI/i);
      proc.write("\x1b[B"); // arrow down to openai
      await sleep(150);
      proc.write("\r");

      // After provider, orchestrator-model step
      await waitFor(buf, /Modelo del orquestador/, 5000);
      // success: openai branch reached without crash
    } finally {
      proc.kill();
      rmSync(targetDir, { recursive: true, force: true });
    }
  }, 30000);
});
