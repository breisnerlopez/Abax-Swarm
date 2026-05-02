import { describe, it, expect, beforeAll } from "vitest";
import { loadDataContext } from "../../src/cli/data-context.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import type { DataContext, ProjectConfig } from "../../src/engine/types.js";

let ctx: DataContext;

beforeAll(() => {
  ctx = loadDataContext();
});

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "rb-test",
    description: "test",
    targetDir: "/tmp/rb-test",
    size: "medium",
    criteria: [],
    stackId: "angular-springboot",
    target: "opencode",
    teamScope: "full",
    provider: "anthropic",
    modelStrategy: "inherit",
    permissionMode: "recommended",
    isolationMode: "devcontainer",
    ...overrides,
  };
}

// ===========================================================================
// SKILL — role-boundaries content
// ===========================================================================
describe("role-boundaries skill: content and structure", () => {
  it("exists and references the motivating incident", () => {
    const skill = ctx.skills.get("role-boundaries");
    expect(skill).toBeDefined();
    expect(skill!.description).toMatch(/Abax-Memory/);
    expect(skill!.description).toMatch(/devops/);
    expect(skill!.description).toMatch(/QA|funcional/i);
  });

  it("includes the master responsibility matrix for the critical phases", () => {
    const skill = ctx.skills.get("role-boundaries")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/Fase 4 - Construccion/);
    expect(txt).toMatch(/Fase 5 - QA/);
    expect(txt).toMatch(/Fase 7 - Despliegue/);
  });

  it("includes the strict rejection template with exact wording", () => {
    const skill = ctx.skills.get("role-boundaries")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/RECHAZO DE TAREA/);
    expect(txt).toMatch(/fuera de mi rol/);
    expect(txt).toMatch(/Devuelvo la Task al orquestador/);
  });

  it("includes the 8 critical non-overlap pairs", () => {
    const skill = ctx.skills.get("role-boundaries")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/devops.*qa-functional/);
    expect(txt).toMatch(/developer-.*tech-lead/);
    expect(txt).toMatch(/developer-backend.*dba/);
    expect(txt).toMatch(/business-analyst.*product-owner/);
    expect(txt).toMatch(/solution-architect.*tech-lead/);
    expect(txt).toMatch(/qa-functional.*qa-automation.*qa-performance/);
    expect(txt).toMatch(/tech-writer.*business-analyst/);
    expect(txt).toMatch(/devops.*security-architect/);
  });

  it("includes anti-patterns and the 2-Tasks correct example", () => {
    const skill = ctx.skills.get("role-boundaries")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/Anti-patrones/);
    expect(txt).toMatch(/Lo hago para acelerar/);
    expect(txt).toMatch(/Total, los tests pasan/);
    expect(txt).toMatch(/Task 1.*@devops/s);
    expect(txt).toMatch(/Task 2.*@qa-functional/s);
  });

  it("includes the two coordination guides", () => {
    const skill = ctx.skills.get("role-boundaries")!;
    const guides = skill.content.guides ?? [];
    const names = guides.map((g) => g.name);
    expect(names).toContain("cuando-aceptar-task-mixta");
    expect(names).toContain("como-detectar-task-cruzada");
  });
});

// ===========================================================================
// WIRING — every at-risk role declares the skill, used_by matches
// ===========================================================================
//
// GUARD RAIL — read this before adding a new role.
//
// Every role in `data/roles/` must be classified explicitly: either it carries
// `role-boundaries` (listed in `used_by`) or it appears in EXEMPT_FROM_ROLE_BOUNDARIES
// below with a one-line reason. The test "every role is classified" enforces this —
// an unclassified role fails CI.
//
// Why: the 0.1.20 incident (devops doing QA) happened because there was no
// systemic check that every executing role had loaded the boundaries skill.
// New roles introduced later (a future role-X) would silently skip the rule
// unless we force the decision now.
//
// To add a new role:
//   - If it executes work that could overlap (tier-1, has bash, signs R in any
//     RACI activity another role also signs): add to `used_by:` in the skill
//     YAML AND add `- role-boundaries` first in its `skills:` list.
//   - If it's a pure coordinator (no execution overlap): add to
//     EXEMPT_FROM_ROLE_BOUNDARIES with a justifying comment.
//
// See docs/guides/adding-roles.md §2 for the full rubric.
// ---------------------------------------------------------------------------

const EXEMPT_FROM_ROLE_BOUNDARIES: Record<string, string> = {
  // Coordinator-only roles with no execution authority that could overlap.
  orchestrator: "is the orchestrator itself; never receives Tasks, only delegates",
  "project-manager": "pure coordination of planning/risks; has no R in execution activities that another role also signs",
  "ux-designer": "design-only handoff to developer-frontend; no implementation overlap",
  "system-designer": "meta-role for the Abax Swarm project itself, not for client projects generated by it",
};

describe("role-boundaries skill: wiring to roles", () => {
  it("every role in data/roles/ is classified (in used_by OR in EXEMPT)", () => {
    const skill = ctx.skills.get("role-boundaries")!;
    const usedBy = new Set(skill.used_by ?? []);
    const exempt = new Set(Object.keys(EXEMPT_FROM_ROLE_BOUNDARIES));
    const unclassified: string[] = [];
    for (const roleId of ctx.roles.keys()) {
      if (!usedBy.has(roleId) && !exempt.has(roleId)) {
        unclassified.push(roleId);
      }
    }
    expect(
      unclassified,
      `Unclassified roles. Add to role-boundaries.yaml#used_by (with - role-boundaries in their skills list) OR to EXEMPT_FROM_ROLE_BOUNDARIES with a reason. See docs/guides/adding-roles.md §2.\nMissing: ${unclassified.join(", ")}`,
    ).toEqual([]);
  });

  it("no role is both in used_by and in EXEMPT (mutually exclusive)", () => {
    const skill = ctx.skills.get("role-boundaries")!;
    const usedBy = new Set(skill.used_by ?? []);
    const conflicts = Object.keys(EXEMPT_FROM_ROLE_BOUNDARIES).filter((id) => usedBy.has(id));
    expect(conflicts, `Roles in both lists: ${conflicts.join(", ")}`).toEqual([]);
  });

  it("every role in used_by also lists role-boundaries in its skills", () => {
    const skill = ctx.skills.get("role-boundaries")!;
    const missing: string[] = [];
    for (const roleId of skill.used_by ?? []) {
      const role = ctx.roles.get(roleId);
      if (!role) {
        missing.push(`${roleId} (role does not exist)`);
        continue;
      }
      if (!role.skills.includes("role-boundaries")) {
        missing.push(`${roleId} (role exists but does not declare the skill)`);
      }
    }
    expect(missing, `used_by ↔ role.skills mismatch: ${missing.join(", ")}`).toEqual([]);
  });

  it("EXEMPT roles do NOT declare role-boundaries (sanity check)", () => {
    const violations: string[] = [];
    for (const roleId of Object.keys(EXEMPT_FROM_ROLE_BOUNDARIES)) {
      const role = ctx.roles.get(roleId);
      if (role && role.skills.includes("role-boundaries")) {
        violations.push(roleId);
      }
    }
    expect(
      violations,
      `EXEMPT roles that wrongly declare role-boundaries: ${violations.join(", ")}. Either remove from EXEMPT or remove the skill from the role.`,
    ).toEqual([]);
  });

  const expectedRoles = [
    "devops",
    "qa-functional",
    "qa-automation",
    "qa-performance",
    "qa-lead",
    "developer-backend",
    "developer-frontend",
    "dba",
    "tech-lead",
    "business-analyst",
    "product-owner",
    "solution-architect",
    "integration-architect",
    "security-architect",
    "change-manager",
    "tech-writer",
  ];

  it("used_by declares all currently classified at-risk roles", () => {
    const skill = ctx.skills.get("role-boundaries")!;
    expect(skill.used_by).toBeDefined();
    expect(skill.used_by!.sort()).toEqual([...expectedRoles].sort());
  });

  it.each(expectedRoles)("role %s has role-boundaries in its skills list", (roleId) => {
    const role = ctx.roles.get(roleId);
    expect(role).toBeDefined();
    expect(role!.skills).toContain("role-boundaries");
  });

  it("the skill reaches the generated agent .md for at-risk roles in opencode", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const skillName = ctx.skills.get("role-boundaries")!.name;
    for (const roleId of ["devops", "qa-functional", "developer-backend", "tech-lead"]) {
      const file = result.files.find((f) => f.path === `.opencode/agents/${roleId}.md`);
      expect(file, `${roleId} agent file missing`).toBeDefined();
      expect(file!.content).toContain(skillName);
    }
  });
});

// ===========================================================================
// ORCHESTRATOR TEMPLATE — emitted in new/continue, NOT in document mode
// ===========================================================================
describe("orchestrator template: role-boundaries section emission", () => {
  it("emits the responsibility matrix in 'new' mode (default)", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md");
    expect(orch).toBeDefined();
    expect(orch!.content).toMatch(/Matriz de responsabilidades tecnicas por fase/);
    expect(orch!.content).toMatch(/anti-cross-role/);
  });

  it("emits the 'Regla 2-Tasks post-fix' section when both qa-functional and developer-backend present", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md");
    expect(orch!.content).toMatch(/Regla 2-Tasks post-fix/);
    expect(orch!.content).toMatch(/dos Tasks separadas/);
    expect(orch!.content).toMatch(/NUNCA en una sola Task/);
  });

  it("emits the rejection protocol guidance for the orchestrator", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md");
    expect(orch!.content).toMatch(/RECHAZO DE TAREA/);
    expect(orch!.content).toMatch(/divide la Task como pide el rol/);
  });

  it("does NOT emit the role-boundaries section in document mode", () => {
    const config = baseConfig({ size: "large", mode: "document" } as Partial<ProjectConfig>);
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md");
    expect(orch).toBeDefined();
    expect(orch!.content).not.toMatch(/Matriz de responsabilidades tecnicas por fase/);
    expect(orch!.content).not.toMatch(/Regla 2-Tasks post-fix/);
    expect(orch!.content).not.toMatch(/anti-cross-role/);
  });

  it("emits the section in 'continue' mode (existing project)", () => {
    const config = baseConfig({ size: "medium", mode: "continue" } as Partial<ProjectConfig>);
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md");
    expect(orch).toBeDefined();
    expect(orch!.content).toMatch(/Matriz de responsabilidades tecnicas por fase/);
  });

  it("does not emit @-mentions for roles outside the team (small project)", () => {
    const config = baseConfig({ size: "small" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    const teamIds = new Set(selection.roles.map((r) => r.roleId));
    const mentions = orch.content.match(/@[a-z][a-z0-9-]+/g) ?? [];
    const orchestratorIds = new Set([...teamIds, "agente", "rol", "rol-correcto", "tu-rol", "otro-rol"]);
    const out = mentions
      .map((m) => m.slice(1))
      .filter((id) => !orchestratorIds.has(id) && id.includes("-"));
    expect(out, `out-of-team mentions: ${out.join(", ")}`).toEqual([]);
  });
});

// ===========================================================================
// CLAUDE TEMPLATE — same gating
// ===========================================================================
describe("claude orchestrator: role-boundaries section emission", () => {
  it("emits the matrix in 'new' mode", () => {
    const config = baseConfig({ size: "large", target: "claude" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === "CLAUDE.md");
    expect(orch).toBeDefined();
    expect(orch!.content).toMatch(/Matriz de responsabilidades tecnicas por fase/);
    expect(orch!.content).toMatch(/Regla 2-Tasks post-fix/);
  });

  it("does NOT emit the matrix in document mode", () => {
    const config = baseConfig({
      size: "large",
      target: "claude",
      mode: "document",
    } as Partial<ProjectConfig>);
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === "CLAUDE.md");
    expect(orch!.content).not.toMatch(/Matriz de responsabilidades tecnicas por fase/);
  });
});

// ===========================================================================
// REGRESION — ensures the section is gated by mode, not by other flags
// ===========================================================================
describe("role-boundaries: regression and edge cases", () => {
  it("a small team still emits the section with only its role rows", () => {
    const config = baseConfig({ size: "small" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toMatch(/Matriz de responsabilidades tecnicas por fase/);
    const teamIds = new Set(selection.roles.map((r) => r.roleId));
    if (teamIds.has("qa-functional")) {
      expect(orch.content).toMatch(/5 QA.*qa-functional/);
    }
  });

  it("section opens and closes properly (no orphan handlebars)", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).not.toMatch(/\{\{/);
    expect(orch.content).not.toMatch(/\}\}/);
  });
});
