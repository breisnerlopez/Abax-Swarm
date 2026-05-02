import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

interface DetectionRule {
  stackId: string;
  match: (dir: string) => string | null;
}

function readJsonSafe(path: string): Record<string, unknown> | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readTextSafe(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function pkgDeps(dir: string): { all: Record<string, string>; raw: Record<string, unknown> } | null {
  const pkg = readJsonSafe(join(dir, "package.json"));
  if (!pkg) return null;
  const deps = (pkg.dependencies ?? {}) as Record<string, string>;
  const dev = (pkg.devDependencies ?? {}) as Record<string, string>;
  return { all: { ...deps, ...dev }, raw: pkg };
}

const RULES: DetectionRule[] = [
  {
    stackId: "react-nextjs",
    match: (dir) => {
      const p = pkgDeps(dir);
      if (p && p.all.next && (p.all.react || p.all["react-dom"])) return "package.json contiene next + react";
      return null;
    },
  },
  {
    stackId: "vue-nuxt",
    match: (dir) => {
      const p = pkgDeps(dir);
      if (p && (p.all.nuxt || p.all["nuxt-edge"])) return "package.json contiene nuxt";
      return null;
    },
  },
  {
    stackId: "react-nestjs",
    match: (dir) => {
      const p = pkgDeps(dir);
      if (p && p.all["@nestjs/core"]) return "package.json contiene @nestjs/core";
      return null;
    },
  },
  {
    stackId: "astro-hono",
    match: (dir) => {
      const p = pkgDeps(dir);
      if (p && p.all.astro && p.all.hono) return "package.json contiene astro + hono";
      if (p && p.all.astro) return "package.json contiene astro";
      return null;
    },
  },
  {
    stackId: "react-native-expo",
    match: (dir) => {
      const p = pkgDeps(dir);
      if (p && (p.all.expo || p.all["expo-router"])) return "package.json contiene expo";
      return null;
    },
  },
  {
    stackId: "angular-springboot",
    match: (dir) => {
      const p = pkgDeps(dir);
      const pom = readTextSafe(join(dir, "pom.xml"));
      if (p && p.all["@angular/core"] && pom?.includes("spring-boot")) {
        return "@angular/core en package.json + spring-boot en pom.xml";
      }
      if (pom?.includes("spring-boot-starter-parent")) return "pom.xml usa spring-boot-starter-parent";
      return null;
    },
  },
  {
    stackId: "angular-quarkus",
    match: (dir) => {
      const p = pkgDeps(dir);
      const pom = readTextSafe(join(dir, "pom.xml"));
      if (p && p.all["@angular/core"] && pom?.includes("quarkus")) {
        return "@angular/core en package.json + quarkus en pom.xml";
      }
      if (pom?.includes("io.quarkus")) return "pom.xml referencia io.quarkus";
      return null;
    },
  },
  {
    stackId: "python-fastapi",
    match: (dir) => {
      const req = readTextSafe(join(dir, "requirements.txt"));
      const pyproject = readTextSafe(join(dir, "pyproject.toml"));
      if (req?.toLowerCase().includes("fastapi") || pyproject?.toLowerCase().includes("fastapi")) {
        return "fastapi referenciado en requirements.txt o pyproject.toml";
      }
      return null;
    },
  },
  {
    stackId: "python-django",
    match: (dir) => {
      const req = readTextSafe(join(dir, "requirements.txt"));
      const pyproject = readTextSafe(join(dir, "pyproject.toml"));
      const manage = existsSync(join(dir, "manage.py"));
      if (manage) return "manage.py existe (Django)";
      if (req?.toLowerCase().match(/^django/m) || pyproject?.toLowerCase().includes('"django"')) {
        return "django referenciado en requirements/pyproject";
      }
      return null;
    },
  },
  {
    stackId: "go-fiber",
    match: (dir) => {
      const gomod = readTextSafe(join(dir, "go.mod"));
      if (gomod?.includes("github.com/gofiber/fiber")) return "go.mod referencia gofiber/fiber";
      return null;
    },
  },
  {
    stackId: "rust-axum",
    match: (dir) => {
      const cargo = readTextSafe(join(dir, "Cargo.toml"));
      if (cargo?.match(/^axum\s*=/m)) return "Cargo.toml referencia axum";
      return null;
    },
  },
  {
    stackId: "flutter-dart",
    match: (dir) => {
      const pub = readTextSafe(join(dir, "pubspec.yaml"));
      if (pub?.includes("flutter:")) return "pubspec.yaml es proyecto Flutter";
      return null;
    },
  },
  {
    stackId: "dotnet-blazor",
    match: (dir) => {
      try {
        const files = readdirSync(dir);
        const csproj = files.find((f) => f.endsWith(".csproj"));
        if (!csproj) return null;
        const content = readTextSafe(join(dir, csproj));
        if (content?.toLowerCase().includes("blazor")) return `${csproj} referencia Blazor`;
      } catch {
        // ignore
      }
      return null;
    },
  },
  // -------------------------------------------------------------------------
  // Legacy detectors — match real stacks the catalog doesn't model and route
  // them to `legacy-other`. Keep these LAST so modern stacks win when both
  // signals coexist (rare but possible: a PHP app being migrated to Next.js).
  // -------------------------------------------------------------------------
  {
    stackId: "legacy-other",
    match: (dir) => {
      // PHP detection. composer.json with framework, or bare .php files.
      const composer = readJsonSafe(join(dir, "composer.json"));
      if (composer) {
        const req = (composer.require ?? {}) as Record<string, string>;
        const reqDev = (composer["require-dev"] ?? {}) as Record<string, string>;
        const all = { ...req, ...reqDev };
        const fw = ["laravel/framework", "symfony/symfony", "symfony/framework-bundle", "cakephp/cakephp", "codeigniter/framework", "yiisoft/yii2", "slim/slim"]
          .find((k) => k in all);
        if (fw) return `PHP detectado: composer.json declara ${fw} (stack legacy no modelado)`;
        return "PHP detectado: composer.json sin framework moderno conocido (stack legacy no modelado)";
      }
      try {
        const files = readdirSync(dir);
        if (files.some((f) => f.toLowerCase().endsWith(".php"))) {
          return "PHP detectado: archivos .php en raiz sin composer.json (stack legacy no modelado)";
        }
      } catch {
        // ignore
      }
      return null;
    },
  },
  {
    stackId: "legacy-other",
    match: (dir) => {
      // Java Desktop (Swing/AWT/JavaFX). Look for Maven/Gradle + UI imports.
      const pom = readTextSafe(join(dir, "pom.xml"));
      const gradle = readTextSafe(join(dir, "build.gradle"))
        ?? readTextSafe(join(dir, "build.gradle.kts"));
      const buildFile = pom ?? gradle;
      if (!buildFile) return null;
      // Heuristic: Java build file with no web framework AND a hint of desktop UI.
      const hasWebFramework = /spring-boot|quarkus|micronaut|dropwizard|javalin|spark-core|vertx-web|jakarta\.ws\.rs|com\.sun\.jersey/i.test(buildFile);
      if (hasWebFramework) return null;
      const hasDesktopUi = /javafx|openjfx|swingx|miglayout|formdev|flatlaf/i.test(buildFile);
      if (hasDesktopUi) return "Java desktop detectado: build file con dependencias JavaFX/Swing y sin framework web (stack legacy no modelado)";
      // Fallback: scan a few .java files for Swing imports.
      try {
        const found = scanForJavaImports(dir, /import\s+javax\.swing|import\s+java\.awt|import\s+javafx\./, 50);
        if (found) return `Java desktop detectado: ${found} (stack legacy no modelado)`;
      } catch {
        // ignore
      }
      return null;
    },
  },
  {
    stackId: "legacy-other",
    match: (dir) => {
      // VB6 / Visual Basic 6.0. .vbp project file, .frm forms, .bas modules, .cls classes.
      try {
        const files = readdirSync(dir);
        const vbp = files.find((f) => f.toLowerCase().endsWith(".vbp"));
        if (vbp) return `VB6 detectado: archivo de proyecto ${vbp} (stack legacy no modelado)`;
        const hasForms = files.some((f) => f.toLowerCase().endsWith(".frm"));
        const hasModules = files.some((f) => f.toLowerCase().endsWith(".bas"));
        const hasClasses = files.some((f) => f.toLowerCase().endsWith(".cls"));
        if (hasForms || (hasModules && hasClasses)) {
          return "VB6 detectado: archivos .frm/.bas/.cls en raiz (stack legacy no modelado)";
        }
      } catch {
        // ignore
      }
      return null;
    },
  },
];

/**
 * Scan up to `limit` .java files at the top level of `dir` looking for an
 * import that matches `pattern`. Returns the first matching filename or null.
 * Bounded by `limit` to keep detection fast on large repos.
 */
function scanForJavaImports(dir: string, pattern: RegExp, limit: number): string | null {
  let scanned = 0;
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".java")) continue;
    if (scanned++ >= limit) return null;
    const content = readTextSafe(join(dir, entry));
    if (content && pattern.test(content)) return `${entry} importa libreria de UI desktop`;
  }
  // Also check src/main/java if it exists (typical Maven layout).
  const javaSrc = join(dir, "src", "main", "java");
  if (existsSync(javaSrc)) {
    try {
      const found = scanDirForJavaImports(javaSrc, pattern, limit - scanned);
      if (found) return found;
    } catch {
      // ignore
    }
  }
  return null;
}

function scanDirForJavaImports(dir: string, pattern: RegExp, remaining: number): string | null {
  if (remaining <= 0) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (remaining-- <= 0) return null;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = scanDirForJavaImports(full, pattern, remaining);
      if (found) return found;
    } else if (entry.name.endsWith(".java")) {
      const content = readTextSafe(full);
      if (content && pattern.test(content)) return `${entry.name} importa libreria de UI desktop`;
    }
  }
  return null;
}

/**
 * Inspect the target directory and return the matched stack id (if any) plus
 * human-readable evidence lines for the wizard. First match wins; the rule
 * order in RULES intentionally puts the more specific patterns first so e.g.
 * a Spring Boot + Angular project doesn't fall through to the generic angular check.
 */
export function detectStack(targetDir: string): { stackId: string | null; evidence: string[] } {
  const evidence: string[] = [];
  for (const rule of RULES) {
    const ev = rule.match(targetDir);
    if (ev) {
      evidence.push(ev);
      return { stackId: rule.stackId, evidence };
    }
  }
  // No match: collect partial signals so the user knows what we saw.
  if (existsSync(join(targetDir, "package.json"))) evidence.push("hay package.json sin framework reconocido");
  if (existsSync(join(targetDir, "pom.xml"))) evidence.push("hay pom.xml sin framework reconocido");
  if (existsSync(join(targetDir, "go.mod"))) evidence.push("hay go.mod sin framework reconocido");
  if (existsSync(join(targetDir, "Cargo.toml"))) evidence.push("hay Cargo.toml sin framework reconocido");
  if (existsSync(join(targetDir, "requirements.txt"))) evidence.push("hay requirements.txt sin framework reconocido");
  if (existsSync(join(targetDir, "pyproject.toml"))) evidence.push("hay pyproject.toml sin framework reconocido");
  return { stackId: null, evidence };
}
