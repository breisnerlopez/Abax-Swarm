# Orchestrator Flow — Abax Swarm

## Overview

The orchestrator is the runtime coordinator of all agents. It is generated as a primary agent that can ONLY delegate work via the Task tool — it cannot read files, write code, or execute commands directly.

## Runtime behavior

When a user starts a conversation with the orchestrator, it follows this strict flow:

```
User request
    │
    ▼
Phase 0: Discovery (iterative)
    │ ← user approves backlog
    ▼
Phase 1: Inception
    │ ← gate: PO approves
    ▼
Phase 2: Functional Analysis
    │ ← gate: PO approves
    ▼
Phase 3: Technical Design
    │ ← gate: Tech Lead approves
    ▼
Phase 4: Construction
    │ ← gate: QA Lead approves
    ▼
Phase 5: QA / Testing
    │ ← gate: PO approves
    ▼
Phase 6: UAT
    │ ← gate: Sponsors approve
    ▼
Phase 7: Deployment
    │ ← gate: Steering committee
    ▼
Phase 8: Stabilization
    │ ← gate: PM approves
    ▼
Phase 9: Closure
```

## Phase 0: Discovery (detailed)

The most complex phase — iterative until the user explicitly approves:

```
Step 1: Entendimiento Inicial
    │  (orchestrator asks user directly — no delegation)
    │  Problem, users, scope, integrations, constraints, success criteria
    ▼
Step 2: Vision del Producto
    │  → delegates to product-owner
    │  → writes docs/entregables/fase-0-descubrimiento/vision-producto.md
    ▼
Step 3: Epicas y Features
    │  → delegates to business-analyst
    │  → writes docs/entregables/fase-0-descubrimiento/epicas-features.md
    ▼
Step 4: Historias de Usuario
    │  → delegates to business-analyst
    │  → writes docs/entregables/fase-0-descubrimiento/historias-usuario.md
    ▼
Step 5: Design System de Presentaciones
    │  → delegates to ux-designer
    │  → writes docs/design-system/presentacion-template.html
    ▼
Step 6: Priorizacion del Backlog
    │  → delegates to product-owner
    │  → writes docs/entregables/fase-0-descubrimiento/backlog-priorizado.md
    ▼
Step 7: Presentacion y Validacion
    │  → delegates to project-manager or business-analyst
    │  → writes docs/entregables/fase-0-descubrimiento/presentacion-descubrimiento.html
    │  → presents to user for approval
    ▼
Step 8: Iteracion (if needed)
    │  → loops back to adjust based on user feedback
    ▼
User approves → advance to Phase 1
```

## Delegation protocol

Every delegation includes:

```
Task(
  agent = "role-id",
  description = "Brief description",
  prompt = "Detailed instructions...
    Escribe el resultado en docs/entregables/fase-N/nombre-entregable.md.
    Al inicio incluye: Fase, Entregable, Responsable, Fecha, Estado."
)
```

Key rules:
1. One Task call per deliverable
2. Always include file path instruction
3. Always specify the phase context
4. HTML presentations reference the Design System template

## Documentation protocol

After completing ALL deliverables in a phase:

1. **Update bitacora** → delegates to project-manager
   - `docs/bitacora.md`: Phase completed, deliverables list with paths, status

2. **Update registry** → delegates to project-manager
   - `docs/registro-entregables.md`: Dashboard table per phase

## Presentation protocol

All presentations are HTML autonomous files (single-file, no CDN):

1. UX designer creates Design System template in Phase 0
2. All subsequent presentations copy CSS/structure from template
3. Saved as `.html` in the phase folder
4. Must pass quality checklist (contrast, hierarchy, anti-AI-slop)

## Phase authorization

Each agent has a `phases:` whitelist. If the orchestrator tries to delegate work for a phase not in the agent's list, the agent rejects it. This is enforced at the agent prompt level.

Example: `business-analyst` has `phases: [discovery, inception, functional-analysis, ...]`
If orchestrator delegates a "construction" task to BA → BA rejects and informs orchestrator.

## Governance models

The orchestrator's behavior adapts to the governance model:

| Model | Gate behavior | Escalation |
|-------|--------------|------------|
| Lightweight | PM or user approves | Minimal ceremony |
| Controlled | PO + PM approve, formal deliverables | User escalation for blockers |
| Corporate | Steering committee, full RACI | Formal change control |

## Unbreakable rules

1. Phase 0 first — always. Iterate until backlog approved.
2. Never skip phases.
3. Never do direct work — only delegate via Task.
4. Never use Read, Write, Edit, Glob, Grep, Bash, or Skill tools.
5. Always indicate: current phase, target agent, requested deliverable.
6. Always include file-write instruction in delegations.
7. Always update bitacora and registry after each phase.
8. Always generate presentations as HTML using the Design System.
9. Escalate to user if unresolvable blockers.
