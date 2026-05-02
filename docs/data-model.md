# Data Model — Abax Swarm

All canonical data lives in `data/` as YAML files, validated by Zod schemas at load time.

## Roles (`data/roles/*.yaml`) — 20 files

```yaml
id: developer-backend          # kebab-case, unique
name: Desarrollador Backend    # Human-readable name
category: construction         # Functional category
tier: "1"                      # 1=full, 2=specialized, 3=meta

size_classification:           # When to include by project size
  small: indispensable
  medium: indispensable
  large: indispensable

agent:
  mode: subagent               # primary (orchestrator only) / subagent
  temperature: 0.3             # LLM temperature
  cognitive_tier: implementation  # strategic / implementation / mechanical → drives model choice
  reasoning: low               # none / low / medium / high → drives thinking budget or reasoning effort
  color: "#1e90ff"             # Optional. Hex (always quoted) or theme key. Defaults to deterministic from palette
  description: "..."           # Short description (1-2 sentences)
  system_prompt: |             # Full agent prompt
    Eres un Desarrollador Backend senior...
    ## Principios
    - ...
    ## Restricciones
    - ...
  permissions:                 # Tool permissions for the target platform
    read: allow
    edit: allow
    bash: allow
    glob: deny
    grep: deny
    skill: allow
  tools_enabled:               # Explicit tool toggles
    write: true
    edit: true
    read: true
    bash: true

skills: [code-review, api-design]    # Skill IDs (must exist in data/skills/)
tools: [run-tests, lint-code]        # Tool IDs (must exist in data/tools/)

stack_overrides:                     # Optional per-stack prompt additions
  angular-springboot:
    prompt_append: "Usa Spring Data JPA..."

dependencies:
  receives_from: [business-analyst, tech-lead]
  delivers_to: [qa-functional, devops]

phases:                              # Authorized project phases
  - construction
  - deployment
  - stabilization

raci:                                # RACI assignments
  build_solution: R
  deploy: C
```

## Skills (`data/skills/*.yaml`) — 71 files

The `presentation-design` skill drives the HTML design system; the `reverse-engineering` skill (added in 0.1.11) is what makes "documentar algo existente" tractable — it gives roles methodology to extract behavior from code, queries and configs.

```yaml
id: functional-analysis
name: Analisis Funcional
description: >
  Metodologia para levantar, documentar y validar
  requisitos funcionales del proyecto.
used_by:
  - business-analyst
  - product-owner

content:
  when_to_use: |
    - Usar cuando se inicia una fase de analisis...
  instructions: |
    ## Principio Central
    Todo requisito debe ser verificable...

    ## Formato
    ...
  guides:
    - name: plantilla-requisitos
      content: |
        Plantilla base para documentar requisitos...
    - name: checklist-revision
      content: |
        Checklist de revision antes de entregar...
```

## Tools (`data/tools/*.yaml`) — 7 files

```yaml
id: generate-diagram
name: Generador de Diagramas
description: >
  Genera diagramas Mermaid para flujos, secuencias,
  entidad-relacion y componentes.
used_by:
  - solution-architect
  - tech-lead
  - business-analyst

implementation:
  language: typescript
  args:
    type:
      type: string
      description: "Tipo de diagrama: flowchart, sequence, erd, component"
    content:
      type: string
      description: "Especificacion del diagrama en texto"
  returns: string
  body: |
    // TypeScript implementation
    const diagramTypes = { ... };
    return `\`\`\`mermaid\n${output}\n\`\`\``;
```

## Stacks (`data/stacks/*.yaml`) — 13 files

```yaml
id: react-nextjs
name: React + Next.js
description: "Full-stack con React y Next.js App Router"

frontend:
  framework: Next.js
  language: TypeScript
  version: "15+"
  package_manager: npm
  conventions:
    - App Router (app/ directory)
    - Server Components by default

backend:
  framework: Next.js API Routes
  language: TypeScript
  version: "15+"
  conventions:
    - Route handlers in app/api/

database:
  default: PostgreSQL
  alternatives: [MySQL, SQLite]
  orm: Prisma

devops:
  containerization: Docker
  ci_cd: GitHub Actions
  hosting: Vercel

role_context:                        # Per-role prompt additions
  developer-backend: |
    Usa Next.js API Routes con App Router.
    ORM: Prisma con PostgreSQL.
    Patron: Server Actions para mutaciones...
  developer-frontend: |
    Usa React Server Components por defecto.
    Client Components solo con "use client"...
```

## Rules (`data/rules/`) — 8 files

### `size-matrix.yaml`
Maps project sizes to role classifications:
```yaml
roles_by_size:
  small:
    indispensable: [project-manager, product-owner, business-analyst, ...]
    recommended: [tech-writer]
    optional: [dba, security-architect]
  medium:
    indispensable: [project-manager, product-owner, ...]
    recommended: [dba, ux-designer, ...]
  large:
    indispensable: [...all core + most specialized]
```

### `criteria-rules.yaml`
10 project criteria that trigger additional roles:
```yaml
criteria:
  - id: has_complex_integrations
    question: "Tiene integraciones complejas con sistemas externos?"
    adds_roles: [integration-architect]
  - id: has_regulatory_compliance
    question: "Requiere cumplimiento regulatorio?"
    adds_roles: [security-architect, compliance-check]
```

### `dependency-graph.yaml`
Inter-role dependencies (hard = auto-included, soft = warning):
```yaml
dependencies:
  developer-frontend:
    hard: [ux-designer]      # If frontend selected, UX is mandatory
    soft: [tech-lead]        # Recommended but not enforced
  qa-automation:
    hard: [qa-lead]
    soft: [devops]
```

### `raci-matrix.yaml`
11 activities × roles with R/A/C/I assignments:
```yaml
activities:
  define_scope:
    product-owner: A
    business-analyst: R
    project-manager: C
  build_solution:
    developer-backend: R
    developer-frontend: R
    tech-lead: A
```

### `phase-deliverables.yaml`
Mandatory deliverables per waterfall phase with responsible agent and gate approver.

### `iron-laws.yaml`
Unbreakable rules injected into agent prompts (phase boundaries, delegation rules).

### `anti-rationalization.yaml`
Rules preventing agents from rationalizing out-of-scope work.

### `document-mode.yaml`
Curated team and 5-phase flow used when `ProjectMode === "document"`. Replaces the size-matrix branch.

```yaml
id: document-mode
name: Equipo curado para documentar un sistema existente

roles:                                  # Always included
  - tech-writer
  - business-analyst
  - product-owner
  - solution-architect
  - tech-lead
  - dba
  - integration-architect
  - ux-designer
  - change-manager

optional_roles:                         # Added only when user opts in
  security-architect:
    question: "¿El sistema maneja datos sensibles, regulación (RGPD, HIPAA, PCI)?"

extra_skills:                           # Auto-folded into the resolved set
  - reverse-engineering

phases:                                 # 5 phases instead of the 10-phase cascade
  - { id: discovery,     name: "Descubrimiento",    description: "..." }
  - { id: inventory,     name: "Inventario",        description: "..." }
  - { id: documentation, name: "Documentación",     description: "..." }
  - { id: review,        name: "Revisión",          description: "..." }
  - { id: publication,   name: "Publicación",       description: "..." }
```

## Entity relationships

```
Role ──uses──▶ Skill[]
Role ──uses──▶ Tool[]
Role ──adapted_by──▶ Stack (role_context merge)
Role ──depends_on──▶ Role[] (dependency-graph)
Role ──participates──▶ Phase[] (phase authorization)
Role ──assigned──▶ Activity[] (RACI matrix)
Criteria ──adds──▶ Role[]
Size ──classifies──▶ Role[] (indispensable/recommended/optional)
```

## Validation

All cross-references are validated at load time and by integration tests:
- Skills referenced by roles must exist in `data/skills/`
- Tools referenced by roles must exist in `data/tools/`
- Dependencies reference valid role IDs
- RACI references valid role IDs and activities
- Size matrix references valid role IDs
- Criteria `adds_roles` references valid role IDs
- `document-mode.yaml` `roles[]` and `optional_roles{}` reference valid role IDs (verified by smoke test)

## Runtime types (`src/engine/types.ts`)

```ts
export type ProjectMode = "new" | "document" | "continue";

export type ModelStrategy =
  | "custom"   // pick a model per role from PROVIDER_MODELS
  | "inherit"; // omit `model` so the host CLI's default applies

export interface ProjectContextDetection {
  stackId: string | null;          // 13 heuristics; null when no match
  evidence: string[];              // human-readable lines for the wizard
  existingDocs: boolean;           // targetDir/docs/ has at least one .md
  hasGit: boolean;                 // targetDir/.git exists
}

export interface ProjectConfig {
  // ... existing fields ...
  mode?: ProjectMode;              // Defaults to "new"
  modelStrategy?: ModelStrategy;   // Defaults to "custom"
  detection?: ProjectContextDetection;  // Set by the wizard via project-context.ts
}
```
