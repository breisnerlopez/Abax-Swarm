import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadDataContext } from "../../src/cli/data-context.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import { buildOpenCodePermission } from "../../src/engine/permissions.js";
import { isInsideContainer, hasDevcontainerConfig } from "../../src/engine/container-detector.js";
import { generateDevcontainerFile, shouldEmitDevcontainer } from "../../src/generator/devcontainer-generator.js";
import type { DataContext, ProjectConfig } from "../../src/engine/types.js";

let ctx: DataContext;

beforeAll(() => {
  ctx = loadDataContext();
});

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "perms-test",
    description: "test",
    targetDir: "/tmp/perms-test",
    size: "small",
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

describe("permissions module: 3 modes", () => {
  it("strict mode returns undefined (no root permission emitted)", () => {
    expect(buildOpenCodePermission("strict", "host")).toBeUndefined();
    expect(buildOpenCodePermission("strict", "devcontainer")).toBeUndefined();
  });

  it("full mode returns object with root catch-all + bash patterns (bug fix 0.1.35)", () => {
    // 0.1.34 bug: returned object without root `"*": "allow"`, so OpenCode tools
    // not explicitly listed (task, skill, websearch, write, patch, etc.) fell
    // to per-tool default `ask`. User reported "echo me pide permisos".
    // 0.1.35: include root `"*": "allow"` catch-all + only override bash patterns.
    const p = buildOpenCodePermission("full", "host") as Record<string, unknown>;
    expect(typeof p).toBe("object");
    // Root catch-all for any tool not explicitly listed (task, skill, write, patch, etc.)
    expect(p["*"]).toBe("allow");
    // bash override with patterns
    expect((p.bash as Record<string, string>)["*"]).toBe("allow");
    // Destructive ops stay in ask even in full mode (safety)
    expect((p.bash as Record<string, string>)["git push --force *"]).toBe("ask");
    expect((p.bash as Record<string, string>)["git push -f *"]).toBe("ask");
    expect((p.bash as Record<string, string>)["git reset --hard *"]).toBe("ask");
    expect((p.bash as Record<string, string>)["rm -rf *"]).toBe("ask");
    expect((p.bash as Record<string, string>)["sudo *"]).toBe("ask");
    // External dir explicit
    expect(p.external_directory).toBe("allow");
  });

  it("recommended host mode keeps apt/dpkg/sudo in 'ask' (must escape user OS)", () => {
    const p = buildOpenCodePermission("recommended", "host") as Record<string, Record<string, string>>;
    expect(p.bash["apt *"]).toBe("ask");
    expect(p.bash["apt-get *"]).toBe("ask");
    expect(p.bash["dpkg *"]).toBe("ask");
    expect(p.bash["sudo *"]).toBe("ask");
  });

  it("recommended devcontainer mode flips apt/dpkg/sudo to 'allow' (safe inside)", () => {
    const p = buildOpenCodePermission("recommended", "devcontainer") as Record<string, Record<string, string>>;
    expect(p.bash["apt *"]).toBe("allow");
    expect(p.bash["apt-get *"]).toBe("allow");
    expect(p.bash["dpkg *"]).toBe("allow");
    expect(p.bash["sudo *"]).toBe("allow");
  });

  it("recommended always denies destructive system paths", () => {
    for (const iso of ["host", "devcontainer"] as const) {
      const p = buildOpenCodePermission("recommended", iso) as Record<string, Record<string, string>>;
      expect(p.bash["git push --force *"]).toBe("deny");
      expect(p.bash["chmod 777 *"]).toBe("deny");
      expect(p.bash["rm /var/* *"]).toBe("deny");
      expect(p.bash["rm /etc/* *"]).toBe("deny");
      expect(p.bash["rm /var/lib/dpkg/* *"]).toBe("deny");
      expect(p.bash["curl * | sh"]).toBe("deny");
    }
  });

  it("recommended allows common dev commands in both modes", () => {
    for (const iso of ["host", "devcontainer"] as const) {
      const p = buildOpenCodePermission("recommended", iso) as Record<string, Record<string, string>>;
      for (const cmd of ["git *", "npm *", "mvn *", "pip *", "node *", "go *", "cargo *", "docker *"]) {
        expect(p.bash[cmd], `${cmd} in ${iso}`).toBe("allow");
      }
    }
  });
});

describe("opencode.json: emits permission per mode", () => {
  it("strict mode: opencode.json has NO root permission", () => {
    const config = baseConfig({ permissionMode: "strict" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const oc = JSON.parse(result.files.find((f) => f.path === "opencode.json")!.content);
    expect(oc.permission).toBeUndefined();
  });

  it("recommended mode: opencode.json has bash allowlist", () => {
    const config = baseConfig({ permissionMode: "recommended" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const oc = JSON.parse(result.files.find((f) => f.path === "opencode.json")!.content);
    expect(oc.permission?.bash).toBeDefined();
    expect(oc.permission.bash["mvn *"]).toBe("allow");
  });

  it("full mode: opencode.json has root catch-all + bash overrides (bug fix 0.1.35)", () => {
    const config = baseConfig({ permissionMode: "full" });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const oc = JSON.parse(result.files.find((f) => f.path === "opencode.json")!.content);
    expect(typeof oc.permission).toBe("object");
    expect(oc.permission["*"]).toBe("allow");
    expect(oc.permission.bash["*"]).toBe("allow");
    expect(oc.permission.bash["git push --force *"]).toBe("ask");
    expect(oc.permission.external_directory).toBe("allow");
  });
});

describe("devcontainer-generator", () => {
  it("emits .devcontainer/devcontainer.json when isolationMode is devcontainer", () => {
    const config = baseConfig({ isolationMode: "devcontainer" });
    expect(shouldEmitDevcontainer(config)).toBe(true);
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const dc = result.files.find((f) => f.path === ".devcontainer/devcontainer.json");
    expect(dc).toBeDefined();
    const parsed = JSON.parse(dc!.content);
    expect(parsed.image).toMatch(/devcontainers/);
    // angular-springboot must include java + node features
    expect(parsed.features["ghcr.io/devcontainers/features/java:1"]).toBeDefined();
    expect(parsed.features["ghcr.io/devcontainers/features/node:1"]).toBeDefined();
    // Must mark the container so detector finds it at runtime
    expect(parsed.containerEnv.ABAX_ISOLATED).toBe("1");
  });

  it("does NOT emit devcontainer when isolationMode is host", () => {
    const config = baseConfig({ isolationMode: "host" });
    expect(shouldEmitDevcontainer(config)).toBe(false);
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    expect(result.files.find((f) => f.path === ".devcontainer/devcontainer.json")).toBeUndefined();
  });

  it("python-fastapi gets python feature, not java", () => {
    const config = baseConfig({ stackId: "python-fastapi" });
    const dc = generateDevcontainerFile(config);
    const parsed = JSON.parse(dc.content);
    expect(parsed.features["ghcr.io/devcontainers/features/python:1"]).toBeDefined();
    expect(parsed.features["ghcr.io/devcontainers/features/java:1"]).toBeUndefined();
  });

  it("rust-axum gets rust feature only", () => {
    const config = baseConfig({ stackId: "rust-axum" });
    const dc = generateDevcontainerFile(config);
    const parsed = JSON.parse(dc.content);
    expect(parsed.features["ghcr.io/devcontainers/features/rust:1"]).toBeDefined();
  });

  it("flutter-dart adds postCreateCommand to install Flutter SDK", () => {
    const config = baseConfig({ stackId: "flutter-dart" });
    const dc = generateDevcontainerFile(config);
    const parsed = JSON.parse(dc.content);
    expect(parsed.postCreateCommand).toMatch(/flutter/);
  });
});

describe("container-detector", () => {
  it("hasDevcontainerConfig returns true when .devcontainer/devcontainer.json exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "abax-devc-"));
    try {
      mkdirSync(join(dir, ".devcontainer"));
      writeFileSync(join(dir, ".devcontainer/devcontainer.json"), "{}");
      expect(hasDevcontainerConfig(dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("hasDevcontainerConfig returns false on a clean dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "abax-devc-"));
    try {
      expect(hasDevcontainerConfig(dir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("isInsideContainer returns boolean (host or container, never throws)", () => {
    expect(typeof isInsideContainer()).toBe("boolean");
  });
});

describe("dependency-management skill", () => {
  it("exists and is referenced by 5 expected roles", () => {
    expect(ctx.skills.has("dependency-management")).toBe(true);
    const skill = ctx.skills.get("dependency-management")!;
    const expectedRoles = ["tech-lead", "devops", "developer-backend", "developer-frontend", "dba"];
    for (const r of expectedRoles) {
      expect(skill.used_by).toContain(r);
    }
  });
});

describe("phase-deliverables: env-verification blocker", () => {
  it("construction phase has env-verification as the FIRST deliverable", () => {
    const construction = ctx.phaseDeliverables.phases.find((p) => p.id === "construction");
    expect(construction).toBeDefined();
    expect(construction!.deliverables[0]!.id).toBe("env-verification");
    expect(construction!.deliverables[0]!.responsible).toBe("devops");
    expect(construction!.deliverables[0]!.mandatory).toBe(true);
  });
});

describe("orchestrator template: env verification protocol", () => {
  it("opencode orchestrator references the env-verification protocol", () => {
    const config = baseConfig();
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toContain("Protocolo de inicio de fase Construccion");
    expect(orch.content).toContain("env-verification");
    expect(orch.content).toContain("dependency-management");
    expect(orch.content).toMatch(/NUNCA `sudo apt`|nunca usa `sudo apt`/i);
  });
});
