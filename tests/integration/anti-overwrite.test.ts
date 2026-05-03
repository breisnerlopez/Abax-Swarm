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
    name: "no-clobber-suite",
    description: "test",
    targetDir: "/tmp/no-clobber-suite",
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
// SKILL — existing-docs-update-protocol
// ===========================================================================
describe("existing-docs-update-protocol skill: content and structure", () => {
  it("exists and references the Abax-Memory v2 incident", () => {
    const skill = ctx.skills.get("existing-docs-update-protocol");
    expect(skill).toBeDefined();
    expect(skill!.description).toMatch(/Abax-Memory v2/);
    expect(skill!.description).toMatch(/sobreescribi/i);
  });

  it("forbids silent overwrite and requires escalation", () => {
    const skill = ctx.skills.get("existing-docs-update-protocol")!;
    // Description has the "NUNCA sobreescribirlo silenciosamente" marker
    expect(skill.description).toMatch(/NUNCA debe sobreescribirlo silenciosamente/i);
    // Instructions have the escalation procedure
    const txt = skill.content.instructions;
    expect(txt).toMatch(/escala.{0,40}al orquestador/i);
    expect(txt).toMatch(/DOCUMENTO PREEXISTE/);
    expect(txt).toMatch(/NUNCA escribas directamente/);
  });

  it("provides 4 explicit strategies (A, B, C, D)", () => {
    const skill = ctx.skills.get("existing-docs-update-protocol")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/A\.\s*ACTUALIZAR EN SITIO con bloque/);
    expect(txt).toMatch(/B\.\s*ACTUALIZAR EN SITIO con secciones tachadas/);
    expect(txt).toMatch(/C\.\s*CREAR ARCHIVO PARALELO/);
    expect(txt).toMatch(/D\.\s*ARCHIVAR Y REESCRIBIR/);
  });

  it("includes anti-patterns specifically about silent write", () => {
    const skill = ctx.skills.get("existing-docs-update-protocol")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/Anti-patrones/);
    expect(txt).toMatch(/`write` directo sobre archivo preexistente sin escalar/);
  });

  it("is wired to all 15 doc-producing roles", () => {
    const skill = ctx.skills.get("existing-docs-update-protocol")!;
    const expected = [
      "business-analyst", "product-owner", "tech-writer",
      "developer-backend", "developer-frontend", "dba",
      "solution-architect", "integration-architect", "security-architect",
      "tech-lead", "devops", "qa-functional", "qa-lead",
      "project-manager", "change-manager",
    ];
    expect(skill.used_by).toEqual(expect.arrayContaining(expected));
    for (const roleId of expected) {
      const role = ctx.roles.get(roleId)!;
      expect(role.skills, `${roleId} missing existing-docs-update-protocol`).toContain("existing-docs-update-protocol");
    }
  });

  it("provides guides for frontmatter, detection, and exemptions", () => {
    const skill = ctx.skills.get("existing-docs-update-protocol")!;
    const guideNames = (skill.content.guides ?? []).map((g) => g.name);
    expect(guideNames).toContain("ejemplos-frontmatter-iterado");
    expect(guideNames).toContain("como-detectar-preexistencia");
    expect(guideNames).toContain("que-no-cuenta-como-preexistente");
  });
});

// ===========================================================================
// SKILL — iteration-strategy
// ===========================================================================
describe("iteration-strategy skill: content and structure", () => {
  it("exists and explains when it activates", () => {
    const skill = ctx.skills.get("iteration-strategy");
    expect(skill).toBeDefined();
    expect(skill!.description).toMatch(/v2|v3|nueva iteracion/i);
  });

  it("documents the 4 iteration strategies (A folder, B bloque, C archivar, D branch)", () => {
    const skill = ctx.skills.get("iteration-strategy")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/A\.\s*Folder por release/);
    expect(txt).toMatch(/B\.\s*Bloque/);
    expect(txt).toMatch(/C\.\s*Archivado.*nuevo/i);
    expect(txt).toMatch(/D\.\s*Branch git/);
  });

  it("requires the orchestrator to ASK the user before delegating first deliverable", () => {
    const skill = ctx.skills.get("iteration-strategy")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/Preguntar al usuario.*BLOQUEANTE/i);
    expect(txt).toMatch(/Iteracion mayor detectada/);
  });

  it("requires documenting the decision in iteration-log.md", () => {
    const skill = ctx.skills.get("iteration-strategy")!;
    expect(skill.content.instructions).toMatch(/iteration-log\.md/);
  });

  it("warns against mixing strategies in the same iteration", () => {
    const skill = ctx.skills.get("iteration-strategy")!;
    expect(skill.content.instructions).toMatch(/Mezclar estrategias en la misma iteracion/);
  });

  it("is wired to coordination roles (PM, PO, BA, tech-writer, sol-arch, tech-lead)", () => {
    const skill = ctx.skills.get("iteration-strategy")!;
    const expected = ["project-manager", "product-owner", "business-analyst", "tech-writer", "solution-architect", "tech-lead"];
    expect(skill.used_by).toEqual(expect.arrayContaining(expected));
    for (const roleId of expected) {
      const role = ctx.roles.get(roleId)!;
      expect(role.skills, `${roleId} missing iteration-strategy`).toContain("iteration-strategy");
    }
  });

  it("provides decision examples for both A (Abax-Memory v2) and B (refinement)", () => {
    const skill = ctx.skills.get("iteration-strategy")!;
    const guideNames = (skill.content.guides ?? []).map((g) => g.name);
    expect(guideNames).toContain("ejemplo-decision-folder-por-release");
    expect(guideNames).toContain("ejemplo-decision-bloque-cambios");
    expect(guideNames).toContain("como-detectar-iteracion-mayor");
  });
});

// ===========================================================================
// ORCHESTRATOR TEMPLATE — anti-overwrite section is ACTIVE (literal template)
// ===========================================================================
describe("orchestrator template: anti-overwrite section emits literal Task instructions", () => {
  it("when existingDocs=true, includes ATENCION block with literal LLM-readable template", () => {
    const config = baseConfig({
      detection: { stackId: null, evidence: [], existingDocs: true, hasGit: false },
    } as Partial<ProjectConfig>);
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toMatch(/ATENCION — POSIBLE ARCHIVO PREEXISTENTE/);
    expect(orch.content).toMatch(/INCLUYE LITERALMENTE en el prompt/);
    expect(orch.content).toMatch(/anti-overwrite/);
  });

  it("references the motivating incident (Abax-Memory v2, May 2026)", () => {
    const config = baseConfig({
      detection: { stackId: null, evidence: [], existingDocs: true, hasGit: false },
    } as Partial<ProjectConfig>);
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toMatch(/incidente Abax-Memory v2/i);
    expect(orch.content).toMatch(/2026-05-03/);
  });

  it("explains the two-layer defense (orchestrator inject + sub-agent skill)", () => {
    const config = baseConfig({
      detection: { stackId: null, evidence: [], existingDocs: true, hasGit: false },
    } as Partial<ProjectConfig>);
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toMatch(/Capa A.*orquestador/i);
    expect(orch.content).toMatch(/Capa B.*sub-agente/i);
    expect(orch.content).toMatch(/cinturon de seguridad/);
  });

  it("instructs to use iteration-strategy skill for v2/v3 iterations", () => {
    const config = baseConfig({
      detection: { stackId: null, evidence: [], existingDocs: true, hasGit: false },
    } as Partial<ProjectConfig>);
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toMatch(/iteration-strategy/);
    expect(orch.content).toMatch(/iteration-log\.md/);
  });

  it("does NOT include the section when there are no existing docs", () => {
    const config = baseConfig({
      detection: { stackId: null, evidence: [], existingDocs: false, hasGit: false },
    } as Partial<ProjectConfig>);
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).not.toMatch(/ATENCION — POSIBLE ARCHIVO PREEXISTENTE/);
    expect(orch.content).not.toMatch(/anti-overwrite/);
  });
});

// ===========================================================================
// CLAUDE TEMPLATE — same anti-overwrite reinforcement
// ===========================================================================
describe("claude orchestrator: anti-overwrite reinforcement", () => {
  it("CLAUDE.md template emits the same anti-overwrite block when existingDocs=true", () => {
    const config = baseConfig({
      target: "claude",
      detection: { stackId: null, evidence: [], existingDocs: true, hasGit: false },
    } as Partial<ProjectConfig>);
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === "CLAUDE.md")!;
    expect(orch.content).toMatch(/ATENCION — POSIBLE ARCHIVO PREEXISTENTE/);
    expect(orch.content).toMatch(/existing-docs-update-protocol/);
    expect(orch.content).toMatch(/iteration-strategy/);
    expect(orch.content).toMatch(/Abax-Memory v2/i);
  });
});

// ===========================================================================
// PIPELINE — both new skills propagate to generated agent files
// ===========================================================================
describe("pipeline: anti-overwrite skills reach generated agents", () => {
  it("BA agent file lists both skills (existing-docs-update-protocol + iteration-strategy)", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const ba = result.files.find((f) => f.path === ".opencode/agents/business-analyst.md")!;
    expect(ba).toBeDefined();
    expect(ba.content).toContain(ctx.skills.get("existing-docs-update-protocol")!.name);
    expect(ba.content).toContain(ctx.skills.get("iteration-strategy")!.name);
  });

  it("SKILL.md files are generated for both new skills", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const protocolFile = result.files.find((f) => f.path === ".opencode/skills/existing-docs-update-protocol/SKILL.md");
    const iterFile = result.files.find((f) => f.path === ".opencode/skills/iteration-strategy/SKILL.md");
    expect(protocolFile).toBeDefined();
    expect(iterFile).toBeDefined();
    expect(protocolFile!.content).toMatch(/DOCUMENTO PREEXISTE/);
    expect(iterFile!.content).toMatch(/Folder por release/);
  });
});

// ===========================================================================
// BIDIRECTIONAL SYNC — guard rail consistent with role-boundaries pattern
// ===========================================================================
describe("guard rail: anti-overwrite skills bidirectional sync", () => {
  const docSkills = ["existing-docs-update-protocol", "iteration-strategy"];

  it.each(docSkills)("skill %s used_by entries match role.skills", (skillId) => {
    const skill = ctx.skills.get(skillId)!;
    for (const roleId of skill.used_by ?? []) {
      const role = ctx.roles.get(roleId);
      expect(role, `${skillId} lists used_by ${roleId} but role does not exist`).toBeDefined();
      expect(role!.skills, `${skillId} lists used_by ${roleId} but role does not declare it`).toContain(skillId);
    }
  });
});
