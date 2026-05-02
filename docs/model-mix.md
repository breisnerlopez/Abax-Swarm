# Mix de modelos por rol

Documenta cómo Abax Swarm asigna un modelo de IA específico a cada uno de los 20 roles del equipo y por qué. La fuente de verdad del código vive en [`src/engine/model-mapping.ts`](../src/engine/model-mapping.ts); este documento explica las decisiones detrás de esa tabla.

## El modelo de decisión

Cada rol declara dos campos en su YAML (`data/roles/<rol>.yaml > agent`):

```yaml
agent:
  cognitive_tier: strategic   # strategic | implementation | mechanical
  reasoning: high             # none | low | medium | high
  temperature: 0.3
```

El motor traduce `(provider, cognitive_tier, reasoning)` a un `ModelSpec` concreto:

| Tier | Anthropic | OpenAI |
|---|---|---|
| `strategic` | `claude-opus-4-7` | `gpt-5` |
| `implementation` | `claude-sonnet-4-6` | `gpt-5-mini` |
| `mechanical` | `claude-haiku-4-5` | `gpt-5-nano` |

| Reasoning | Anthropic (`thinking.budgetTokens`) | OpenAI (`reasoningEffort`) |
|---|---|---|
| `none` | sin thinking | `minimal` |
| `low` | 4 000 tok | `low` |
| `medium` | 16 000 tok | `medium` |
| `high` | 32 000 tok | `high` |

**Mantenemos el mix dentro del mismo proveedor**: nunca mezclamos modelos de Anthropic con modelos de OpenAI en el mismo equipo. Esto evita confusión de credenciales y permite al usuario optimizar costo/calidad cambiando un solo `provider` en el wizard.

### Estrategia de asignación: `custom` vs `inherit`

El wizard pregunta cómo asignar modelos antes de pedir el proveedor:

- **`custom`** (recomendado, comportamiento por defecto): aplica la tabla de arriba. Cada rol recibe un modelo concreto en el frontmatter de su `.md` y en `opencode.json`.
- **`inherit`**: **no se escribe `model:` en ningún agente** ni en `opencode.json`. OpenCode hereda del `model` raíz del workspace o del default global del usuario; los subagentes heredan del primario que los invoca (comportamiento documentado en https://opencode.ai/docs/agents).

Cuándo elegir `inherit`:

- El usuario final no tiene credenciales para Opus / GPT-5 (los modelos `strategic`).
- Quieres un proyecto portable que cualquier instalación de OpenCode pueda ejecutar sin tocar config.
- Estás haciendo pruebas locales con un modelo único (Sonnet, Haiku, gpt-4o-mini, etc.).

OpenCode **no soporta fallback nativo** entre modelos ([sst/opencode#25150](https://github.com/sst/opencode/issues/25150) abierto sin merge), por lo que `inherit` es la única forma idiomática de evitar fallos en runtime cuando el modelo asignado no está disponible.

La estrategia se persiste en `project-manifest.yaml > project.model_strategy` y se respeta en `abax-swarm regenerate`.

---

## Asignación por rol

### Roles estratégicos — `strategic` (8 roles)

Modelo: **Opus** (Anthropic) o **GPT-5** (OpenAI).

| Rol | Reasoning | Thinking / Effort | Temp | Por qué |
|---|---|---|---|---|
| `orchestrator` | high | 32k / high | 0.3 | Coordina al equipo entero, decide a quién delegar y cuándo cerrar fases. Razonamiento profundo sobre dependencias y prioridades. |
| `solution-architect` | high | 32k / high | 0.2 | Decisiones de arquitectura técnica (ADRs). Tradeoffs irreversibles y alto costo de equivocarse. |
| `security-architect` | high | 32k / high | 0.1 | Compliance, threat modeling, sensitive data. Consecuencias de un error son altas. Temp baja para máxima consistencia. |
| `integration-architect` | high | 32k / high | 0.2 | Diseño de integraciones entre sistemas. Cada decisión afecta a varios equipos / contratos externos. |
| `business-analyst` | high | 32k / high | 0.3 | Levanta requisitos completos, reglas de negocio, alcance, criterios de aceptación. Necesita razonar sobre el dominio del negocio. |
| `system-designer` | high | 32k / high | 0.2 | Meta-rol: modifica el propio Abax Swarm. Cambios al motor afectan a todos los proyectos generados después. |
| `project-manager` | medium | 16k / medium | 0.3 | Planifica, sigue riesgos, gobierna. Decisiones importantes pero más operativas que arquitecturales. |
| `product-owner` | medium | 16k / medium | 0.4 | Visión, backlog, priorización. Razonamiento sobre valor pero menos crítico que arquitectura. Temp algo más alta para creatividad de product. |

### Roles de implementación — `implementation` (7 roles)

Modelo: **Sonnet** (Anthropic) o **GPT-5-mini** (OpenAI).

| Rol | Reasoning | Thinking / Effort | Temp | Por qué |
|---|---|---|---|---|
| `tech-lead` | medium | 16k / medium | 0.2 | Liderazgo técnico, code reviews, decisiones de patterns. Razona sobre calidad y diseño de código. |
| `qa-lead` | medium | 16k / medium | 0.2 | Estrategia QA, métricas, prioriza casos de prueba. Decide cobertura y planes de test. |
| `developer-backend` | low | 4k / low | 0.2 | Implementa según diseño técnico aprobado. Razonamiento ligero por edge cases pero la spec ya está cerrada. |
| `developer-frontend` | low | 4k / low | 0.2 | Mismo patrón en UI, siguiendo wireframes y reglas de UX. |
| `dba` | low | 4k / low | 0.1 | Modelo de datos, queries, migraciones. Trabajo dirigido por specs; baja temp para consistencia en SQL/DDL. |
| `devops` | low | 4k / low | 0.1 | CI/CD, contenedores, despliegues. Procedural; baja temp para evitar variantes en pipelines/manifests. |
| `ux-designer` | low | 4k / low | 0.5 | Wireframes y layout. Trabajo creativo: temperatura alta para variedad en propuestas. |

### Roles mecánicos — `mechanical` (5 roles)

Modelo: **Haiku** (Anthropic) o **GPT-5-nano** (OpenAI). Optimiza velocidad/costo sobre razonamiento.

| Rol | Reasoning | Thinking / Effort | Temp | Por qué |
|---|---|---|---|---|
| `qa-functional` | none | — / minimal | 0.2 | Casos de prueba manuales, ejecución, reporte de defectos. Trabajo de volumen. |
| `qa-automation` | none | — / minimal | 0.2 | Genera test code repetitivo. Las decisiones de qué testear las toma `qa-lead`. |
| `qa-performance` | low | 4k / low | 0.1 | Único `mechanical` con reasoning: necesita interpretar resultados de pruebas de carga (latencias, throughput, percentiles). |
| `tech-writer` | none | — / minimal | 0.4 | Documentación técnica. Volumen alto, temperatura algo más alta para fluidez de redacción. |
| `change-manager` | none | — / minimal | 0.4 | Comunicación / change management. Volumen, foco en claridad, temperatura para tono más natural. |

---

## Resumen agregado

```
8 roles strategic       → Opus / GPT-5         (40%)
7 roles implementation  → Sonnet / GPT-5-mini  (35%)
5 roles mechanical      → Haiku / GPT-5-nano   (25%)

Reasoning levels:
- 6 roles high          (architects + orchestrator + business-analyst + system-designer)
- 4 roles medium        (PM, PO, tech-lead, qa-lead)
- 6 roles low           (developers, DBA, DevOps, UX, qa-performance)
- 4 roles none          (qa-functional/automation, tech-writer, change-manager)
```

Distribución de costo aproximada (assumiendo Anthropic):

- 40% del equipo (los strategic) usa el modelo más caro pero solo cuando hay decisiones complejas que justifican el thinking budget.
- 35% (implementation) usa el modelo balanceado, con thinking limitado a 4k–16k para no sobrecostar la implementación rutinaria.
- 25% (mechanical) usa el modelo más barato y rápido, sin thinking, donde se hace volumen sin razonamiento profundo.

---

## Tradeoffs considerados

### Por qué no usamos Opus para todo

- **Costo**: Opus cuesta varias veces más que Sonnet o Haiku por token. Para implementación rutinaria no aporta calidad proporcional al costo.
- **Latencia**: Opus tarda más en responder. Acumulado a lo largo de un proyecto, son horas perdidas en agentes que no necesitan razonamiento profundo.
- **Thinking budget**: 32k de thinking en cada agente sería abrumador. Un developer con 4k razona suficiente para escribir una función bien.

### Por qué no usamos Haiku para todo

- **Calidad de decisiones**: Las decisiones de un solution-architect pueden marcar el destino del proyecto entero. Ahorrar usando Haiku ahí compromete la base sobre la que se construye todo lo demás.
- **Razonamiento profundo**: Haiku no soporta thinking extendido. Un architect sin thinking tiende a decidir más rápido pero más superficialmente.

### Por qué reasoning ≠ tier

`reasoning` y `cognitive_tier` son ortogonales, aunque suelen correlacionar:

- Un rol `strategic` puede ser `medium` reasoning (PM, PO) si las decisiones son operativas más que técnicas.
- Un rol `implementation` puede ser `medium` reasoning (tech-lead, qa-lead) si decide patrones / estrategia.
- Un rol `mechanical` puede ser `low` reasoning (qa-performance) si necesita interpretar datos.

Esto permite ajustar el costo de thinking sin cambiar el tamaño del modelo.

---

## Cómo cambiar el mix

Tres niveles de override, en orden de impacto creciente:

### 1. Por proyecto: `modelOverrides` en `ProjectConfig`

Aplica solo a un proyecto generado, no cambia los YAML de roles. Útil cuando un proyecto tiene necesidades atípicas.

```ts
const config: ProjectConfig = {
  // ...
  provider: "anthropic",
  modelOverrides: {
    "developer-backend": { cognitive_tier: "strategic", reasoning: "high" },
    // este developer-backend específico usará Opus + 32k thinking
  },
};
```

> El wizard expondrá esto como pantalla de "edit per role" cuando se implemente la UI. Por ahora se usa programáticamente.

### 2. Por rol: editar `data/roles/<rol>.yaml`

Aplica a **todos** los proyectos generados a partir de ese momento. Útil cuando descubres que un rol estaba sobre/sub asignado.

```yaml
# data/roles/qa-automation.yaml
agent:
  cognitive_tier: implementation  # antes era "mechanical"
  reasoning: low                  # antes era "none"
```

Tras el cambio: `npm run validate` + `npm test` para asegurar consistencia.

### 3. Globalmente: editar `src/engine/model-mapping.ts`

Aplica al cambiar la familia de modelos (p.ej. cuando salga Opus 4.8). Una sola constante, ningún YAML de rol cambia.

```ts
export const PROVIDER_MODELS: Record<Provider, Record<CognitiveTier, string>> = {
  anthropic: {
    strategic: "anthropic/claude-opus-4-8",  // ← upgrade
    implementation: "anthropic/claude-sonnet-4-7",
    mechanical: "anthropic/claude-haiku-4-6",
  },
  // ...
};
```

Tras el cambio: corre los tests de `tests/unit/engine/model-mapping.test.ts` y `tests/integration/model-mix.test.ts` para verificar.

---

## Cuando salgan modelos nuevos

Lugar único de cambio: [`src/engine/model-mapping.ts`](../src/engine/model-mapping.ts).

```ts
// Cambia las constantes y los tests verifican que el mapeo sigue produciendo
// la forma esperada (model + thinking/reasoningEffort) para cada combinación.
export const PROVIDER_MODELS = { /* ... */ };
const ANTHROPIC_BUDGET = { /* ... */ };
const OPENAI_EFFORT = { /* ... */ };
```

Si el nuevo modelo introduce un parámetro nuevo (ej. una tercera dimensión más allá de thinking/reasoning), añade el campo al `ModelSpec` en `src/engine/types.ts` y al render del frontmatter en `templates/opencode/agent.md.hbs`.

---

## Cómo añadir un rol nuevo respetando este patrón

Cuando crees un rol en `data/roles/<rol>.yaml`, decide su `cognitive_tier` y `reasoning` con esta heurística:

- **¿Toma decisiones que afectan a otros roles?** → `strategic`. Si las decisiones tienen consecuencias irreversibles (arquitectura, seguridad, compliance) → `reasoning: high`. Si son operativas (planificación, priorización) → `reasoning: medium`.
- **¿Implementa según un diseño que ya está cerrado?** → `implementation`. Si decide patrones o ejerce juicio técnico → `reasoning: medium`. Si solo ejecuta → `reasoning: low`.
- **¿Hace volumen de trabajo repetitivo / mecánico?** → `mechanical`. Casi siempre `reasoning: none`. Solo `low` si necesita interpretar datos (como `qa-performance`).

Después: `npm run validate` + `npm test`. Los tests de integración verifican que el rol nuevo aparece con un modelo asignado en `opencode.json`.

---

## Referencias

- Código del mapeo: [`src/engine/model-mapping.ts`](../src/engine/model-mapping.ts)
- Tests del mapeo: [`tests/unit/engine/model-mapping.test.ts`](../tests/unit/engine/model-mapping.test.ts)
- Test de integración end-to-end: [`tests/integration/model-mix.test.ts`](../tests/integration/model-mix.test.ts)
- Cómo añadir un rol completo: [docs/guides/adding-roles.md](guides/adding-roles.md)
- Esquema YAML de roles: [docs/data-model.md](data-model.md)
