import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { readFileSync } from "fs";
import { parse as yamlParse } from "yaml";
import { loadRolesAsMap } from "../../src/loader/role-loader.js";
import { loadSkillsAsMap } from "../../src/loader/skill-loader.js";
import { loadToolsAsMap } from "../../src/loader/tool-loader.js";
import { loadStacksAsMap } from "../../src/loader/stack-loader.js";
import { loadAllRules } from "../../src/loader/rule-loader.js";
import type { DataContext, ProjectConfig } from "../../src/engine/types.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import { validateRaciMatrix, validateRaciRoles } from "../../src/validator/raci-validator.js";
import { validateOrchestrator } from "../../src/validator/orchestrator-validator.js";

const DATA_DIR = join(__dirname, "../../data");
const FIXTURES_DIR = join(__dirname, "../fixtures");
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

function loadFixture(name: string): ProjectConfig {
  const raw = readFileSync(join(FIXTURES_DIR, name), "utf-8");
  return yamlParse(raw) as ProjectConfig;
}

// ========================================
// F6-05: Integration test - Small project
// ========================================
describe("Integration: Small project (api-pagos)", () => {
  it("should complete full pipeline", () => {
    const config = loadFixture("small-api.yaml");
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    expect(result.files.length).toBeGreaterThan(0);
    expect(result.project.config.name).toBe("api-pagos");
    expect(selection.governanceModel).toBe("lightweight");
  });

  it("should include core roles", () => {
    const config = loadFixture("small-api.yaml");
    const selection = runSelection(config, ctx);
    const roleIds = selection.roles.map((r) => r.roleId);

    expect(roleIds).toContain("project-manager");
    expect(roleIds).toContain("business-analyst");
    expect(roleIds).toContain("tech-lead");
    expect(roleIds).toContain("developer-backend");
    expect(roleIds).toContain("qa-functional");
    // PO not in small indispensable — BA absorbs PO work
    expect(roleIds).not.toContain("product-owner");
  });

  it("should generate valid orchestrator", () => {
    const config = loadFixture("small-api.yaml");
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const orchestratorFile = result.files.find((f) => f.path.includes("orchestrator"));
    expect(orchestratorFile).toBeDefined();

    const validation = validateOrchestrator(orchestratorFile!, result.project.roles);
    expect(validation.valid).toBe(true);
  });

  it("should generate parseable opencode.json", () => {
    const config = loadFixture("small-api.yaml");
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const configFile = result.files.find((f) => f.path === "opencode.json");
    expect(configFile).toBeDefined();
    const parsed = JSON.parse(configFile!.content);
    expect(parsed.$schema).toBe("https://opencode.ai/config.json");
    // +1 for orchestrator entry
    expect(Object.keys(parsed.agent).length).toBe(selection.roles.length + 1);
  });

  it("should generate parseable project manifest", () => {
    const config = loadFixture("small-api.yaml");
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const manifest = result.files.find((f) => f.path === "project-manifest.yaml");
    expect(manifest).toBeDefined();
    const parsed = yamlParse(manifest!.content);
    expect(parsed.project.name).toBe("api-pagos");
    expect(parsed.project.size).toBe("small");
    expect(parsed.project.stack).toBe("python-fastapi");
  });

  it("should adapt prompts to python-fastapi stack", () => {
    const config = loadFixture("small-api.yaml");
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const agentFiles = result.files.filter((f) => f.path.startsWith(".opencode/agents/"));
    const hasFastAPI = agentFiles.some((f) => f.content.includes("FastAPI") || f.content.includes("Python"));
    expect(hasFastAPI).toBe(true);
  });
});

// ========================================
// F6-06: Integration test - Medium project
// ========================================
describe("Integration: Medium project (sistema-ventas)", () => {
  it("should complete full pipeline with criteria", () => {
    const config = loadFixture("medium-webapp.yaml");
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    expect(result.files.length).toBeGreaterThan(15);
    expect(selection.governanceModel).toBe("controlled");
  });

  it("should include criteria-added roles", () => {
    const config = loadFixture("medium-webapp.yaml");
    const selection = runSelection(config, ctx);
    const roleIds = selection.roles.map((r) => r.roleId);

    // has_integrations -> integration-architect, devops
    expect(roleIds).toContain("integration-architect");
    // has_sensitive_data -> security-architect
    expect(roleIds).toContain("security-architect");
    // has_user_facing_ui -> developer-frontend, ux-designer
    expect(roleIds).toContain("developer-frontend");
  });

  it("should have more roles than small", () => {
    const small = runSelection(loadFixture("small-api.yaml"), ctx);
    const medium = runSelection(loadFixture("medium-webapp.yaml"), ctx);

    expect(medium.roles.length).toBeGreaterThan(small.roles.length);
  });

  it("should generate valid orchestrator with all agents referenced", () => {
    const config = loadFixture("medium-webapp.yaml");
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const orchestratorFile = result.files.find((f) => f.path.includes("orchestrator"));
    const validation = validateOrchestrator(orchestratorFile!, result.project.roles);
    expect(validation.valid).toBe(true);
  });

  it("should generate skill files", () => {
    const config = loadFixture("medium-webapp.yaml");
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const skillFiles = result.files.filter((f) => f.path.includes("/skills/"));
    expect(skillFiles.length).toBeGreaterThan(0);
    const hasSkillMd = skillFiles.some((f) => f.path.endsWith("SKILL.md"));
    expect(hasSkillMd).toBe(true);
  });

  it("should generate tool files", () => {
    const config = loadFixture("medium-webapp.yaml");
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const toolFiles = result.files.filter((f) => f.path.includes("/tools/"));
    expect(toolFiles.length).toBeGreaterThan(0);
  });
});

// ========================================
// F6-07: Integration test - Large project
// ========================================
describe("Integration: Large project (plataforma-core)", () => {
  it("should complete full pipeline with all criteria", () => {
    const config = loadFixture("large-enterprise.yaml");
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    expect(result.files.length).toBeGreaterThan(30);
    expect(selection.governanceModel).toBe("corporate");
  });

  it("should include 14+ roles", () => {
    const config = loadFixture("large-enterprise.yaml");
    const selection = runSelection(config, ctx);

    expect(selection.roles.length).toBeGreaterThanOrEqual(14);
  });

  it("should include all indispensable large roles", () => {
    const config = loadFixture("large-enterprise.yaml");
    const selection = runSelection(config, ctx);
    const roleIds = selection.roles.map((r) => r.roleId);

    const largeIndispensable = [
      "product-owner", "project-manager", "business-analyst",
      "solution-architect", "integration-architect", "security-architect",
      "tech-lead", "developer-backend", "developer-frontend",
      "dba", "devops", "qa-lead", "qa-functional", "change-manager",
    ];

    for (const roleId of largeIndispensable) {
      expect(roleIds, `Missing ${roleId}`).toContain(roleId);
    }
  });

  it("should include criteria-specific roles", () => {
    const config = loadFixture("large-enterprise.yaml");
    const selection = runSelection(config, ctx);
    const roleIds = selection.roles.map((r) => r.roleId);

    // has_high_concurrency -> qa-performance
    expect(roleIds).toContain("qa-performance");
    // has_user_facing_ui -> ux-designer
    expect(roleIds).toContain("ux-designer");
  });

  it("should generate corporate governance orchestrator", () => {
    const config = loadFixture("large-enterprise.yaml");
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const orchestratorFile = result.files.find((f) => f.path.includes("orchestrator"));
    expect(orchestratorFile!.content).toContain("Equipo Corporativo Completo");
    expect(orchestratorFile!.content).toContain("Completa y auditable");
  });

  it("should generate valid opencode.json for all agents", () => {
    const config = loadFixture("large-enterprise.yaml");
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);

    const configFile = result.files.find((f) => f.path === "opencode.json");
    const parsed = JSON.parse(configFile!.content);
    // +1 for orchestrator entry
    expect(Object.keys(parsed.agent).length).toBe(selection.roles.length + 1);
    expect(parsed.agent).toHaveProperty("orchestrator");
    expect(parsed.agent.orchestrator.permission.task).toBe("allow");
  });
});

// ========================================
// F6-08: RACI validator
// ========================================
describe("RACI Validation", () => {
  it("should validate RACI matrix completeness", () => {
    const result = validateRaciMatrix(ctx.raci);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should have R and A for every activity", () => {
    for (const [activity, roles] of Object.entries(ctx.raci.activities)) {
      const values = Object.values(roles);
      const hasR = values.some((v) => v === "R" || v === "A/R");
      const hasA = values.some((v) => v === "A" || v === "A/R");
      expect(hasR, `${activity} missing R`).toBe(true);
      expect(hasA, `${activity} missing A`).toBe(true);
    }
  });

  it("should reference only valid roles", () => {
    const roleIds = new Set(ctx.roles.keys());
    const result = validateRaciRoles(ctx.raci, roleIds);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should detect invalid RACI matrix", () => {
    const badRaci = {
      activities: {
        bad_activity: { "nobody": "C" as const },
      },
    };
    const result = validateRaciMatrix(badRaci);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should detect unknown roles in RACI (as warnings, not errors, in 0.1.41+)", () => {
    const badRaci = {
      activities: {
        test_activity: { "ghost-role": "R" as const },
      },
    };
    const result = validateRaciRoles(badRaci, new Set(["real-role"]));
    // 0.1.41 demoted unknown-role-in-RACI from error to warning. Reasoning:
    // RACI references roles not always present in the user's team (the
    // catalogue caters to the full enterprise template); the activity still
    // has other R/A roles. `valid` stays true because nothing is structurally
    // broken.
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    // Without ValidationContext, the unknown role lands in `warnings` (the
    // safer default). With context, an "optional" role would land in notices.
    expect(result.warnings.join("\n")).toContain("ghost-role");
  });
});

// ========================================
// Cross-size comparison
// ========================================
describe("Cross-size consistency", () => {
  it("should have increasing file counts: small < medium < large", () => {
    const configs = ["small-api.yaml", "medium-webapp.yaml", "large-enterprise.yaml"].map(loadFixture);
    const fileCounts = configs.map((c) => {
      const sel = runSelection(c, ctx);
      return runPipeline(c, sel, ctx).files.length;
    });

    expect(fileCounts[0]).toBeLessThan(fileCounts[1]);
    expect(fileCounts[1]).toBeLessThan(fileCounts[2]);
  });

  it("should have valid orchestrators for all sizes", () => {
    const configs = ["small-api.yaml", "medium-webapp.yaml", "large-enterprise.yaml"].map(loadFixture);

    for (const config of configs) {
      const sel = runSelection(config, ctx);
      const result = runPipeline(config, sel, ctx);
      const orch = result.files.find((f) => f.path.includes("orchestrator"))!;
      const validation = validateOrchestrator(orch, result.project.roles);
      expect(validation.valid, `Invalid orchestrator for ${config.size}`).toBe(true);
    }
  });
});
