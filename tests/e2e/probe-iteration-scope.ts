// Direct probe of iteration-scope enforcement.
// Bypasses the LLM. Tests:
//   1. With no active scope + project has bitacora → blocks discovery/inception
//   2. set-iteration-scope writes state file
//   3. With active scope=minor → blocks discovery (in skip_phases)
//   4. With active scope=minor → allows construction
//   5. With active scope=major → allows discovery (no skip)

import { existsSync, writeFileSync, unlinkSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const projectDir = Bun.argv[2];
if (!projectDir) {
  console.error("usage: bun run probe-iteration-scope.ts <projectDir>");
  process.exit(1);
}

// Make sure the project has iteration signals (touch bitacora.md)
const bitacora = join(projectDir, "docs/bitacora.md");
if (!existsSync(bitacora)) {
  mkdirSync(join(projectDir, "docs"), { recursive: true });
  writeFileSync(bitacora, "# Bitácora\n", "utf8");
}
const stateFile = join(projectDir, ".opencode/iteration-state.json");

// Reset state
try { unlinkSync(stateFile); } catch {}

// @ts-expect-error runtime import
const mod = await import(`${projectDir}/.opencode/plugins/abax-policy.ts`);
const plugin = mod.default;
const hooks = await plugin({
  client: null, project: null, directory: projectDir, worktree: "",
  experimental_workspace: { register: () => {} },
  serverUrl: new URL("http://localhost"), $: null,
});
const before = hooks["tool.execute.before"];

let pass = 0;
let fail = 0;

async function probe(label: string, expect: "block" | "allow", input: any, output: any) {
  try {
    await before?.(input, output);
    if (expect === "allow") {
      console.log(`  ✓ ${label}: passed`);
      pass++;
    } else {
      console.log(`  ✗ ${label}: PASSED but expected BLOCK`);
      fail++;
    }
  } catch (e) {
    if (expect === "block") {
      console.log(`  ✓ ${label}: blocked — ${(e as Error).message.split("\n")[0].slice(0, 100)}`);
      pass++;
    } else {
      console.log(`  ✗ ${label}: BLOCKED but expected ALLOW — ${(e as Error).message.slice(0, 100)}`);
      fail++;
    }
  }
}

console.log(`\nProject: ${projectDir}`);
console.log("\n── Phase 1: NO active scope, project has bitácora ──");
await probe(
  "discovery delegation → block (require_scope_for_phases)",
  "block",
  { tool: "task", sessionID: "t", callID: "1" },
  { args: { agent: "business-analyst", phase: "discovery", prompt: "Visión del Producto" } },
);
await probe(
  "inception delegation → block (require_scope_for_phases)",
  "block",
  { tool: "task", sessionID: "t", callID: "2" },
  { args: { agent: "project-manager", phase: "inception", prompt: "Acta de Constitución" } },
);
await probe(
  "construction delegation → allow (not in require_scope_for_phases)",
  "allow",
  { tool: "task", sessionID: "t", callID: "3" },
  { args: { agent: "developer-backend", phase: "construction", prompt: "small implementation" } },
);

console.log("\n── Phase 2: set scope=minor (skip_phases: discovery, inception) ──");
mkdirSync(join(projectDir, ".opencode"), { recursive: true });
writeFileSync(
  stateFile,
  JSON.stringify({ schema_version: 1, active_scope: "minor", activated_at: "now", rationale: "test" }),
  "utf8",
);
// Need to RE-LOAD plugin so it picks up the state file at hook invocation time
// (loadActiveScopeId reads at every call, so no reload needed actually — verify)
await probe(
  "discovery delegation → block (skip_phases under minor)",
  "block",
  { tool: "task", sessionID: "t", callID: "4" },
  { args: { agent: "business-analyst", phase: "discovery", prompt: "vision update" } },
);
await probe(
  "inception delegation → block (skip_phases under minor)",
  "block",
  { tool: "task", sessionID: "t", callID: "5" },
  { args: { agent: "project-manager", phase: "inception", prompt: "kickoff" } },
);
await probe(
  "construction → allow under minor",
  "allow",
  { tool: "task", sessionID: "t", callID: "6" },
  { args: { agent: "developer-backend", phase: "construction", prompt: "build feature" } },
);
await probe(
  "functional-analysis with deliverable=functional-spec → allow (in minimal_phases)",
  "allow",
  { tool: "task", sessionID: "t", callID: "7" },
  { args: { agent: "business-analyst", phase: "functional-analysis", deliverable: "functional-spec", prompt: "update spec" } },
);
await probe(
  "functional-analysis with deliverable=business-rules → block (NOT in minimal_phases)",
  "block",
  { tool: "task", sessionID: "t", callID: "8" },
  { args: { agent: "business-analyst", phase: "functional-analysis", deliverable: "business-rules", prompt: "update rules" } },
);

console.log("\n── Phase 3: set scope=major (no skip_phases) ──");
writeFileSync(
  stateFile,
  JSON.stringify({ schema_version: 1, active_scope: "major", activated_at: "now", rationale: "test" }),
  "utf8",
);
await probe(
  "discovery → allow under major",
  "allow",
  { tool: "task", sessionID: "t", callID: "9" },
  { args: { agent: "business-analyst", phase: "discovery", prompt: "discovery for v3" } },
);
await probe(
  "inception → allow under major",
  "allow",
  { tool: "task", sessionID: "t", callID: "10" },
  { args: { agent: "project-manager", phase: "inception", prompt: "v3 kickoff" } },
);

// cleanup
try { unlinkSync(stateFile); } catch {}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
