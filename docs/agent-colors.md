# Colores de los agentes en OpenCode

OpenCode soporta un campo `color` por agente que pinta su nombre en el TUI cuando se le delega trabajo. Abax Swarm asigna un color a cada agente generado bajo una política determinista para que (a) el orquestador siempre destaque, (b) los demás agentes sean fácilmente distinguibles entre sí, y (c) un mismo rol reciba el mismo color en cada regeneración.

La fuente de verdad del código vive en [`src/engine/color-resolver.ts`](../src/engine/color-resolver.ts).

## Política de asignación

El resolver aplica esta precedencia, de mayor a menor:

1. **Override explícito en el YAML** (`agent.color` del rol). Acepta hex (`"#ff6b6b"` — siempre entrecomillado) o claves del tema activo (`primary`, `secondary`, `accent`, `success`, `warning`, `error`, `info`).
2. **Orquestador** → `#dc143c` (crimson). Es el único rol con color reservado en código.
3. **Hash determinista** del `role.id` contra una paleta curada. djb2 → módulo de la paleta.

> Por qué hash determinista en vez de "siguiente color libre": el hash garantiza que el color de un rol nunca cambia cuando agregas o quitas otros roles. Una asignación tipo "primer slot disponible" rompería esa estabilidad.

## La paleta

24 colores hex vivos, distribuidos a lo largo del círculo cromático **excluyendo el rango rojo** (≈340°–20°) para que ningún agente se confunda con el orquestador. Lista actual (ver `AGENT_PALETTE` en el resolver para el orden canónico):

| Color | Hex | Aproximación de hue |
|---|---|---|
| Dark orange | `#ff8c00` | ~30° |
| Tomato | `#ff6347` | ~10° (saturación cálida) |
| Orange | `#ffa500` | ~38° |
| Gold | `#ffd700` | ~50° |
| Goldenrod | `#daa520` | ~43° |
| Dark khaki | `#bdb76b` | ~55° |
| Yellow green | `#9acd32` | ~80° |
| Lawn green | `#7cfc00` | ~90° |
| Lime green | `#32cd32` | ~120° |
| Medium spring green | `#00fa9a` | ~150° |
| Medium sea green | `#3cb371` | ~145° |
| Light sea green | `#20b2aa` | ~180° |
| Medium turquoise | `#48d1cc` | ~178° |
| Dark turquoise | `#00ced1` | ~181° |
| Cadet blue | `#5f9ea0` | ~180° (muted) |
| Deep sky blue | `#00bfff` | ~195° |
| Dodger blue | `#1e90ff` | ~210° |
| Royal blue | `#4169e1` | ~225° |
| Medium slate blue | `#7b68ee` | ~250° |
| Medium purple | `#9370db` | ~260° |
| Dark orchid | `#9932cc` | ~280° |
| Medium orchid | `#ba55d3` | ~290° |
| Orchid | `#da70d6` | ~300° |
| Hot pink | `#ff69b4` | ~330° |

## Cuándo overridear con `agent.color`

Casos válidos para fijar color explícito en el YAML del rol:

- **Convenciones de equipo**: quieres que `security-architect` sea siempre `error` (rojo de tema) para que destaque como "ojo aquí".
- **Romper una colisión accidental**: dos roles caen en el mismo slot del hash y los ves usados juntos a menudo. Setea `agent.color` en uno de ellos.
- **Adoptar el tema en vez de un hex**: prefieres `accent` para que se adapte al esquema visual del usuario.

Sintaxis (recuerda **siempre comillas** con hex por [sst/opencode#17118](https://github.com/sst/opencode/issues/17118)):

```yaml
# data/roles/security-architect.yaml
agent:
  cognitive_tier: strategic
  reasoning: high
  color: "error"   # tema; o "#ff4500" con comillas si prefieres hex
  # ... resto del bloque
```

## Pattern para roles nuevos

Cuando agregues un rol a `data/roles/<nuevo>.yaml`:

1. **No pongas `color` salvo que tengas razón explícita** — el resolver le asignará uno determinista de la paleta.
2. Si después de regenerar ves que comparte color con un rol cercano en el flujo (raro pero posible), añade `agent.color` al YAML del nuevo rol con un hex que no esté ya muy usado.
3. **No uses crimson (`#dc143c` ni similares)** — está reservado para el orquestador.

Si en el futuro la paleta se queda corta (más roles que entradas únicas), la solución correcta es ampliar `AGENT_PALETTE` en `src/engine/color-resolver.ts` con colores adicionales que respeten la regla "hue lejos del rojo, alta saturación".

## Verificación

Tests unitarios (`tests/unit/engine/color-resolver.test.ts`) garantizan: orquestador siempre crimson, override siempre gana, hash siempre estable, paleta excluye crimson. Tests de integración (`tests/integration/agent-colors.test.ts`) garantizan que el `opencode.json` y cada `.opencode/agents/*.md` emiten el color con el formato esperado (hex entrecomillado o clave de tema).
