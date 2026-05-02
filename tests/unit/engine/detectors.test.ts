import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { detectStack } from "../../../src/engine/stack-detector.js";
import { hasExistingDocs } from "../../../src/engine/docs-detector.js";
import { hasGitRepo } from "../../../src/engine/git-detector.js";
import { detectProjectContext } from "../../../src/engine/project-context.js";

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "abax-detectors-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function fixture(name: string, files: Record<string, string>): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

describe("stack-detector: 13 stacks", () => {
  it("detects react-nextjs from next + react", () => {
    const dir = fixture("nextjs", { "package.json": JSON.stringify({ dependencies: { next: "15", react: "19" } }) });
    const r = detectStack(dir);
    expect(r.stackId).toBe("react-nextjs");
    expect(r.evidence[0]).toContain("next");
  });

  it("detects vue-nuxt from nuxt", () => {
    const dir = fixture("nuxt", { "package.json": JSON.stringify({ dependencies: { nuxt: "3" } }) });
    expect(detectStack(dir).stackId).toBe("vue-nuxt");
  });

  it("detects react-nestjs from @nestjs/core", () => {
    const dir = fixture("nestjs", { "package.json": JSON.stringify({ dependencies: { "@nestjs/core": "10" } }) });
    expect(detectStack(dir).stackId).toBe("react-nestjs");
  });

  it("detects astro-hono from astro + hono", () => {
    const dir = fixture("astro", { "package.json": JSON.stringify({ dependencies: { astro: "4", hono: "4" } }) });
    expect(detectStack(dir).stackId).toBe("astro-hono");
  });

  it("detects react-native-expo from expo", () => {
    const dir = fixture("expo", { "package.json": JSON.stringify({ dependencies: { expo: "50" } }) });
    expect(detectStack(dir).stackId).toBe("react-native-expo");
  });

  it("detects angular-springboot from pom.xml + @angular/core", () => {
    const dir = fixture("ng-spring", {
      "package.json": JSON.stringify({ dependencies: { "@angular/core": "18" } }),
      "pom.xml": "<project><parent><artifactId>spring-boot-starter-parent</artifactId></parent></project>",
    });
    expect(detectStack(dir).stackId).toBe("angular-springboot");
  });

  it("detects angular-quarkus from pom.xml quarkus + angular", () => {
    const dir = fixture("ng-quarkus", {
      "package.json": JSON.stringify({ dependencies: { "@angular/core": "18" } }),
      "pom.xml": "<project><dependencies><dependency><groupId>io.quarkus</groupId></dependency></dependencies></project>",
    });
    expect(detectStack(dir).stackId).toBe("angular-quarkus");
  });

  it("detects python-fastapi from requirements.txt", () => {
    const dir = fixture("fastapi", { "requirements.txt": "fastapi==0.110\nuvicorn\n" });
    expect(detectStack(dir).stackId).toBe("python-fastapi");
  });

  it("detects python-django from manage.py", () => {
    const dir = fixture("django", { "manage.py": "#!/usr/bin/env python\n", "requirements.txt": "Django==5\n" });
    expect(detectStack(dir).stackId).toBe("python-django");
  });

  it("detects go-fiber from go.mod", () => {
    const dir = fixture("go-fiber", { "go.mod": "module x\n\nrequire github.com/gofiber/fiber/v2 v2.50\n" });
    expect(detectStack(dir).stackId).toBe("go-fiber");
  });

  it("detects rust-axum from Cargo.toml", () => {
    const dir = fixture("rust-axum", { "Cargo.toml": "[dependencies]\naxum = \"0.7\"\n" });
    expect(detectStack(dir).stackId).toBe("rust-axum");
  });

  it("detects flutter-dart from pubspec.yaml", () => {
    const dir = fixture("flutter", { "pubspec.yaml": "name: app\nflutter:\n  uses-material-design: true\n" });
    expect(detectStack(dir).stackId).toBe("flutter-dart");
  });

  it("detects dotnet-blazor from .csproj", () => {
    const dir = fixture("blazor", {
      "App.csproj": "<Project Sdk=\"Microsoft.NET.Sdk.BlazorWebAssembly\"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>",
    });
    expect(detectStack(dir).stackId).toBe("dotnet-blazor");
  });

  it("returns null and partial evidence for an unknown stack", () => {
    const dir = fixture("unknown", { "package.json": JSON.stringify({ dependencies: { lodash: "4" } }) });
    const r = detectStack(dir);
    expect(r.stackId).toBeNull();
    expect(r.evidence.some((e) => e.includes("package.json"))).toBe(true);
  });
});

describe("docs-detector", () => {
  it("returns false on a directory without docs/", () => {
    const dir = fixture("no-docs", {});
    expect(hasExistingDocs(dir)).toBe(false);
  });

  it("returns true when docs/ has a markdown file", () => {
    const dir = fixture("with-docs", { "docs/intro.md": "# hi\n" });
    expect(hasExistingDocs(dir)).toBe(true);
  });

  it("returns true even when the markdown is in a nested subfolder", () => {
    const dir = fixture("nested-docs", { "docs/api/v1/spec.md": "# spec\n" });
    expect(hasExistingDocs(dir)).toBe(true);
  });

  it("returns false when docs/ exists but has no .md files", () => {
    const dir = fixture("docs-no-md", { "docs/.gitkeep": "" });
    expect(hasExistingDocs(dir)).toBe(false);
  });
});

describe("git-detector", () => {
  it("returns false when there is no .git", () => {
    const dir = fixture("no-git", {});
    expect(hasGitRepo(dir)).toBe(false);
  });

  it("returns true when .git exists as a directory", () => {
    const dir = fixture("with-git", { ".git/HEAD": "ref: refs/heads/main\n" });
    expect(hasGitRepo(dir)).toBe(true);
  });
});

describe("project-context: aggregate", () => {
  it("combines all signals", () => {
    const dir = fixture("full-signal", {
      "package.json": JSON.stringify({ dependencies: { next: "15", react: "19" } }),
      "docs/index.md": "# x\n",
      ".git/HEAD": "ref: refs/heads/main\n",
    });
    const ctx = detectProjectContext(dir);
    expect(ctx.stackId).toBe("react-nextjs");
    expect(ctx.existingDocs).toBe(true);
    expect(ctx.hasGit).toBe(true);
  });
});
