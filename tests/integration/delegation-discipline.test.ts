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
    name: "deleg-test",
    description: "test",
    targetDir: "/tmp/deleg-test",
    size: "medium",
    criteria: [],
    stackId: "react-nextjs",
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
// SKILL — delegation-discipline
// ===========================================================================
describe("delegation-discipline skill: content and structure", () => {
  it("exists and references the Abax-Memory v2 explore incident", () => {
    const skill = ctx.skills.get("delegation-discipline");
    expect(skill).toBeDefined();
    expect(skill!.description).toMatch(/Abax-Memory v2/i);
    expect(skill!.description).toMatch(/@explore|nativo/i);
  });

  it("provides a decision matrix with both 'OK' cases and 'Veto' cases", () => {
    const skill = ctx.skills.get("delegation-discipline")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/Matriz de decision/);
    // OK cases for natives
    expect(txt).toMatch(/@explore.*permitido/);
    expect(txt).toMatch(/@docs.*permitido/);
    expect(txt).toMatch(/@plan.*permitido/);
    expect(txt).toMatch(/@general.*permitido/);
    // Veto cases
    expect(txt).toMatch(/Solo roles del proyecto/);
  });

  it("enumerates the 4 critical vetos explicitly", () => {
    const skill = ctx.skills.get("delegation-discipline")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/Los 4 vetos criticos/i);
    expect(txt).toMatch(/Veto 1.*write.*edit/i);
    expect(txt).toMatch(/Veto 2.*git commit/i);
    expect(txt).toMatch(/Veto 3.*Decision formal/);
    expect(txt).toMatch(/Veto 4.*entregable formal/i);
  });

  it("includes the 5-second heuristics guide", () => {
    const skill = ctx.skills.get("delegation-discipline")!;
    const guideNames = (skill.content.guides ?? []).map((g) => g.name);
    expect(guideNames).toContain("heuristicas-rapidas");
    expect(guideNames).toContain("ejemplos-nativos-permitidos");
    expect(guideNames).toContain("ejemplos-nativos-prohibidos");
  });

  it("mentions reading project-manifest.yaml as shortcut before delegation", () => {
    const skill = ctx.skills.get("delegation-discipline")!;
    expect(skill.content.instructions).toMatch(/project-manifest\.yaml/);
    expect(skill.content.instructions).toMatch(/atajo|directamente/i);
  });

  it("is wired to all 6 coordinator roles", () => {
    const skill = ctx.skills.get("delegation-discipline")!;
    const expected = [
      "project-manager", "product-owner", "business-analyst",
      "tech-writer", "solution-architect", "tech-lead",
    ];
    expect(skill.used_by).toEqual(expect.arrayContaining(expected));
    for (const roleId of expected) {
      const role = ctx.roles.get(roleId)!;
      expect(role.skills, `${roleId} missing delegation-discipline`).toContain("delegation-discipline");
    }
  });
});

// ===========================================================================
// ITERATION-STRATEGY — reinforced with manifest shortcut
// ===========================================================================
describe("iteration-strategy: reinforced activation", () => {
  it("when_to_use mentions FIRST user message + propuesta keyword", () => {
    const skill = ctx.skills.get("iteration-strategy")!;
    expect(skill.content.when_to_use).toMatch(/PRIMER mensaje del usuario/);
    expect(skill.content.when_to_use).toMatch(/implementar propuesta/);
  });

  it("instructions include the project-manifest shortcut", () => {
    const skill = ctx.skills.get("iteration-strategy")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/Atajo de deteccion/);
    expect(txt).toMatch(/project-manifest\.yaml/);
    expect(txt).toMatch(/sin delegar/);
    expect(txt).toMatch(/80%/);
  });

  it("instructs NOT to delegate exhaustive @explore before deciding strategy", () => {
    const skill = ctx.skills.get("iteration-strategy")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/@explore/);
    expect(txt).toMatch(/NO delegues exploracion exhaustiva/i);
  });
});

// ===========================================================================
// ORCHESTRATOR TEMPLATE — new section "ROLES vs NATIVOS"
// ===========================================================================
describe("orchestrator template: nativos vs roles section", () => {
  it("emits ROLES DEL PROYECTO vs SUBAGENTS NATIVOS section", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toMatch(/ROLES DEL PROYECTO vs SUBAGENTS NATIVOS/);
    expect(orch.content).toMatch(/Cuando usar nativos.*OK/);
    expect(orch.content).toMatch(/Cuando NUNCA usar nativos.*Veto/);
  });

  it("lists the 4 vetos in template", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toMatch(/Escribir o editar en `docs\/`/);
    expect(orch.content).toMatch(/`git commit` o `git push`/);
    expect(orch.content).toMatch(/Tomar decision formal/);
    expect(orch.content).toMatch(/Producir entregable formal/);
  });

  it("instructs to read manifest.yaml as shortcut before exploring", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toMatch(/Atajo.*lee el manifest/i);
    expect(orch.content).toMatch(/project-manifest\.yaml/);
    expect(orch.content).toMatch(/80% del contexto/);
  });

  it("instructs to ACTIVATE iteration-strategy on v2 keywords (first message)", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toMatch(/ACTIVA `iteration-strategy`/);
    expect(orch.content).toMatch(/v2\/v3\/iteracion\/evolucion\/implementar propuesta/);
  });
});

// ===========================================================================
// CLAUDE TEMPLATE — same reinforcement
// ===========================================================================
describe("claude orchestrator: nativos vs roles + iteration trigger", () => {
  it("CLAUDE.md template instructs to use roles for entregables and forbids natives for write/commit/decisions", () => {
    const config = baseConfig({ target: "claude", size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === "CLAUDE.md")!;
    expect(orch.content).toMatch(/SIEMPRE rol del proyecto/);
    expect(orch.content).toMatch(/NUNCA delegar a subagents nativos/);
    expect(orch.content).toMatch(/delegation-discipline/);
    expect(orch.content).toMatch(/iteration-strategy/);
  });
});

// ===========================================================================
// PIPELINE — both reinforcements propagate to generated agents
// ===========================================================================
describe("pipeline: delegation-discipline reaches coordinator agents", () => {
  it("PM agent file lists delegation-discipline as a skill", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const pm = result.files.find((f) => f.path === ".opencode/agents/project-manager.md")!;
    expect(pm).toBeDefined();
    expect(pm.content).toContain(ctx.skills.get("delegation-discipline")!.name);
  });

  it("BA agent file lists delegation-discipline + iteration-strategy", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const ba = result.files.find((f) => f.path === ".opencode/agents/business-analyst.md")!;
    expect(ba.content).toContain(ctx.skills.get("delegation-discipline")!.name);
    expect(ba.content).toContain(ctx.skills.get("iteration-strategy")!.name);
  });

  it("SKILL.md is generated under .opencode/skills/delegation-discipline/", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const skillFile = result.files.find((f) => f.path === ".opencode/skills/delegation-discipline/SKILL.md");
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toMatch(/Los 4 vetos criticos/);
  });
});

// ===========================================================================
// BIDIRECTIONAL SYNC
// ===========================================================================
describe("guard rail: delegation-discipline bidirectional sync", () => {
  it("skill used_by entries match role.skills", () => {
    const skill = ctx.skills.get("delegation-discipline")!;
    for (const roleId of skill.used_by ?? []) {
      const role = ctx.roles.get(roleId);
      expect(role, `${roleId} does not exist`).toBeDefined();
      expect(role!.skills, `${roleId} does not declare delegation-discipline`).toContain("delegation-discipline");
    }
  });
});
