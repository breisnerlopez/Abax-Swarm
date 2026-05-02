import { describe, it, expect, beforeAll } from "vitest";
import { loadDataContext } from "../../src/cli/data-context.js";
import type { DataContext } from "../../src/engine/types.js";

let ctx: DataContext;

beforeAll(() => {
  ctx = loadDataContext();
});

// ===========================================================================
// GUARD 1 — Regla anti-mock en developers (incidente Abax-Memory, 0.1.19)
// ===========================================================================
//
// Roles que implementan código de producción deben tener la "Regla anti-mock"
// embebida en su system_prompt: la marca `REPLACE_BEFORE_PROD` y la cita al
// incidente Abax-Memory. Si mañana se añade `developer-mobile`/`-ml`/`-api`
// sin la regla, el `InMemorySearchIndexer` puede regresar.
//
// Heuristica para "necesita la regla":
//   - id empieza con `developer-` (futuros developer-mobile, etc.)
//   - O category en ["construction","data"] con bash != "deny"
//
// Para añadir un rol exento, agregalo a EXEMPT_FROM_ANTI_MOCK con razon.
// ---------------------------------------------------------------------------

const EXEMPT_FROM_ANTI_MOCK: Record<string, string> = {
  // (vacio por ahora — todo rol que cumple la heuristica tiene la regla hoy)
};

describe("guard rail: anti-mock rule in production-implementing roles", () => {
  it("every role that implements production code has the anti-mock rule", () => {
    const violations: string[] = [];
    for (const [id, role] of ctx.roles.entries()) {
      const isDeveloper = id.startsWith("developer-");
      const isConstructionOrData =
        (role.category === "construction" || role.category === "data") &&
        role.agent.permissions?.bash !== "deny";
      if (!isDeveloper && !isConstructionOrData) continue;
      if (id in EXEMPT_FROM_ANTI_MOCK) continue;
      const prompt = role.agent.system_prompt;
      const missing: string[] = [];
      if (!/REPLACE_BEFORE_PROD/.test(prompt)) missing.push("REPLACE_BEFORE_PROD");
      if (!/incidente Abax-Memory/.test(prompt)) missing.push("'incidente Abax-Memory'");
      if (!/Regla anti-mock/i.test(prompt)) missing.push("'Regla anti-mock' header");
      if (missing.length > 0) violations.push(`${id} missing: ${missing.join(", ")}`);
    }
    expect(
      violations,
      `Roles that should carry the anti-mock rule but don't.\nAdd the rule to their system_prompt OR add the role to EXEMPT_FROM_ANTI_MOCK with a reason.\nSee docs/quality-gates.md for the rule.\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});

// ===========================================================================
// GUARD 2 — git-collaboration skill en roles con bash (flujo distribuido, 0.1.16)
// ===========================================================================
//
// Cualquier rol con `bash: allow|ask` puede ejecutar `git`. Sin la skill
// `git-collaboration` no respetara el flujo distribuido (rama abax/<project>,
// --author del rol, no force push, no commit a main). Riesgo: un rol nuevo
// con bash haria commits en main rompiendo la convencion.
//
// Para exentar (rol con bash que NO commitea — ejecuta tests, smoke, etc.),
// agregalo a EXEMPT_FROM_GIT_COLLABORATION con razon.
// ---------------------------------------------------------------------------

const EXEMPT_FROM_GIT_COLLABORATION: Record<string, string> = {
  "qa-functional": "ejecuta tests con bash pero produce reportes via write/edit, no commitea entregables",
  "qa-automation": "mantiene framework de tests con bash pero los commits del framework los hace el developer/tech-lead",
  "qa-performance": "ejecuta load tests con bash pero los reportes se entregan via write/edit, no commitea",
  "system-designer": "meta-rol del proyecto Abax Swarm, no opera sobre proyectos cliente con git",
};

describe("guard rail: git-collaboration skill in roles with bash access", () => {
  it("every role with bash != 'deny' carries git-collaboration OR is exempt", () => {
    const violations: string[] = [];
    for (const [id, role] of ctx.roles.entries()) {
      const bash = role.agent.permissions?.bash;
      if (bash === "deny" || bash == null) continue;
      if (id in EXEMPT_FROM_GIT_COLLABORATION) continue;
      if (!role.skills.includes("git-collaboration")) {
        violations.push(`${id} (bash=${bash})`);
      }
    }
    expect(
      violations,
      `Roles with bash access that lack git-collaboration.\nAdd '- git-collaboration' to their skills OR add to EXEMPT_FROM_GIT_COLLABORATION with reason.\nSee docs/git-collaboration.md.\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("EXEMPT roles do not carry git-collaboration (sanity check)", () => {
    const violations: string[] = [];
    for (const id of Object.keys(EXEMPT_FROM_GIT_COLLABORATION)) {
      const role = ctx.roles.get(id);
      if (role && role.skills.includes("git-collaboration")) {
        violations.push(id);
      }
    }
    expect(
      violations,
      `EXEMPT roles that wrongly declare git-collaboration: ${violations.join(", ")}.`,
    ).toEqual([]);
  });
});

// ===========================================================================
// GUARD 3 — stack_overrides cubren TODOS los stacks definidos
// ===========================================================================
//
// Si un rol declara `stack_overrides`, debe tener una entrada para CADA stack
// en data/stacks/. Olvidar uno hace que el agente generado para ese stack
// pierda el contexto especifico (estandares, libs, frameworks de testing).
//
// Tambien previene que al añadir un stack nuevo (#14) se olvide agregarlo a
// los 12 roles tecnicos existentes — el guard falla en CI.
// ---------------------------------------------------------------------------

describe("guard rail: stack_overrides cover all defined stacks", () => {
  it("every role with stack_overrides has an entry for each stack in data/stacks/", () => {
    const allStackIds = Array.from(ctx.stacks.keys()).sort();
    const violations: string[] = [];
    for (const [id, role] of ctx.roles.entries()) {
      const overrides = role.stack_overrides ?? {};
      const overriddenStacks = Object.keys(overrides);
      if (overriddenStacks.length === 0) continue;
      const missing = allStackIds.filter((s) => !(s in overrides));
      if (missing.length > 0) {
        violations.push(`${id} missing stacks: ${missing.join(", ")}`);
      }
    }
    expect(
      violations,
      `Roles with incomplete stack_overrides. If you added a new stack, add it to all roles below. If a role legitimately doesn't need it, remove the role's entire stack_overrides block (don't half-fill it).\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("no role declares overrides for stacks that don't exist", () => {
    const allStackIds = new Set(ctx.stacks.keys());
    const violations: string[] = [];
    for (const [id, role] of ctx.roles.entries()) {
      const overrides = role.stack_overrides ?? {};
      for (const stackId of Object.keys(overrides)) {
        if (!allStackIds.has(stackId)) {
          violations.push(`${id} references unknown stack: ${stackId}`);
        }
      }
    }
    expect(violations, `Stale stack references in role overrides:\n${violations.join("\n")}`).toEqual([]);
  });
});
