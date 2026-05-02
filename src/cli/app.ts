#!/usr/bin/env node

import { Command } from "commander";
import { resolve, dirname } from "path";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { parse as yamlParse } from "yaml";
import { loadDataContext } from "./data-context.js";
import { runWizard } from "./wizard.js";
import { runSelection, runPipeline, writePipeline } from "./pipeline.js";
import { printBanner, printRoleTable, printStackTable, printFileList, printSuccess } from "./format.js";
import type { ProjectConfig } from "../engine/types.js";

// Read version from package.json so the binary always matches the published
// version. Both `dist/cli/app.js` and `src/cli/app.ts` are two levels deep.
const pkg = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../package.json"), "utf-8"),
) as { version: string };

const program = new Command();

program
  .name("abax-swarm")
  .description("Inicializa proyectos con agentes IA orquestados para OpenCode y Claude Code")
  .version(pkg.version);

program
  .command("init")
  .description("Wizard interactivo para inicializar o actualizar un proyecto")
  .option("--dry-run", "Vista previa sin escribir archivos a disco", false)
  .action(async (opts) => {
    try {
      const ctx = loadDataContext();
      await runWizard(ctx, { dryRun: opts.dryRun });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ERR_USE_AFTER_CLOSE") return;
      console.error("\n  Error:", (err as Error).message);
      process.exit(1);
    }
  });

program
  .command("roles")
  .description("Lista todos los roles disponibles")
  .action(() => {
    const ctx = loadDataContext();
    printBanner();
    const roles = Array.from(ctx.roles.values())
      .filter((r) => r.id !== "orchestrator" && r.id !== "system-designer")
      .map((r) => ({ id: r.id, name: r.name, tier: r.tier, category: r.category }));
    printRoleTable(roles);
    console.log(`\n  Total: ${roles.length} roles\n`);
  });

program
  .command("stacks")
  .description("Lista todos los stacks tecnologicos disponibles")
  .action(() => {
    const ctx = loadDataContext();
    printBanner();
    const stacks = Array.from(ctx.stacks.values()).map((s) => ({
      id: s.id,
      name: s.name,
      frontend: s.frontend?.framework ?? "-",
      backend: s.backend?.framework ?? "-",
    }));
    printStackTable(stacks);
    console.log(`\n  Total: ${stacks.length} stacks\n`);
  });

program
  .command("validate")
  .description("Valida todos los archivos YAML de datos canonicos")
  .action(() => {
    try {
      const ctx = loadDataContext();
      const roleCount = ctx.roles.size;
      const skillCount = ctx.skills.size;
      const toolCount = ctx.tools.size;
      const stackCount = ctx.stacks.size;
      console.log(`\n  ✓ Datos validados correctamente`);
      console.log(`    ${roleCount} roles, ${skillCount} skills, ${toolCount} tools, ${stackCount} stacks\n`);
    } catch (err) {
      console.error("\n  ✗ Error de validacion:", (err as Error).message, "\n");
      process.exit(1);
    }
  });

program
  .command("regenerate")
  .description("Regenera el orquestador y archivos desde un project-manifest.yaml existente")
  .option("-d, --dir <path>", "Directorio del proyecto", ".")
  .option("--dry-run", "Vista previa sin escribir archivos", false)
  .action((opts) => {
    try {
      const dir = resolve(opts.dir);
      const manifestPath = resolve(dir, "project-manifest.yaml");

      if (!existsSync(manifestPath)) {
        console.error(`\n  ✗ No se encontro project-manifest.yaml en ${dir}\n`);
        process.exit(1);
      }

      const manifest = yamlParse(readFileSync(manifestPath, "utf-8"));
      const ctx = loadDataContext();

      const config: ProjectConfig = {
        name: manifest.project.name,
        description: manifest.project.description ?? "",
        targetDir: dir,
        size: manifest.project.size,
        criteria: manifest.criteria_applied ?? [],
        stackId: manifest.project.stack,
        target: manifest.project.target ?? "opencode",
        teamScope: manifest.project.team_scope ?? "full",
        provider: manifest.project.provider ?? "anthropic",
        modelStrategy: manifest.project.model_strategy ?? "custom",
      };

      const selection = runSelection(config, ctx);
      const result = runPipeline(config, selection, ctx);

      printBanner();
      printFileList(result);

      if (opts.dryRun) {
        console.log(`\n  ⚡ Modo dry-run: ${result.files.length} archivos se regenerarian\n`);
        return;
      }

      writePipeline(result, false);
      printSuccess(dir, result.files.length);
    } catch (err) {
      console.error("\n  ✗ Error:", (err as Error).message, "\n");
      process.exit(1);
    }
  });

program.parse();
