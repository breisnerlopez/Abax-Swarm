# Convención de nombres en código (inglés obligatorio)

## El síntoma reportado

> *"los equipos técnicos o en general los internals del sistema como variable Endpoints parámetros deben estar siempre en inglés, me ha dado un mix en algunos escenarios que no debe volver a suceder"*

Hasta 0.1.24 el repo declaraba la regla en `CLAUDE.md` ("Code in English, UI/content in Spanish") pero los **propios skills que el agente lee** la contradecían con ejemplos en español:

- `coding-standards` mostraba clases como `OrdenCompra`, `UsuarioServicio`; variables `cantidadItems`, `fechaCreacion`; constantes `MAX_INTENTOS`, `TIMEOUT_SEGUNDOS`.
- `backend-implementation` daba endpoints `/api/v1/usuarios`, `/api/v1/ordenes`.
- `unit-testing` tenía un nombre de test ejemplo `calcularDescuento_montoMayorA1000_retorna10Porciento`.

Cuando un agente leía estos skills, internalizaba que era aceptable mezclar — y propagaba la mezcla a los proyectos cliente. La regla en CLAUDE.md no llegaba al agente; los ejemplos sí.

## La respuesta: skill explícita + corrección de fuentes + guard rail

### 1. Skill `code-naming-convention` (nueva, asignada a 8 roles)

Regla no-negociable con tabla exhaustiva de **qué identificadores deben estar en inglés**:

| Tipo de identificador | Ejemplo correcto | Ejemplo INCORRECTO |
|---|---|---|
| Clases / types / interfaces | `class Order`, `interface UserRepository` | `class OrdenCompra`, `interface RepositorioUsuario` |
| Funciones / métodos | `calculateTotal()`, `getUser()`, `findByEmail()` | `calcularTotal()`, `obtenerUsuario()`, `buscarPorCorreo()` |
| Variables locales | `const itemCount`, `let totalAmount` | `const cantidadItems`, `let montoTotal` |
| Constantes | `MAX_RETRIES`, `TIMEOUT_SECONDS`, `DEFAULT_PAGE_SIZE` | `MAX_INTENTOS`, `TIMEOUT_SEGUNDOS`, `TAMANO_PAGINA_DEFAULT` |
| Atributos / propiedades de modelo | `firstName`, `createdAt`, `isActive` | `nombreCompleto`, `fechaCreacion`, `estaActivo` |
| Endpoints REST | `/api/v1/users`, `/api/v1/orders/{id}/items` | `/api/v1/usuarios`, `/api/v1/pedidos/{id}/articulos` |
| Query parameters | `?page=1&pageSize=20&sortBy=createdAt` | `?pagina=1&tamano=20&ordenarPor=fechaCreacion` |
| Path parameters | `/users/{userId}/orders/{orderId}` | `/usuarios/{idUsuario}/pedidos/{idPedido}` |
| Headers HTTP custom | `X-Request-Id`, `X-Tenant-Id` | `X-Id-Solicitud`, `X-Id-Inquilino` |
| Tablas SQL | `users`, `orders`, `order_items` | `usuarios`, `pedidos`, `articulos_pedido` |
| Columnas SQL | `id`, `email`, `created_at`, `is_active` | `correo`, `fecha_creacion`, `esta_activo` |
| Env vars | `DATABASE_URL`, `JWT_SECRET`, `LOG_LEVEL` | `URL_BASE_DATOS`, `SECRETO_JWT`, `NIVEL_LOGS` |
| Claves JSON/YAML | `{"firstName": "..."}`, `apiKey: ...` | `{"primerNombre": "..."}`, `claveApi: ...` |
| Branches git | `feature/user-onboarding`, `bugfix/login-redirect` | `feature/registro-usuario`, `bugfix/redireccion-login` |
| Archivos de código | `OrderService.ts`, `user.repository.ts` | `ServicioPedido.ts`, `usuario.repositorio.ts` |
| Tests | `describe("Order")`, `it("should calculate total")` | `describe("Pedido")`, `it("debe calcular total")` |

**Qué SÍ puede ir en español** (o en el idioma del proyecto):
- Comments en código.
- Strings destinados al usuario final (vía i18n).
- Mensajes de log de negocio (las KEYS son inglés; el valor puede ser español).
- Nombres de presentaciones, entregables, archivos `docs/`.

Asignada a 8 roles que escriben/revisan código: `developer-backend`, `developer-frontend`, `dba`, `tech-lead`, `solution-architect`, `integration-architect`, `security-architect`, `qa-automation`.

### 2. Excepciones documentadas

Cuatro casos donde la regla admite excepción legítima:

1. **Términos de dominio sin traducción** (RUC, CURP, BSN, NIE) — se mantienen en su forma original o se mapean al equivalente internacional (`taxId`, `nationalId`, `VAT`, `IBAN`, `SWIFT`).
2. **Bases de datos legacy con tablas en español** — NO renombrar para "limpiar"; mapear desde código nuevo en inglés:
   ```typescript
   @Entity({ name: "usuarios" })  // tabla legacy
   class User {                   // nombre lógico EN INGLÉS
     @Column({ name: "correo" })  // columna legacy
     email: string;               // propiedad EN INGLÉS
   }
   ```
3. **APIs públicas con consumidores existentes** — versionar (`/api/v1/usuarios` legacy + `/api/v2/users` nueva).
4. **Códigos de error vs mensajes de UI**:
   ```typescript
   throw new AppError({
     code: "USER_NOT_FOUND",            // inglés
     message: "Usuario no encontrado",  // español para UI
   });
   ```

Cada excepción debe quedar en `docs/decisions/NNNN-naming-exception-<slug>.md` y citarse en el README del proyecto cliente.

### 3. Skills corregidos

| Skill | Antes | Después |
|---|---|---|
| `coding-standards` | Ejemplos en español (`OrdenCompra`, `cantidadItems`, `MAX_INTENTOS`) | Ejemplos en inglés + cita a `code-naming-convention` |
| `backend-implementation` | `/api/v1/usuarios`, `/api/v1/ordenes` | `/api/v1/users`, `/api/v1/orders` + path params en inglés |
| `unit-testing` | `calcularDescuento_montoMayorA1000_retorna10Porciento` | `calculateDiscount_amountOver1000_returns10Percent` |

### 4. Guard rail automatizado

Test `tests/integration/code-naming-convention.test.ts` que escanea **todos los YAMLs en `data/`** buscando dos patrones de mezcla:

- **Identificadores backtick-quoted** (`\`obtenerUsuario\``, `\`OrdenCompra\``) que combinan verbos/nombres españoles con camelCase/PascalCase.
- **URLs reales** (con prefijo `/api/v\d/` o después de un verbo HTTP) cuyo segmento es un nombre español plural típico (`usuarios`, `pedidos`, `clientes`).

Si encuentra coincidencias, falla CI con reporte exacto:
```
data/skills/foo.yaml:42
  - example: GET /api/v1/usuarios/{userId}
  HTTP verb URL uses Spanish "usuarios". Use English equivalent (users, orders, etc.).
```

**EXEMPT_FILES**: solo dos archivos pueden contener identificadores españoles legítimamente — `code-naming-convention.yaml` (donde están los ejemplos negativos pedagógicos) y `role-boundaries.yaml` (donde aparecen placeholders españoles como `<rol-correcto>`).

El test también valida que el regex no produzca **falsos positivos** sobre los ejemplos canónicos en inglés (sentinel test sintético).

### 5. Sanity check del guard rail

Inyectando temporalmente `GET /api/v1/usuarios/{userId}` en `data/skills/api-design.yaml`, el guard fallaba en CI con mensaje accionable; al restaurar, volvía a verde. Cubierto en el test plan del PR.

## Cómo añadir una excepción legítima en el futuro

1. Verificar que la excepción cabe en una de las 4 categorías documentadas.
2. Crear `docs/decisions/NNNN-naming-exception-<slug>.md` con justificación, alcance exacto, qué sigue en inglés a pesar de la excepción, y plan de migración (o por qué es permanente).
3. Si la excepción aparece en un YAML de `data/`, añadir el archivo a `EXEMPT_FILES` en `tests/integration/code-naming-convention.test.ts` con un comentario explicando.
4. Mencionar la excepción en el README del proyecto cliente (sección "Convenciones") para que nuevos developers no se sorprendan.

## Cómo detectar mezclas en un codebase existente

Patrones de búsqueda regex (ajustar al stack), incluidos en la guía `como-detectar-mezclas` de la skill:

```bash
# TypeScript/JavaScript: identificadores camelCase con palabras españolas comunes
grep -rEn 'cantidad|fecha|usuario|cliente|pedido|factura|articulo|producto|orden|nombre|apellido|correo|telefono|direccion|monto|valor|moneda|precio|calcular|obtener|listar|crear|borrar|eliminar|guardar|actualizar|verificar|validar|enviar|recibir|consultar' src/ \
  --include='*.ts' --include='*.tsx' --include='*.js'

# Endpoints en español
grep -rEn '/(usuarios|pedidos|clientes|facturas|productos|articulos|ordenes)' src/ data/

# Tablas SQL en español (en migrations/schemas)
grep -rEn 'CREATE TABLE (usuarios|pedidos|clientes|facturas|productos|articulos|ordenes)' migrations/ schema/ db/

# Env vars en español
grep -rEn '^(URL_|CLAVE_|TOKEN_|SECRETO_|CONFIGURACION_|PARAMETRO_)[A-Z_]+' .env* deployment/ k8s/
```

Reportar al orquestador en formato matriz; **no modificar tablas/APIs públicas legacy sin plan de migración explícito y aprobado por sponsor**.

## Coordinación con guard rails existentes

- **`role-boundaries`**: el tech-lead es el approver del code review; aplica esta convención como sub-criterio.
- **`anti-mock-review`**: el escaneo de patrones sospechosos del tech-lead ahora también incluye identificadores en español como anti-pattern.
- **`coding-standards`**: ya no contradice — sus ejemplos canónicos son en inglés y cita esta skill como fuente.
- **`documentation-quality-bar`**: el "idioma consistente" del entregable de docs incluye respetar esta convención al citar identificadores.

## Ver también

- `data/skills/code-naming-convention.yaml` — definición completa de la skill
- `tests/integration/code-naming-convention.test.ts` — guard rail con sanity tests
- `docs/quality-gates.md` — las 3 capas anti-mock que motivaron este patrón sistemático
- `docs/role-boundaries.md` — quién aprueba qué
- `CLAUDE.md` — sección "Conventions" actualizada con la regla
