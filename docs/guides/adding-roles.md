# Adding Roles — Abax Swarm

## 1. Create the YAML file

Create `data/roles/<role-id>.yaml`:

```yaml
id: my-new-role
name: Mi Nuevo Rol
category: construction    # See RoleCategory in src/loader/schemas.ts
tier: "1"                 # 1=full agent, 2=specialized

size_classification:
  small: optional
  medium: recommended
  large: indispensable

agent:
  mode: subagent
  temperature: 0.3
  description: Short description of the agent
  system_prompt: |
    Eres el agente [nombre]. Tu responsabilidad es...

    ## Responsabilidades
    - ...

    ## Restricciones
    - ...
  permissions:
    read: allow
    edit: allow
    glob: deny
    grep: deny
    bash: deny
    skill: allow
  tools_enabled:
    write: true
    edit: true
    read: true
    bash: false

skills: []      # Skill IDs (must exist in data/skills/)
tools: []       # Tool IDs (must exist in data/tools/)

stack_overrides: {}   # Optional per-stack additions

dependencies:
  receives_from: []   # Roles that deliver work to this role
  delivers_to: []     # Roles this role delivers work to

phases: []            # Authorized project phases (e.g., construction, deployment)
raci: {}              # RACI activity assignments (e.g., build_solution: R)
```

## 2. Decide on `role-boundaries` (REQUIRED)

Every new role MUST be classified explicitly: either it carries the `role-boundaries` skill (because it could overlap with another master role) OR it is exempt with a documented reason. The integration test `tests/integration/role-boundaries.test.ts` enforces this — adding a role without classification will fail CI.

**Add to `role-boundaries` if any of these apply** (covers most tier-1 roles):

- The role has `bash: allow|ask` and operates on shared environments (devops, dba, devs).
- The role validates work that another role implements (qa-*, tech-lead, business-analyst doing spec-compliance, security-architect).
- The role is tier 1 in `construction`, `quality`, `deployment`, `data`, `architecture`, `analysis`, `business`, `security`, or `documentation` categories.
- The role appears as `R` in any RACI activity that another role also signs as `R` or `A`.

How:

1. Add `- role-boundaries` as the **first** entry in the role's `skills:` list (convention — first skill is loaded first, sets the tone).
2. Add the role ID to `used_by:` in `data/skills/role-boundaries.yaml`.
3. Add a row in the master matrix (`data/skills/role-boundaries.yaml` → `content.instructions`) for the phase where this role is master. Update `docs/role-boundaries.md` to mirror it.
4. If the role is master in a phase that already has another master, add a row to `pares criticos de no-solapamiento` in the same skill explaining how the two divide work.
5. If the orchestrator template needs to know about the role (e.g., the new role is a master in some phase), add a `has<RoleName>` boolean in `src/generator/{opencode,claude}/orchestrator-generator.ts` and reference it in the matrix block of `templates/{opencode,claude}/orchestrator.md.hbs`.

**Mark as exempt if**:

- The role is a pure coordinator with no execution authority (e.g., `change-manager`, `agile-coach`, `scrum-master`).
- The role is design-only with no implementation overlap (e.g., `ux-designer` does not need it because it doesn't implement the components — `developer-frontend` does).
- The role has `bash: deny`, no `R` in any activity another role also has, and is at most `C/I` in everything.

How: add the role ID to `EXEMPT_FROM_ROLE_BOUNDARIES` in `tests/integration/role-boundaries.test.ts` with a one-line comment explaining why. The test will pass; reviewers should question the exemption during code review.

## 2b. Three additional guard rails (`tests/integration/role-guards.test.ts`)

Three other systemic rules are enforced automatically when you add a new role. Each has a corresponding `EXEMPT_FROM_*` constant for documented exceptions.

### Anti-mock rule (incident Abax-Memory, 0.1.19)

Every role that implements production code (`id` starts with `developer-` OR `category` is `construction`/`data` with `bash != "deny"`) must embed the anti-mock rule in its `system_prompt`. The rule must contain `REPLACE_BEFORE_PROD`, the phrase `incidente Abax-Memory`, and a `Regla anti-mock` header.

Use the rule from `data/roles/developer-backend.yaml` (the canonical version) and adapt the language-specific examples and signals (e.g., `// MOCK:` for TS/Java/Go, `# MOCK:` for Python, `-- MOCK:` for SQL). Exempt only via `EXEMPT_FROM_ANTI_MOCK` if the role provably writes no production code.

### `git-collaboration` skill on roles with bash

Every role with `bash: allow|ask` must declare the `git-collaboration` skill (so it respects the distributed flow: `abax/<project>` branch, `--author <role@abax-swarm>`, no force push, no commits to `main`). Exempt via `EXEMPT_FROM_GIT_COLLABORATION` only if the role uses bash but does not commit deliverables (e.g., `qa-*` roles execute tests but produce reports via `write/edit`).

### Complete `stack_overrides`

If a role declares any `stack_overrides`, it must have an entry for **every** stack in `data/stacks/`. Adding a stack later (`#14`) without updating all 12 technical roles produces silent context loss in generated agents — the guard catches this.

A role can legitimately have no `stack_overrides` at all (coordinators, designers, doc roles); the guard only enforces completeness when the block is present.

## 3. Register in rules

### `data/rules/size-matrix.yaml`
Add the role ID in the appropriate classification per size:
```yaml
roles_by_size:
  small:
    optional:
      - my-new-role
  medium:
    recommended:
      - my-new-role
  large:
    indispensable:
      - my-new-role
```

### `data/rules/dependency-graph.yaml`
If the role has dependencies:
```yaml
dependencies:
  my-new-role:
    hard: [business-analyst]    # Mandatory (auto-included)
    soft: [tech-lead]           # Recommended (warning only)
```

### `data/rules/raci-matrix.yaml`
Add to relevant activities:
```yaml
activities:
  build_solution:
    my-new-role: R    # R/A/C/I
```

### `data/rules/criteria-rules.yaml`
If a project criterion should add this role:
```yaml
criteria:
  - id: has_new_criteria
    adds_roles:
      - my-new-role
```

## 4. Validate

```bash
npx abax-swarm validate
```

## 5. Run tests

```bash
npm test
```

Integration tests will verify:
- The role loads correctly against the Zod schema
- Referenced skills and tools exist
- Referenced dependencies exist
- The size matrix references valid roles
- RACI assignments reference valid roles and activities
- **The role is classified for `role-boundaries`** (in `used_by` or in `EXEMPT_FROM_ROLE_BOUNDARIES`)

## 6. Adding skills or tools

Same pattern — create `data/skills/<id>.yaml` or `data/tools/<id>.yaml`, reference from roles, run tests.
