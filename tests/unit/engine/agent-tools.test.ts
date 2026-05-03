import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { computeAgentTools } from "../../../src/engine/agent-tools.js";
import { loadRolesAsMap } from "../../../src/loader/role-loader.js";
import type { Role } from "../../../src/loader/schemas.js";

const DATA_DIR = join(__dirname, "../../../data");
let roles: Map<string, Role>;

beforeAll(() => {
  roles = loadRolesAsMap(join(DATA_DIR, "roles"));
});

describe("computeAgentTools", () => {
  it("business-analyst: bash denied (perm + tools_enabled), write/read/edit allowed", () => {
    const ba = roles.get("business-analyst")!;
    const view = computeAgentTools(ba);
    expect(view.denied).toContain("bash");
    expect(view.allowed).toContain("write");
    expect(view.allowed).toContain("read");
    expect(view.allowed).toContain("edit");
    expect(view.allowed).toContain("skill");
    // BA defines custom tools, they should land in `allowed` and `custom`
    expect(view.custom.length).toBeGreaterThan(0);
    for (const c of view.custom) expect(view.allowed).toContain(c);
  });

  it("orchestrator: only `task` survives (everything else denied)", () => {
    const orch = roles.get("orchestrator")!;
    const view = computeAgentTools(orch);
    expect(view.denied).toEqual(
      expect.arrayContaining(["read", "write", "edit", "glob", "grep", "bash", "skill"]),
    );
    // task is allow in perms and not in tools_enabled — should be in allowed
    // (orchestrator's role yaml lists `task: allow` in permissions)
    // we don't include `task` in BUILTIN_TOOLS so it won't appear in view.allowed,
    // but we must not list it as denied either.
    expect(view.denied).not.toContain("task");
  });

  it("developer-backend: bash allowed (ask), webfetch denied", () => {
    const dev = roles.get("developer-backend")!;
    const view = computeAgentTools(dev);
    expect(view.allowed).toContain("bash");
    expect(view.denied).toContain("webfetch");
  });

  it("denied list never overlaps with allowed list", () => {
    for (const role of roles.values()) {
      const view = computeAgentTools(role);
      const overlap = view.allowed.filter((t) => view.denied.includes(t));
      expect(overlap, `${role.id} has overlap`).toEqual([]);
    }
  });

  it("custom tools (role.tools[]) always appear in allowed", () => {
    for (const role of roles.values()) {
      const view = computeAgentTools(role);
      for (const t of role.tools) {
        expect(view.allowed, `${role.id} missing custom ${t}`).toContain(t);
      }
    }
  });
});
