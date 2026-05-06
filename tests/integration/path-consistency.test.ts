// Path constants invariant test.
// TS code imports paths from src/engine/paths.ts. Templates (TS plugin,
// Python hook, custom tool YAML bodies) hardcode the same strings —
// they execute in the project at runtime without access to abax-swarm
// source. This test scans those template files and asserts the
// hardcoded strings match the canonical constants. Renaming a path in
// paths.ts now fails CI until the templates are updated too.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  OC_PLUGIN_PATH,
  OC_POLICIES_PATH,
  OC_ITERATION_STATE_PATH,
  OC_PLUGIN_DEBUG_LOG,
  CC_HOOK_PATH,
  CC_POLICIES_PATH,
  CC_ITERATION_STATE_PATH,
  ATTESTATIONS_DIR,
} from "../../src/engine/paths.js";

const REPO = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

describe("Path consistency — templates match src/engine/paths.ts", () => {
  it("opencode plugin TS uses canonical opencode paths", () => {
    const txt = read("templates/opencode/plugins/abax-policy.ts");
    // Plugin reads policies + state + writes debug log.
    expect(txt).toContain(OC_POLICIES_PATH);
    expect(txt).toContain(OC_ITERATION_STATE_PATH);
    expect(txt).toContain(OC_PLUGIN_DEBUG_LOG);
  });

  it("Claude Python hook uses canonical claude paths", () => {
    const txt = read("templates/claude/hooks/abax-policy.py");
    // Python hook reads policies + state.
    // Note: split path components to allow Python's pathlib idioms,
    // we check the suffix is present (the prefix builds via Path / .claude).
    expect(txt).toContain('"abax-policies.json"');
    expect(txt).toContain('"iteration-state.json"');
    // And the directory components.
    expect(txt).toContain('".claude"');
    expect(txt).toContain('"policies"');
  });

  it("set-iteration-scope tool body uses canonical paths for both targets", () => {
    const txt = read("data/tools/set-iteration-scope.yaml");
    // Tool auto-detects which subtree exists. Should reference both.
    expect(txt).toContain(".opencode");
    expect(txt).toContain(".claude");
    expect(txt).toContain("policies/abax-policies.json");
    expect(txt).toContain("iteration-state.json");
  });

  it("phase-state / verify-deliverable / attest-deliverable tool bodies use opencode policies path", () => {
    for (const t of ["phase-state", "verify-deliverable", "attest-deliverable"]) {
      const txt = read(`data/tools/${t}.yaml`);
      expect(txt, `${t} should reference policies file`).toContain(
        "policies/abax-policies.json",
      );
    }
    // attest-deliverable additionally writes attestations.
    const att = read("data/tools/attest-deliverable.yaml");
    expect(att).toContain(ATTESTATIONS_DIR);
  });

  it("plugin path constant is consistent between paths.ts and re-export", async () => {
    const re = await import("../../src/generator/opencode/plugin-generator.js");
    expect(re.PLUGIN_OPENCODE_PATH).toBe(OC_PLUGIN_PATH);
  });

  it("HOOK_INVOCATION composed from CC_HOOK_PATH", async () => {
    const re = await import("../../src/generator/claude/policy-generator.js");
    expect(re.HOOK_INVOCATION).toContain(CC_HOOK_PATH);
  });
});
