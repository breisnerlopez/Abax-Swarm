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
    name: "qg-test",
    description: "test",
    targetDir: "/tmp/qg-test",
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
// CAPA 1 — Regla anti-mock en developer prompts
// ===========================================================================
describe("Capa 1: anti-mock rule in developer prompts", () => {
  it("developer-backend system_prompt contains the anti-mock rule referencing the incident", () => {
    const role = ctx.roles.get("developer-backend")!;
    expect(role.agent.system_prompt).toMatch(/Regla anti-mock/);
    expect(role.agent.system_prompt).toMatch(/incidente Abax-Memory/);
    expect(role.agent.system_prompt).toMatch(/REPLACE_BEFORE_PROD/);
    expect(role.agent.system_prompt).toMatch(/ESCALA al orquestador/);
    expect(role.agent.system_prompt).toMatch(/HTTP 200.*no es.*implementar/i);
  });

  it("developer-frontend has the same rule with frontend-specific signals", () => {
    const role = ctx.roles.get("developer-frontend")!;
    expect(role.agent.system_prompt).toMatch(/Regla anti-mock/);
    expect(role.agent.system_prompt).toMatch(/REPLACE_BEFORE_PROD/);
    // Frontend-specific signals
    expect(role.agent.system_prompt).toMatch(/MSW intercept|fixture/i);
  });

  it("dba has the rule with data-specific signals", () => {
    const role = ctx.roles.get("dba")!;
    expect(role.agent.system_prompt).toMatch(/Regla anti-mock/);
    expect(role.agent.system_prompt).toMatch(/REPLACE_BEFORE_PROD/);
    expect(role.agent.system_prompt).toMatch(/seed/i);
  });

  it("the rule is reflected in the generated agent .md", () => {
    const config = baseConfig();
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const dev = result.files.find((f) => f.path === ".opencode/agents/developer-backend.md");
    expect(dev).toBeDefined();
    expect(dev!.content).toContain("Regla anti-mock");
    expect(dev!.content).toContain("REPLACE_BEFORE_PROD");
  });
});

// ===========================================================================
// CAPA 2 — Skill anti-mock-review en tech-lead
// ===========================================================================
describe("Capa 2: anti-mock-review skill for tech-lead", () => {
  it("skill exists and references the incident as motivation", () => {
    const skill = ctx.skills.get("anti-mock-review");
    expect(skill).toBeDefined();
    expect(skill!.description).toMatch(/Abax-Memory/);
    expect(skill!.content.instructions).toMatch(/InMemorySearchIndexer/);
  });

  it("is wired only to tech-lead (not over-assigned)", () => {
    const skill = ctx.skills.get("anti-mock-review")!;
    expect(skill.used_by).toEqual(["tech-lead"]);
  });

  it("tech-lead declares the skill", () => {
    const role = ctx.roles.get("tech-lead")!;
    expect(role.skills).toContain("anti-mock-review");
  });

  it("instructions document the 6 steps and the keyword scan patterns", () => {
    const text = ctx.skills.get("anti-mock-review")!.content.instructions;
    for (const step of [
      "Inventario de integraciones",
      "Verificar dependencias declaradas vs imports reales",
      "Escaneo de keywords sospechosos",
      "Verificar instanciacion real",
      "Reporte estructurado",
      "Comunicacion al orquestador",
    ]) {
      expect(text, `step ${step}`).toContain(step);
    }
    // Specific keyword patterns
    expect(text).toMatch(/InMemory\|Mock\|Fake\|Stub\|Dummy/);
    expect(text).toMatch(/REPLACE_BEFORE_PROD/);
  });

  it("instructions explicitly mention the convention for legitimate temp mocks", () => {
    const text = ctx.skills.get("anti-mock-review")!.content.instructions;
    expect(text).toMatch(/MOCK convencional/);
    expect(text).toMatch(/MOCK silencioso/);
  });
});

// ===========================================================================
// CAPA 3 — Bloqueante feature-spec-compliance al final de fase 4
// ===========================================================================
describe("Capa 3: feature-spec-compliance blocker", () => {
  it("phase-deliverables construction includes feature-spec-compliance as LAST deliverable", () => {
    const phase = ctx.phaseDeliverables.phases.find((p) => p.id === "construction")!;
    const last = phase.deliverables[phase.deliverables.length - 1]!;
    expect(last.id).toBe("feature-spec-compliance");
    expect(last.responsible).toBe("business-analyst");
    expect(last.approver).toBe("product-owner");
    expect(last.mandatory).toBe(true);
  });

  it("orchestrator template emits 'Protocolo de cierre de fase Construccion' when team has BA", () => {
    const config = baseConfig();
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toContain("Protocolo de cierre de fase Construccion");
    expect(orch.content).toContain("3 capas anti-mock");
    expect(orch.content).toContain("feature-spec-compliance");
    expect(orch.content).toContain("anti-mock-review");
    expect(orch.content).toMatch(/incidente Abax-Memory/);
  });

  it("the section is omitted when no business-analyst in the team", () => {
    // Team without BA — extreme lean small project
    const config = baseConfig({ size: "small", teamScope: "lean" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const teamHasBA = result.project.roles.some((r) => r.id === "business-analyst");
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    if (teamHasBA) {
      expect(orch.content).toContain("Protocolo de cierre de fase Construccion");
    } else {
      expect(orch.content).not.toContain("Protocolo de cierre de fase Construccion");
    }
  });

  it("claude orchestrator also emits the protocol", () => {
    const config = baseConfig({ target: "claude" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === "CLAUDE.md")!;
    expect(orch.content).toContain("Protocolo de cierre de fase Construccion");
    expect(orch.content).toContain("feature-spec-compliance");
  });

  it("the 3-layer reference cross-references all key pieces", () => {
    const config = baseConfig();
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    // Capa 1 reference
    expect(orch.content).toMatch(/REPLACE_BEFORE_PROD/);
    // Capa 2 reference
    expect(orch.content).toMatch(/anti-mock-review/);
    // Capa 3 reference
    expect(orch.content).toMatch(/feature-spec-compliance/);
  });
});

// ===========================================================================
// Integration: all 3 layers visible end-to-end in a generated project
// ===========================================================================
describe("End-to-end: all 3 layers integrate consistently", () => {
  it("a medium opencode project includes capas 1+2+3 in their natural locations", () => {
    const config = baseConfig({ size: "medium" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);

    // Capa 1: developer agent has the rule
    const dev = result.files.find((f) => f.path === ".opencode/agents/developer-backend.md");
    expect(dev!.content).toContain("Regla anti-mock");

    // Capa 2: tech-lead skill is in the skill set
    expect(result.project.skills.some((s) => s.id === "anti-mock-review")).toBe(true);
    const techLead = result.files.find((f) => f.path === ".opencode/agents/tech-lead.md");
    expect(techLead).toBeDefined();
    // Tech lead's skills section should include the skill (by display name)
    expect(techLead!.content).toMatch(/Code Review Anti-Mock|anti-mock-review/i);

    // Capa 3: orchestrator emits the closing-construction protocol
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toContain("Protocolo de cierre de fase Construccion");
  });
});
