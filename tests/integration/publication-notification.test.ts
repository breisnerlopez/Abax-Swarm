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
    name: "pubnotif-test",
    description: "test",
    targetDir: "/tmp/pubnotif-test",
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

describe("publication-notification skill: content and structure", () => {
  it("exists and references the v2 incident", () => {
    const skill = ctx.skills.get("publication-notification");
    expect(skill).toBeDefined();
    expect(skill!.description).toMatch(/ses_21088afdeffe|invisible|URL/i);
  });

  it("instructs how to construct URL from git remote + path", () => {
    const skill = ctx.skills.get("publication-notification")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/https:\/\/<owner>\.github\.io\/<repo>/);
    expect(txt).toMatch(/git remote get-url origin/);
    expect(txt).toMatch(/path-relativo-a-docs/);
  });

  it("defines structured report format with table", () => {
    const skill = ctx.skills.get("publication-notification")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/URLs publicas/);
    expect(txt).toMatch(/Entregable.*URL.*Status/);
  });

  it("instructs orchestrator to include URL in user message", () => {
    const skill = ctx.skills.get("publication-notification")!;
    expect(skill.content.instructions).toMatch(/orquestador.*comunica al usuario|incluir.*URL.*usuario/i);
    expect(skill.content.instructions).toMatch(/No es opcional/);
  });

  it("documents when NOT to apply (md only, internal docs)", () => {
    const skill = ctx.skills.get("publication-notification")!;
    expect(skill.content.instructions).toMatch(/Cuando NO aplica/);
  });

  it("includes 2 guides (URL construction + status validation)", () => {
    const skill = ctx.skills.get("publication-notification")!;
    const guideNames = (skill.content.guides ?? []).map((g) => g.name);
    expect(guideNames).toContain("como-construir-url");
    expect(guideNames).toContain("validar-status-url");
  });

  it("is wired to 6 roles (tech-writer, BA, devops, PM, PO, sol-arch)", () => {
    const skill = ctx.skills.get("publication-notification")!;
    const expected = ["tech-writer", "business-analyst", "devops", "project-manager", "product-owner", "solution-architect"];
    expect(skill.used_by).toEqual(expect.arrayContaining(expected));
    for (const roleId of expected) {
      const role = ctx.roles.get(roleId)!;
      expect(role.skills, `${roleId} missing publication-notification`).toContain("publication-notification");
    }
  });
});

describe("iteration-strategy: post-rename index.html update", () => {
  it("includes the post-rename index.html update task in the folder-por-release guide", () => {
    const skill = ctx.skills.get("iteration-strategy")!;
    const guide = (skill.content.guides ?? []).find((g) => g.name === "ejemplo-decision-folder-por-release");
    expect(guide, "guide ejemplo-decision-folder-por-release missing").toBeDefined();
    const txt = guide!.content;
    expect(txt).toMatch(/Tarea OBLIGATORIA tras el rename — actualizar docs\/index\.html/);
    expect(txt).toMatch(/agent: devops/);
    expect(txt).toMatch(/Reescribe TODOS los `href="entregables\/fase-X/);
    expect(txt).toMatch(/Agrega seccion nueva al inicio/);
  });

  it("includes validation commands post-rename in same guide", () => {
    const skill = ctx.skills.get("iteration-strategy")!;
    const guide = (skill.content.guides ?? []).find((g) => g.name === "ejemplo-decision-folder-por-release")!;
    expect(guide.content).toMatch(/Validacion post-rename/);
    expect(guide.content).toMatch(/grep -E 'href="entregables\/fase-\[0-9\]/);
  });
});

describe("orchestrator template: 'Reporte de URLs publicas' obligatorio al cierre", () => {
  it("opencode template includes the section", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toMatch(/Reporte de URLs publicas/);
    expect(orch.content).toMatch(/ULTIMO entregable obligatorio/);
    expect(orch.content).toMatch(/publication-notification/);
    expect(orch.content).toMatch(/incidente.*ses_21088afdeffe|2026-05-03/);
  });

  it("claude template includes the section", () => {
    const config = baseConfig({ target: "claude", size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === "CLAUDE.md")!;
    expect(orch.content).toMatch(/Reporte de URLs publicas/);
    expect(orch.content).toMatch(/publication-notification/);
  });
});

describe("pipeline: skill propagates to coordinator agents", () => {
  it("PM agent file contains publication-notification skill name", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const pm = result.files.find((f) => f.path === ".opencode/agents/project-manager.md")!;
    expect(pm.content).toContain(ctx.skills.get("publication-notification")!.name);
  });

  it("SKILL.md generated under .opencode/skills/publication-notification/", () => {
    const config = baseConfig({ size: "large" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const skillFile = result.files.find((f) => f.path === ".opencode/skills/publication-notification/SKILL.md");
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toMatch(/Procedimiento al completar un entregable HTML/);
  });
});

describe("guard rail: publication-notification bidirectional sync", () => {
  it("used_by entries match role.skills", () => {
    const skill = ctx.skills.get("publication-notification")!;
    for (const roleId of skill.used_by ?? []) {
      const role = ctx.roles.get(roleId);
      expect(role).toBeDefined();
      expect(role!.skills).toContain("publication-notification");
    }
  });
});
