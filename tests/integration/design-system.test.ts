import { describe, it, expect, beforeAll } from "vitest";
import { loadDataContext } from "../../src/cli/data-context.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import {
  PRESENTATION_TEMPLATE_PATH,
  generatePresentationTemplate,
  teamUsesPresentations,
} from "../../src/generator/design-system-generator.js";
import type { DataContext, ProjectConfig } from "../../src/engine/types.js";

let ctx: DataContext;

beforeAll(() => {
  ctx = loadDataContext();
});

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "ds-test",
    description: "test",
    targetDir: "/tmp/ds-test",
    size: "medium", // medium pulls business-analyst → presentation-design skill
    criteria: [],
    stackId: "angular-springboot",
    target: "opencode",
    teamScope: "full",
    provider: "anthropic",
    modelStrategy: "inherit",
    ...overrides,
  };
}

const ANTI_PATTERNS: Array<[RegExp, string]> = [
  [/linear-gradient\([^)]*\b(purple|magenta|fuchsia|#a020f0|#ff00ff)\b[^)]*\)/i, "purple/pink gradient"],
  [/#888\b|#999\b|#ccc\b|#cccccc\b|#888888\b/i, "pure gray"],
  [/cubic-bezier\([^)]*\b1\.[0-9]/i, "bouncy easing"],
];

describe("design-system: template emission", () => {
  it("teamUsesPresentations is true when presentation-design skill is in the set", () => {
    expect(teamUsesPresentations([{ id: "presentation-design" } as never])).toBe(true);
    expect(teamUsesPresentations([{ id: "other" } as never])).toBe(false);
    expect(teamUsesPresentations([])).toBe(false);
  });

  it("opencode pipeline emits the presentation template when team uses presentations", () => {
    const config = baseConfig({ target: "opencode" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const tpl = result.files.find((f) => f.path === PRESENTATION_TEMPLATE_PATH);
    expect(tpl).toBeDefined();
    expect(tpl!.content).toMatch(/^<!DOCTYPE html>/);
  });

  it("claude pipeline also emits the presentation template", () => {
    const config = baseConfig({ target: "claude" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const tpl = result.files.find((f) => f.path === PRESENTATION_TEMPLATE_PATH);
    expect(tpl).toBeDefined();
  });
});

describe("design-system: template HTML content", () => {
  const tpl = generatePresentationTemplate();

  it("starts with DOCTYPE and has lang + viewport meta", () => {
    expect(tpl.content).toMatch(/^<!DOCTYPE html>/);
    expect(tpl.content).toMatch(/<html lang="es">/);
    expect(tpl.content).toMatch(/<meta name="viewport"/);
    expect(tpl.content).toMatch(/<meta charset="UTF-8">/);
  });

  it("defines all three visual presets", () => {
    expect(tpl.content).toMatch(/data-style="corporate-minimal"/);
    expect(tpl.content).toMatch(/data-style="tech-editorial"/);
    expect(tpl.content).toMatch(/data-style="dark-premium"/);
  });

  it("uses semantic <section> per slide", () => {
    const sectionCount = (tpl.content.match(/<section class="slide"/g) || []).length;
    expect(sectionCount).toBeGreaterThanOrEqual(5);
  });

  it("does not use any UX anti-patterns in actual CSS", () => {
    // Examine only the <style> content, not slide copy that may mention
    // anti-patterns as cautionary text. Also strip CSS comments so an
    // explanatory `/* not #ccc */` in the source doesn't trip the regex.
    const styleMatch = tpl.content.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    const css = (styleMatch?.[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css.length).toBeGreaterThan(0);
    for (const [pattern, label] of ANTI_PATTERNS) {
      expect(css, `CSS should not contain ${label}`).not.toMatch(pattern);
    }
  });

  it("has a CTA block (every deck must end with one)", () => {
    expect(tpl.content).toMatch(/class="cta"/);
  });
});

describe("design-system: create-presentation tool body", () => {
  it("the tool YAML emits HTML, not Markdown, and accepts the style arg", () => {
    const tool = ctx.tools.get("create-presentation");
    expect(tool).toBeDefined();
    const body = tool!.implementation.body;
    expect(body).toContain("<!DOCTYPE html>");
    expect(body).toContain("data-style=");
    expect(body).toContain("corporate-minimal");
    expect(body).toContain("tech-editorial");
    expect(body).toContain("dark-premium");
    expect(tool!.implementation.args.style).toBeDefined();
  });

  it("the tool body contains no UX anti-patterns either", () => {
    const tool = ctx.tools.get("create-presentation");
    const body = tool!.implementation.body;
    for (const [pattern, label] of ANTI_PATTERNS) {
      expect(body, `should not contain ${label}`).not.toMatch(pattern);
    }
  });
});
