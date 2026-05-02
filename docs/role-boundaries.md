# Limites de rol: matriz maestra y reglas de rechazo

## El incidente que motivo este sistema

En la sesion `ses_21576ae3b...` (mayo 2026) del proyecto **Abax-Memory**, el orquestador delego a `@devops` una Task que decia *"redespliega el backend con los cambios y reejecuta las pruebas de QA"*. Devops cumplio: hizo el deploy, ejecuto los casos de prueba contra el endpoint, vio que los tests "pasaban", y reporto el ciclo cerrado.

El problema: devops no tiene el sesgo de qa-functional. No tiene los criterios de aceptacion frente, no actualiza el registro de defectos, no diferencia entre "responde HTTP 200" y "cumple la spec". Una sola Task colapso dos disciplinas y diluyo la responsabilidad — exactamente el patron que llevo `InMemorySearchIndexer` a producir antes (incidente que motivo las 3 capas anti-mock).

**Diagnostico**: el orquestador combino dos roles maestros distintos en una sola delegacion, y ningun agente protesto.

## La respuesta: skill + matriz + protocolo de rechazo

| Capa | Donde vive | Quien la ejecuta | Que detecta |
|---|---|---|---|
| 1. Skill compartida | `data/skills/role-boundaries.yaml` | 13 roles al recibir Task | Tasks fuera de su rol o con responsabilidades mezcladas |
| 2. Matriz en orquestador | Seccion *"Matriz de responsabilidades tecnicas por fase"* en `orchestrator.md` (modos new/continue) | El orquestador antes de cada delegacion | Mezcla de dos roles maestros en un mismo prompt |
| 3. Protocolo 2-Tasks post-fix | Misma seccion del orquestador | El orquestador al recibir reporte de defecto | Tasks "combo" tipo "fix esto y vuelve a probar" |

## La matriz maestra de responsabilidades por fase

Cada fase tiene un **rol maestro (R)** — quien aporta el sesgo principal — y los demas son consultados (C) o informados (I). El orquestador NUNCA delega trabajo del rol maestro a otro rol "porque ya esta abierto".

| Fase | Rol maestro | Apoyo | Anti-pattern |
|---|---|---|---|
| 0-1 Discovery / Inicio | product-owner (o BA si no hay PO) | business-analyst, project-manager | tech-lead diseñando alcance funcional sin BA |
| 2 Analisis funcional | business-analyst | product-owner, qa-functional | developer escribiendo criterios de aceptacion |
| 3 Diseño tecnico | solution-architect / tech-lead | dba (modelo), security-architect | developer improvisando arquitectura |
| 4 Construccion | developer-backend / developer-frontend | tech-lead (review), dba (migrations only) | qa-functional escribiendo codigo de produccion |
| 5 QA | qa-functional / qa-automation / qa-performance | tech-lead (defectos), devops (entorno de pruebas) | **devops ejecutando o cerrando QA** (← incidente original) |
| 6 UAT | qa-functional + product-owner | business-analyst | tech-lead validando UAT en lugar del usuario |
| 7 Despliegue | devops (o tech-lead si no hay devops) | tech-lead (consult), security-architect | **qa-functional ejecutando deploy o validando rollback** |
| 8 Estabilizacion | devops (operacion) + developers (fixes) | tech-lead (root cause) | qa-functional implementando hotfixes |
| 9 Cierre | project-manager + tech-writer | todos | un solo rol firmando el cierre |

## Pares criticos de no-solapamiento

Los 8 pares que historicamente se confunden mas:

1. **devops ↔ qa-functional** — devops opera infra; qa-functional valida features. Smoke test post-deploy (`curl /health`) = devops. Test funcional post-deploy contra criterios de aceptacion = qa-functional.
2. **developer-* ↔ tech-lead** — developer implementa; tech-lead revisa y decide patrones. Developer NO toma decisiones de arquitectura sin consultar; tech-lead NO escribe codigo de aplicacion.
3. **developer-backend ↔ dba** — developer modela DTOs, dba modela schema. Migraciones SOLO con aprobacion del dba.
4. **business-analyst ↔ product-owner** — BA detalla spec; PO aprueba spec y prioriza. PO NO redacta spec; BA NO aprueba a nombre del negocio.
5. **solution-architect ↔ tech-lead** — sol-arch decide macro (stack, integraciones); tech-lead decide micro (patrones de codigo, code review). Sol-arch NO baja a nivel de codigo concreto.
6. **qa-functional ↔ qa-automation ↔ qa-performance** — funcional ejecuta manual contra spec; automation mantiene suites E2E; performance hace load/stress. NO se mezclan.
7. **tech-writer ↔ business-analyst** — BA produce spec funcional formal; tech-writer documenta para usuarios finales. Tech-writer NO inventa spec; BA NO escribe manual de usuario.
8. **devops ↔ security-architect** — security-arch diseña (modelo de amenazas, politicas); devops opera (rota secrets, configura WAF). Security-arch NO ejecuta deploy; devops NO decide politica.

## El patron estricto de rechazo

Cuando un agente recibe una Task que NO corresponde a su rol (segun la matriz), **rechaza** con esta respuesta exacta:

```
RECHAZO DE TAREA — fuera de mi rol

Soy @<tu-rol>. La tarea solicitada incluye actividades que pertenecen
a otro rol segun la matriz role-boundaries:

- <Actividad concreta>: corresponde a @<rol-correcto>
- <Otra actividad si aplica>: corresponde a @<otro-rol>

Devuelvo la Task al orquestador para que delegue a los roles correctos
(preferiblemente como Tasks separadas, no combinadas).

Mi parte (si aplica): <lo que SI puedo hacer>
```

**El rechazo es no-negociable**: el agente NO completa "para acelerar" la parte de otro rol. Si la Task es mixta, ejecuta SOLO su parte y devuelve el resto.

Cuando el orquestador recibe un rechazo, **NO insiste** — divide la Task en dos delegaciones separadas y re-delega a los roles correctos.

## La regla 2-Tasks post-fix

Cuando QA reporta un defecto y el equipo aplica fix, el orquestador SIEMPRE delega **dos Tasks separadas**, esperando reporte entre ellas:

```
Task 1 → @developer-<area> (fix con causa raiz, escribe tests, hace commit)
        | espera reporte con SHA del commit
Task 2 → @qa-functional (re-ejecuta caso fallido + regresion del area)
        | espera reporte con evidencia
```

NUNCA en una sola Task: `"fix esto y vuelve a probar"`. Eso obliga a un mismo rol a hacer dos disciplinas.

Para el ciclo *"redespliega y reejecuta QA"* (el del incidente original):

```
Task 1 → @devops:        "Redespliega backend con la nueva version. Reporta
                          SHA y status del health endpoint."
Task 2 → @qa-functional: "Re-ejecuta los casos de prueba afectados por
                          <bug-id> contra el desplegado en <URL>. Certifica
                          si el fix es correcto y actualiza el registro
                          de defectos."
```

Dos Tasks, dos roles, dos sesgos. Eso es lo correcto.

## Roles que cargan la skill `role-boundaries`

Los 13 roles con riesgo de solapamiento, cada uno la lee al recibir Tasks:

- `devops`, `qa-functional`, `qa-automation`, `qa-performance`, `qa-lead`
- `developer-backend`, `developer-frontend`, `dba`
- `tech-lead`, `business-analyst`, `product-owner`
- `solution-architect`, `integration-architect`, `security-architect`
- `change-manager`, `tech-writer`

## Roles exentos (sin la skill, por diseño)

Cuatro roles estan declarados explicitamente como exentos en `tests/integration/role-boundaries.test.ts` con razon documentada:

| Rol | Razon de exencion |
|---|---|
| `orchestrator` | Es el orquestador mismo; no recibe Tasks, solo delega. Su mecanismo de prevencion vive en el template del orchestrator (matriz por fase). |
| `project-manager` | Coordinador puro de planning/risks; no firma como `R` en actividades de ejecucion que otro rol tambien firme. |
| `ux-designer` | Design-only handoff a developer-frontend; sin solapamiento de implementacion. |
| `system-designer` | Meta-rol del propio proyecto Abax Swarm, no para proyectos generados. |

## Como evitar que esto se repita con futuros roles

El test `every role is classified` en `tests/integration/role-boundaries.test.ts` recorre TODOS los roles en `data/roles/` y exige que cada uno este en `used_by` (de la skill) **o** en `EXEMPT_FROM_ROLE_BOUNDARIES` (constante del test). Si se añade un rol nuevo sin clasificarlo, el test falla en CI antes de llegar a release.

Cobertura adicional del test guard:
- `no role is both in used_by and in EXEMPT` — listas mutuamente excluyentes.
- `every role in used_by also lists role-boundaries in its skills` — sincronia bidireccional skill ↔ rol.
- `EXEMPT roles do NOT declare role-boundaries` — sanity check inverso.

La guia `docs/guides/adding-roles.md` §2 incluye la rubrica completa con los 4 criterios para decidir y el procedimiento paso a paso.

`CLAUDE.md` (raiz del repo) recuerda esta regla en la seccion **"When modifying YAML data"** (paso 5) para que cualquier asistente o contribuidor se entere antes de comenzar.

## Cuando NO se aplica

La matriz y la regla 2-Tasks **NO se renderizan en modo `document`**. En modo documentacion los roles trabajan en paralelo sobre los 4 ejes (tecnico, funcional, negocio, operativo) y el riesgo de cross-role no aplica del mismo modo. Solo `mode === "new"` y `mode === "continue"` activan la seccion en el orquestador.

## Ver tambien

- `docs/quality-gates.md` — Las 3 capas anti-mock que motivaron este patron
- `data/skills/role-boundaries.yaml` — Definicion de la skill
- `templates/opencode/orchestrator.md.hbs` — Seccion `enforceRoleBoundaries`
- `tests/integration/role-boundaries.test.ts` — Cobertura de las reglas
