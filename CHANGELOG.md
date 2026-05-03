# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.29] — 2026-05-03

### Added — Skill `delegation-discipline` (cuando nativos OpenCode vs roles del proyecto)

En la sesion `ses_210f79b8effe...` (2026-05-03 18:09 UTC) el orquestador procesando una propuesta v2.0.0 sobre Abax-Memory delego exploracion exhaustiva a `@explore` (3+ minutos) y lectura de la propuesta a `@general` — ambos subagents nativos de OpenCode que NO tienen cargadas las skills criticas (role-boundaries, anti-mock-review, existing-docs-update-protocol, code-naming-convention, git-collaboration, documentation-quality-bar, iteration-strategy). Bypassed todo el sistema de salvaguardas que llevamos 0.1.19-0.1.28 construyendo.

Decision arquitectural: **NO prohibir los nativos** (tienen usos legitimos donde su eficiencia justifica), sino **priorizar roles del proyecto** y vetar nativos en 4 casos criticos.

Skill nueva `delegation-discipline` asignada a 6 roles coordinadores (project-manager, product-owner, business-analyst, tech-writer, solution-architect, tech-lead) con:

- **Matriz de decision** de 12 filas: cuando rol del proyecto vs cuando nativo OK.
- **4 vetos criticos** para nativos: (1) `write`/`edit` en docs/src/raiz, (2) `git commit`/`push`, (3) decisiones formales con approver RACI (ADRs, specs), (4) entregables formales de `phase-deliverables.yaml`.
- **Atajo de deteccion**: leer `project-manifest.yaml` + `docs/bitacora.md` + `CHANGELOG.md` directamente (sin Task) antes de delegar exploracion. 80% del contexto en 3 reads.
- 3 guides: ejemplos de nativos permitidos, ejemplos prohibidos, heuristicas rapidas (decision en 5 segundos).

### Changed — `iteration-strategy` reforzado con activacion temprana

`when_to_use` ahora incluye "PRIMER mensaje del usuario" + palabras clave `implementar propuesta`. `instructions` ampliadas con seccion "Atajo de deteccion" (leer manifest + bitacora + changelog antes de delegar) e instruccion explicita "NO delegues exploracion exhaustiva a `@explore` esperando ver mas — ya tienes suficiente para decidir estrategia".

### Changed — Orchestrator template (opencode + claude)

Sección nueva "ROLES DEL PROYECTO vs SUBAGENTS NATIVOS" que incluye:
- Tabla de 5 casos donde nativos son OK (busqueda, lookup, bosquejo, sintesis, lectura individual)
- Tabla de 4 vetos donde nativos NO se permiten (write, commit, decision RACI, entregable formal)
- Atajo "Lee el manifest antes de explorar"
- Instruccion critica reordenada: paso 1 lee manifest; paso 2 activa iteration-strategy si aplica; pasos 3-7 delega segun matriz

CLAUDE.md template recibe la misma logica condensada.

### Added — Tests integrales

18 nuevos tests en `tests/integration/delegation-discipline.test.ts` cubriendo: skill content (matriz, 4 vetos, atajo, 3 guides), iteration-strategy reforzado, orchestrator template (sección ROLES vs NATIVOS, 4 vetos en template, atajo manifest, activacion iteration-strategy), CLAUDE.md template, pipeline (skill llega a agentes, SKILL.md generado), bidireccional sync.

Suite total: **535 tests pasando** (era 517), typecheck + validate OK, **83 skills** (era 82).

### Documentation

- `docs/delegation-discipline.md` (nuevo): sintoma, causa raiz, decision "priorizar no prohibir", matriz, 4 vetos, refuerzo iteration-strategy, refuerzo orchestrator template, ejemplo paso a paso del flujo correcto.
- `README.md` y `docs/README.md` actualizados (7 guard rails ahora visibles, era 6).

## [0.1.28] — 2026-05-03

### Fixed — `regenerate` no ejecutaba detection (anti-overwrite block nunca llegaba al orchestrator)

Bug latente desde 0.1.16 (cuando se introdujo `existingDocs`): el comando `regenerate` construia el `ProjectConfig` desde `project-manifest.yaml` pero **omitia `detectProjectContext()`**. Resultado: `config.detection` quedaba `undefined`, y por lo tanto `flags.existingDocs`/`flags.hasGit` eran `undefined` en el orchestrator generator. Los bloques condicionales `{{#if existingDocs}}` y `{{#if hasGit}}` del template **nunca se renderizaban en proyectos regenerados**.

Impacto especifico tras 0.1.26: la seccion reforzada **anti-overwrite con plantilla literal `ATENCION — POSIBLE ARCHIVO PREEXISTENTE`** no llegaba al orchestrator.md aunque el proyecto tuviera docs preexistentes — exactamente el escenario para el que se diseno. Solo la Capa B (skill cargada en sub-agents) funcionaba.

Fix: `regenerate` ahora corre `detectProjectContext(dir)` y pasa el resultado en `config.detection`. Tambien lee `manifest.project.mode` (que tampoco se respetaba antes).

2 tests nuevos en `tests/integration/regenerate-detection.test.ts` que ejecutan el binario real contra fixtures temporales:
- Con docs/*.md preexistentes → orchestrator.md DEBE contener `Protocolo de actualizacion`, `anti-overwrite`, `ATENCION — POSIBLE`, `iteration-strategy`.
- Sin docs/*.md → orchestrator.md NO debe contener ninguno de los anteriores.

Suite total: **517 tests pasando** (era 515).

## [0.1.27] — 2026-05-03

### Changed — Help y docs de `regenerate` aclaran que `--dir` es opcional (default carpeta actual)

`abax-swarm regenerate` ya soportaba ejecutarse sin `--dir` (default `.`), pero el README, CLAUDE.md, docs/iteration-strategies.md y la descripcion de `--help` del comando lo presentaban siempre con `--dir <path>` como si fuera obligatorio. Ajustado para mostrar las dos formas: `abax-swarm regenerate` (carpeta actual) y `abax-swarm regenerate --dir /ruta/proyecto` (otra carpeta).

Sin cambios funcionales — solo claridad de documentacion y `--help`.

## [0.1.26] — 2026-05-03

### Fixed — Sobrescritura silenciosa de docs preexistentes en iteracion v2 (incidente Abax-Memory v2)

En la sesion `ses_21170157cffe...` (2026-05-03), el orquestador procesando una propuesta de v2.0.0 sobre el proyecto v1 cerrado Abax-Memory delego al business-analyst tareas tipo "Elabora el Documento de Vision del Producto v2.0.0" sin instruccion explicita de preservar el archivo v1 existente. El BA ejecuto `write` sobre las mismas rutas, **sobreescribiendo silenciosamente 8 entregables de v1** (Vision, Epicas, Historias, Backlog, Presentacion Discovery, Acta de Constitucion, Registro Interesados, Template de presentacion) en cuestion de minutos. Solo se rescato porque no estaban commiteados.

Causa raiz: el "Protocolo de actualizacion de documentacion existente" del orchestrator template SI mencionaba "no reescribir desde cero" pero esa instruccion vivia solo en el prompt del orquestador y NO se reinyectaba en el prompt de cada Task delegada — el subagent en su sesion hija nunca lo leia. Ademas, no habia politica explicita para nueva iteracion mayor sobre proyecto cerrado.

### Added — Skill `existing-docs-update-protocol` (anti-overwrite)

Asignada a 15 roles que escriben docs (BA, PO, tech-writer, todos los developers, DBA, arquitectos, tech-lead, devops, QA, PM, change-manager). Da al sub-agent el procedimiento exacto antes de cualquier `write`:

1. Verificar si el archivo existe (`test -f`).
2. Si NO existe → escribir normal.
3. Si EXISTE → **escalar al orquestador** con plantilla "DOCUMENTO PREEXISTE — solicito instruccion antes de escribir" y esperar estrategia A/B/C/D.

Las 4 estrategias documentadas con plantillas listas: A (bloque "## Cambios <fecha>" al final), B (secciones tachadas + nuevo abajo), C (archivo paralelo o folder por release), D (archivar v1 a `docs/.archive/v1/` y reescribir). Anti-patrones explicitos. Coordinacion con role-boundaries y documentation-quality-bar.

### Added — Skill `iteration-strategy` (politica antes de delegar)

Asignada a 6 roles coordinadores (PM, PO, BA, tech-writer, sol-arch, tech-lead). Cuando el orquestador detecta proyecto cerrado + nueva iteracion mayor, esta skill se activa **bloqueante**: el orquestador DEBE preguntar al usuario antes de delegar el primer entregable de la nueva iteracion cual de las 4 estrategias aplicar. Decision documentada en `docs/iteration-log.md` y aplicada consistentemente a TODOS los entregables de la iteracion (no mezclar A para uno y C para otro).

### Changed — Orchestrator template (`existingDocs` block reforzado)

Cuando `existingDocs === true`, el bloque ahora:
- Cita el incidente Abax-Memory v2 por nombre y fecha como motivacion.
- Provee plantilla LITERAL "ATENCION — POSIBLE ARCHIVO PREEXISTENTE" que el orquestador debe inyectar en CADA Task delegado a docs preexistentes.
- Explica las 2 capas independientes de defensa (Capa A = orquestador inyecta, Capa B = sub-agent valida con la skill).
- Instruye uso de `iteration-strategy` cuando hay v2/v3.

Replicado en CLAUDE.md template.

### Added — Tests integrales

23 nuevos tests en `tests/integration/anti-overwrite.test.ts`:
- Skill `existing-docs-update-protocol`: existencia, prohibicion de write silencioso, 4 estrategias, anti-patrones, wiring a 15 roles, 3 guides.
- Skill `iteration-strategy`: detection condiciones, 4 estrategias, requerimiento de PREGUNTAR (BLOQUEANTE), `iteration-log.md` obligatorio, prohibicion de mezclar estrategias, wiring a 6 roles, 3 ejemplos guides.
- Orchestrator template: con `existingDocs=true` emite plantilla literal + cita incidente + capas A/B + iteration-strategy. Con `existingDocs=false` NO emite la seccion.
- CLAUDE.md template: misma logica replicada.
- Pipeline: ambas skills propagan a archivos de agente generados.
- Bidireccional sync: `used_by` <-> `role.skills` consistente.

Suite total: **515 tests** pasando (era 492), typecheck + validate OK, **82 skills** (era 80).

### Documentation

- `docs/iteration-strategies.md` (nuevo): incidente que lo motivo, las 3 capas, las 4 estrategias con cuando aplicarlas, estructura `docs/` segun cada estrategia, como aplicar a un proyecto existente, como añadir mejoras a futuro.
- `README.md` y `docs/README.md` actualizados con la referencia (6 guard rails ahora visibles).

### Recovery aplicada al proyecto Abax-Memory v1 (no parte del package)

Capa 1 ejecutada el 2026-05-03 12:13:
- Drafts v2 preservados en `docs/.archive/v2-draft-2026-05-03/` (no perder trabajo del BA).
- v1 restaurado al working tree desde `HEAD` (los overwrites no estaban commiteados).
- `docs/iteration-log.md` creado con narrativa del incidente y decision pendiente sobre estrategia (A/B/C/D) para v2.

## [0.1.25] — 2026-05-03

### Fixed — Mix de espanol/ingles en identificadores de codigo (sintoma reportado por usuario)

Sintoma del usuario: *"variables endpoints parametros deben estar siempre en ingles, me ha dado un mix en algunos escenarios que no debe volver a suceder"*. Causa raiz: tres skills que los agentes leen tenian ejemplos en espanol que contradecian la regla declarada en CLAUDE.md, y el agente internalizaba que era aceptable mezclar.

Las fuentes corregidas:
- `coding-standards`: clases como `OrdenCompra`/`UsuarioServicio`, variables `cantidadItems`/`fechaCreacion`, constantes `MAX_INTENTOS`/`TIMEOUT_SEGUNDOS` → ahora `Order`/`UserRepository`/`PaymentService`, `itemCount`/`createdAt`/`totalAmount`, `MAX_RETRIES`/`TIMEOUT_SECONDS`/`DEFAULT_PAGE_SIZE`. Cita la nueva skill `code-naming-convention`.
- `backend-implementation`: endpoints `/api/v1/usuarios`, `/api/v1/ordenes` → `/api/v1/users`, `/api/v1/orders` con path params en ingles.
- `unit-testing`: `calcularDescuento_montoMayorA1000_retorna10Porciento` → `calculateDiscount_amountOver1000_returns10Percent`.

### Added — Skill `code-naming-convention` (5to guard rail)

Nueva skill no-negociable con tabla exhaustiva de identificadores que deben estar en ingles (clases, funciones, variables, constantes, endpoints REST, query/path params, headers HTTP custom, tablas y columnas SQL, env vars, claves JSON/YAML, branches git, archivos de codigo, tests, imagenes Docker, topicos Kafka, metric/log keys). Documenta 4 categorias de excepciones legitimas (terminos de dominio sin traduccion como RUC/CURP, BD legacy con tablas en espanol, APIs publicas con consumidores existentes, error codes vs messages). Incluye guidance por stack (TypeScript/Java/Python/Go/Rust/SQL/YAML), patrones de busqueda regex para auditar codebases existentes, y formato estandar para documentar excepciones en `docs/decisions/`. Wired a 8 roles que escriben/revisan codigo: developer-backend, developer-frontend, dba, tech-lead, solution-architect, integration-architect, security-architect, qa-automation.

### Added — Test guard automatizado

`tests/integration/code-naming-convention.test.ts`: escanea TODOS los YAMLs de `data/` buscando dos patrones de mezcla: identificadores backtick-quoted que combinan verbos/nombres espanoles con camelCase/PascalCase, y URLs reales (con prefijo `/api/v\d/` o despues de un verbo HTTP) cuyo segmento es nombre espanol plural tipico. Falla CI con reporte exacto archivo:linea + sugerencia. EXEMPT_FILES con 2 entradas legitimas (`code-naming-convention.yaml` con ejemplos negativos pedagogicos, `role-boundaries.yaml` con placeholders espanoles). Sentinel test sintetico verifica que el regex no produce falsos positivos sobre ejemplos canonicos en ingles. Sanity test confirmado: inyectando `GET /api/v1/usuarios/{userId}` en `api-design.yaml`, el guard fallaba; al restaurar, volvia a verde.

### Changed — README del repo Abax-Swarm

Reescrito siguiendo mejores practicas: badges al inicio (npm version, downloads, CI, tests, license, Node), TL;DR de 3 frases + 3 comandos quickstart, tabla de contenidos navegable, seccion **"Por que Abax Swarm"** con 5 patrones problematicos y como cada guard rail los evita, **Casos de uso comunes** que enlazan a docs/use-cases.md, **Estado del proyecto**, **Soporte y comunidad** con FAQ, recursos completos. Numeros actualizados: 492 tests (era 446), 80 skills (era 76), 14 stacks (era 13).

### Changed — CLAUDE.md sección Conventions

Regla de naming explicita y exhaustiva en una sola linea con referencia a la skill, el guard rail y el doc nuevo.

### Documentation

- `docs/code-naming.md` (nuevo): sintoma reportado, causa raiz, las 5 piezas de la respuesta (skill nueva + 3 skills corregidos + guard rail), 4 excepciones documentadas con ejemplos de codigo, como detectar mezclas en codebases existentes, coordinacion con guard rails existentes.
- `README.md` y `docs/README.md` actualizados con la referencia.

### Tests

Suite total: 492 tests pasando (era 476), typecheck + validate OK, 80 skills (era 79), 14 stacks (sin cambios).

## [0.1.24] — 2026-05-02

### Added — 3 skills coordinadas para que los agentes generen documentacion consistente en proyectos cliente

Hueco detectado: ningun skill ni guia sistematica existia para el `README.md` ni para la estructura general de la carpeta `docs/` que los agentes producen dentro de los proyectos cliente. Cada agente improvisaba — terminaba en READMEs de 30 lineas sin quickstart, o `docs/` planos con 30 archivos sueltos, o `TODO: completar esto` sin owner que envejecia para siempre.

3 skills nuevas coordinadas:

- **`project-readme`** — Como generar el `README.md` del proyecto cliente: 4 preguntas fundamentales (que es, por que importa, como pruebo en 2 min, donde aprendo mas), 18 secciones estandar, 10 reglas no-negociables (cada comando ejecutable, sin TODO sin owner, versiones explicitas, sin lenguaje promocional vacio), adaptacion por modo (`new`/`document`/`continue`) y por stack tecnologico (incluido `legacy-other`). 4 plantillas listas (modo new, modo document, stack legacy, checklist pre-commit). Wired a tech-writer + developer-backend + developer-frontend + tech-lead.
- **`documentation-quality-bar`** — Los 8 minimos no-negociables que cualquier doc generado debe cumplir antes de marcarse completado: frontmatter de procedencia, comandos validados (no inventados), sin TODO sin owner, links relativos validados, bloques de codigo etiquetados con lenguaje, glosario si tiene >=3 acronimos, indice si > 200 lineas, idioma consistente. Checklist obligatorio + 3 guides (validacion de comandos, ejemplos de frontmatter por tipo de doc, auditoria rapida de gaps). Wired a 9 roles que producen documentacion.
- **`project-documentation-structure`** — Estructura estandar de `docs/` en proyectos cliente: subcarpetas (`architecture`, `api`, `runbooks`, `user-guides`, `functional`, `deliverables`, `decisions`, `presentations`), indices intermedios obligatorios, convenciones de naming (kebab-case sin tildes, ADRs numerados NNNN), alineacion con MkDocs nav. Adaptacion por modo. 2 guides (skeleton script para generar arbol inicial, formato ADR estandar). Wired a tech-writer + tech-lead + solution-architect + business-analyst + devops.

### Added — Entregables nuevos en fase 4 (Construccion)

- **`project-readme`** (mandatory) — el README.md del proyecto cliente. Responsable: tech-writer. Approver: tech-lead.
- **`docs-structure-skeleton`** (mandatory) — el esqueleto inicial de `docs/` con README placeholders. Responsable: tech-writer. Approver: tech-lead.

Ambos bloquean la salida de fase 4 si no estan generados — los demas entregables de docs (api-documentation, runbook, etc.) los llenan con contenido a lo largo del proyecto.

### Added — Tests integrales

30 nuevos tests en `tests/integration/project-documentation.test.ts`:
- Skill `project-readme`: 4 preguntas fundamentales, 18 secciones, 10 reglas, adaptacion por modo, guidance legacy-other, 4 plantillas, wiring.
- Skill `documentation-quality-bar`: 8 minimos enumerados, checklist, conexion con role-boundaries, wiring a 9 roles, 3 guides.
- Skill `project-documentation-structure`: arbol estandar, naming + indexing, adaptacion por modo, MkDocs nav, 2 guides, wiring a 5 roles.
- Phase deliverables: project-readme + docs-structure-skeleton mandatorios en fase 4.
- Pipeline: las 3 skills propagan a archivos de agente generados, archivos `SKILL.md` se crean en `.opencode/skills/<id>/`.
- Modo document + legacy-other: las skills llegan al tech-writer del equipo curado.
- Guard rail: bidireccional sync entre `used_by` y `role.skills`.

Suite total: 476 tests pasando (era 446), typecheck + validate OK, 79 skills (era 76).

### Documentation

- `docs/project-documentation.md` (nuevo): describe el subsistema completo — por que existe, las 3 skills, las 4 preguntas del README, estructura `docs/` estandar, los 8 minimos, entregables nuevos, coordinacion con guard rails existentes, como añadir mejoras a futuro.
- `README.md` y `docs/README.md` actualizados con la referencia.

## [0.1.23] — 2026-05-02

### Added — Stack `legacy-other` + deteccion de PHP / Java desktop / VB6 + fix de fallback silencioso

El wizard tenia un bug latente: cuando el detector no reconocia el stack y el usuario presionaba "Continuar sin stack adapter", se asignaba **`angular-springboot`** silenciosamente. En modo `document` sobre un sistema legacy (Java Swing, VB6, PHP clasico, Cobol, Delphi), los agentes recibian prompts adaptados a Spring Boot y documentaban "controllers REST" sobre `JFrame` listeners o forms .frm — equivalente al incidente Abax-Memory pero en la capa de documentacion.

Tres piezas coordinadas:

- **Stack `legacy-other`** (`data/stacks/legacy-other.yaml`): placeholder con `role_context` cauteloso para los 12 roles tecnicos. Cada uno recibe instrucciones adaptadas a su disciplina diciendo: *NO asumas patrones modernos, INFIERE convenciones del codigo existente, REPORTA al orquestador antes de aplicar comandos modernos*. Sumado a `stack_overrides` consistentes en los 12 roles (ahora todos con 14 stacks completos).
- **3 detectores nuevos** (`src/engine/stack-detector.ts`):
  - **PHP**: `composer.json` con framework conocido (Laravel/Symfony/CakePHP/CodeIgniter/Yii/Slim) o sin framework, o archivos `.php` sueltos sin composer.
  - **Java desktop**: `pom.xml`/`build.gradle` con JavaFX/Swing/MigLayout/FlatLaf y SIN spring-boot/quarkus/micronaut, o archivos `.java` importando `javax.swing`/`java.awt`/`javafx.*` (escaneo bounded a 50 archivos top-level + Maven `src/main/java` layout).
  - **VB6**: archivos `.vbp` (proyecto), `.frm` (forms), o combinacion `.bas`+`.cls` en raiz.
  - Los 3 mapean a `stackId: "legacy-other"` con evidencia descriptiva. Estan al **final** de `RULES` para que stacks modernos ganen cuando coexistan.
- **Fix del fallback silencioso** (`src/cli/WizardApp.tsx`): la opcion "Continuar sin stack adapter" se reemplaza por "Usar Stack legacy o no soportado" (apuntando a `legacy-other`). Si el detector no encuentra match, el wizard recomienda explicitamente la opcion legacy con texto "Si tu sistema es Java desktop, VB6, PHP clasico, Cobol, Delphi, etc.".

### Added — Tests integrales

- 26 nuevos tests en `tests/integration/legacy-stack.test.ts`:
  - Stack catalog: existencia, `role_context` para 12 roles, descripcion explicita.
  - Detector: PHP (4 variantes), Java desktop (4 variantes incluyendo regresion para Spring Boot/Quarkus), VB6 (3 variantes), prioridad de modernos, ausencia de signals.
  - Pipeline: `runSelection`/`runPipeline` con `legacy-other` no crashean, agentes generados contienen el contexto cauteloso, funciona en modo `document`.
  - Stack adapter: merge aditivo de `stack_overrides` + `role_context`, no muta el rol original.
  - Regresion: el codigo fuente de `WizardApp.tsx` ya NO mapea `__none__` a `angular-springboot` (test sentinel que lee el archivo).

Suite total: 446 tests pasando (era 420), typecheck + validate OK, 14 stacks (era 13).

### Documentation

- `docs/legacy-stacks.md` (nuevo): bug que lo motivo, descripcion de las 3 piezas, ejemplos de prompts cautelosos por rol, criterios de deteccion, justificacion de mapear a `legacy-other` en lugar de crear stacks por cada legacy, como añadir mas detectores en el futuro.
- `README.md` y `docs/README.md` actualizados con la referencia.

## [0.1.22] — 2026-05-02

### Added — 3 guard rails adicionales para reglas con riesgo de dilucion

Mismo patron que la guard rail de `role-boundaries` (0.1.21): tests que recorren todos los roles en `data/roles/` y exigen que cada uno cumpla una regla sistemica O este en una lista de exencion documentada. Aplicado a tres reglas mas:

- **Anti-mock rule en developers** (incidente Abax-Memory, 0.1.19) — todo rol cuyo `id` empieza con `developer-` o cuya `category` es `construction`/`data` con `bash != "deny"` debe embeber `REPLACE_BEFORE_PROD`, "incidente Abax-Memory" y "Regla anti-mock" en su `system_prompt`. Previene que un futuro `developer-mobile`/`-ml`/`-api` regrese el patron `InMemorySearchIndexer`.
- **`git-collaboration` skill en roles con bash** (flujo distribuido, 0.1.16) — todo rol con `bash: allow|ask` debe declarar la skill o estar exento. 4 exenciones documentadas: `qa-functional`, `qa-automation`, `qa-performance` (ejecutan tests, reportan via write/edit), `system-designer` (meta-rol del proyecto Abax Swarm). Previene que un rol nuevo con bash haga commits a `main` sin la convencion `abax/<project>` + `--author`.
- **`stack_overrides` completos** — cada rol con bloque `stack_overrides` debe tener entrada para cada uno de los 13 stacks en `data/stacks/`. Previene que añadir un stack `#14` deje silenciosamente sin contexto a los 12 roles tecnicos. Tambien atrapa referencias a stacks que no existen.

5 nuevos tests en `tests/integration/role-guards.test.ts` (419 totales, era 414).

### Changed

- `docs/guides/adding-roles.md` §2b nuevo con las 3 reglas + criterios de exencion.
- `CLAUDE.md` paso 6 en "When modifying YAML data" recuerda los 3 guards al asistente.

## [0.1.21] — 2026-05-02

### Added — Guard rails para que role-boundaries no se diluya con futuros roles

El test `every role is classified` recorre TODOS los roles en `data/roles/` y exige que cada uno este en `used_by` de la skill role-boundaries **o** en la constante `EXEMPT_FROM_ROLE_BOUNDARIES` del test, con razon documentada. Anadir un rol nuevo sin clasificarlo falla CI antes de release.

- 3 roles añadidos a `used_by` y a sus `skills:` (`qa-lead`, `integration-architect`, `change-manager`) — la matriz maestra ya los mencionaba implicitamente como masters de actividades especificas.
- 4 roles marcados explicitamente como exentos con razon: `orchestrator` (no recibe Tasks), `project-manager` (coordinador puro), `ux-designer` (design-only handoff), `system-designer` (meta-rol del proyecto Abax Swarm).
- 4 nuevos tests guard: clasificacion exhaustiva, exclusion mutua, sincronia bidireccional skill↔rol, sanity check inverso para exentos.

### Changed

- `docs/guides/adding-roles.md` §2 nuevo: rubrica con 4 criterios para clasificar un rol nuevo + procedimiento paso a paso.
- `CLAUDE.md` (paso 5 en "When modifying YAML data"): recuerda al asistente la regla antes de empezar.
- `docs/role-boundaries.md`: lista expandida (16 roles) + tabla de 4 exentos + seccion "Como evitar que esto se repita con futuros roles".
- Suite: 414 tests pasando (era 407), typecheck + validate OK, 76 skills (sin cambios).

## [0.1.20] — 2026-05-02

### Added — Limites de rol y reglas de rechazo

Motivado por el incidente de la sesión `ses_21576ae3b...`: el orquestador delegó a `@devops` una Task que decía *"redespliega y reejecuta QA"*. Devops cumplió con sesgo operacional ("responde HTTP 200 → done") y declaró el ciclo cerrado sin aplicar el rigor de qa-functional (criterios de aceptación, registro de defectos). Una sola Task colapsó dos disciplinas. Tres mecanismos coordinados de defensa:

- **Skill compartida `role-boundaries`** asignada a 13 roles con riesgo de solapamiento (`devops`, `qa-functional`, `qa-automation`, `qa-performance`, `developer-backend`, `developer-frontend`, `dba`, `tech-lead`, `business-analyst`, `product-owner`, `solution-architect`, `security-architect`, `tech-writer`). Contiene la matriz maestra por fase, los 8 pares críticos de no-solapamiento, anti-patrones, y el patrón estricto de rechazo (`RECHAZO DE TAREA — fuera de mi rol`) con plantilla exacta.
- **Sección nueva en orchestrator template** (OpenCode + Claude): "Matriz de responsabilidades técnicas por fase (anti-cross-role)" que enuncia el rol maestro de cada fase con sus anti-patrones, gateada por `mode !== "document"` (no aplica al modo documentación porque sus 4 ejes trabajan en paralelo). Cada fila se renderiza condicionalmente solo si los roles correspondientes están en el equipo.
- **Regla 2-Tasks post-fix** en el mismo bloque: cuando QA reporta defecto, el orquestador SIEMPRE delega dos Tasks separadas (`@developer-*` para fix → SHA → `@qa-functional` para re-ejecutar). Se renderiza solo si tanto qa-functional como developer-backend están presentes.

### Added — Tests

- `tests/integration/role-boundaries.test.ts`: 31 tests cubriendo contenido del skill, wiring a los 13 roles, emisión condicional en modos `new` / `continue` / `document`, gating por roles presentes, validación de @-mentions out-of-team, edge cases de equipo pequeño y orphan handlebars.
- Suite completa: 407 tests pasando (era 376), typecheck limpio, validate Zod OK.

### Changed

- `data/skills/` ahora tiene 76 archivos (era 75).
- 13 roles declaran el nuevo skill `role-boundaries` en su lista `skills:`.

### Documentation

- `docs/role-boundaries.md` (nuevo): incidente motivador, matriz maestra completa, 8 pares críticos, plantilla exacta de rechazo, regla 2-Tasks post-fix, gating por modo.
- `docs/README.md` y `README.md` actualizados con la referencia.

## [0.1.19] — 2026-05-02

### Added — 3 capas anti-mock

Motivado por el incidente Abax-Memory (sesión `ses_216175a25ffe...`): un backend con `regex` disfrazada de IA y un `InMemorySearchIndexer` en lugar de Qdrant pasó los 7 entregables de Construcción, QA, UAT, y llegó al borde del despliegue sin que ningún control lo detectara. Tres capas independientes de defensa, ahora obligatorias:

- **Capa 1 — Prevención en developers**: nueva sección "Regla anti-mock" en `system_prompt` de `developer-backend`, `developer-frontend` y `dba`. Cita el incidente por nombre y fecha. Obliga a escalar al orquestador cuando falta credencial/dependencia, y a marcar mocks temporales con `// MOCK: <razon> // REPLACE_BEFORE_PROD`.
- **Capa 2 — Skill nuevo `anti-mock-review`** asignado a `tech-lead`. Flujo de 6 pasos: inventario de integraciones declaradas, dependencias declaradas vs imports reales, escaneo de keywords sospechosos (`InMemory*`/`Mock*`/`Fake*`/`Stub*`/`Dummy*`/`regex.*match` en código no-test), instanciación real de clientes externos, reporte estructurado, comunicación al orquestador. Incluye guides por stack (Java/TS/Python/Go/Rust) y criterios de mock temporal aceptable.
- **Capa 3 — Entregable bloqueante `feature-spec-compliance`** como **ÚLTIMO** entregable de fase 4 (Construcción). Responsable: `business-analyst` (NO desarrollador, NO tech-lead — alguien externo al equipo de implementación). Approver: `product-owner` (consulta al sponsor para integraciones críticas). Bloqueante: el orchestrator no delega QA hasta que esto esté aprobado. Output: matriz `feature de spec → archivo → REAL/MOCK/NO_IMPL → evidencia`.
- **Sección nueva en orchestrator template** (OpenCode + Claude): "Protocolo de cierre de fase Construccion (3 capas anti-mock)" que enuncia explícitamente las 3 capas, las cita por nombre y bloquea el avance a QA.

### Added — Tests

- 15 nuevos integration tests en `tests/integration/quality-gates.test.ts` cubriendo cada capa individualmente + un end-to-end que valida que las 3 capas están consistentes en un proyecto medium generado.
- Lint, typecheck, validate Zod: todo verde. 376 tests en la suite unit/integration + 1 E2E.

### Changed

- `data/skills/` ahora tiene 75 archivos (era 74).
- `tech-lead` declara skill nuevo: `anti-mock-review`.
- `developer-backend`, `developer-frontend`, `dba` system_prompts ampliados con regla anti-mock.

### Documentation

- `docs/quality-gates.md` (nuevo): incidente que lo motivó, descripción detallada de las 3 capas, por qué BA en Capa 3, cómo cambiar la rúbrica, limitaciones conocidas.
- `docs/README.md` actualizado con la referencia.

## [0.1.18] — 2026-05-02

### Added

- **Bloqueante de planificación de despliegue al inicio de fase 7** con aprobación explícita del usuario sponsor. Resuelve el caso reportado: el orchestrator avanzaba a Estabilización sin haber preguntado dónde se publicaba el sistema, con qué dominio, ni cómo se monitorizaba.
  - Nuevo skill `deployment-planning` con rúbrica de **12 preguntas** (dónde, cómo, **URL pública + dominio**, DNS+TLS, exposición, secrets, monitoring, rollback, backup, comunicación, compliance, SLO/SLA) + tabla de aplicabilidad por tipo de servicio (web, API, mobile backend, batch, interno) + checklist pre-go-live.
  - Asignado a `devops`, `project-manager`, `solution-architect`, `security-architect`.
  - `deployment-plan-doc` en `phase-deliverables.yaml` cambia approver de `tech-lead` → `product-owner` (que **debe consultar al sponsor explícitamente**).
  - Sección nueva en orchestrator template (OpenCode + Claude): "Protocolo de inicio de fase Despliegue" — bloquea avance hasta aprobación textual del sponsor en chat.
- **Publicación automática de presentaciones a GitHub Pages**:
  - Nuevo `src/generator/pages-generator.ts` emite `.github/workflows/pages.yml` cuando el team usa `presentation-design`.
  - El workflow auto-detecta `mkdocs.yml` (modo `document` → `mkdocs build`) o publica `docs/` directamente como sitio estático.
  - Trigger: `push` a `main` + `workflow_dispatch`. Concurrency `pages` con `cancel-in-progress: false` (los pushes consecutivos se encolan, ninguno se cancela mid-deploy).
  - Setup único: el usuario habilita Pages en `Settings → Pages → Source: GitHub Actions`. A partir de ahí, cada presentación generada y commiteada por el flujo distribuido se publica automáticamente.
- **Audit anti-solapamiento de roles para presentaciones**:
  - El skill `presentation-design` se amplió con `product-owner`, `tech-lead` y `qa-lead` en `used_by` (estaban en la rúbrica pero faltaban en el wiring — bug detectado por el audit).
  - Esos 3 roles ahora declaran el skill en sus YAMLs.
  - Test nuevo `tests/integration/deployment-pages.test.ts` ejecuta dos audits automáticos: (1) cada responsabilidad en la tabla del skill está correctamente wireada en `used_by` + role.skills; (2) ningún par `(fase, presentación)` aparece duplicado.
- **17 tests nuevos** cubriendo skill, wiring, blocker en fase 7, orchestrator template (ambos targets), workflow YAML válido, branching mkdocs/static, audits.

### Documentation

- `docs/deployment-planning.md` (nuevo): rúbrica completa, plantilla del entregable, checklist pre-go-live, quién hace qué, cómo cambiar la rúbrica.
- `docs/presentation-publishing.md` (nuevo): workflow GitHub Pages, setup único, audit anti-solapamiento, cómo cambiar asignación de presentaciones, limitaciones conocidas.
- `docs/README.md` actualizado con las dos referencias nuevas.

### Internal validation

- Smoke test de 5 escenarios + 2 audits, todos verde (28 checks).
- E2E del wizard sigue verde (4s).
- Lint, typecheck, validate Zod: todo verde. 363 unit/integration tests pasan + 1 E2E + smoke.

## [0.1.17] — 2026-05-02

### Documentation

- 3 docs sincronizados con el flujo git distribuido de 0.1.16:
  - `docs/architecture.md`: skills count actualizado de 71 a 73 (incluye `dependency-management` y `git-collaboration`); tabla de "Project modes" describe el flujo distribuido en lugar de la versión "suggest-only"; tabla de templates incluye los nuevos vars del context (`hasDevops`, `envVerificationLead`).
  - `docs/data-model.md`: skills count actualizado a 73, mención del nuevo skill `git-collaboration`.
  - `docs/permissions.md`: nueva nota cruzada explicando que `git *: allow` + `git push --force *: deny` están diseñados específicamente para soportar el flujo distribuido.

## [0.1.16] — 2026-05-02

### Changed

- **Flujo git distribuido y ejecutado, no sugerido** (cambio de comportamiento respecto a 0.1.14):
  - Antes: cuando había `.git/`, el orquestador emitía un comando `git add ... && git commit ...` para que el usuario lo ejecutara manualmente. Push nunca se ejecutaba.
  - Ahora: cada agente técnico (5 roles) **commitea su propio entregable** después de escribirlo, con `git add <archivo-específico>` (nunca `.`/`-A`) + `git commit --author "<rol> <rol@abax-swarm>"`. Al cierre de cada fase, el orquestador delega exactamente una Task a `@devops` (o `@tech-lead` fallback): "haz `git push` de la fase". El orquestador **sigue siendo coordinador puro** (`bash: deny` intacto), no toca git directamente.

### Added

- **Nuevo skill `git-collaboration`** asignado a tech-lead, devops, developer-backend, developer-frontend y dba. Define: creación idempotente de rama `abax/<project-name>` al primer commit (si la actual es `main`/`master`/`trunk`), commits granulares con autoría del rol, push centralizado por devops al cierre de fase, manejo de errores (auth, branch protection, non-fast-forward, rate limit, conflicts).
- **Nuevo doc [`docs/git-collaboration.md`](docs/git-collaboration.md)** con la tabla quien-hace-que, política de naming de rama, anti-patrones bloqueados, manejo de errores, combinación con modos de permisos.
- **8 tests nuevos** verificando: skill existe + 5 roles lo declaran + instructions cubren branch/author/push/anti-patterns; orchestrator template emite la nueva instrucción distribuida cuando `hasGit`; fallback a tech-lead cuando no hay devops; sección omitida cuando `hasGit === false`; ambos targets (OpenCode + Claude).

### Documentation

- README actualizado: la frase sobre "sugiere un commit" ahora describe el flujo ejecutado, distribuido, con rama `abax/<project>` creada automáticamente.
- `docs/guides/orchestrator-flow.md` sección "Per-phase commit protocol" reescrita.
- `docs/README.md` actualizado con nuevas referencias (permissions, dependency-management, dev-environments, git-collaboration) y screenshot count corregido (6, no 5).

## [0.1.15] — 2026-05-02

### Added

- **Test E2E del wizard** (`tests/e2e/wizard-flow.test.ts`): spawnea el binario real `node dist/cli/app.js init --dry-run` dentro de un PTY (`node-pty`), escribe teclas sintéticas y verifica el output renderizado por Ink. Cubre los 12 steps del flujo completo modo `new` con defaults — incluye los nuevos pasos `permissions` y `isolation` añadidos en 0.1.14. Detecta regresiones que `ink-testing-library` no puede (comportamiento real de teclado, transiciones de step, sidebar dinámico).
- Nuevo script `npm run test:e2e` que builda y corre solo el E2E. Separado de `npm test` para mantener CI rápido. Tiempo total: ~5s.
- `node-pty@^1.1.0` añadido a `devDependencies`.

### Documentation

- CONTRIBUTING.md: la sección "Antes de tagear un release" ahora menciona que el E2E vive aparte y se corre con `npm run test:e2e` cuando se modifica el wizard.

## [0.1.14] — 2026-05-02

### Added

- **3 modos de permisos para OpenCode**, configurables en un nuevo step del wizard:
  - `strict`: comportamiento de hoy (sólo permission por agente).
  - `recommended` (default): allowlist de comandos comunes (git, npm, mvn, pip, etc.) y denylist de operaciones peligrosas (`git push --force`, `rm /var/*`, `rm /var/lib/dpkg/*`, `chmod 777`, `curl|sh`). **Container-aware**: `apt`/`dpkg`/`sudo` están en `ask` cuando el aislamiento es `host` y pasan a `allow` automáticamente cuando es `devcontainer`.
  - `full`: `"permission": "allow"` raíz, sin restricciones, con banner de advertencia en el wizard.
- **Aislamiento del entorno de desarrollo**, nuevo step del wizard con 2 opciones:
  - `devcontainer` (default): genera `.devcontainer/devcontainer.json` con features según el stack (Java+Maven, Node, Python, Go, Rust, .NET, Flutter). Marca el container con `ABAX_ISOLATED=1` para que el detector lo reconozca en runtime.
  - `host`: trabaja directamente en el SO principal; los agentes usan gestores de versión del usuario (sdkman, nvm, pyenv, rustup) y nunca `sudo apt`.
- **Skill nuevo `dependency-management`** asignado a tech-lead, devops, developer-backend, developer-frontend y dba. Define el flujo de 6 pasos para verificar runtime, declarar dependencias en el manifest del stack, instalar con aprobación del usuario (sin destructive remediation), verificar build vacío, documentar setup local en `docs/setup.md`. Incluye tabla de comandos por stack.
- **Entregable bloqueante `env-verification`** al inicio de la fase Construcción (`phase-deliverables.yaml`). El orchestrator no delega ningún otro entregable de Construcción hasta que esté completado y aprobado. Resuelve el incidente que motivó este release: agentes intentando builds sin runtime instalado.
- **Detector de container** (`container-detector.ts`): `/.dockerenv`, `/run/.containerenv`, `/proc/1/cgroup`, `$ABAX_ISOLATED`. Pure module, no I/O fuera de readFileSync.
- Nuevos docs: `docs/permissions.md` (3 modos + el incidente que los motivó), `docs/dependency-management.md` (skill + entregable + protocolo), `docs/guides/dev-environments.md` (devcontainer vs host, cómo arrancar, alternativas).
- **20 tests nuevos** cubriendo los 3 modos de permisos, devcontainer per-stack, container-detector, cross-references del skill, blocker en phase-deliverables, sección del orchestrator template.

### Changed

- Orchestrator template (OpenCode + Claude) incluye nueva sección "Protocolo de inicio de fase Construcción" que fuerza el entregable `env-verification` antes que cualquier otro de Construcción y referencia el skill `dependency-management`.
- 5 roles (tech-lead, devops, developer-backend, developer-frontend, dba) ahora declaran el skill `dependency-management`.
- `ProjectConfig` admite `permissionMode` e `isolationMode`. Se persisten en `project-manifest.yaml > project.permission_mode/isolation_mode` y se respetan en `regenerate`.
- Capturas regeneradas reflejando los 2 nuevos steps.

### Fixed

- Mitigación al incidente real `ses_217c43466ffe...` (mayo 2026): un agente devops intentando `mvn install` sin Java instalado terminó ejecutando `rm -f /var/lib/dpkg/lock-frontend && dpkg --configure -a` para forzar la instalación. Con modo `recommended` ese comando ahora está en `deny` explícito; con devcontainer no aplica porque apt-get es seguro adentro.

## [0.1.13] — 2026-05-02

### Documentation

- `CONTRIBUTING.md` ampliado de 73 a 236 líneas con dos guías nuevas para futuros contribuyentes:
  - **"Documentar cambios"**: tabla con qué docs tocar según el tipo de cambio (wizard, schemas YAML, módulos engine/generator, orchestrator, features grandes), formato del `CHANGELOG.md` (Keep a Changelog), pautas de redacción de bullets, criterios de versionado en 0.x.y, checks obligatorios pre-release.
  - **"Regenerar las capturas de pantalla"**: requisitos (`tmux` + `freeze`), instalación de `freeze` desde GitHub release, ejecución del script, cuidados al modificarlo (TextInput pre-llenado con `process.cwd()` requiere Backspaces en chunks; `Ctrl-U` no funciona en `ink-text-input`; sleeps generosos para que ink procese), verificación visual.
- Sección de Releases ampliada: orden recomendado (bump + CHANGELOG en el mismo PR de la última feature), requisito de `NPM_TOKEN` con bypass 2FA, troubleshooting para fallos comunes (`skipped`, `403`, `tag already exists`).

## [0.1.12] — 2026-05-02

### Fixed

- `Header.tsx` reportaba `Abax Swarm · v0.1.1` (cadena hardcodeada). Ahora la versión se lee dinámicamente del `package.json` igual que `--version` (fix paralelo al de `app.ts` en 0.1.6).

### Documentation

- README ampliado con: tabla de los 3 modos de proyecto, mención de model-strategy / inherit, agent colors, sistema de presentaciones HTML, regla de glosario al cierre, y nueva captura del paso "Modo de proyecto".
- `docs/architecture.md` actualizado: capa de detectores (`stack-detector`, `docs-detector`, `git-detector`, `project-context`), generador `docs-site-generator`, `color-resolver`, nueva sección de "Project modes", governance `documentation`, plantilla `design-system/`.
- `docs/data-model.md` actualizado: `agent.color` y `cognitive_tier`/`reasoning` en role schema, `document-mode.yaml`, runtime types (`ProjectMode`, `ModelStrategy`, `ProjectContextDetection`), bump skills a 71.
- `docs/guides/orchestrator-flow.md` extendido: flujo de modo documentación (5 fases, 4 ejes), protocolo de actualización de docs existentes, protocolo de commits por fase, regla de glosario.
- `docs/README.md` reordenado: añadidas referencias a `model-mix.md` y `agent-colors.md`.
- `scripts/capture-screenshots.sh` actualizado para reflejar el wizard de v0.1.11 (paso `project-mode` añadido, `model-strategy`, banner v0.1.12 leído dinámicamente). Genera 6 PNGs en vez de 5.
- 6 capturas regeneradas (anteriormente eran 5 y mostraban `v0.1.1`).

## [0.1.11] — 2026-05-01

### Added

- **Modos de proyecto** — el wizard ahora pregunta al inicio qué quieres hacer:
  - **Implementar algo nuevo** (`new`): flujo cascada completo (sin cambios respecto a versiones previas).
  - **Documentar algo existente** (`document`): equipo curado de 9 roles fijos (tech-writer, business-analyst, product-owner, solution-architect, tech-lead, dba, integration-architect, ux-designer, change-manager) + security-architect opcional. Cubre 4 ejes: técnico, funcional, negocio, operativo. Flujo de 5 fases (`discovery → inventory → documentation → review → publication`) en vez de la cascada de 10. Genera scaffold MkDocs Material (`mkdocs.yml`, `requirements.txt`, `docs/index.md` + seeds por fase) listo para ejecutar `mkdocs serve`.
  - **Continuar / partir de proyecto previo** (`continue`): detector ejecuta sobre el `targetDir` y muestra al usuario el stack detectado para que elija mantener o cambiar. Si no detecta ninguno conocido, muestra evidencia parcial y ofrece elegir manualmente o continuar sin stack adapter.
- Nuevo skill `reverse-engineering` (en `data/skills/`): instrucciones detalladas para inventariar componentes, extraer reglas de negocio del código, identificar gaps y verificar contra runtime. Asociado a tech-lead, solution-architect, business-analyst, dba, integration-architect y tech-writer.
- Nuevo módulo `src/engine/stack-detector.ts` con 13 heurísticas (Next.js, Nuxt, NestJS, Astro+Hono, Expo, Spring Boot, Quarkus, FastAPI, Django, Fiber, Axum, Flutter, Blazor) + detección de evidencia parcial cuando no hay match.
- Nuevos detectores `docs-detector.ts` (busca `docs/*.md` recursivo) y `git-detector.ts` (busca `.git/`).
- Sección **"Protocolo de actualización de documentación existente"** en el orchestrator: si detectamos `docs/` con `.md`, el orquestador delega "actualizar X" en vez de "crear X". Cada agente recibe la regla "leer primero, conservar estructura, modificar solo lo cambiado".
- Sección **"Protocolo de commits por fase"** en el orchestrator: si detectamos `.git/`, al cierre de cada fase emite un bloque `git add docs/<fase>/ && git commit -m "docs(<fase>): ..."` listo para que el usuario ejecute. **No ejecuta commits automáticamente** (orchestrator tiene `bash: deny` por diseño); es una sugerencia.
- Tests: 19 unit del detector de stack (13 fixtures + caso desconocido) + integration de modo document, MkDocs scaffold, secciones condicionales del orchestrator.

### Changed

- 6 roles (tech-lead, solution-architect, business-analyst, dba, integration-architect, tech-writer) ahora declaran el skill `reverse-engineering` para el modo `document`.
- `ProjectConfig` admite `mode: "new" | "document" | "continue"` y `detection: ProjectContextDetection` (flags hasGit, existingDocs, stackId detectado).
- Nuevo modelo de governance `documentation` (cuarto valor además de lightweight/controlled/corporate) con cierres editoriales en lugar de comités.

## [0.1.10] — 2026-05-01

### Added

- Cada agente generado (excepto el orquestador, que no escribe entregables) ahora incluye una **regla de Glosario al cierre** en su prompt:
  - Si un entregable usa **3 o más acrónimos / términos específicos** de la disciplina del rol (RACI, SLA, BPMN, OWASP, CI/CD, SLO, RTO/RPO, DDD, CQRS, etc.), el agente añade una sección final `## Glosario` con definiciones cortas (máx 7 términos, 1 línea por término).
  - Si todos los términos son de uso común, omite la sección.
  - Aplica también a presentaciones HTML (slide final con el glosario).
  - Objetivo: hacer los entregables comprensibles para usuarios no técnicos / no especialistas.
- Ambas plantillas de agente (OpenCode y Claude) llevan la misma regla.

## [0.1.9] — 2026-05-01

### Added

- Sistema de presentaciones funcional end-to-end:
  - Nuevo `templates/design-system/presentacion-template.html` (single-file, sin CDN) con los **3 presets visuales** del Design System: Corporate Minimal, Tech Editorial y Dark Premium. Incluye un slide deck de muestra navegable con switcher entre presets.
  - Nuevo generador `src/generator/design-system-generator.ts` que emite el template en `docs/design-system/presentacion-template.html` del proyecto destino cuando algún agente del equipo usa el skill `presentation-design`.
  - Aplica para ambos targets (OpenCode y Claude).

### Changed

- `data/tools/create-presentation.yaml` ahora **emite HTML autónomo single-file** (antes emitía Markdown, contradiciendo el skill rubric):
  - Nuevo arg `style` con valores `corporate-minimal | tech-editorial | dark-premium` (default: `corporate-minimal`).
  - Convierte el `content` Markdown del agente en `<section class="slide">` separados por `---`.
  - CSS de los 3 presets embebido (single-file, portable, imprimible).
  - Sin gradientes púrpura/rosa, sin gris puro, neutrales tintados — alineado con la rúbrica del skill.

### Fixed

- Eliminado el gap entre la rúbrica de `presentation-design` y la implementación: el archivo `docs/design-system/presentacion-template.html` que el skill y los agentes referenciaban **ya no es un dangling reference** — se entrega con cada proyecto generado.

## [0.1.8] — 2026-05-01

### Added

- Asignación determinista de color por agente para el TUI de OpenCode:
  - El **orquestador** siempre se pinta con `#dc143c` (crimson) — reservado en código y declarado explícitamente en `data/roles/orchestrator.yaml`.
  - Cada agente recibe un color de una **paleta curada de 24 hex vivos** (excluye el rango rojo) vía hash determinista del `role.id`. Mismo rol → mismo color en cada regeneración; agregar o quitar otros roles no afecta los colores de los existentes.
  - Override por rol disponible vía `agent.color` en el YAML (acepta hex con comillas o claves de tema: `primary`, `accent`, `success`, etc.).
  - Hex se emite siempre **entrecomillado** en el frontmatter para evitar [sst/opencode#17118](https://github.com/sst/opencode/issues/17118) (parser interpreta `#` como comentario sin comillas).
- Nuevo módulo `src/engine/color-resolver.ts` (puro) y nuevo doc `docs/agent-colors.md` con la paleta completa, política de asignación y patrón a seguir al crear roles nuevos.

## [0.1.7] — 2026-05-01

### Changed

- El paso 1 del wizard ("Directorio del proyecto") ahora pre-llena el input con `process.cwd()`, así basta con pulsar Enter para usar el directorio actual desde donde se ejecutó `abax-swarm init`. El usuario puede editarlo si quiere otra ruta.

## [0.1.6] — 2026-05-01

### Fixed

- `abax-swarm --version` reportaba `0.1.0` (cadena hardcodeada en `src/cli/app.ts` que nunca se sincronizó con los bumps 0.1.1 → 0.1.5). Ahora la versión se lee dinámicamente de `package.json` en runtime, así que nunca volverá a desincronizarse.

## [0.1.5] — 2026-05-01

### Added

- Nueva opción **"Heredar del default de mi configuración"** en el paso 3 del wizard ("Asignación de modelos"):
  - Cuando el usuario la elige, no se escribe `model:`, `thinking:` ni `reasoningEffort:` en el frontmatter de los agentes ni en `opencode.json`. OpenCode hereda del `model` raíz del workspace o del default global del usuario, y los subagentes heredan del primario que los invoca (vía oficial documentada).
  - Útil cuando el usuario final no tiene acceso a Opus / GPT-5; OpenCode no soporta fallback nativo de modelos ([sst/opencode#25150](https://github.com/sst/opencode/issues/25150)).
  - Si elige "inherit", el wizard salta el paso de proveedor.
  - La estrategia se persiste como `project.model_strategy` en `project-manifest.yaml` y se respeta en `abax-swarm regenerate`.
- Precarga de elecciones previas al actualizar una carpeta existente:
  - `init` sobre carpeta con `project-manifest.yaml` ahora precarga `target`, `provider` y `model_strategy` desde el manifest.
  - El bloque "Configuración existente" muestra plataforma y estrategia/proveedor previos.
  - `SelectInput` admite `initialValue` y posiciona el cursor en la opción anterior — basta Enter para conservarla.

### Documentation

- Sección nueva en `docs/model-mix.md` explicando `custom` vs `inherit` y cuándo usar cada una.

## [0.1.4] — 2026-05-01

### Added

- Expand/collapse del preview de archivos en el paso de Confirmación con tecla `E`.
- Selección fina de modelo por agente:
  - `cognitive_tier` (`strategic` / `implementation` / `mechanical`) y `reasoning` (`none` / `low` / `medium` / `high`) en cada rol YAML.
  - Nuevo paso 3 del wizard ("Proveedor de IA") para elegir Anthropic o OpenAI.
  - `src/engine/model-mapping.ts` traduce `(provider, tier, reasoning)` a un `ModelSpec` concreto.
  - `opencode.json` y el frontmatter de cada `.opencode/agents/*.md` ahora incluyen `model` y `thinking`/`reasoningEffort`.
  - El `project-manifest.yaml` registra el `provider` usado.
  - Confirm step muestra el mix sugerido agrupado por modelo.
- Tests: `ink-testing-library` para los componentes de la TUI, integration tests del mix de modelos. 257 tests en total.
- `npm publish` opcional en `release.yml` cuando `NPM_TOKEN` está configurado.

### Changed

- `tests/integration/e2e-interface.test.ts` ahora usa `mkdtempSync(tmpdir(), "abax-e2e-")` en vez de un path fijo `.tmp-e2e/`. `testTimeout` global subido a 15 s.

### Fixed

- Eliminados los 9 warnings de lint en `tests/` (renombrar `id` no usado a `_id`, etc.).
- Quitada la nota "may timeout under load, safe to retry" de CLAUDE.md ahora que el e2e es estable.

## [0.1.3] — 2026-05-01

### Changed

- README reescrito en español con tres rutas claras: usar rápido sin conocimiento técnico, personalizar (agregar roles propios), contribuir al código.

## [0.1.2] — 2026-05-01

### Added

- Captura del paso 7 (Confirmación) en el README.

### Changed

- TUI: el preview de archivos en el paso de Confirmación se compacta a 8 directorios × 4 archivos para que quepa con el sidebar en una pantalla de altura razonable.

## [0.1.1] — 2026-05-01

### Added

- Reescritura completa del wizard (`abax-swarm init`) con [Ink](https://github.com/vadimdemedes/ink):
  - Componentes: `TextInput`, `SelectInput`, `MultiSelectInput`, `ConfirmInput`, `RoleEditor`, `Spinner`, `Header`, `StepHeader`, `ProgressBar`, `Sidebar`, `InfoBox`.
  - Single-page Ink app (`WizardApp.tsx`) con state machine para los 7 pasos.
  - Layout en 2 columnas: paso activo a la izquierda, sidebar persistente a la derecha con resumen acumulado.
  - Indicador de progreso visual (●─●─○─○─○─○─○).
  - Navegación libre con `Ctrl+B` para volver al paso anterior.
  - Spinner durante la generación, summary card final con archivos generados.
- Workflows GitHub Actions: `ci.yml` (PRs y push a main) y `release.yml` (tags `v*`).
- Auto-label de PRs por prefijo de rama (`feature/*` → `feature`, etc.).
- 5 capturas de pantalla en el README cubriendo los pasos clave.

### Changed

- Migración de gitflow a GitHub Flow (rama `develop` eliminada).
- Branch protection en `main` con `validate` como check obligatorio.
- Default branch en GitHub: `main`.

[Unreleased]: https://github.com/breisnerlopez/Abax-Swarm/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/breisnerlopez/Abax-Swarm/releases/tag/v0.1.4
[0.1.3]: https://github.com/breisnerlopez/Abax-Swarm/releases/tag/v0.1.3
[0.1.2]: https://github.com/breisnerlopez/Abax-Swarm/releases/tag/v0.1.2
[0.1.1]: https://github.com/breisnerlopez/Abax-Swarm/releases/tag/v0.1.1
