# Quality gates: 3 capas anti-mock

## El incidente que motivo este sistema

En la sesion `ses_216175a25ffe45klimZpYr8IlX` (mayo 2026) del proyecto **Abax-Memory**, un agente `developer-backend` produjo un backend con:

- `InMemorySearchIndexer.java` en lugar de un cliente Qdrant real.
- `StructuredExtractionService.java` usando `Pattern.compile` (regex) en lugar de OpenAI structured outputs.
- `pom.xml` sin las dependencias `langchain4j`, `langchain4j-openai` ni `qdrant-client`.

El codigo paso los 7 entregables de Construccion, las pruebas de QA, UAT, y llego a fase 7 (Despliegue). La sesion inmediatamente anterior se llamaba **"Configurar entorno y desplegar"** — es decir, regex disfrazada de IA estaba a punto de pasar a produccion.

El usuario lo detecto solo cuando aporto la API key real y vio que la "IA" no se conectaba. Ningun control automatico lo cazo.

**Diagnostico**: nadie tenia explicitamente la responsabilidad de *"verificar que lo implementado corresponde a la especificacion funcional con integraciones reales, no mocks"*.

## La respuesta: 3 capas independientes de defensa

| Capa | Donde vive | Quien la ejecuta | Que detecta |
|---|---|---|---|
| 1. Prevencion | `system_prompt` de developers (`developer-backend`, `developer-frontend`, `dba`) | El propio developer al implementar | Falta de credenciales/dependencias antes de mockear silenciosamente |
| 2. Code review | Skill `anti-mock-review` | `tech-lead` antes de aprobar `source-code` | Clases `InMemory*`/`Mock*`/`Fake*`/`Stub*`, regex en metodos NLP, deps declaradas vs imports reales, instanciacion de clientes externos |
| 3. Spec compliance | Entregable `feature-spec-compliance` (ULTIMO de fase 4) | `business-analyst` (NO desarrollador, NO tech-lead) | Cada feature de la spec → archivo → estado REAL/MOCK/NO_IMPL |

**Las tres capas son independientes a proposito**: si el developer ignora la regla bajo presion (Capa 1), el tech-lead lo cacha en review (Capa 2). Si ambos fallan (porque son del mismo equipo y comparten presion), el BA lo bloquea antes de QA (Capa 3) — el BA no esta en el equipo de implementacion, su sesgo es opuesto.

## Capa 1 — Prevencion en los developers

`data/roles/developer-backend.yaml`, `developer-frontend.yaml` y `dba.yaml` tienen una seccion **"Regla anti-mock"** en su `system_prompt` que el agente lee al arrancar. La regla obliga:

1. **NO mockear silenciosamente** cuando falta credencial/dependencia/servicio.
2. **ESCALAR al orquestador** con bloqueo concreto.
3. Si el mock es **temporal y necesario**, marcarlo:

   ```java
   // MOCK: <razon concreta + ticket de bloqueo> // REPLACE_BEFORE_PROD
   ```

   y escalar la lista al orquestador.

La regla cita el incidente Abax-Memory por nombre y por fecha — los agentes ven el aprendizaje organizacional, no una regla abstracta.

## Capa 2 — Skill `anti-mock-review` para tech-lead

`data/skills/anti-mock-review.yaml` define un flujo de 6 pasos que el tech-lead ejecuta antes de aprobar el entregable `source-code`:

1. **Inventario de integraciones declaradas** (lee technical-design + spec).
2. **Verificar dependencias declaradas vs imports reales** (manifest del stack vs `import` en src/main).
3. **Escaneo de keywords sospechosos** (clases con prefijos InMemory/Mock/Fake/Stub/Dummy en src/main, regex en metodos extractores, `// TODO`/`// FIXME` sin la convencion `REPLACE_BEFORE_PROD`).
4. **Verificar instanciacion real de clientes externos** (no `localhost:1234` ni `test-key` en codigo de produccion).
5. **Reporte estructurado** en `docs/entregables/fase-4-construccion/code-review-anti-mock.md` con matriz de integraciones y hallazgos.
6. **Comunicacion al orquestador**: APROBADO / RECHAZADO / APROBADO CON OBSERVACIONES.

Si el reporte es **RECHAZADO**, el entregable vuelve al developer. NO se marca `source-code` como done.

El skill incluye dos guides: `keywords-sospechosos-por-stack` (Java/TS/Python/Go/Rust) y `convencion-mock-temporal-aceptable`.

## Capa 3 — `feature-spec-compliance` bloqueante

`data/rules/phase-deliverables.yaml` define **`feature-spec-compliance` como el ULTIMO entregable obligatorio** de fase 4 (Construccion):

```yaml
- id: feature-spec-compliance
  name: Verificacion de cumplimiento Feature vs Especificacion
  responsible: business-analyst
  approver: product-owner
  mandatory: true
  artifact_type: report
```

**Por que el BA y no otro rol**: el BA conoce la spec funcional pero no escribio el codigo. Su sesgo es validar que lo implementado corresponde a lo especificado, no defender el codigo. Tech-lead, developers y devops estan en el equipo de implementacion — sufren del mismo sesgo de confirmacion. El BA es el ojo externo natural.

**Por que approver es product-owner**: las decisiones sobre que features pueden ir a QA con stub temporal son de negocio, no tecnicas. El PO consulta al sponsor para integraciones criticas.

**Bloqueante**: el orquestador NO delega ningun entregable de fase 5 (QA) hasta que `feature-spec-compliance` este completado y aprobado. Esto se enuncia explicitamente en la seccion "Protocolo de cierre de fase Construccion" del orchestrator template.

El BA produce una matriz:

| Feature de la spec | Archivo que la implementa | Estado | Evidencia |
|---|---|---|---|
| Embeddings con text-embedding-3-large | `EmbeddingConfig.java` | REAL | `OpenAiEmbeddingModel` instanciado linea 23 |
| Busqueda semantica con Qdrant | `QdrantSearchIndexer.java` | REAL | Cliente `QdrantClient` instanciado, test integracion en `QdrantIT.java` |
| Extraccion de entidades estructurada | `StructuredExtractionService.java` | **MOCK detectado** | `Pattern.compile` linea 42, sin marca REPLACE_BEFORE_PROD — RECHAZAR |

## Combinacion con permisos y flujo git

- En modo de permisos `recommended`, los developers pueden ejecutar `grep` y `find` (allowlist), lo cual les da herramientas para auto-auditarse antes de escalar al orquestador.
- El tech-lead, al ejecutar `anti-mock-review`, puede correr los `grep` de detection del Paso 3 con el permiso `bash: ask`.
- Cada hallazgo del code-review queda commiteado por el flujo distribuido (`git-collaboration`): es auditable, no se pierde entre conversaciones.

## Tests

`tests/integration/quality-gates.test.ts` cubre las 3 capas con 15 tests:

- Capa 1: las 3 roles tienen la regla con su signature por dominio (backend/frontend/dba); la regla aparece en el `.md` generado.
- Capa 2: el skill existe + esta wireado solo a tech-lead; las 6 pasos estan documentados; los keywords sospechosos estan listados.
- Capa 3: `feature-spec-compliance` es el ULTIMO deliverable de fase 4; orchestrator template emite "Protocolo de cierre de fase Construccion"; ambos targets (OpenCode + Claude) reciben el protocolo.
- End-to-end: en un proyecto medium con OpenCode, las 3 capas estan visibles y consistentes.

## Como cambiar la rubrica

- **Anadir/quitar keywords**: edita `data/skills/anti-mock-review.yaml` seccion "Escaneo de keywords sospechosos" (Paso 3).
- **Cambiar el responsable de Capa 3**: edita `phase-deliverables.yaml` y el `responsible` del entregable. Si lo cambias a algo distinto de business-analyst, considera el sesgo: el ojo externo es el activo principal.
- **Anadir un quinto step a Capa 2**: extiende las instrucciones del skill. Los tests pasan mientras los 6 pasos originales sigan presentes.

## Limitaciones

- **No detecta mocks semanticos**: si el developer escribe codigo que parece real pero hardcodea constantes en lugar de calcular (ej. siempre devuelve sentiment="positive"), las 3 capas pueden no detectarlo. El audit Capa 3 es la ultima linea de defensa, pero requiere que el BA inspeccione muestras concretas.
- **Asume que la spec funcional existe**: si la fase 2 (analisis funcional) produjo entregables vagos, el BA no tiene contra que comparar. Refuerza la gobernanza de la fase 2.
- **No reemplaza tests de integracion reales**: el skill recomienda tests `*IT.java`/integration tests pero no los enforce.
