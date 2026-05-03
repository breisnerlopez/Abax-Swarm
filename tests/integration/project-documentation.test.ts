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
    name: "doc-test",
    description: "test",
    targetDir: "/tmp/doc-test",
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
// SKILL — project-readme
// ===========================================================================
describe("project-readme skill: content and structure", () => {
  it("exists in the data context", () => {
    const skill = ctx.skills.get("project-readme");
    expect(skill).toBeDefined();
    expect(skill!.name).toMatch(/README/i);
  });

  it("references the 4 fundamental questions a README must answer", () => {
    const skill = ctx.skills.get("project-readme")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/Que es esto/i);
    expect(txt).toMatch(/Por que importa|que problema resuelve/i);
    expect(txt).toMatch(/menos de 2 minutos|quickstart/i);
    expect(txt).toMatch(/Donde aprendo mas|links a docs/i);
  });

  it("includes the 18-row standard structure table", () => {
    const skill = ctx.skills.get("project-readme")!;
    expect(skill.content.instructions).toMatch(/Estructura estandar/);
    // Spot-check the critical sections appear in the table
    for (const section of ["Titulo", "Badges", "TL;DR", "Instalacion", "Uso", "Configuracion", "Tests", "Contribuir", "Licencia"]) {
      expect(skill.content.instructions, `missing section ${section}`).toMatch(new RegExp(section));
    }
  });

  it("has the 10 non-negotiable rules", () => {
    const skill = ctx.skills.get("project-readme")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/Reglas no-negociables/);
    expect(txt).toMatch(/ejecutable tal cual aparece/i);
    expect(txt).toMatch(/Sin lenguaje promocional vacio/i);
    expect(txt).toMatch(/Versiones explicitas/i);
  });

  it("adapts behavior per project mode (new, document, continue)", () => {
    const skill = ctx.skills.get("project-readme")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/Modo `new`/);
    expect(txt).toMatch(/Modo `document`/);
    expect(txt).toMatch(/Modo `continue`/);
  });

  it("provides stack-specific guidance for legacy-other", () => {
    const skill = ctx.skills.get("project-readme")!;
    expect(skill.content.instructions).toMatch(/legacy-other/);
    expect(skill.content.instructions).toMatch(/PHP|VB6|Java Swing|Cobol|Delphi/);
  });

  it("includes 4 templates as guides (new mode, document mode, legacy stack, pre-commit checklist)", () => {
    const skill = ctx.skills.get("project-readme")!;
    const guideNames = (skill.content.guides ?? []).map((g) => g.name);
    expect(guideNames).toContain("plantilla-readme-new-mode");
    expect(guideNames).toContain("plantilla-readme-document-mode");
    expect(guideNames).toContain("plantilla-readme-legacy-stack");
    expect(guideNames).toContain("validacion-pre-commit");
  });

  it("is wired to tech-writer, developer-backend, developer-frontend, tech-lead", () => {
    const skill = ctx.skills.get("project-readme")!;
    expect(skill.used_by).toEqual(
      expect.arrayContaining(["tech-writer", "developer-backend", "developer-frontend", "tech-lead"]),
    );
    for (const roleId of skill.used_by ?? []) {
      const role = ctx.roles.get(roleId);
      expect(role, `${roleId} does not exist`).toBeDefined();
      expect(role!.skills, `${roleId} does not declare project-readme`).toContain("project-readme");
    }
  });
});

// ===========================================================================
// SKILL — documentation-quality-bar
// ===========================================================================
describe("documentation-quality-bar skill: content and structure", () => {
  it("exists and emphasizes the 'mediocre is worse than absent' philosophy", () => {
    const skill = ctx.skills.get("documentation-quality-bar");
    expect(skill).toBeDefined();
    expect(skill!.content.instructions).toMatch(/mediocre|falsa confianza/i);
  });

  it("enumerates the 8 non-negotiable minimums explicitly", () => {
    const skill = ctx.skills.get("documentation-quality-bar")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/8 minimos no-negociables/);
    expect(txt).toMatch(/Frontmatter de procedencia/);
    expect(txt).toMatch(/comando ejecutado, no inventado/i);
    expect(txt).toMatch(/TODO|TBD|placeholder/i);
    expect(txt).toMatch(/Links relativos validados/);
    expect(txt).toMatch(/Bloques de codigo etiquetados/);
    expect(txt).toMatch(/Glosario/);
    expect(txt).toMatch(/Indice si supera 200 lineas/);
    expect(txt).toMatch(/Idioma consistente/);
  });

  it("includes a pre-completion checklist", () => {
    const skill = ctx.skills.get("documentation-quality-bar")!;
    expect(skill.content.instructions).toMatch(/Validacion antes de marcar completado/);
    expect(skill.content.instructions).toMatch(/\[ \] Frontmatter completo/);
  });

  it("connects with role-boundaries for approver assignment", () => {
    const skill = ctx.skills.get("documentation-quality-bar")!;
    expect(skill.content.instructions).toMatch(/role-boundaries/);
    expect(skill.content.instructions).toMatch(/tech-writer/i);
  });

  it("is wired to all roles that produce documentation (≥9 roles)", () => {
    const skill = ctx.skills.get("documentation-quality-bar")!;
    const expected = [
      "tech-writer",
      "business-analyst",
      "developer-backend",
      "developer-frontend",
      "tech-lead",
      "solution-architect",
      "dba",
      "devops",
      "security-architect",
    ];
    expect(skill.used_by).toEqual(expect.arrayContaining(expected));
    for (const roleId of expected) {
      const role = ctx.roles.get(roleId)!;
      expect(role.skills, `${roleId} does not declare documentation-quality-bar`).toContain("documentation-quality-bar");
    }
  });

  it("provides command-validation guide with concrete patterns", () => {
    const skill = ctx.skills.get("documentation-quality-bar")!;
    const guideNames = (skill.content.guides ?? []).map((g) => g.name);
    expect(guideNames).toContain("validacion-de-comandos");
    expect(guideNames).toContain("ejemplo-frontmatter");
    expect(guideNames).toContain("como-detectar-gaps");
  });
});

// ===========================================================================
// SKILL — project-documentation-structure
// ===========================================================================
describe("project-documentation-structure skill: content and structure", () => {
  it("exists and defines the standard docs/ tree", () => {
    const skill = ctx.skills.get("project-documentation-structure");
    expect(skill).toBeDefined();
    const txt = skill!.content.instructions;
    expect(txt).toMatch(/Estructura estandar/);
    // Standard subfolders
    for (const folder of ["architecture", "api", "runbooks", "user-guides", "functional", "deliverables"]) {
      expect(txt, `missing folder ${folder} in tree`).toMatch(new RegExp(folder));
    }
  });

  it("includes naming conventions and indexing rules", () => {
    const skill = ctx.skills.get("project-documentation-structure")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/kebab-case/);
    expect(txt).toMatch(/Indices/);
    expect(txt).toMatch(/README\.md/);
  });

  it("adapts structure per project mode (new, document, continue)", () => {
    const skill = ctx.skills.get("project-documentation-structure")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/Modo `new`/);
    expect(txt).toMatch(/Modo `document`/);
    expect(txt).toMatch(/Modo `continue`/);
    expect(txt).toMatch(/recommendations\.md/);
    expect(txt).toMatch(/migration-plan/);
  });

  it("provides MkDocs nav alignment for document mode", () => {
    const skill = ctx.skills.get("project-documentation-structure")!;
    expect(skill.content.instructions).toMatch(/MkDocs/);
    expect(skill.content.instructions).toMatch(/mkdocs\.yml/);
  });

  it("includes skeleton script and ADR format guides", () => {
    const skill = ctx.skills.get("project-documentation-structure")!;
    const guideNames = (skill.content.guides ?? []).map((g) => g.name);
    expect(guideNames).toContain("skeleton-script");
    expect(guideNames).toContain("adr-format");
  });

  it("is wired to tech-writer, tech-lead, solution-architect, business-analyst, devops", () => {
    const skill = ctx.skills.get("project-documentation-structure")!;
    const expected = ["tech-writer", "tech-lead", "solution-architect", "business-analyst", "devops"];
    expect(skill.used_by).toEqual(expect.arrayContaining(expected));
    for (const roleId of expected) {
      const role = ctx.roles.get(roleId)!;
      expect(role.skills, `${roleId} does not declare project-documentation-structure`).toContain(
        "project-documentation-structure",
      );
    }
  });
});

// ===========================================================================
// PHASE DELIVERABLES — project-readme + docs-structure-skeleton in fase 4
// ===========================================================================
describe("phase-deliverables: docs entregables in Construccion", () => {
  it("project-readme is a mandatory deliverable in fase 4", () => {
    const construction = ctx.phaseDeliverables!.phases.find((p) => /construccion/i.test(p.name) || p.id === "construction");
    expect(construction).toBeDefined();
    const readme = construction!.deliverables.find((d) => d.id === "project-readme");
    expect(readme, "project-readme deliverable missing in Construccion phase").toBeDefined();
    expect(readme!.mandatory).toBe(true);
    expect(readme!.responsible).toBe("tech-writer");
    expect(readme!.approver).toBe("tech-lead");
  });

  it("docs-structure-skeleton is a mandatory deliverable in fase 4", () => {
    const construction = ctx.phaseDeliverables!.phases.find((p) => /construccion/i.test(p.name) || p.id === "construction");
    const skeleton = construction!.deliverables.find((d) => d.id === "docs-structure-skeleton");
    expect(skeleton, "docs-structure-skeleton deliverable missing in Construccion phase").toBeDefined();
    expect(skeleton!.mandatory).toBe(true);
    expect(skeleton!.responsible).toBe("tech-writer");
  });
});

// ===========================================================================
// PIPELINE — agents reach the docs skills via generated files
// ===========================================================================
describe("pipeline: doc skills propagate to generated agent files", () => {
  it("generated tech-writer agent file lists project-readme as a skill", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const tw = result.files.find((f) => f.path === ".opencode/agents/tech-writer.md");
    expect(tw).toBeDefined();
    const skillName = ctx.skills.get("project-readme")!.name;
    expect(tw!.content).toContain(skillName);
  });

  it("generated developer-backend agent file lists project-readme + documentation-quality-bar", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const dev = result.files.find((f) => f.path === ".opencode/agents/developer-backend.md");
    expect(dev).toBeDefined();
    expect(dev!.content).toContain(ctx.skills.get("project-readme")!.name);
    expect(dev!.content).toContain(ctx.skills.get("documentation-quality-bar")!.name);
  });

  it("the project-readme skill file is generated under .opencode/skills/", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const skillFile = result.files.find((f) => f.path === ".opencode/skills/project-readme/SKILL.md");
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toMatch(/Estructura estandar/);
  });

  it("the documentation-quality-bar skill file is generated", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const skillFile = result.files.find((f) => f.path === ".opencode/skills/documentation-quality-bar/SKILL.md");
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toMatch(/8 minimos no-negociables/);
  });
});

// ===========================================================================
// MODE-SPECIFIC — document mode keeps the skills relevant
// ===========================================================================
describe("doc skills in document mode", () => {
  it("legacy-other + document mode still propagates the doc skills", () => {
    const config = baseConfig({
      size: "medium",
      stackId: "legacy-other",
      mode: "document",
    } as Partial<ProjectConfig>);
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    // tech-writer is in the curated document-mode team
    const tw = result.files.find((f) => f.path === ".opencode/agents/tech-writer.md");
    expect(tw).toBeDefined();
    expect(tw!.content).toMatch(/README|Estructura/i);
  });
});

// ===========================================================================
// GUARD RAIL — every doc skill has used_by / role.skills bidirectional sync
// ===========================================================================
describe("guard rail: doc skills bidirectional sync", () => {
  const docSkills = ["project-readme", "documentation-quality-bar", "project-documentation-structure"];

  it.each(docSkills)("skill %s has used_by entries that match role.skills", (skillId) => {
    const skill = ctx.skills.get(skillId)!;
    for (const roleId of skill.used_by ?? []) {
      const role = ctx.roles.get(roleId);
      expect(role, `${skillId} lists used_by ${roleId} but role does not exist`).toBeDefined();
      expect(role!.skills, `${skillId} lists used_by ${roleId} but role does not declare it`).toContain(skillId);
    }
  });
});
