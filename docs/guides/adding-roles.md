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

## 2. Register in rules

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

## 3. Validate

```bash
npx abax-swarm validate
```

## 4. Run tests

```bash
npm test
```

Integration tests will verify:
- The role loads correctly against the Zod schema
- Referenced skills and tools exist
- Referenced dependencies exist
- The size matrix references valid roles
- RACI assignments reference valid roles and activities

## 5. Adding skills or tools

Same pattern — create `data/skills/<id>.yaml` or `data/tools/<id>.yaml`, reference from roles, run tests.
