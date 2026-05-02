import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { detectStack } from "../../src/engine/stack-detector.js";
import { adaptRoleToStack } from "../../src/engine/stack-adapter.js";
import { loadDataContext } from "../../src/cli/data-context.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import type { DataContext, ProjectConfig } from "../../src/engine/types.js";

let ctx: DataContext;
const TMP_ROOT = join(tmpdir(), `abax-legacy-${process.pid}`);

beforeAll(() => {
  ctx = loadDataContext();
  mkdirSync(TMP_ROOT, { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_ROOT)) rmSync(TMP_ROOT, { recursive: true, force: true });
});

function fixture(name: string, files: Record<string, string>): string {
  const dir = join(TMP_ROOT, name);
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "legacy-test",
    description: "test",
    targetDir: "/tmp/legacy-test",
    size: "medium",
    criteria: [],
    stackId: "legacy-other",
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
// STACK YAML — content and structure
// ===========================================================================
describe("legacy-other stack: catalog entry", () => {
  it("exists in the loaded data context", () => {
    const stack = ctx.stacks.get("legacy-other");
    expect(stack).toBeDefined();
    expect(stack!.name).toMatch(/legacy/i);
  });

  it("has role_context entries for the same roles as other stacks (12 roles with stack_overrides)", () => {
    const stack = ctx.stacks.get("legacy-other")!;
    const expectedRoles = [
      "business-analyst",
      "dba",
      "developer-backend",
      "developer-frontend",
      "devops",
      "integration-architect",
      "qa-automation",
      "qa-functional",
      "qa-performance",
      "security-architect",
      "solution-architect",
      "tech-lead",
    ];
    for (const roleId of expectedRoles) {
      expect(stack.role_context, `missing role_context for ${roleId}`).toHaveProperty(roleId);
      const ctx_text = stack.role_context[roleId];
      expect(ctx_text, `${roleId} role_context lacks ATENCION header`).toMatch(/ATENCION/);
      expect(ctx_text, `${roleId} role_context lacks 'modelado' wording`).toMatch(/modelado/i);
      expect(ctx_text, `${roleId} role_context lacks 'Reglas de operacion'`).toMatch(/Reglas de operacion/i);
    }
  });

  it("description warns about modern-pattern assumption explicitly", () => {
    const stack = ctx.stacks.get("legacy-other")!;
    expect(stack.description).toMatch(/no modelad|legacy/i);
    expect(stack.description).toMatch(/cautelos|infer|asumas/i);
  });
});

// ===========================================================================
// DETECTOR — PHP, Java desktop (Swing/JavaFX), VB6
// ===========================================================================
describe("stack detector: PHP", () => {
  it("detects PHP via composer.json with Laravel", () => {
    const dir = fixture("php-laravel", {
      "composer.json": JSON.stringify({
        require: { "laravel/framework": "^10.0" },
      }),
    });
    const result = detectStack(dir);
    expect(result.stackId).toBe("legacy-other");
    expect(result.evidence.join(" ")).toMatch(/laravel/i);
    expect(result.evidence.join(" ")).toMatch(/legacy/i);
  });

  it("detects PHP via composer.json with Symfony", () => {
    const dir = fixture("php-symfony", {
      "composer.json": JSON.stringify({
        require: { "symfony/framework-bundle": "^6.0" },
      }),
    });
    const result = detectStack(dir);
    expect(result.stackId).toBe("legacy-other");
    expect(result.evidence.join(" ")).toMatch(/symfony/i);
  });

  it("detects PHP via composer.json without recognized framework", () => {
    const dir = fixture("php-bare", {
      "composer.json": JSON.stringify({ name: "acme/legacy-app" }),
    });
    const result = detectStack(dir);
    expect(result.stackId).toBe("legacy-other");
    expect(result.evidence.join(" ")).toMatch(/sin framework moderno/i);
  });

  it("detects PHP via bare .php files in root (no composer.json)", () => {
    const dir = fixture("php-classic", {
      "index.php": "<?php echo 'hello'; ?>",
      "config.php": "<?php $db = 'mysql:host=localhost'; ?>",
    });
    const result = detectStack(dir);
    expect(result.stackId).toBe("legacy-other");
    expect(result.evidence.join(" ")).toMatch(/sin composer/i);
  });
});

describe("stack detector: Java desktop (Swing/AWT/JavaFX)", () => {
  it("detects Java desktop via pom.xml with JavaFX dependency and no web framework", () => {
    const dir = fixture("java-javafx", {
      "pom.xml": `<project>
  <dependencies>
    <dependency><groupId>org.openjfx</groupId><artifactId>javafx-controls</artifactId></dependency>
  </dependencies>
</project>`,
    });
    const result = detectStack(dir);
    expect(result.stackId).toBe("legacy-other");
    expect(result.evidence.join(" ")).toMatch(/Java desktop/i);
  });

  it("detects Java desktop via .java files importing javax.swing", () => {
    const dir = fixture("java-swing", {
      "pom.xml": "<project><dependencies></dependencies></project>",
      "Main.java": `import javax.swing.JFrame;
public class Main {
  public static void main(String[] args) {
    JFrame frame = new JFrame("Legacy App");
    frame.setVisible(true);
  }
}`,
    });
    const result = detectStack(dir);
    expect(result.stackId).toBe("legacy-other");
    expect(result.evidence.join(" ")).toMatch(/Java desktop/i);
  });

  it("does NOT classify Spring Boot as Java desktop (modern wins)", () => {
    const dir = fixture("java-springboot", {
      "pom.xml": `<project>
  <parent><artifactId>spring-boot-starter-parent</artifactId></parent>
</project>`,
      "Main.java": "import javax.swing.JFrame; // accidental import in springboot project",
    });
    const result = detectStack(dir);
    expect(result.stackId).toBe("angular-springboot");
  });

  it("does NOT classify Quarkus as Java desktop", () => {
    const dir = fixture("java-quarkus", {
      "pom.xml": `<project>
  <dependencies>
    <dependency><groupId>io.quarkus</groupId></dependency>
  </dependencies>
</project>`,
    });
    const result = detectStack(dir);
    expect(result.stackId).toBe("angular-quarkus");
  });
});

describe("stack detector: VB6", () => {
  it("detects VB6 via .vbp project file", () => {
    const dir = fixture("vb6-vbp", {
      "MyApp.vbp": "Type=Exe\nReference=*\\G{00020430-0000-0000-C000-000000000046}#2.0#0#..\\stdole2.tlb#OLE Automation",
    });
    const result = detectStack(dir);
    expect(result.stackId).toBe("legacy-other");
    expect(result.evidence.join(" ")).toMatch(/VB6/i);
    expect(result.evidence.join(" ")).toMatch(/MyApp\.vbp/);
  });

  it("detects VB6 via .frm forms in root", () => {
    const dir = fixture("vb6-forms", {
      "frmMain.frm": "VERSION 5.00\nBegin VB.Form frmMain\n   Caption = \"Main\"\nEnd",
      "modGlobal.bas": "Attribute VB_Name = \"modGlobal\"\nPublic gCounter As Long",
    });
    const result = detectStack(dir);
    expect(result.stackId).toBe("legacy-other");
    expect(result.evidence.join(" ")).toMatch(/VB6/i);
  });

  it("does NOT confuse .cls files alone with VB6 (could be c#-script)", () => {
    const dir = fixture("vb6-just-cls", {
      "Foo.cls": "Attribute VB_Name = ...",
    });
    const result = detectStack(dir);
    expect(result.stackId).not.toBe("legacy-other");
  });
});

describe("stack detector: priority and absence", () => {
  it("returns null with partial signals for completely unknown stacks", () => {
    const dir = fixture("unknown", {
      "README.txt": "Some legacy COBOL system",
    });
    const result = detectStack(dir);
    expect(result.stackId).toBeNull();
  });

  it("modern stacks still win over legacy when signals coexist", () => {
    const dir = fixture("php-and-nextjs", {
      "composer.json": JSON.stringify({ require: { "laravel/framework": "^10.0" } }),
      "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
    });
    const result = detectStack(dir);
    expect(result.stackId).toBe("react-nextjs");
  });
});

// ===========================================================================
// PIPELINE — legacy-other generates a valid project
// ===========================================================================
describe("pipeline: legacy-other generates valid agents without crashing", () => {
  it("runSelection works with stackId=legacy-other", () => {
    const config = baseConfig({ size: "medium" });
    expect(() => runSelection(config, ctx)).not.toThrow();
  });

  it("runPipeline produces agent files for every selected role", () => {
    const config = baseConfig({ size: "medium" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")).toBeDefined();
  });

  it("developer-backend agent in legacy-other carries the cautious context", () => {
    const config = baseConfig({ size: "large" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const dev = result.files.find((f) => f.path === ".opencode/agents/developer-backend.md");
    expect(dev).toBeDefined();
    expect(dev!.content).toMatch(/legacy o no modelado/i);
    expect(dev!.content).toMatch(/INFIERE/i);
    expect(dev!.content).toMatch(/NO asumas/i);
  });

  it("solution-architect agent in legacy-other warns about NOT redesigning", () => {
    const config = baseConfig({ size: "large" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const arch = result.files.find((f) => f.path === ".opencode/agents/solution-architect.md");
    expect(arch).toBeDefined();
    expect(arch!.content).toMatch(/Clean Architecture/);
    expect(arch!.content).toMatch(/NO aplican/);
    expect(arch!.content).toMatch(/PRIMERO documenta/i);
  });

  it("works in document mode (the most common use case for legacy stacks)", () => {
    const config = baseConfig({
      size: "medium",
      mode: "document",
    } as Partial<ProjectConfig>);
    const selection = runSelection(config, ctx);
    expect(() => runPipeline(config, selection, ctx)).not.toThrow();
    const result = runPipeline(config, selection, ctx);
    expect(result.files.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// REGRESSION — no silent fallback to angular-springboot
// ===========================================================================
describe("regression: no silent fallback to angular-springboot", () => {
  it("the WizardApp file no longer maps __none__ to angular-springboot", () => {
    // Sentinel test: the original bug was a literal `setData((d) => ({ ...d, stackId: "angular-springboot" }))`
    // in the "Continuar sin stack adapter" handler. Replacing it with legacy-other is part of the fix.
    // We assert the fallback is gone by checking the source file content.
    const fs = require("fs");
    const src = fs.readFileSync(
      join(__dirname, "..", "..", "src", "cli", "WizardApp.tsx"),
      "utf-8",
    );
    // Find the "stack-detected" case block and assert no setData(...stackId: "angular-springboot")
    // outside of comments. The current code has only ONE mention in a comment explaining the historical bug.
    const stackDetectedIdx = src.indexOf("case \"stack-detected\":");
    const platformIdx = src.indexOf("case \"platform\":", stackDetectedIdx);
    const block = src.slice(stackDetectedIdx, platformIdx);
    // Strip line comments
    const noComments = block
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//"))
      .join("\n");
    expect(noComments).not.toMatch(/stackId:\s*"angular-springboot"/);
  });

  it("legacy-other is offered as an explicit fallback option in the wizard source", () => {
    const fs = require("fs");
    const src = fs.readFileSync(
      join(__dirname, "..", "..", "src", "cli", "WizardApp.tsx"),
      "utf-8",
    );
    expect(src).toMatch(/value:\s*"legacy-other"/);
    expect(src).toMatch(/Stack legacy o no soportado|prompts cautelosos/);
  });
});

// ===========================================================================
// STACK ADAPTER — legacy-other context propagates correctly
// ===========================================================================
describe("stack adapter: legacy-other applies cautious context to all roles", () => {
  it("adapts a developer-backend role with both stack_overrides AND role_context appended", () => {
    const role = ctx.roles.get("developer-backend")!;
    const stack = ctx.stacks.get("legacy-other")!;
    const adapted = adaptRoleToStack(role, stack);
    expect(adapted.agent.system_prompt).toContain("Contexto del Stack: Stack legacy");
    // Both sources should be present (additive merge)
    expect(adapted.agent.system_prompt).toMatch(/Stack: legacy o no modelado en Abax Swarm/); // from stack_overrides
    expect(adapted.agent.system_prompt).toMatch(/ATENCION: el stack del proyecto NO esta modelado/); // from role_context
  });

  it("adapts roles that only have stack_overrides entry but no role_context (e.g., qa-functional has both)", () => {
    const role = ctx.roles.get("qa-functional")!;
    const stack = ctx.stacks.get("legacy-other")!;
    const adapted = adaptRoleToStack(role, stack);
    expect(adapted.agent.system_prompt).toContain("Contexto del Stack");
    expect(adapted.agent.system_prompt).toMatch(/legacy/i);
  });

  it("does not mutate the original role", () => {
    const role = ctx.roles.get("developer-backend")!;
    const original = role.agent.system_prompt;
    const stack = ctx.stacks.get("legacy-other")!;
    adaptRoleToStack(role, stack);
    expect(role.agent.system_prompt).toBe(original);
  });
});
