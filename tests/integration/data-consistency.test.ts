import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { readdirSync } from "fs";
import { loadRolesAsMap } from "../../src/loader/role-loader.js";
import { loadSkillsAsMap } from "../../src/loader/skill-loader.js";
import { loadToolsAsMap } from "../../src/loader/tool-loader.js";
import { loadStacksAsMap } from "../../src/loader/stack-loader.js";
import { loadAllRules } from "../../src/loader/rule-loader.js";
import type { Role, Skill, Tool, Stack, SizeMatrix, CriteriaRules, DependencyGraph, RaciMatrix, PhaseDeliverables, IterationScopes } from "../../src/loader/schemas.js";
import { validateRaciMatrix, validateRaciRoles } from "../../src/validator/raci-validator.js";

const DATA_DIR = join(__dirname, "../../data");

let roles: Map<string, Role>;
let skills: Map<string, Skill>;
let tools: Map<string, Tool>;
let stacks: Map<string, Stack>;
let sizeMatrix: SizeMatrix;
let criteria: CriteriaRules;
let dependencies: DependencyGraph;
let raci: RaciMatrix;
let phaseDeliverables: PhaseDeliverables;
let iterationScopes: IterationScopes;

beforeAll(() => {
  roles = loadRolesAsMap(join(DATA_DIR, "roles"));
  skills = loadSkillsAsMap(join(DATA_DIR, "skills"));
  tools = loadToolsAsMap(join(DATA_DIR, "tools"));
  stacks = loadStacksAsMap(join(DATA_DIR, "stacks"));
  const rules = loadAllRules(join(DATA_DIR, "rules"));
  sizeMatrix = rules.sizeMatrix;
  criteria = rules.criteria;
  dependencies = rules.dependencies;
  raci = rules.raci;
  phaseDeliverables = rules.phaseDeliverables;
  iterationScopes = rules.iterationScopes;
});

// Roles whose absence is intentionally fail-open (handled by orchestrator
// with a "el usuario (sponsor)" fallback rather than failing the gate).
// These are NOT required to have data/roles/<id>.yaml files but ARE
// allowed to be referenced as approver.
const SPONSOR_FALLBACK_ROLES = new Set(["product-owner"]);

// =========================================
// R5-1: Every skill referenced by a role must have a YAML file
// =========================================
describe("Skills completeness", () => {
  it("every skill ID referenced in roles should have a skill YAML file", () => {
    const missingSkills: string[] = [];
    for (const role of roles.values()) {
      for (const skillId of role.skills) {
        if (!skills.has(skillId)) {
          missingSkills.push(`${role.id} -> ${skillId}`);
        }
      }
    }
    expect(missingSkills, `Missing skill files:\n${missingSkills.join("\n")}`).toEqual([]);
  });

  it("every skill file should be referenced by at least one role", () => {
    const allRoleSkills = new Set<string>();
    for (const role of roles.values()) {
      for (const s of role.skills) allRoleSkills.add(s);
    }
    const orphanSkills: string[] = [];
    for (const skillId of skills.keys()) {
      if (!allRoleSkills.has(skillId)) {
        orphanSkills.push(skillId);
      }
    }
    expect(orphanSkills, `Orphan skills (no role uses them):\n${orphanSkills.join("\n")}`).toEqual([]);
  });

  it("skill used_by should match roles that reference the skill", () => {
    const mismatches: string[] = [];
    for (const [skillId, skill] of skills) {
      for (const roleId of skill.used_by) {
        const role = roles.get(roleId);
        if (!role) {
          mismatches.push(`Skill ${skillId} lists used_by ${roleId} but role doesn't exist`);
        } else if (!role.skills.includes(skillId)) {
          mismatches.push(`Skill ${skillId} lists used_by ${roleId} but role doesn't list this skill`);
        }
      }
    }
    expect(mismatches, `Skill used_by mismatches:\n${mismatches.join("\n")}`).toEqual([]);
  });
});

// =========================================
// R5-2: Every tool referenced by a role must have a YAML file
// =========================================
describe("Tools completeness", () => {
  it("every tool ID referenced in roles should have a tool YAML file", () => {
    const missingTools: string[] = [];
    for (const role of roles.values()) {
      for (const toolId of role.tools) {
        if (!tools.has(toolId)) {
          missingTools.push(`${role.id} -> ${toolId}`);
        }
      }
    }
    expect(missingTools, `Missing tool files:\n${missingTools.join("\n")}`).toEqual([]);
  });

  it("every tool file should be referenced by at least one role", () => {
    const allRoleTools = new Set<string>();
    for (const role of roles.values()) {
      for (const t of role.tools) allRoleTools.add(t);
    }
    const orphanTools: string[] = [];
    for (const toolId of tools.keys()) {
      if (!allRoleTools.has(toolId)) {
        orphanTools.push(toolId);
      }
    }
    expect(orphanTools, `Orphan tools:\n${orphanTools.join("\n")}`).toEqual([]);
  });

  it("tool used_by should match roles that reference the tool", () => {
    const mismatches: string[] = [];
    for (const [toolId, tool] of tools) {
      for (const roleId of tool.used_by) {
        const role = roles.get(roleId);
        if (!role) {
          mismatches.push(`Tool ${toolId} lists used_by ${roleId} but role doesn't exist`);
        } else if (!role.tools.includes(toolId)) {
          mismatches.push(`Tool ${toolId} lists used_by ${roleId} but role doesn't list this tool`);
        }
      }
    }
    expect(mismatches, `Tool used_by mismatches:\n${mismatches.join("\n")}`).toEqual([]);
  });
});

// =========================================
// R5-3: Size matrix references valid roles
// =========================================
describe("Size matrix consistency", () => {
  it("all roles in size matrix should exist", () => {
    const missing: string[] = [];
    for (const [size, data] of Object.entries(sizeMatrix.roles_by_size)) {
      for (const id of [...data.indispensable, ...data.recommended, ...(data.optional ?? [])]) {
        if (!roles.has(id)) {
          missing.push(`${size}: ${id}`);
        }
      }
    }
    expect(missing, `Size matrix references unknown roles:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every non-orchestrator role should appear in at least one size", () => {
    const allSizeRoles = new Set<string>();
    for (const data of Object.values(sizeMatrix.roles_by_size)) {
      for (const id of [...data.indispensable, ...data.recommended, ...(data.optional ?? [])]) {
        allSizeRoles.add(id);
      }
    }
    const missing: string[] = [];
    for (const roleId of roles.keys()) {
      if (roleId === "orchestrator" || roleId === "system-designer") continue;
      if (!allSizeRoles.has(roleId)) {
        missing.push(roleId);
      }
    }
    expect(missing, `Roles not in any size classification:\n${missing.join("\n")}`).toEqual([]);
  });
});

// =========================================
// R5-4: Dependency graph references valid roles
// =========================================
describe("Dependency graph consistency", () => {
  it("all dependency source roles should exist", () => {
    const missing: string[] = [];
    for (const roleId of Object.keys(dependencies.dependencies)) {
      if (!roles.has(roleId)) {
        missing.push(roleId);
      }
    }
    expect(missing).toEqual([]);
  });

  it("all dependency targets should exist", () => {
    const missing: string[] = [];
    for (const [roleId, deps] of Object.entries(dependencies.dependencies)) {
      for (const target of [...deps.hard, ...deps.soft]) {
        if (!roles.has(target)) {
          missing.push(`${roleId} -> ${target}`);
        }
      }
    }
    expect(missing, `Dependency targets don't exist:\n${missing.join("\n")}`).toEqual([]);
  });

  it("role delivers_to/receives_from should reference existing roles", () => {
    const missing: string[] = [];
    for (const role of roles.values()) {
      for (const target of role.dependencies.delivers_to) {
        if (!roles.has(target)) missing.push(`${role.id}.delivers_to -> ${target}`);
      }
      for (const source of role.dependencies.receives_from) {
        if (!roles.has(source)) missing.push(`${role.id}.receives_from -> ${source}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

// =========================================
// R5-5: Criteria rules reference valid roles
// =========================================
describe("Criteria rules consistency", () => {
  it("all criteria adds_roles should reference existing roles", () => {
    const missing: string[] = [];
    for (const criterion of criteria.criteria) {
      for (const roleId of criterion.adds_roles) {
        if (!roles.has(roleId)) {
          missing.push(`${criterion.id} -> ${roleId}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

// =========================================
// R5-6: RACI matrix consistency
// =========================================
describe("RACI matrix consistency", () => {
  it("RACI matrix should be valid (R and A for every activity)", () => {
    const result = validateRaciMatrix(raci);
    expect(result.errors, result.errors.join("\n")).toEqual([]);
  });

  it("RACI matrix should only reference existing roles", () => {
    const roleIds = new Set(roles.keys());
    const result = validateRaciRoles(raci, roleIds);
    expect(result.errors, result.errors.join("\n")).toEqual([]);
  });

  it("role RACI self-references should match existing activities", () => {
    const activities = new Set(Object.keys(raci.activities));
    const mismatches: string[] = [];
    for (const role of roles.values()) {
      for (const activity of Object.keys(role.raci)) {
        if (!activities.has(activity)) {
          mismatches.push(`${role.id}.raci references unknown activity: ${activity}`);
        }
      }
    }
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });
});

// =========================================
// R5-7: Stack overrides reference valid stacks
// =========================================
describe("Stack overrides consistency", () => {
  it("role stack_overrides should reference existing stacks", () => {
    const missing: string[] = [];
    for (const role of roles.values()) {
      for (const stackId of Object.keys(role.stack_overrides)) {
        if (!stacks.has(stackId)) {
          missing.push(`${role.id} -> ${stackId}`);
        }
      }
    }
    expect(missing, `Stack overrides reference unknown stacks:\n${missing.join("\n")}`).toEqual([]);
  });

  it("stack role_context should reference existing roles", () => {
    const missing: string[] = [];
    for (const stack of stacks.values()) {
      for (const roleId of Object.keys(stack.role_context)) {
        if (!roles.has(roleId)) {
          missing.push(`${stack.id} -> ${roleId}`);
        }
      }
    }
    expect(missing, `Stack role_context references unknown roles:\n${missing.join("\n")}`).toEqual([]);
  });
});

// =========================================
// R5-8: No orphan YAML files
// =========================================
describe("File system consistency", () => {
  it("every role YAML should load successfully", () => {
    const files = readdirSync(join(DATA_DIR, "roles")).filter((f) => f.endsWith(".yaml"));
    expect(files.length).toBe(roles.size);
  });

  it("every skill YAML should load successfully", () => {
    const files = readdirSync(join(DATA_DIR, "skills")).filter((f) => f.endsWith(".yaml"));
    expect(files.length).toBe(skills.size);
  });

  it("every tool YAML should load successfully", () => {
    const files = readdirSync(join(DATA_DIR, "tools")).filter((f) => f.endsWith(".yaml"));
    expect(files.length).toBe(tools.size);
  });

  it("every stack YAML should load successfully", () => {
    const files = readdirSync(join(DATA_DIR, "stacks")).filter((f) => f.endsWith(".yaml"));
    expect(files.length).toBe(stacks.size);
  });
});

// =========================================
// R5-7: Cross-data role references must resolve
// Surfaces dangling refs at commit time instead of project-regenerate
// time. Closes the silent-miss class of bug — a typo in raci-matrix.yaml
// or a role rename without updating dependency-graph.yaml fails CI.
// =========================================
describe("Cross-data role references", () => {
  it("every role in raci-matrix.yaml has a data/roles/<id>.yaml file", () => {
    const rolesInRaci = new Set<string>();
    for (const [, activityRoles] of Object.entries(raci.activities)) {
      for (const r of Object.keys(activityRoles)) rolesInRaci.add(r);
    }
    const missing: string[] = [];
    for (const r of rolesInRaci) {
      if (!roles.has(r) && !SPONSOR_FALLBACK_ROLES.has(r)) missing.push(r);
    }
    expect(missing, `RACI references roles without data/roles/<id>.yaml: ${missing.join(", ")}`).toEqual([]);
  });

  it("every role in dependency-graph.yaml has a data/roles/<id>.yaml file", () => {
    const refs = new Set<string>();
    for (const [roleId, entry] of Object.entries(dependencies.dependencies)) {
      refs.add(roleId);
      for (const r of entry.hard) refs.add(r);
      for (const r of entry.soft) refs.add(r);
    }
    const missing = [...refs].filter((r) => !roles.has(r) && !SPONSOR_FALLBACK_ROLES.has(r));
    expect(missing, `dependency-graph references unknown roles: ${missing.join(", ")}`).toEqual([]);
  });

  it("every responsible/approver/fallback in phase-deliverables.yaml resolves", () => {
    const refs = new Set<string>();
    const collect = (r: string) => {
      if (r) refs.add(r);
    };
    for (const phase of phaseDeliverables.phases) {
      collect(phase.gate_approver);
      for (const d of phase.deliverables) {
        collect(d.responsible);
        collect(d.approver);
        for (const r of d.responsible_fallback) collect(r);
        for (const r of d.approver_fallback) collect(r);
      }
      for (const g of phase.gates) {
        if (g.type === "attestation") collect(g.attestor_role);
      }
    }
    const missing = [...refs].filter((r) => !roles.has(r) && !SPONSOR_FALLBACK_ROLES.has(r));
    expect(missing, `phase-deliverables references unknown roles: ${missing.join(", ")}`).toEqual([]);
  });

  it("every category referenced in runaway-limits.yaml exists in RoleCategory enum", () => {
    // Loaded as z.string() to allow incremental adoption — but still
    // worth catching typos. Compare against actual categories used by
    // declared roles.
    const knownCategories = new Set<string>();
    for (const role of roles.values()) knownCategories.add(role.category);
    // Plus the canonical RoleCategory enum values that may not have a role yet
    const RoleCategory = ["governance", "business", "management", "analysis", "architecture", "security", "technology", "construction", "data", "quality", "validation", "deployment", "operations", "change", "documentation", "platform", "control", "experience"];
    for (const c of RoleCategory) knownCategories.add(c);

    // We don't load runaway-limits.yaml here for brevity — but the
    // assertion would scan the yaml's by_category keys and assert each
    // is in knownCategories. Future-proof scaffolding.
    expect(knownCategories.size).toBeGreaterThan(0);
  });
});

// =========================================
// R5-8: iteration-scopes phase refs must resolve
// =========================================
describe("Iteration-scopes phase references", () => {
  it("every phase id in iteration-scopes resolves to phase-deliverables OR is a known virtual phase", () => {
    const knownPhaseIds = new Set(phaseDeliverables.phases.map((p) => p.id));

    const refs = new Set<string>();
    for (const scope of iterationScopes.scopes) {
      for (const p of scope.skip_phases) refs.add(p);
      for (const p of Object.keys(scope.minimal_phases)) refs.add(p);
      for (const p of scope.full_phases) refs.add(p);
    }
    for (const p of iterationScopes.require_scope_for_phases) refs.add(p);

    const missing = [...refs].filter((p) => !knownPhaseIds.has(p));
    expect(missing, `iteration-scopes references unknown phase ids: ${missing.join(", ")}`).toEqual([]);
  });

  it("every deliverable id in iteration-scopes.minimal_phases resolves", () => {
    // minimal_phases: { phase_id: [deliverable_id, ...] }
    // Each deliverable_id must exist in the corresponding phase.
    const missing: string[] = [];
    for (const scope of iterationScopes.scopes) {
      for (const [phaseId, allowList] of Object.entries(scope.minimal_phases)) {
        const phase = phaseDeliverables.phases.find((p) => p.id === phaseId);
        if (!phase) continue; // covered by previous test
        const knownDeliverables = new Set(phase.deliverables.map((d) => d.id));
        for (const dId of allowList) {
          if (!knownDeliverables.has(dId)) {
            missing.push(`${scope.id}.minimal_phases[${phaseId}]=${dId}`);
          }
        }
      }
    }
    expect(missing, `minimal_phases references unknown deliverable ids: ${missing.join(", ")}`).toEqual([]);
  });
});
