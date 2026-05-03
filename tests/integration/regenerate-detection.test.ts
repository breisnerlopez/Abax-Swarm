import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

const TMP_ROOT = join(tmpdir(), `abax-regenerate-${process.pid}`);
const REPO_ROOT = join(__dirname, "..", "..");
const CLI = join(REPO_ROOT, "node_modules", ".bin", "tsx") + " " + join(REPO_ROOT, "src/cli/app.ts");

beforeAll(() => {
  mkdirSync(TMP_ROOT, { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_ROOT)) rmSync(TMP_ROOT, { recursive: true, force: true });
});

function setupProjectWithExistingDocs(): string {
  const dir = join(TMP_ROOT, `proj-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  // Minimal manifest so regenerate can run
  writeFileSync(
    join(dir, "project-manifest.yaml"),
    `project:
  name: regen-test
  description: test
  size: small
  stack: react-nextjs
  target: opencode
  team_scope: full
  provider: anthropic
  model_strategy: inherit
  permission_mode: recommended
  isolation_mode: devcontainer
criteria_applied: []
`,
  );
  // Pre-existing docs (this is what regenerate must detect)
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "vision.md"), "# v1 vision");
  return dir;
}

describe("regenerate command: detection is re-run (bug 0.1.27 fix)", () => {
  it("emits the existingDocs anti-overwrite block when docs/*.md preexist", () => {
    const dir = setupProjectWithExistingDocs();
    execSync(`${CLI} regenerate --dir ${dir}`, { cwd: REPO_ROOT, stdio: "pipe" });
    const orch = readFileSync(join(dir, ".opencode/agents/orchestrator.md"), "utf-8");
    // Anti-overwrite reinforced section must appear because docs/ has .md files
    expect(orch).toMatch(/Protocolo de actualizacion de documentacion existente/);
    expect(orch).toMatch(/anti-overwrite/);
    expect(orch).toMatch(/ATENCION — POSIBLE ARCHIVO PREEXISTENTE/);
    expect(orch).toMatch(/iteration-strategy/);
  });

  it("does NOT emit anti-overwrite when docs/ has no .md files", () => {
    const dir = join(TMP_ROOT, `proj-no-docs-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "project-manifest.yaml"),
      `project:
  name: regen-test-clean
  description: test
  size: small
  stack: react-nextjs
  target: opencode
  team_scope: full
  provider: anthropic
  model_strategy: inherit
  permission_mode: recommended
  isolation_mode: devcontainer
criteria_applied: []
`,
    );
    execSync(`${CLI} regenerate --dir ${dir}`, { cwd: REPO_ROOT, stdio: "pipe" });
    const orch = readFileSync(join(dir, ".opencode/agents/orchestrator.md"), "utf-8");
    expect(orch).not.toMatch(/ATENCION — POSIBLE ARCHIVO PREEXISTENTE/);
    expect(orch).not.toMatch(/anti-overwrite/);
  });
});
