# Gestion de dependencias y entorno local

Abax Swarm asume que cualquier proyecto generado debe poder ser ejecutado por un nuevo desarrollador sin adivinar que herramientas instalar. Para eso introduce **3 piezas coordinadas**:

1. El skill [`dependency-management`](../data/skills/dependency-management.yaml).
2. Un entregable bloqueante al inicio de fase Construccion: `env-verification`.
3. Un protocolo en el orquestador que **no permite avanzar** en Construccion hasta que el entorno este verificado.

## El problema que resuelve

Antes de 0.1.14, los agentes tecnicos no tenian instrucciones explicitas sobre verificar el runtime, declarar dependencias en el manifest del stack, o documentar el setup local. En la practica esto causaba:

- Builds fallando en fase Construccion porque faltaban Java/Maven/Node/etc.
- Codigo escrito que importaba librerias no declaradas en `pom.xml`/`package.json`.
- "Funciona en mi maquina" sin un `docs/setup.md` reproducible.
- Remediacion ad-hoc por el orquestador — peligrosa cuando termina ejecutando comandos destructivos en el SO del usuario.

## El skill `dependency-management`

Asignado a 5 roles tecnicos: `tech-lead`, `devops`, `developer-backend`, `developer-frontend`, `dba`.

Define un flujo de 6 pasos:

1. **Verificar runtime** del stack con el comando exacto (tabla por stack en el skill).
2. **Detectar entorno** (`/.dockerenv`, `$ABAX_ISOLATED`).
3. **Si falta runtime**: pedir aprobacion al usuario antes de instalar.
   - Dentro de container → `apt-get install` (seguro, solo afecta al container).
   - En host → gestores de version del usuario (sdkman, nvm, pyenv) — **nunca `sudo apt`**.
4. **Declarar dependencias** en el manifest del stack antes de escribir codigo que las use.
5. **Verificar build vacio** (`mvn validate`, `npm install --dry-run`, `cargo check`, etc.).
6. **Documentar setup local** en `docs/setup.md` con variantes "devcontainer" y "host".

## El entregable bloqueante `env-verification`

Definido en `data/rules/phase-deliverables.yaml` como el primer entregable de la fase `construction`:

```yaml
- id: env-verification
  name: Verificacion de entorno y dependencias
  responsible: devops          # o tech-lead si no hay devops en el equipo
  approver: tech-lead
  mandatory: true
  artifact_type: document
```

El agente produce `docs/entregables/fase-4-construccion/00-verificacion-entorno.md` con:
- Versiones detectadas del runtime requerido.
- Si falto algo: comando exacto que se ejecuto (con aprobacion del usuario), o bloqueo escalado.
- Resultado de la verificacion minima de build.
- Referencia al `docs/setup.md` actualizado.

## El protocolo en el orquestador

El template del orquestador (en ambos targets, OpenCode y Claude) incluye una seccion:

> **Protocolo de inicio de fase Construccion**
>
> Cuando entres a la fase Construccion, antes de delegar cualquier entregable
> (source-code, unit-tests, etc.), el primer entregable obligatorio es
> `env-verification`.
>
> **Bloqueante**: NO delegar ningun otro entregable de Construccion hasta que
> `env-verification` este completado y aprobado por tech-lead.

## La interaccion con permisos y aislamiento

Las 3 piezas (skill + entregable + protocolo) se complementan con:

- El **modo de permisos `recommended`** (ver [permissions.md](permissions.md)) deniega `rm /var/lib/dpkg/*` y pone `apt *` en `ask` cuando estamos en host. Esto impide que el agente caiga en remediaciones destructivas.
- El **aislamiento `devcontainer`** (ver [guides/dev-environments.md](guides/dev-environments.md)) preinstala el runtime via Dev Container Features, asi que en muchos casos el `env-verification` pasa al primer intento.

## Como personalizarlo

- **Anadir un nuevo stack**: actualiza la tabla `comandos-por-stack` en el skill `dependency-management.yaml` con el comando de verificacion, manifest, install, run.
- **Cambiar el responsable**: edita `responsible` del entregable `env-verification` en `phase-deliverables.yaml`.
- **Anadir un check adicional**: extiende la lista de pasos en `instructions:` del skill.

## Tests que garantizan la coherencia

`tests/integration/permissions-isolation.test.ts` verifica:
- El skill existe y referencia los 5 roles esperados.
- El entregable `env-verification` esta como **primer** elemento de `construction`.
- El template del orquestador (OpenCode) emite el "Protocolo de inicio de fase Construccion".
- El skill se incluye automaticamente en el contexto generado.
