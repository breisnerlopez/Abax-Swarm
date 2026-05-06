// Probe: scope=minor blocks discovery deliverables specifically (now
// that discovery is a real phase with deliverable ids).
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const projectDir = Bun.argv[2];
if (!projectDir) {
  console.error("usage: bun run probe-discovery.ts <projectDir>");
  process.exit(1);
}

// Plant iteration signal
const bitacora = join(projectDir, "docs/bitacora.md");
if (!existsSync(bitacora)) {
  mkdirSync(join(projectDir, "docs"), { recursive: true });
  writeFileSync(bitacora, "# Bitácora\n", "utf8");
}

// Pin scope = minor (skip_phases includes discovery and inception)
const stateFile = join(projectDir, ".opencode/iteration-state.json");
mkdirSync(join(projectDir, ".opencode"), { recursive: true });
writeFileSync(
  stateFile,
  JSON.stringify({ schema_version: 1, active_scope: "minor", activated_at: "now", rationale: "test" }),
  "utf8",
);

// @ts-expect-error
const mod = await import(`${projectDir}/.opencode/plugins/abax-policy.ts`);
const plugin = mod.default;
const hooks = await plugin({
  client: null, project: null, directory: projectDir, worktree: "",
  experimental_workspace: { register: () => {} },
  serverUrl: new URL("http://localhost"), $: null,
});
const before = hooks["tool.execute.before"];

let pass = 0, fail = 0;
async function probe(label: string, expect: "block" | "allow", input: any, output: any) {
  try {
    await before?.(input, output);
    if (expect === "allow") { console.log(`  ✓ ${label}`); pass++; }
    else { console.log(`  ✗ ${label}: expected BLOCK`); fail++; }
  } catch (e) {
    if (expect === "block") {
      console.log(`  ✓ ${label} — ${(e as Error).message.split("\n")[0].slice(0, 110)}`);
      pass++;
    } else {
      console.log(`  ✗ ${label}: expected ALLOW — ${(e as Error).message.slice(0, 100)}`);
      fail++;
    }
  }
}

console.log(`\nProject: ${projectDir} (scope=minor)`);
console.log("\n── Discovery deliverables (Phase 0) — minor's skip_phases ──");
await probe(
  "discovery / vision-producto → block (skip_phases)",
  "block",
  { tool: "task", sessionID: "t", callID: "1" },
  { args: { agent: "business-analyst", phase: "discovery", deliverable: "vision-producto", prompt: "vision" } },
);
await probe(
  "discovery / epicas-features → block",
  "block",
  { tool: "task", sessionID: "t", callID: "2" },
  { args: { agent: "business-analyst", phase: "discovery", deliverable: "epicas-features", prompt: "epicas" } },
);
await probe(
  "discovery / historias-usuario → block",
  "block",
  { tool: "task", sessionID: "t", callID: "3" },
  { args: { agent: "business-analyst", phase: "discovery", deliverable: "historias-usuario", prompt: "stories" } },
);

console.log("\n── Construction (full_phase under minor) ──");
await probe(
  "construction → allow",
  "allow",
  { tool: "task", sessionID: "t", callID: "4" },
  { args: { agent: "developer-backend", phase: "construction", prompt: "implement reranker" } },
);

unlinkSync(stateFile);
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
