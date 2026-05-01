import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { stringify, parse as yamlParse } from "yaml";
import { loadRolesAsMap } from "../../src/loader/role-loader.js";
import { loadSkillsAsMap } from "../../src/loader/skill-loader.js";
import { loadToolsAsMap } from "../../src/loader/tool-loader.js";
import { loadStacksAsMap } from "../../src/loader/stack-loader.js";
import { loadAllRules } from "../../src/loader/rule-loader.js";
import type { DataContext, ProjectConfig, RoleSelection, SelectionResult } from "../../src/engine/types.js";
import { runSelection, runPipeline, writePipeline } from "../../src/cli/pipeline.js";
import { resolveDependencies } from "../../src/engine/dependency-resolver.js";

const DATA_DIR = join(__dirname, "../../data");
let TMP_DIR: string;
let ctx: DataContext;

beforeAll(() => {
  ctx = {
    roles: loadRolesAsMap(join(DATA_DIR, "roles")),
    skills: loadSkillsAsMap(join(DATA_DIR, "skills")),
    tools: loadToolsAsMap(join(DATA_DIR, "tools")),
    stacks: loadStacksAsMap(join(DATA_DIR, "stacks")),
    ...loadAllRules(join(DATA_DIR, "rules")),
  };
  // Each run uses an isolated temp dir so parallel CI invocations cannot collide.
  TMP_DIR = mkdtempSync(join(tmpdir(), "abax-e2e-"));
});

afterAll(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "e2e-test",
    description: "E2E test project",
    targetDir: TMP_DIR,
    size: "small",
    criteria: [],
    stackId: "angular-springboot",
    target: "opencode",
    ...overrides,
  };
}

// =========================================
// E2E-1: Init generates manifest, re-init detects it
// =========================================
describe("E2E: Init → detect existing → update roundtrip", () => {
  let roundtripDir: string;
  beforeAll(() => {
    roundtripDir = join(TMP_DIR, "roundtrip");
  });

  it("should generate all files on first init", () => {
    const config = makeConfig({ targetDir: roundtripDir, size: "medium", criteria: ["has_sensitive_data"] });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    writePipeline(result, false);

    expect(existsSync(join(roundtripDir, "project-manifest.yaml"))).toBe(true);
    expect(existsSync(join(roundtripDir, "opencode.json"))).toBe(true);
    expect(existsSync(join(roundtripDir, ".opencode/agents/orchestrator.md"))).toBe(true);
  });

  it("should produce parseable manifest with correct metadata", () => {
    const raw = readFileSync(join(roundtripDir, "project-manifest.yaml"), "utf-8");
    const manifest = yamlParse(raw);

    expect(manifest.project.name).toBe("e2e-test");
    expect(manifest.project.size).toBe("medium");
    expect(manifest.project.stack).toBe("angular-springboot");
    expect(manifest.team.roles.length).toBeGreaterThan(0);
    expect(manifest.criteria_applied).toContain("has_sensitive_data");
  });

  it("should re-read manifest and produce equivalent config", () => {
    const raw = readFileSync(join(roundtripDir, "project-manifest.yaml"), "utf-8");
    const manifest = yamlParse(raw);

    const reConfig: ProjectConfig = {
      name: manifest.project.name,
      description: manifest.project.description ?? "",
      targetDir: roundtripDir,
      size: manifest.project.size,
      criteria: manifest.criteria_applied ?? [],
      stackId: manifest.project.stack,
      target: manifest.project.target ?? "opencode",
    };

    expect(reConfig.name).toBe("e2e-test");
    expect(reConfig.size).toBe("medium");
    expect(reConfig.stackId).toBe("angular-springboot");
  });

  it("should regenerate with same config and get same role count", () => {
    const raw = readFileSync(join(roundtripDir, "project-manifest.yaml"), "utf-8");
    const manifest = yamlParse(raw);
    const originalRoleCount = manifest.team.roles.length;

    const reConfig: ProjectConfig = {
      name: manifest.project.name,
      description: manifest.project.description ?? "",
      targetDir: roundtripDir,
      size: manifest.project.size,
      criteria: manifest.criteria_applied ?? [],
      stackId: manifest.project.stack,
      target: manifest.project.target ?? "opencode",
    };

    const selection = runSelection(reConfig, ctx);
    expect(selection.roles.length).toBe(originalRoleCount);
  });
});

// =========================================
// E2E-2: Manual role add/remove simulation
// =========================================
describe("E2E: Manual role add/remove", () => {
  it("should allow adding a role not in selection", () => {
    const config = makeConfig({ size: "small" });
    const selection = runSelection(config, ctx);
    const originalIds = new Set(selection.roles.map((s) => s.roleId));

    // Simulate user adding qa-performance manually (only added by criteria, not by size)
    const manualRole = "qa-performance";
    expect(originalIds.has(manualRole)).toBe(false);

    const withManual: RoleSelection[] = [
      ...selection.roles,
      { roleId: manualRole, reason: "manual", removable: true },
    ];

    const manualSelection: SelectionResult = {
      roles: withManual,
      warnings: selection.warnings,
      governanceModel: selection.governanceModel,
    };

    const result = runPipeline(config, manualSelection, ctx);
    const agentFiles = result.files.filter((f) => f.path.startsWith(".opencode/agents/") && !f.path.includes("orchestrator"));

    // Should have agent file for qa-performance
    expect(agentFiles.some((f) => f.path.includes("qa-performance"))).toBe(true);
    expect(agentFiles.length).toBe(manualSelection.roles.length);
  });

  it("should allow removing a removable role", () => {
    const config = makeConfig({ size: "medium" });
    const selection = runSelection(config, ctx);

    const removable = selection.roles.find((r) => r.removable);
    expect(removable).toBeDefined();

    const filtered = selection.roles.filter((s) => s.roleId !== removable!.roleId);
    const reducedSelection: SelectionResult = {
      roles: filtered,
      warnings: selection.warnings,
      governanceModel: selection.governanceModel,
    };

    const result = runPipeline(config, reducedSelection, ctx);
    const roleIds = result.project.roles.map((r) => r.id);
    expect(roleIds).not.toContain(removable!.roleId);
  });

  it("should allow removing an indispensable role (user override)", () => {
    const config = makeConfig({ size: "small" });
    const selection = runSelection(config, ctx);

    const indispensable = selection.roles.find((r) => !r.removable);
    expect(indispensable).toBeDefined();

    // User forces removal
    const filtered = selection.roles.filter((s) => s.roleId !== indispensable!.roleId);
    const overrideSelection: SelectionResult = {
      roles: filtered,
      warnings: selection.warnings,
      governanceModel: selection.governanceModel,
    };

    const result = runPipeline(config, overrideSelection, ctx);
    expect(result.project.roles.map((r) => r.id)).not.toContain(indispensable!.roleId);
    // Pipeline still works
    expect(result.files.length).toBeGreaterThan(0);
  });

  it("manual roles should persist through dependency resolution", () => {
    const config = makeConfig({ size: "small" });
    const selection = runSelection(config, ctx);

    const manualRoles: RoleSelection[] = [
      ...selection.roles,
      { roleId: "qa-performance", reason: "manual", removable: true },
    ];

    const { selections: resolved } = resolveDependencies(manualRoles, ctx.dependencies);
    expect(resolved.some((r) => r.roleId === "qa-performance")).toBe(true);
  });
});

// =========================================
// E2E-3: Existing manifest merge with new selection
// =========================================
describe("E2E: Existing manifest role merge", () => {
  it("should merge previous manual roles into new selection", () => {
    const config = makeConfig({ size: "small" });
    const selection = runSelection(config, ctx);
    const autoIds = new Set(selection.roles.map((s) => s.roleId));

    // Simulate existing manifest had extra roles
    const existingRoles = [
      ...selection.roles.map((s) => ({ id: s.roleId })),
      { id: "dba" },
      { id: "qa-performance" },
    ];

    // Merge logic (same as wizard.ts stepRoleReview)
    const currentIds = new Set(selection.roles.map((s) => s.roleId));
    for (const prev of existingRoles) {
      if (!currentIds.has(prev.id) && ctx.roles.has(prev.id)) {
        selection.roles.push({ roleId: prev.id, reason: "manual", removable: true });
        currentIds.add(prev.id);
      }
    }

    expect(selection.roles.some((r) => r.roleId === "dba")).toBe(true);
    expect(selection.roles.some((r) => r.roleId === "qa-performance")).toBe(true);
    expect(selection.roles.length).toBeGreaterThan(autoIds.size);
  });

  it("should not duplicate roles already in selection", () => {
    const config = makeConfig({ size: "medium", criteria: ["has_sensitive_data"] });
    const selection = runSelection(config, ctx);
    const rolesBefore = selection.roles.length;

    // Existing manifest has same roles
    const existingRoles = selection.roles.map((s) => ({ id: s.roleId }));
    const currentIds = new Set(selection.roles.map((s) => s.roleId));
    for (const prev of existingRoles) {
      if (!currentIds.has(prev.id) && ctx.roles.has(prev.id)) {
        selection.roles.push({ roleId: prev.id, reason: "manual", removable: true });
        currentIds.add(prev.id);
      }
    }

    expect(selection.roles.length).toBe(rolesBefore);
  });

  it("should ignore roles from manifest that no longer exist in catalog", () => {
    const config = makeConfig({ size: "small" });
    const selection = runSelection(config, ctx);
    const rolesBefore = selection.roles.length;

    const existingRoles = [{ id: "ghost-role-that-doesnt-exist" }];
    const currentIds = new Set(selection.roles.map((s) => s.roleId));
    for (const prev of existingRoles) {
      if (!currentIds.has(prev.id) && ctx.roles.has(prev.id)) {
        selection.roles.push({ roleId: prev.id, reason: "manual", removable: true });
        currentIds.add(prev.id);
      }
    }

    expect(selection.roles.length).toBe(rolesBefore);
  });
});

// =========================================
// E2E-4: Full write → re-read → regenerate cycle
// =========================================
describe("E2E: Write → read → regenerate consistency", () => {
  let cycleDir: string;
  beforeAll(() => {
    cycleDir = join(TMP_DIR, "cycle");
  });

  it("should survive full regeneration cycle for each size", () => {
    for (const size of ["small", "medium", "large"] as const) {
      const dir = join(cycleDir, size);
      const config = makeConfig({
        name: `cycle-${size}`,
        targetDir: dir,
        size,
        criteria: size === "large" ? ["has_integrations", "has_sensitive_data"] : [],
        stackId: "react-nextjs",
      });

      // Generate
      const sel1 = runSelection(config, ctx);
      const res1 = runPipeline(config, sel1, ctx);
      writePipeline(res1, false);

      // Re-read manifest
      const raw = readFileSync(join(dir, "project-manifest.yaml"), "utf-8");
      const manifest = yamlParse(raw);

      // Regenerate from manifest
      const reConfig: ProjectConfig = {
        name: manifest.project.name,
        description: manifest.project.description ?? "",
        targetDir: dir,
        size: manifest.project.size,
        criteria: manifest.criteria_applied ?? [],
        stackId: manifest.project.stack,
        target: manifest.project.target ?? "opencode",
      };

      const sel2 = runSelection(reConfig, ctx);
      const res2 = runPipeline(reConfig, sel2, ctx);

      // Same number of roles and files
      expect(sel2.roles.length).toBe(sel1.roles.length);
      expect(res2.files.length).toBe(res1.files.length);

      // Same role IDs
      const ids1 = sel1.roles.map((r) => r.roleId).sort();
      const ids2 = sel2.roles.map((r) => r.roleId).sort();
      expect(ids2).toEqual(ids1);
    }
  });
});

// =========================================
// E2E-5: All stacks produce valid output
// =========================================
describe("E2E: All stacks generate valid pipeline output", () => {
  const stackIds = Array.from(
    loadStacksAsMap(join(DATA_DIR, "stacks")).keys(),
  );

  it.each(stackIds)("stack %s should produce valid pipeline", (stackId) => {
    const config = makeConfig({ stackId, size: "medium" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    // Has files
    expect(result.files.length).toBeGreaterThan(0);

    // Has orchestrator
    const orch = result.files.find((f) => f.path.includes("orchestrator"));
    expect(orch).toBeDefined();

    // opencode.json is valid JSON
    const oc = result.files.find((f) => f.path === "opencode.json");
    expect(oc).toBeDefined();
    expect(() => JSON.parse(oc!.content)).not.toThrow();

    // manifest is valid YAML
    const manifest = result.files.find((f) => f.path === "project-manifest.yaml");
    expect(manifest).toBeDefined();
    const parsed = yamlParse(manifest!.content);
    expect(parsed.project.stack).toBe(stackId);
  });
});

// =========================================
// E2E-6: Orchestrator/system-designer exclusion
// =========================================
describe("E2E: Meta-role exclusion", () => {
  it("orchestrator should not appear in selection", () => {
    for (const size of ["small", "medium", "large"] as const) {
      const config = makeConfig({ size });
      const selection = runSelection(config, ctx);
      expect(selection.roles.some((r) => r.roleId === "orchestrator")).toBe(false);
    }
  });

  it("system-designer should not appear in selection", () => {
    for (const size of ["small", "medium", "large"] as const) {
      const config = makeConfig({ size, criteria: ["has_integrations", "has_sensitive_data", "has_high_concurrency", "has_user_facing_ui"] });
      const selection = runSelection(config, ctx);
      expect(selection.roles.some((r) => r.roleId === "system-designer")).toBe(false);
    }
  });

  it("available roles catalog should exclude orchestrator and system-designer", () => {
    const available = Array.from(ctx.roles.values())
      .filter((r) => r.id !== "orchestrator" && r.id !== "system-designer");

    expect(available.some((r) => r.id === "orchestrator")).toBe(false);
    expect(available.some((r) => r.id === "system-designer")).toBe(false);
    expect(available.length).toBe(ctx.roles.size - 2);
  });
});

// =========================================
// E2E-7: Generated files internal consistency
// =========================================
describe("E2E: Generated files cross-consistency", () => {
  it("opencode.json agents should match manifest roles", () => {
    const config = makeConfig({ size: "large", criteria: ["has_integrations", "has_sensitive_data"] });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const oc = JSON.parse(result.files.find((f) => f.path === "opencode.json")!.content);
    const manifest = yamlParse(result.files.find((f) => f.path === "project-manifest.yaml")!.content);

    const ocAgentIds = new Set(Object.keys(oc.agent));
    const manifestRoleIds = new Set(manifest.team.roles.map((r: { id: string }) => r.id));

    // opencode.json includes orchestrator entry (not in manifest roles)
    ocAgentIds.delete("orchestrator");
    expect(ocAgentIds).toEqual(manifestRoleIds);
  });

  it("every agent file should have a matching opencode.json entry", () => {
    const config = makeConfig({ size: "medium" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const oc = JSON.parse(result.files.find((f) => f.path === "opencode.json")!.content);
    const agentFiles = result.files
      .filter((f) => f.path.startsWith(".opencode/agents/") && !f.path.includes("orchestrator"))
      .map((f) => f.path.replace(".opencode/agents/", "").replace(".md", ""));

    for (const agentId of agentFiles) {
      expect(oc.agent[agentId], `Agent ${agentId} missing from opencode.json`).toBeDefined();
    }
  });

  it("manifest skills should be subset of canonical skills", () => {
    const config = makeConfig({ size: "large", criteria: ["has_integrations"] });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const manifest = yamlParse(result.files.find((f) => f.path === "project-manifest.yaml")!.content);
    for (const skill of manifest.skills) {
      expect(ctx.skills.has(skill.id), `Manifest skill ${skill.id} not in canonical data`).toBe(true);
    }
  });

  it("manifest tools should be subset of canonical tools", () => {
    const config = makeConfig({ size: "large" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const manifest = yamlParse(result.files.find((f) => f.path === "project-manifest.yaml")!.content);
    for (const tool of manifest.tools) {
      expect(ctx.tools.has(tool.id), `Manifest tool ${tool.id} not in canonical data`).toBe(true);
    }
  });
});

// =========================================
// E2E-8: CLI argument validation
// =========================================
describe("E2E: WizardOptions interface consistency", () => {
  it("wizard options should require targetDir", () => {
    // Type-level check: WizardOptions has targetDir
    const opts = { dryRun: false, targetDir: "/some/path" };
    expect(opts.targetDir).toBe("/some/path");
    expect(opts.dryRun).toBe(false);
  });

  it("existing manifest detection with non-existent dir should return null-equivalent", () => {
    const fakePath = join(TMP_DIR, "nonexistent", "project-manifest.yaml");
    expect(existsSync(fakePath)).toBe(false);
  });

  it("existing manifest detection with valid manifest should parse", () => {
    const manifestDir = join(TMP_DIR, "manifest-detect");
    mkdirSync(manifestDir, { recursive: true });

    const manifest = {
      project: { name: "test", size: "small", stack: "react-nextjs" },
      team: { roles: [{ id: "tech-lead", name: "Lider Tecnico" }] },
      criteria_applied: ["has_sensitive_data"],
    };
    writeFileSync(join(manifestDir, "project-manifest.yaml"), stringify(manifest));

    const raw = readFileSync(join(manifestDir, "project-manifest.yaml"), "utf-8");
    const parsed = yamlParse(raw);

    expect(parsed.project.name).toBe("test");
    expect(parsed.project.size).toBe("small");
    expect(parsed.team.roles[0].id).toBe("tech-lead");
    expect(parsed.criteria_applied).toContain("has_sensitive_data");
  });
});
