# Roadmap — futuros tipos de proyecto

> **Status**: documento de planificacion, no compromisos. Las prioridades se ajustan en funcion de demanda real y capacidad.

Hoy (v0.1.17) Abax Swarm cubre 3 modos de proyecto: `new` (build de software), `document` (documentar sistema existente), `continue` (partir de un proyecto previo). Esta pagina enumera los modos adicionales que tienen sentido tecnico y de mercado, ordenados por relacion impacto/esfuerzo.

## Resumen ejecutivo

- **Tier 1 (recomendado)**: `audit`, `onboarding`, `incident`. Cero roles nuevos, alto valor.
- **Tier 2 (extension natural)**: `migration`, `compliance`. Pequenios cambios al modelo de datos.
- **Tier 3 (nuevo vertical)**: `infra` + `network` + `observability`. Implica reposicionar el producto a SRE/DevOps.
- **Tier 4 (decision arquitectonica)**: `monitor` (recurring), `data`, `ml`, `process`. Requieren infraestructura o roles muy distintos.

## Categorias

### A. Adyacentes al dev (reusan ~80% de los roles actuales)

| Modo | Caso de uso | Roles relevantes (existentes) | Roles nuevos | Esfuerzo |
|---|---|---|---|---|
| **`audit`** | Auditoria de un sistema en produccion: seguridad (OWASP, threat model), performance (profiling, load test), o due diligence tecnica (M&A, takeover de proyecto). Output: reporte ejecutivo + plan de remediacion priorizado. | security-arch, tech-lead, dba, qa-performance, sol-arch | ninguno | bajo |
| **`migration`** | Migracion legacy → moderno: assessment + plan + ejecucion + cutover + rollback. Combina lo mejor de `document` (analizar origen) + `new` (construir destino). | sol-arch, tech-lead, dba, integration-arch, devops, qa-functional | ninguno (pero `stackId` se vuelve un par `from`/`to`) | medio |
| **`onboarding`** | Generar kit completo para un nuevo dev/equipo: tour del codigo, setup local con devcontainer, primeras tasks calibradas, FAQ, glosario de dominio. Variante focalizada del modo `document`. | tech-writer, tech-lead, ux-designer, change-manager | ninguno | bajo |
| **`refactor`** | Modernizacion arquitectural sin cambio de stack: identificar deuda, plan de refactor por capas, tests de regresion, ejecucion incremental. | sol-arch, tech-lead, qa-automation | ninguno | bajo |

### B. Infraestructura / ops (mundo paralelo, requiere roles nuevos)

| Modo | Caso de uso | Roles existentes | Roles nuevos | Esfuerzo |
|---|---|---|---|---|
| **`infra`** | Diseño/setup de infraestructura cloud o on-prem: VPC, kubernetes, IaC (Terraform), CDN, WAF. | devops, security-arch, integration-arch | **cloud-architect, network-engineer, sre** | alto |
| **`network`** | Diseño de red corporativa: VPN, VPC peering, firewalls, segmentacion, BGP, load balancers. | security-arch | **network-architect, network-engineer** | alto |
| **`observability`** | Setup completo de logging/metrics/tracing/alerting: Prometheus, Grafana, OpenTelemetry, dashboards, runbooks de oncall. | devops, tech-lead | **sre** (opcional) | medio |
| **`dr-bcp`** | Disaster recovery + business continuity: backup strategy, RTO/RPO targets, runbooks de failover, simulacros. | devops, dba, security-arch | ninguno | medio |

### C. Gestion y procesos (mucho menos software, mas gobernanza)

| Modo | Caso de uso | Roles existentes | Roles nuevos | Esfuerzo |
|---|---|---|---|---|
| **`monitor`** | Reportes recurrentes sobre proyectos en curso: estado, riesgos, blockers, decisiones pendientes. **Requiere ejecucion periodica**, no one-shot. | project-manager, business-analyst, change-manager | ninguno | alto (requiere scheduling + persistencia) |
| **`compliance`** | Implementar/auditar SOC2, ISO27001, GDPR, HIPAA, PCI sobre un sistema existente. Output: gap assessment + plan + evidencia. | security-arch, business-analyst, change-manager | **compliance-officer** (opcional) | medio |
| **`process`** | Implementar un proceso organizacional: agile/scrum, ITIL, metodologia propia. Mas consultoria que software. | change-manager, project-manager | **process-consultant** | medio |
| **`incident`** | Tras un incidente: RCA estructurado, blameless post-mortem, preventive actions, plan de comunicacion. | tech-lead, security-arch, change-manager, project-manager | ninguno | bajo |

### D. Verticales fuera del software dev tradicional

| Modo | Caso de uso | Roles existentes | Roles nuevos | Esfuerzo |
|---|---|---|---|---|
| **`data`** | Pipelines ETL/ELT, data warehouse, modelado dimensional, reporting BI. | dba, integration-arch, business-analyst | **data-engineer, data-analyst, data-architect, analytics-engineer** | alto |
| **`ml`** | Proyecto de ML/IA: data prep, training, evaluation, deployment, monitoring de drift. | tech-lead, devops | **ml-engineer, data-scientist, ml-ops** | alto |

## Priorizacion sugerida

### Tier 1 — Implementar pronto (alto valor / bajo esfuerzo)

1. **`audit`** — el mas versatil. Cubre security, performance y due diligence con los mismos roles. Una sola opcion del wizard, tres "sub-tipos" via criteria. Sin roles nuevos. Demanda profesional altisima.
2. **`onboarding`** — variante del modo `document` con foco distinto: el output es un kit para humanos nuevos, no documentacion general. Setup script + tour + first tasks. Sin roles nuevos. Util internamente y para clientes.
3. **`incident`** — caso muy bien acotado, output predecible (post-mortem template + RCA + actions). Sin roles nuevos.

### Tier 2 — Expandir alcance manteniendo el modelo

4. **`migration`** — natural por la conjuncion de `document` (origen) + `new` (destino). Requiere modelar `from_stack` + `to_stack` en el wizard. Sin roles nuevos.
5. **`compliance`** — podria modelarse como sub-tipo de `audit` en lugar de modo aparte. Mismos roles, criteria distinto.

### Tier 3 — Apertura de un nuevo vertical (decision grande)

6. **`infra` + `network` + `observability`** — los tres juntos abren "Abax para SRE/DevOps". 4-5 roles nuevos (cloud-architect, network-engineer, network-architect, sre), 5-8 stacks nuevos (AWS, GCP, Azure, on-prem, k8s, terraform, etc.). **Cambia el posicionamiento del producto** de "para devs" a "para devs+ops".
7. **`data` + `ml`** — segundo vertical paralelo. Mismo orden de magnitud que infra. Entrar a competir en otro mercado.

### Tier 4 — Decisiones arquitectonicas significativas

- **`monitor`** (seguimiento recurrente) — requiere infraestructura nueva: scheduling, persistencia de estado entre runs, comparacion con corrida anterior. Es una **app cron** dentro de Abax. No encaja en el modelo "wizard one-shot" actual.
- **`process`** — muy alejado del foco actual. Mas consultoria que tooling.

## Cambios tecnicos transversales que cualquier nuevo modo puede requerir

Cuando se anada un modo nuevo, considerar:

- **Nuevo set de fases**: cada modo puede definir su propio flujo (`document` ya lo hace via `data/rules/document-mode.yaml`). El patron a seguir es agregar `data/rules/<mode>-mode.yaml` con el team curado + fases + skills extra.
- **Nuevo modelo de governance** (`governance-resolver.ts`): si el flujo no es cascada tradicional, definir el cuarto/quinto valor (como hicimos con `documentation`).
- **Stacks especializados por vertical**: `infra` y `data` requieren un set de stacks distinto (`aws+terraform`, `dbt+snowflake`, etc.). Probablemente conviene un campo `category` en `data/stacks/*.yaml` para filtrar por modo.
- **Skills nuevas**: el patron es claro tras `reverse-engineering`, `dependency-management`, `git-collaboration`. Cada modo nuevo identifica 1-2 skills criticas y las anade.
- **Detector ampliado**: si el modo aplica sobre un sistema existente, el detector (`stack-detector.ts`) debe reconocer su firma (e.g. carpetas `terraform/`, `dbt_project.yml`, `airflow.cfg`).

## Criterios para promover un modo de Tier N a Tier N-1

- Demanda explicita de >3 usuarios distintos.
- Caso de uso claro y delimitado (no "haz todo lo de SRE", sino "diseña una VPC AWS para 3 microservicios").
- Output reconocible (set de archivos generados, fases concretas, entregables medibles).
- Encaja en el modelo "wizard pregunta → pipeline genera → agentes ejecutan" sin necesidad de infraestructura nueva (scheduling, persistencia, etc.).

Si los 4 criterios se cumplen, el modo es candidato a implementacion en el siguiente release con `feat(modes):` prefix.

## Dependencias entre modos

```
new ────┐
        ├──▶ migration (depende de document + new)
document┘
                 ├──▶ onboarding (variante de document, output distinto)
                 ├──▶ audit (lente sobre lo documentado)
                 │     └──▶ compliance (audit con criteria fija)
                 └──▶ refactor (post-document, antes de new partial)

continue ──▶ incident (analiza lo que ya existe + recover)

infra ──┐
network ┼──▶ "Abax DevOps Edition" (los 3 juntos cambian el posicionamiento)
observability─┘

data ───▶ ml (ml depende de data pipelines)
```

## Como contribuir un nuevo modo

Si quieres proponer un modo nuevo:

1. Abre un issue en GitHub con:
   - Nombre del modo (slug kebab-case).
   - Caso de uso concreto en 3-5 frases.
   - Roles que usaria (existentes + propuestos).
   - Output esperado (archivos generados, fases).
2. Ejemplo de invocacion: como se veria el flujo del wizard.
3. Si propones roles nuevos, justifica por que no encajan los existentes.

El tier se asigna en base a los criterios de arriba durante la discusion del issue.
