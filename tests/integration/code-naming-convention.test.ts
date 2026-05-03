import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { loadDataContext } from "../../src/cli/data-context.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import type { DataContext, ProjectConfig } from "../../src/engine/types.js";

let ctx: DataContext;

beforeAll(() => {
  ctx = loadDataContext();
});

// ===========================================================================
// SKILL — code-naming-convention
// ===========================================================================
describe("code-naming-convention skill: content and structure", () => {
  it("exists and references the user-reported incident", () => {
    const skill = ctx.skills.get("code-naming-convention");
    expect(skill).toBeDefined();
    // Skill must mention English-only and the user-reported trigger
    expect(skill!.description).toMatch(/ingles|english/i);
    expect(skill!.description).toMatch(/incidente|usuarios.*cantidadItems|mix/i);
  });

  it("enumerates all identifier types that must be in English", () => {
    const skill = ctx.skills.get("code-naming-convention")!;
    const txt = skill.content.instructions;
    const types = [
      /Clases.*types/i,
      /Funciones.*metodos/i,
      /Variables locales/i,
      /Constantes/i,
      /Endpoints REST/i,
      /Query parameters/i,
      /Path parameters/i,
      /Headers HTTP/i,
      /Tablas SQL/i,
      /Columnas SQL/i,
      /Env vars/i,
      /Claves JSON\/YAML/i,
      /Branches git/i,
      /Tests/i,
    ];
    for (const re of types) {
      expect(txt, `missing identifier type ${re.source}`).toMatch(re);
    }
  });

  it("documents legitimate exceptions (legacy DB, domain terms, public APIs)", () => {
    const skill = ctx.skills.get("code-naming-convention")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/legacy/i);
    expect(txt).toMatch(/RUC|CURP|VAT|IBAN|SWIFT/);
    expect(txt).toMatch(/APIs publicas/i);
  });

  it("includes a pre-merge checklist", () => {
    const skill = ctx.skills.get("code-naming-convention")!;
    expect(skill.content.instructions).toMatch(/Checklist pre-merge/);
    expect(skill.content.instructions).toMatch(/\[ \] Todas las clases nuevas/i);
  });

  it("includes per-stack guidance and detection guide", () => {
    const skill = ctx.skills.get("code-naming-convention")!;
    const guideNames = (skill.content.guides ?? []).map((g) => g.name);
    expect(guideNames).toContain("por-stack");
    expect(guideNames).toContain("como-detectar-mezclas");
    expect(guideNames).toContain("excepciones-documentadas");
  });

  it("is wired to all 8 code-touching roles", () => {
    const skill = ctx.skills.get("code-naming-convention")!;
    const expected = [
      "developer-backend",
      "developer-frontend",
      "dba",
      "tech-lead",
      "solution-architect",
      "integration-architect",
      "security-architect",
      "qa-automation",
    ];
    expect(skill.used_by).toEqual(expect.arrayContaining(expected));
    for (const roleId of expected) {
      const role = ctx.roles.get(roleId)!;
      expect(role.skills, `${roleId} does not declare code-naming-convention`).toContain("code-naming-convention");
    }
  });
});

// ===========================================================================
// CORRECTED SKILLS — coding-standards and backend-implementation no longer mix
// ===========================================================================
describe("coding-standards skill: examples are now in English", () => {
  it("classes example uses English names", () => {
    const skill = ctx.skills.get("coding-standards")!;
    const txt = skill.content.instructions;
    expect(txt).toMatch(/`Order`|`UserRepository`|`PaymentService`/);
  });

  it("does NOT use the old Spanish examples", () => {
    const skill = ctx.skills.get("coding-standards")!;
    const txt = skill.content.instructions;
    // Sentinel — these specific identifiers were the original mix
    expect(txt).not.toMatch(/`OrdenCompra`/);
    expect(txt).not.toMatch(/`UsuarioServicio`/);
    expect(txt).not.toMatch(/`calcularTotal`/);
    expect(txt).not.toMatch(/`obtenerUsuario`/);
    expect(txt).not.toMatch(/`cantidadItems`/);
    expect(txt).not.toMatch(/`fechaCreacion`/);
    expect(txt).not.toMatch(/`MAX_INTENTOS`/);
    expect(txt).not.toMatch(/`TIMEOUT_SEGUNDOS`/);
  });

  it("references code-naming-convention as the authoritative source", () => {
    const skill = ctx.skills.get("coding-standards")!;
    expect(skill.content.instructions).toMatch(/code-naming-convention/);
  });
});

describe("backend-implementation skill: REST examples are now in English", () => {
  it("endpoint examples are now in English (no /usuarios, /ordenes)", () => {
    const skill = ctx.skills.get("backend-implementation")!;
    const txt = JSON.stringify(skill.content);
    expect(txt).not.toMatch(/\/api\/v1\/usuarios/);
    expect(txt).not.toMatch(/\/api\/v1\/ordenes/);
    expect(txt).toMatch(/\/api\/v1\/users/);
    expect(txt).toMatch(/\/api\/v1\/orders/);
  });

  it("references code-naming-convention", () => {
    const skill = ctx.skills.get("backend-implementation")!;
    expect(JSON.stringify(skill.content)).toMatch(/code-naming-convention/);
  });
});

// ===========================================================================
// GUARD RAIL — scans ALL data YAMLs for Spanish identifiers in code examples
// ===========================================================================
//
// This catches future regressions. If someone adds a YAML with a code example
// like `crearUsuario()` or `/api/usuarios`, this test fails in CI with the
// exact line and a suggestion.
//
// Scope: backtick-quoted identifiers AND URL paths in /code-blocks.
// Out of scope: prose words like "el usuario debe..." in instructions —
// those are documentation, not code.
// ---------------------------------------------------------------------------

const SPANISH_VERBS = [
  "calcular", "obtener", "listar", "crear", "borrar", "eliminar", "guardar",
  "actualizar", "verificar", "validar", "enviar", "recibir", "consultar",
  "notificar", "iniciar", "terminar", "registrar", "buscar", "asignar",
  "procesar", "generar", "imprimir",
];

const SPANISH_NOUNS = [
  "usuario", "cliente", "pedido", "factura", "articulo", "producto", "orden",
  "pago", "categoria", "catalogo", "carrito", "compra", "venta", "envio",
  "direccion", "telefono", "correo", "nombre", "apellido", "edad", "fecha",
  "hora", "monto", "moneda", "precio", "cantidad", "valor",
];

const SPANISH_ENDPOINTS_TABLES = [
  "usuarios", "clientes", "pedidos", "facturas", "productos", "articulos",
  "ordenes", "categorias", "catalogos", "carritos", "compras", "ventas",
];

// Files where Spanish identifiers ARE legitimate (this skill's own examples,
// the role-boundaries skill explaining a Spanish UI scenario, etc.)
const EXEMPT_FILES = new Set([
  "data/skills/code-naming-convention.yaml",  // contains the negative examples
  "data/skills/role-boundaries.yaml",          // mentions @rol-correcto, etc. as Spanish placeholders
]);

function listYamlFiles(dir: string, results: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listYamlFiles(full, results);
    else if (entry.name.endsWith(".yaml")) results.push(full);
  }
  return results;
}

interface Mix {
  file: string;
  line: number;
  text: string;
  reason: string;
}

function scanForCodeExampleMixes(filePath: string): Mix[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const mixes: Mix[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern 1: backtick-quoted identifiers with Spanish verbs/nouns combined as camelCase or PascalCase
    // e.g., `obtenerUsuario`, `OrdenCompra`, `cantidadItems`
    const backtickMatches = line.matchAll(/`([a-zA-Z_][a-zA-Z0-9_]*)`/g);
    for (const m of backtickMatches) {
      const ident = m[1];
      // Skip pure-uppercase short tokens (likely acronyms)
      if (/^[A-Z]{2,5}$/.test(ident)) continue;
      // Skip very short tokens
      if (ident.length < 6) continue;
      const lower = ident.toLowerCase();
      const hasSpanishVerb = SPANISH_VERBS.some((v) => lower.startsWith(v) && lower.length > v.length && /[A-Z]/.test(ident.charAt(v.length)));
      const hasSpanishNoun = SPANISH_NOUNS.some((n) =>
        lower.includes(n) && (lower !== n) && /[A-Z]/.test(ident),
      );
      if (hasSpanishVerb || hasSpanishNoun) {
        mixes.push({
          file: filePath,
          line: i + 1,
          text: line.trim().slice(0, 100),
          reason: `Identifier \`${ident}\` mixes Spanish words with code naming. Use English equivalent.`,
        });
      }
    }

    // Pattern 2: URL paths with Spanish plural nouns
    // Only match when the path is a REAL URL: must have /api/vN/ prefix OR
    // appear after an HTTP verb (GET|POST|...). Plain text like
    // "extensiones/clientes" does not qualify.
    const apiUrlMatches = line.matchAll(/\/api\/v\d+\/([a-z][a-z0-9-]*)/g);
    for (const m of apiUrlMatches) {
      const segment = m[1];
      if (SPANISH_ENDPOINTS_TABLES.includes(segment)) {
        mixes.push({
          file: filePath,
          line: i + 1,
          text: line.trim().slice(0, 100),
          reason: `URL path uses Spanish "${segment}". Use English equivalent (users, orders, etc.).`,
        });
      }
    }
    const verbUrlMatches = line.matchAll(/\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\/([a-z][a-z0-9-]*)/g);
    for (const m of verbUrlMatches) {
      const segment = m[2];
      if (SPANISH_ENDPOINTS_TABLES.includes(segment)) {
        mixes.push({
          file: filePath,
          line: i + 1,
          text: line.trim().slice(0, 100),
          reason: `HTTP verb URL uses Spanish "${segment}". Use English equivalent (users, orders, etc.).`,
        });
      }
    }
  }

  return mixes;
}

describe("guard rail: no Spanish identifiers in YAML code examples", () => {
  it("scans all data/*.yaml and finds zero Spanish-mixed identifiers (excluding exempt files)", () => {
    const dataDir = join(__dirname, "..", "..", "data");
    const files = listYamlFiles(dataDir);
    const allMixes: Mix[] = [];
    for (const file of files) {
      const relativePath = file.slice(file.indexOf("data/"));
      if (EXEMPT_FILES.has(relativePath)) continue;
      allMixes.push(...scanForCodeExampleMixes(file));
    }
    if (allMixes.length > 0) {
      const report = allMixes
        .map((m) => `  ${m.file.replace(/.*\/data/, "data")}:${m.line}\n    ${m.text}\n    ${m.reason}`)
        .join("\n");
      expect(
        allMixes,
        `Found ${allMixes.length} Spanish-identifier mixes in data YAMLs.\nThese will leak into agent prompts and cause the same incident the user reported.\nFix by renaming to English, OR add the file to EXEMPT_FILES if the Spanish word is a legitimate negative example.\n\n${report}`,
      ).toEqual([]);
    } else {
      expect(allMixes).toEqual([]);
    }
  });

  it("EXEMPT_FILES list itself only contains files that exist", () => {
    const root = join(__dirname, "..", "..");
    for (const exempt of EXEMPT_FILES) {
      const full = join(root, exempt);
      try {
        statSync(full);
      } catch {
        throw new Error(`EXEMPT_FILES references non-existent file: ${exempt}`);
      }
    }
  });

  it("the convention itself produces ZERO false positives on the canonical English examples", () => {
    // Synthetic: a fake YAML with explicit English examples should not trigger.
    const synthetic = `
  - example: |
      class Order { }
      function calculateTotal() { }
      const itemCount = 0;
      const MAX_RETRIES = 3;
      GET /api/v1/users
      GET /api/v1/orders
      query: ?pageSize=20&sortBy=createdAt
    `;
    // Mock by calling the scanner against a tmp file
    const tmpFile = "/tmp/fake-english.yaml";
    writeFileSync(tmpFile, synthetic);
    const mixes = scanForCodeExampleMixes(tmpFile);
    unlinkSync(tmpFile);
    expect(mixes, `False positives on English examples:\n${JSON.stringify(mixes, null, 2)}`).toEqual([]);
  });
});

// ===========================================================================
// PIPELINE — agents reach the new skill via generated files
// ===========================================================================
function namingConfig(): ProjectConfig {
  return {
    name: "naming-test",
    description: "test",
    targetDir: "/tmp/naming-test",
    size: "large",
    criteria: [],
    stackId: "react-nextjs",
    target: "opencode",
    teamScope: "full",
    provider: "anthropic",
    modelStrategy: "inherit",
    permissionMode: "recommended",
    isolationMode: "devcontainer",
  };
}

describe("pipeline: code-naming-convention reaches generated agent files", () => {
  it("generated developer-backend agent file lists code-naming-convention", () => {
    const config = namingConfig();
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const dev = result.files.find((f) => f.path === ".opencode/agents/developer-backend.md");
    expect(dev).toBeDefined();
    expect(dev!.content).toContain(ctx.skills.get("code-naming-convention")!.name);
  });

  it("the SKILL.md is generated under .opencode/skills/code-naming-convention/", () => {
    const config = namingConfig();
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const skillFile = result.files.find((f) => f.path === ".opencode/skills/code-naming-convention/SKILL.md");
    expect(skillFile).toBeDefined();
    expect(skillFile!.content).toMatch(/INGLES/);
    expect(skillFile!.content).toMatch(/Que va en ingles/);
  });
});
