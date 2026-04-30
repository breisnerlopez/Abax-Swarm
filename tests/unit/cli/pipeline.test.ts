import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { existsSync, rmSync } from "fs";
import { loadRolesAsMap } from "../../../src/loader/role-loader.js";
import { loadSkillsAsMap } from "../../../src/loader/skill-loader.js";
import { loadToolsAsMap } from "../../../src/loader/tool-loader.js";
import { loadStacksAsMap } from "../../../src/loader/stack-loader.js";
import { loadAllRules } from "../../../src/loader/rule-loader.js";
import type { DataContext, ProjectConfig } from "../../../src/engine/types.js";
import { runSelection, runPipeline, toggleRole, writePipeline } from "../../../src/cli/pipeline.js";

const DATA_DIR = join(__dirname, "../../../data");
let ctx: DataContext;

beforeAll(() => {
  ctx = {
    roles: loadRolesAsMap(join(DATA_DIR, "roles")),
    skills: loadSkillsAsMap(join(DATA_DIR, "skills")),
    tools: loadToolsAsMap(join(DATA_DIR, "tools")),
    stacks: loadStacksAsMap(join(DATA_DIR, "stacks")),
    ...loadAllRules(join(DATA_DIR, "rules")),
  };
});

function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "test-project",
    description: "Test project",
    targetDir: "/tmp/test-output",
    size: "small",
    criteria: [],
    stackId: "angular-springboot",
    target: "opencode",
    ...overrides,
  };
}

describe("Pipeline: runSelection", () => {
  it("should select roles for small project", () => {
    const config = makeConfig({ size: "small" });
    const result = runSelection(config, ctx);

    expect(result.roles.length).toBeGreaterThan(0);
    expect(result.governanceModel).toBe("lightweight");
    expect(result.roles.some((r) => r.roleId === "business-analyst")).toBe(true);
  });

  it("should select more roles for large project", () => {
    const small = runSelection(makeConfig({ size: "small" }), ctx);
    const large = runSelection(makeConfig({ size: "large" }), ctx);

    expect(large.roles.length).toBeGreaterThan(small.roles.length);
    expect(large.governanceModel).toBe("corporate");
  });

  it("should add roles from criteria", () => {
    const without = runSelection(makeConfig(), ctx);
    const withCriteria = runSelection(makeConfig({ criteria: ["has_sensitive_data"] }), ctx);

    const hasSecArch = withCriteria.roles.some((r) => r.roleId === "security-architect");
    expect(hasSecArch).toBe(true);
    expect(withCriteria.roles.length).toBeGreaterThanOrEqual(without.roles.length);
  });

  it("should resolve hard dependencies", () => {
    const result = runSelection(makeConfig({ size: "small" }), ctx);
    const roleIds = result.roles.map((r) => r.roleId);

    // If tech-lead is present, its hard deps should be too
    if (roleIds.includes("tech-lead")) {
      expect(roleIds.includes("business-analyst") || roleIds.includes("solution-architect")).toBe(true);
    }
  });
});

describe("Pipeline: toggleRole", () => {
  it("should remove a role from selections", () => {
    const config = makeConfig({ size: "medium" });
    const result = runSelection(config, ctx);
    const removable = result.roles.find((r) => r.removable);

    if (removable) {
      const toggled = toggleRole(result.roles, removable.roleId);
      expect(toggled.some((r) => r.roleId === removable.roleId)).toBe(false);
      expect(toggled.length).toBe(result.roles.length - 1);
    }
  });
});

describe("Pipeline: runPipeline", () => {
  it("should generate files for small project", () => {
    const config = makeConfig({ size: "small" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    expect(result.files.length).toBeGreaterThan(0);
    expect(result.project.config.name).toBe("test-project");

    // Should have orchestrator
    const orchestrator = result.files.find((f) => f.path.includes("orchestrator"));
    expect(orchestrator).toBeDefined();

    // Should have opencode.json
    const config2 = result.files.find((f) => f.path === "opencode.json");
    expect(config2).toBeDefined();

    // Should have project-manifest.yaml
    const manifest = result.files.find((f) => f.path === "project-manifest.yaml");
    expect(manifest).toBeDefined();
  });

  it("should generate agent files for each role", () => {
    const config = makeConfig({ size: "small" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const agentFiles = result.files.filter((f) => f.path.startsWith(".opencode/agents/") && !f.path.includes("orchestrator"));
    expect(agentFiles.length).toBe(selection.roles.length);
  });

  it("should generate files for medium project", () => {
    const config = makeConfig({ size: "medium" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const agentFiles = result.files.filter((f) => f.path.startsWith(".opencode/agents/"));
    expect(agentFiles.length).toBeGreaterThan(5);
  });

  it("should generate files for large project with criteria", () => {
    const config = makeConfig({
      size: "large",
      criteria: ["has_integrations", "has_sensitive_data", "has_high_concurrency"],
    });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    expect(result.project.roles.length).toBeGreaterThan(10);
    expect(result.files.length).toBeGreaterThan(20);
  });

  it("should include stack context in agent prompts", () => {
    const config = makeConfig({ stackId: "angular-springboot" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    // At least some agents should have stack context
    const agentFiles = result.files.filter((f) => f.path.startsWith(".opencode/agents/"));
    const hasStackContext = agentFiles.some((f) => f.content.includes("Angular") || f.content.includes("Spring Boot"));
    expect(hasStackContext).toBe(true);
  });
});

const WRITE_TMP = join(__dirname, "../../../.tmp-pipeline-write");

afterAll(() => {
  rmSync(WRITE_TMP, { recursive: true, force: true });
});

describe("Pipeline: writePipeline", () => {
  it("should skip writing in dry-run mode", () => {
    const config = makeConfig({ size: "small" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    result.project.config.targetDir = "/nonexistent/path/that/should/not/exist";
    expect(() => writePipeline(result, true)).not.toThrow();
  });

  it("should write files to disk when not dry-run", () => {
    const config = makeConfig({ size: "small", targetDir: WRITE_TMP });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    writePipeline(result, false);

    expect(existsSync(join(WRITE_TMP, "opencode.json"))).toBe(true);
    expect(existsSync(join(WRITE_TMP, ".opencode/agents/orchestrator.md"))).toBe(true);
  });
});
