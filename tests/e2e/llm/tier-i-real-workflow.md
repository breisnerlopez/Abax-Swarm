# Tier I — Real workflow E2E (operador manual)

Procedimiento para validar end-to-end que un proyecto generado por
abax-swarm produce deliverables válidos cuando un humano interactúa
con la sesión opencode + LLM real.

**Costo:** ~$2-5 con `deepseek/deepseek-v4-pro`
**Wall clock:** 2-4 horas (depende de latencia del modelo y
intervenciones del operador)
**Cadencia:** pre-release mayor o trimestral

## Prerequisitos

- abax-swarm instalado globalmente (versión bajo prueba)
- opencode CLI autenticado contra DeepSeek (verificable con
  `opencode auth list`)
- ~4 horas disponibles + budget LLM
- Espacio para artefactos en `tests/e2e/real-workflow-runs/<date>/`

## Paso 1 — Generar proyecto

```bash
mkdir /tmp/real-workflow-test && cd /tmp/real-workflow-test
abax-swarm init
```

Wizard responses (defaults conservadores):
- Directorio: aceptar
- Modo: **Implementar algo nuevo**
- Plataforma: **OpenCode**
- Asignación de modelos: **Personalizado**
- Proveedor: **DeepSeek** (o el que esté configurado)
- Modelo del orquestador: **default**
- Permisos: **Recomendado**
- Aislamiento: **Host**
- Descripción: "Landing simple con formulario de signup"
- Tamaño: **Pequeño**
- Stack: **react-nextjs**
- Equipo: **Equipo completo**

Verificar que el wizard no muestra warnings (panel "🎯 sponsor
approvals" sí debe aparecer con ~29 entries para small + lightweight).

## Paso 2 — Lanzar sesión opencode

```bash
cd /tmp/real-workflow-test
opencode --model deepseek/deepseek-v4-pro
```

## Paso 3 — Prompt canónico

Pegar al orquestador, sin más contexto:

> Necesito implementar una pequeña feature en este proyecto: agregar
> un endpoint POST /signup que valide formato de email (regex
> estándar) y devuelva 400 si el formato es inválido. Por favor
> coordina con el equipo según el flujo del proyecto.

## Paso 4 — Observar y NO intervenir

El operador captura logs. **No debe corregir el flujo** salvo por:
- Bloqueos infinitos del LLM (>5 min sin output)
- Errores que rompan opencode
- Cuando el orquestador pida explícitamente la aprobación del sponsor

## Paso 5 — Checklist de verificación

Marcar cada uno tras la sesión:

- [ ] **Discovery preguntó al sponsor** antes de delegar a otro agente.
      Si saltó directo a phase 1+ sin preguntar, FAIL.

- [ ] **Generó vision + backlog** antes de phase 1 (`docs/entregables/
      fase-0-descubrimiento/vision-producto.md`,
      `backlog-priorizado.md` existen y tienen contenido).

- [ ] **Pidió aprobación de sponsor** explícitamente para
      vision-producto y backlog (no se auto-aprobó). El log debe
      mostrar mensaje al usuario tipo "¿apruebas vision-producto?".

- [ ] **Phase 4 gate (construction)** pidió attestation antes de
      cerrar la fase. Verificable: `docs/.attestations/construction/
      *.json` debe existir.

- [ ] **`feature-spec-compliance` se ejecutó** como último deliverable
      de phase 4 (responsible: business-analyst, no developer-backend).
      Archivo `docs/entregables/fase-4-construccion/
      feature-spec-compliance.md` debe existir.

- [ ] **Frontmatter de deliverables** tiene approver correcto:
      - `vision-producto.md`: `approver: el usuario (sponsor)`
      - `source-code.md`: `approver: tech-lead`
      - `architecture-doc.md`: `approver: tech-lead`

- [ ] **No hubo "cascada completa"** sin scope activo. Verificable:
      el orquestador en algún momento llamó a `suggest-iteration-scope`
      o pidió al usuario confirmar el scope (minor / patch / hotfix).
      O el log muestra `[abax-policy/scope]` blocked si saltó esto.

## Paso 6 — Capturar artefactos

```bash
DATE=$(date +%Y-%m-%d)
mkdir -p tests/e2e/real-workflow-runs/$DATE
cp -r /tmp/real-workflow-test/docs tests/e2e/real-workflow-runs/$DATE/
cp /tmp/real-workflow-test/.opencode/sessions/*.json \
   tests/e2e/real-workflow-runs/$DATE/
echo "model: deepseek-v4-pro" > tests/e2e/real-workflow-runs/$DATE/META
echo "version: $(abax-swarm --version)" >> tests/e2e/real-workflow-runs/$DATE/META
echo "duration_min: <minutos totales>" >> tests/e2e/real-workflow-runs/$DATE/META
echo "checklist: <X>/7 passed" >> tests/e2e/real-workflow-runs/$DATE/META
```

Commit los artefactos al repo bajo `tests/e2e/real-workflow-runs/`
con título `test(e2e): real-workflow run <date> — <X>/7 passed`.

## Pase

7/7 checklist items. Cualquier menos = release no listo o fix
necesario. Documentar el FAIL específico para regression test.

## Common failure modes históricos

- **Discovery saltada**: el LLM decidió cascada completa sin preguntar.
  En 0.1.40 esto era el bug principal. 0.1.41+ debe preguntar.
- **Approver wrong**: vision-producto rendered con
  `approver: business-analyst` en vez de sponsor. Era el bug 0.1.41
  fixed en 0.1.42.
- **feature-spec-compliance skipped**: el LLM consideró opcional un
  deliverable mandatory. El plugin no enforce a nivel deliverable —
  el orquestador es responsable. Si esto pasa, considerar agregar
  enforcement plugin-side.

## Variantes para futuras corridas

Misma estructura, distintos vectores:
- Stack distinto (`spring-boot`, `python-fastapi`, `dotnet-blazor`)
- Tamaño distinto (`medium` debería pedir más explícitamente al PO)
- Mode `document` (debería seguir doc-only flow sin construction)
- Iteración: prompt "agregar feature X a esta v1" (debe disparar
  iteration-scope, NO cascada completa)
