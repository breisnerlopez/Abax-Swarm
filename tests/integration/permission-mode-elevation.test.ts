import { describe, it, expect } from "vitest";
import { applyModeToAgentPermissions } from "../../src/engine/permissions.js";
import { generateOpenCodeConfig } from "../../src/generator/opencode/config-generator.js";
import { loadDataContext } from "../../src/cli/data-context.js";

describe("applyModeToAgentPermissions: per-agent permission elevation", () => {
  const orchestratorPerms = {
    read: "deny", edit: "deny", glob: "deny", grep: "deny",
    bash: "deny", task: "allow", skill: "deny", webfetch: "deny", todowrite: "deny",
  };

  const developerPerms = {
    read: "allow", edit: "allow", glob: "allow", grep: "allow",
    bash: "ask", webfetch: "deny", skill: "allow",
  };

  it("recommended mode: pass-through (no changes)", () => {
    expect(applyModeToAgentPermissions(developerPerms, "recommended")).toEqual(developerPerms);
  });

  it("full mode: ask → allow, deny preserved", () => {
    const result = applyModeToAgentPermissions(developerPerms, "full")!;
    expect(result.bash).toBe("allow");      // was ask → elevated
    expect(result.webfetch).toBe("deny");   // was deny → preserved
    expect(result.read).toBe("allow");      // was allow → unchanged
    expect(result.edit).toBe("allow");      // was allow → unchanged
  });

  it("full mode: orchestrator's deny stays intact (pure coordinator)", () => {
    const result = applyModeToAgentPermissions(orchestratorPerms, "full")!;
    expect(result.read).toBe("deny");
    expect(result.edit).toBe("deny");
    expect(result.bash).toBe("deny");
    expect(result.task).toBe("allow"); // unchanged
  });

  it("strict mode: allow → ask, deny preserved", () => {
    const result = applyModeToAgentPermissions(developerPerms, "strict")!;
    expect(result.read).toBe("ask");        // was allow → demoted
    expect(result.edit).toBe("ask");        // was allow → demoted
    expect(result.bash).toBe("ask");        // was ask → unchanged
    expect(result.webfetch).toBe("deny");   // preserved
  });

  it("undefined permissions returns undefined", () => {
    expect(applyModeToAgentPermissions(undefined, "full")).toBeUndefined();
  });
});

describe("generateOpenCodeConfig: permissionMode propagation to per-agent", () => {
  const ctx = loadDataContext();
  const devBackend = ctx.roles.get("developer-backend")!;
  const techLead = ctx.roles.get("tech-lead")!;
  const ba = ctx.roles.get("business-analyst")!;
  const agents = [devBackend, techLead, ba];

  it("full mode: developer-backend bash elevated from ask to allow", () => {
    const file = generateOpenCodeConfig(agents, undefined, undefined, "full", "devcontainer");
    const config = JSON.parse(file.content);
    expect(config.agent["developer-backend"].permission.bash).toBe("allow");
    expect(config.agent["tech-lead"].permission.bash).toBe("allow");
    expect(config.agent["business-analyst"].permission.webfetch).toBe("allow");
  });

  it("full mode: orchestrator keeps bash:deny (coordinator-only by design)", () => {
    const file = generateOpenCodeConfig(agents, undefined, undefined, "full", "devcontainer");
    const config = JSON.parse(file.content);
    expect(config.agent.orchestrator.permission.read).toBe("deny");
    expect(config.agent.orchestrator.permission.bash).toBe("deny");
    expect(config.agent.orchestrator.permission.task).toBe("allow");
  });

  it("recommended mode: developer-backend keeps bash:ask (no auto-elevation)", () => {
    const file = generateOpenCodeConfig(agents, undefined, undefined, "recommended", "devcontainer");
    const config = JSON.parse(file.content);
    expect(config.agent["developer-backend"].permission.bash).toBe("ask");
    expect(config.agent["business-analyst"].permission.webfetch).toBe("ask");
  });

  it("strict mode: developer-backend's read/edit demoted to ask, deny preserved", () => {
    const file = generateOpenCodeConfig(agents, undefined, undefined, "strict", "devcontainer");
    const config = JSON.parse(file.content);
    expect(config.agent["developer-backend"].permission.read).toBe("ask");
    expect(config.agent["developer-backend"].permission.edit).toBe("ask");
    expect(config.agent["developer-backend"].permission.webfetch).toBe("deny");
  });
});
