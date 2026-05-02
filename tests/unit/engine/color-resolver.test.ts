import { describe, it, expect } from "vitest";
import {
  resolveAgentColor,
  ORCHESTRATOR_COLOR,
  AGENT_PALETTE,
} from "../../../src/engine/color-resolver.js";
import type { Role } from "../../../src/loader/schemas.js";

function fakeRole(id: string, color?: string): Role {
  return {
    id,
    name: id,
    category: "engineering",
    tier: "2",
    size_classification: { small: "optional", medium: "optional", large: "optional" },
    agent: {
      mode: "subagent",
      temperature: 0.3,
      description: "test description over ten chars",
      system_prompt: "test prompt over fifty characters " + "x".repeat(40),
      permissions: {},
      tools_enabled: {},
      cognitive_tier: "implementation",
      reasoning: "none",
      ...(color ? { color } : {}),
    },
    skills: [],
    tools: [],
    dependencies: { receives_from: [], delivers_to: [] },
    phases: [],
    raci: {},
  } as unknown as Role;
}

describe("color-resolver", () => {
  it("returns crimson for orchestrator when no override", () => {
    expect(resolveAgentColor(fakeRole("orchestrator"))).toBe(ORCHESTRATOR_COLOR);
  });

  it("explicit agent.color always wins, even for orchestrator", () => {
    expect(resolveAgentColor(fakeRole("orchestrator", "#abcdef"))).toBe("#abcdef");
    expect(resolveAgentColor(fakeRole("developer-backend", "primary"))).toBe("primary");
  });

  it("non-orchestrator role gets a deterministic palette color", () => {
    const r = fakeRole("developer-backend");
    const first = resolveAgentColor(r);
    expect(first).not.toBe(ORCHESTRATOR_COLOR);
    expect(AGENT_PALETTE).toContain(first);
    // Stable across calls
    expect(resolveAgentColor(r)).toBe(first);
    expect(resolveAgentColor(fakeRole("developer-backend"))).toBe(first);
  });

  it("different role ids are not forced to differ but the mapping is deterministic", () => {
    const a = resolveAgentColor(fakeRole("qa-functional"));
    const b = resolveAgentColor(fakeRole("qa-automation"));
    // Both must be from the palette
    expect(AGENT_PALETTE).toContain(a);
    expect(AGENT_PALETTE).toContain(b);
    // We don't assert a !== b (collisions are allowed by design); we assert stability:
    expect(resolveAgentColor(fakeRole("qa-functional"))).toBe(a);
    expect(resolveAgentColor(fakeRole("qa-automation"))).toBe(b);
  });

  it("palette excludes the orchestrator's crimson so no role is mistaken for it", () => {
    expect(AGENT_PALETTE).not.toContain(ORCHESTRATOR_COLOR);
  });
});
