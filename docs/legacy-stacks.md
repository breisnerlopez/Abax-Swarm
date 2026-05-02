# Stack `legacy-other` y deteccion de sistemas legacy

## El bug que motivo este sistema

El wizard de Abax Swarm tenia un fallback silencioso: cuando el detector no reconocia el stack del proyecto y el usuario presionaba "Continuar sin stack adapter", el sistema asignaba **`angular-springboot`** como neutral por defecto. El comentario en el codigo decia "agents won't get stack_overrides applied" pero eso no era cierto — los aplicaba.

Consecuencia practica: si un usuario aplicaba modo `document` sobre un proyecto **Java Swing**, **VB6**, **PHP clasico**, **Cobol** o **Delphi**, el orquestador delegaba al business-analyst con prompts adaptados a Spring Boot. El BA documentaba "controllers REST" cuando el sistema real eran event listeners de `JFrame`, `.frm` forms con codigo en eventos, o mezclas de HTML+PHP. Salida convincente, base falsa — el equivalente al incidente Abax-Memory pero en la capa de documentacion.

## La respuesta: 3 piezas coordinadas

| Pieza | Donde vive | Que hace |
|---|---|---|
| Stack `legacy-other` | `data/stacks/legacy-other.yaml` | Placeholder con `role_context` cauteloso para los 12 roles tecnicos. Le dice a cada agente "el stack no esta modelado, NO asumas patrones modernos, INFIERE del codigo" |
| 3 detectores nuevos | `src/engine/stack-detector.ts` | Detectan PHP (composer.json + framework, o .php sueltos), Java desktop (pom.xml/gradle con JavaFX/Swing/AWT y sin web framework, o .java importando javax.swing), VB6 (.vbp / .frm / .bas+.cls). Mapean a `legacy-other` con evidencia descriptiva |
| Fix del fallback | `src/cli/WizardApp.tsx` | Reemplaza la opcion silenciosa "Continuar sin stack adapter" con "Usar Stack legacy o no soportado". Muestra mensaje explicito recomendando legacy-other para sistemas legacy |

## Como funciona el `role_context` cauteloso

Cada uno de los 12 roles tecnicos recibe en su prompt de stack la advertencia adaptada a su disciplina. Ejemplos:

- **developer-backend**: "NO asumas frameworks modernos (controllers REST, ORM, DI, async). INFIERE convenciones leyendo el codigo. REPORTA al orquestador antes de aplicar comandos modernos como `npm`/`mvn`/`docker`."
- **dba**: "NO asumas ORM (Hibernate, Prisma, EF Core). El acceso a datos puede ser SQL inline, stored procedures, archivos planos. INFIERE el patron leyendo el codigo: `PreparedStatement`, `mysql_query`, `ADODB.Recordset`."
- **devops**: "Probablemente NO hay CI/CD moderno, NO hay Docker. El deploy puede ser FTP/SCP, `setup.exe`, o IIS clasico. NO asumas Dockerfile como punto de partida."
- **solution-architect**: "Patrones modernos (Clean Architecture, DDD, microservicios) probablemente NO aplican. PRIMERO documenta lo que existe antes de proponer rediseño. Un VB6 monolitico de 200 forms NO se 'microserviza' en una iteracion."
- **security-architect**: "Riesgos tipicos: SQL injection, XSS, contraseñas en texto plano, dependencias EOL sin patches. PRIMERO mapea dependencias y su estado de soporte. Para modo document: documenta hallazgos sin proponer remediacion forzada."

## Que detectan los nuevos detectores

### PHP

- **`composer.json` con framework conocido** (Laravel, Symfony, CakePHP, CodeIgniter, Yii, Slim) → "PHP detectado: composer.json declara `<framework>` (stack legacy no modelado)"
- **`composer.json` sin framework** → "PHP detectado: composer.json sin framework moderno conocido"
- **Archivos `.php` en raiz sin composer.json** → "PHP detectado: archivos .php en raiz sin composer.json"

### Java desktop

- **`pom.xml`/`build.gradle` con JavaFX/Swing/MigLayout/FlatLaf y SIN spring-boot/quarkus/micronaut** → "Java desktop detectado: build file con dependencias JavaFX/Swing y sin framework web"
- **Archivo `.java` importando `javax.swing`/`java.awt`/`javafx.*`** (escaneo bounded a 50 archivos top-level + Maven layout) → "Java desktop detectado: `<file>` importa libreria de UI desktop"

### VB6

- **`.vbp` project file** → "VB6 detectado: archivo de proyecto `<MyApp.vbp>`"
- **`.frm` forms en raiz** O **`.bas` modulos + `.cls` clases** → "VB6 detectado: archivos .frm/.bas/.cls en raiz"

## Por que mapear a `legacy-other` y NO crear un stack por cada legacy

Crear `php-laravel`, `java-swing`, `vb6` como stacks de primera clase requeriria mantener `role_context` detallado para cada uno (12 roles × 3 stacks = 36 prompts), mas detectores con falsos positivos a vigilar. **El valor marginal es bajo**: la mayoria de proyectos Abax sobre legacy son de **modo document** (inventario), no de **modo new** (construccion). Los prompts cautelosos comunes son suficientes para que el equipo pregunte antes de inventar.

Si en el futuro hay demanda real de `php-laravel` como stack moderno (con tests Pest, Octane, etc.), promover la deteccion a un stack propio es trivial — el detector ya existe, solo cambia el `stackId` que devuelve.

## Prioridad: stacks modernos siempre ganan

Los 3 detectores legacy estan al **final** de `RULES`. Si un repo tiene `composer.json` con Laravel **y** `package.json` con Next.js (caso real: app PHP en migracion incremental), gana `react-nextjs`. La regla: **modernidad explicita > legacy implicito**.

Cubierto por el test `regression: modern stacks still win over legacy when signals coexist` en `tests/integration/legacy-stack.test.ts`.

## Sin fallback silencioso

El test `regression: no silent fallback to angular-springboot` lee el codigo fuente de `WizardApp.tsx` y verifica que **no existe** un `setData(...stackId: "angular-springboot")` fuera de comentarios en el bloque `case "stack-detected"`. Si alguien re-introduce el bug accidentalmente, el test falla en CI con mensaje accionable.

## Como añadir mas detectores legacy en el futuro

Añade una entrada al final de `RULES` en `src/engine/stack-detector.ts` con `stackId: "legacy-other"` y un `match` que detecte señales del stack (extension de archivo, dependencia en lockfile, magic bytes en config). Añade un fixture en `tests/integration/legacy-stack.test.ts` siguiendo el patron de PHP/Swing/VB6.

NO hace falta tocar `data/stacks/legacy-other.yaml` ni los `stack_overrides` de los 12 roles — el contexto cauteloso ya esta listo para todo lo que entre.

## Ver tambien

- `docs/quality-gates.md` — Las 3 capas anti-mock que motivaron este patron de cautela
- `docs/role-boundaries.md` — Matriz maestra de roles
- `data/stacks/legacy-other.yaml` — Placeholder con role_context completo
- `src/engine/stack-detector.ts` — Detectores y orden de prioridad
- `tests/integration/legacy-stack.test.ts` — 26 tests cubriendo deteccion + pipeline + regresion
