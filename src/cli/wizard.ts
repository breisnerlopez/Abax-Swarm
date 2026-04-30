import { resolve, basename } from "path";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { parse as yamlParse } from "yaml";
import type { ProjectConfig, DataContext, SelectionResult, TargetPlatform, TeamScope } from "../engine/types.js";
import type { ProjectSize } from "../loader/schemas.js";
import { runSelection, runPipeline, writePipeline } from "./pipeline.js";
import { resolveDependencies } from "../engine/dependency-resolver.js";
import { askText, askSelect, askMultiSelect, askConfirm, askRoleToggle, closeRL } from "./prompts.js";
import { printBanner, printStepHeader, printSelectionSummary, printRolePreview, printFileList, printSuccess, printDryRun, printExistingConfig } from "./format.js";
import type { RolePreviewEntry } from "./format.js";

interface WizardOptions {
  dryRun: boolean;
}

interface ExistingManifest {
  project: { name: string; description?: string; size: ProjectSize; stack: string };
  team?: { roles?: Array<{ id: string }> };
  criteria_applied?: string[];
}

/**
 * Runs the 5-step interactive wizard.
 */
export async function runWizard(ctx: DataContext, options: WizardOptions): Promise<void> {
  printBanner();

  try {
    // Step 1: Target directory
    printStepHeader(1, 7, "Directorio del proyecto");
    const rawPath = await askText("Ruta del proyecto destino");
    if (!rawPath) {
      console.log("\n  Debes ingresar una ruta.\n");
      return;
    }
    const targetDir = resolve(rawPath);

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
      console.log(`  Directorio creado: ${targetDir}`);
    }

    const existing = loadExistingManifest(targetDir);

    if (existing) {
      printExistingConfig(existing, targetDir);
      const proceed = await askConfirm("Deseas actualizar esta configuracion?");
      if (!proceed) {
        console.log("\n  Cancelado.\n");
        return;
      }
    }

    // Step 2: Platform
    const target = await stepPlatformSelection(existing);

    // Step 3: Project Info
    const config = await stepProjectInfo(targetDir, target, existing);

    // Step 4: Classification
    const { size, criteria } = await stepClassification(ctx, existing);
    config.size = size;
    config.criteria = criteria;

    // Step 5: Stack Selection
    config.stackId = await stepStackSelection(ctx, existing);

    // Step 6: Role Review
    const selection = await stepRoleReview(config, ctx, existing);

    // Step 7: Confirmation & Generation
    await stepConfirmation(config, selection, ctx, options);
  } finally {
    closeRL();
  }
}

function loadExistingManifest(targetDir: string): ExistingManifest | null {
  const manifestPath = resolve(targetDir, "project-manifest.yaml");
  if (!existsSync(manifestPath)) return null;
  try {
    return yamlParse(readFileSync(manifestPath, "utf-8")) as ExistingManifest;
  } catch {
    return null;
  }
}

async function stepPlatformSelection(existing: ExistingManifest | null): Promise<TargetPlatform> {
  printStepHeader(2, 7, "Plataforma destino");

  if (existing) {
    const prev = (existing as unknown as { project: { target?: string } }).project?.target;
    if (prev) console.log(`  Actual: ${prev}`);
  }

  const selected = await askSelect("Plataforma de agentes:", [
    { label: "OpenCode", value: "opencode" },
    { label: "Claude Code", value: "claude" },
  ]);
  return selected.value as TargetPlatform;
}

async function stepProjectInfo(targetDir: string, target: TargetPlatform, existing: ExistingManifest | null): Promise<ProjectConfig> {
  printStepHeader(3, 7, "Informacion del proyecto");

  const name = existing?.project.name ?? basename(targetDir);
  const defaultDesc = existing?.project.description ?? `Proyecto ${name}`;
  const description = await askText("Descripcion breve", defaultDesc);

  console.log(`  Proyecto: ${name}`);

  return {
    name,
    description,
    targetDir,
    size: "small",
    criteria: [],
    stackId: "",
    target,
    teamScope: "full",
  };
}

async function stepClassification(
  ctx: DataContext,
  existing: ExistingManifest | null,
): Promise<{ size: ProjectSize; criteria: string[] }> {
  printStepHeader(4, 7, "Clasificacion del proyecto");

  const sizeOptions = [
    { label: "Pequeno (3-6 personas, < 6 meses)", value: "small" },
    { label: "Mediano (7-15 personas, 6-12 meses)", value: "medium" },
    { label: "Grande (15+ personas, > 12 meses)", value: "large" },
  ];

  if (existing?.project.size) {
    const current = sizeOptions.find((o) => o.value === existing.project.size);
    if (current) console.log(`  Actual: ${current.label}`);
  }

  const sizeOption = await askSelect("Tamano del proyecto:", sizeOptions);
  const size = sizeOption.value as ProjectSize;

  const criteriaOptions = ctx.criteria.criteria.map((c) => ({
    label: c.question,
    value: c.id,
  }));

  if (existing?.criteria_applied?.length) {
    console.log(`  Criterios actuales: ${existing.criteria_applied.join(", ")}`);
  }

  const selectedCriteria = await askMultiSelect("Caracteristicas del proyecto:", criteriaOptions);
  const criteria = selectedCriteria.map((c) => c.value);

  return { size, criteria };
}

async function stepStackSelection(ctx: DataContext, existing: ExistingManifest | null): Promise<string> {
  printStepHeader(5, 7, "Seleccion de stack tecnologico");

  if (existing?.project.stack) {
    const currentStack = ctx.stacks.get(existing.project.stack);
    if (currentStack) console.log(`  Actual: ${currentStack.name}`);
  }

  const stackOptions = Array.from(ctx.stacks.values()).map((s) => ({
    label: `${s.name} (${s.frontend?.framework ?? "N/A"} + ${s.backend?.framework ?? "N/A"})`,
    value: s.id,
  }));

  const selected = await askSelect("Stack tecnologico:", stackOptions);
  return selected.value;
}

async function stepRoleReview(
  config: ProjectConfig,
  ctx: DataContext,
  existing: ExistingManifest | null,
): Promise<SelectionResult> {
  printStepHeader(6, 7, "Revision de equipo");

  // First: show ALL roles (full scope) so user sees complete picture
  const fullConfig = { ...config, teamScope: "full" as TeamScope };
  const fullSelection = runSelection(fullConfig, ctx);

  // Build preview entries with role names and reasons
  const previewEntries: RolePreviewEntry[] = fullSelection.roles.map((s) => {
    const role = ctx.roles.get(s.roleId);
    return {
      roleId: s.roleId,
      name: role?.name ?? s.roleId,
      reason: s.reason,
      criteriaSource: s.criteriaSource,
    };
  });

  // Show full role table with labels
  printRolePreview(previewEntries);

  // Ask: all or just indispensable?
  const scopeOption = await askSelect("Que roles incluir?", [
    { label: "Todos (indispensables + recomendados + criterios)", value: "full" },
    { label: "Solo indispensables (+ criterios)", value: "lean" },
  ]);
  config.teamScope = scopeOption.value as TeamScope;

  // Re-run selection with chosen scope
  const selection = runSelection(config, ctx);

  // Merge previously configured roles from existing manifest
  if (existing?.team?.roles) {
    const currentIds = new Set(selection.roles.map((s) => s.roleId));
    for (const prev of existing.team.roles) {
      if (!currentIds.has(prev.id) && ctx.roles.has(prev.id)) {
        selection.roles.push({ roleId: prev.id, reason: "manual", removable: true });
        currentIds.add(prev.id);
      }
    }
  }

  printSelectionSummary(selection, ctx);

  const roleDetails = selection.roles.map((s) => {
    const role = ctx.roles.get(s.roleId);
    return {
      id: s.roleId,
      name: role?.name ?? s.roleId,
      reason: s.reason,
      removable: s.removable,
    };
  });

  // Build catalog of all roles (excluding orchestrator and system-designer)
  const availableRoles = Array.from(ctx.roles.values())
    .filter((r) => r.id !== "orchestrator" && r.id !== "system-designer")
    .map((r) => ({ id: r.id, name: r.name, category: r.category, tier: r.tier }));

  const finalRoleIds = await askRoleToggle(roleDetails, availableRoles);

  // Rebuild selection: keep existing selections + add manual ones
  const selectedSet = new Set(finalRoleIds);
  const keptSelections = selection.roles.filter((s) => selectedSet.has(s.roleId));

  // Add manually added roles (not in original selection)
  const originalIds = new Set(selection.roles.map((s) => s.roleId));
  for (const roleId of finalRoleIds) {
    if (!originalIds.has(roleId)) {
      keptSelections.push({ roleId, reason: "manual", removable: true });
    }
  }

  const { selections: resolved, warnings } = resolveDependencies(keptSelections, ctx.dependencies);

  return {
    roles: resolved,
    warnings: [...selection.warnings, ...warnings],
    governanceModel: selection.governanceModel,
  };
}

async function stepConfirmation(
  config: ProjectConfig,
  selection: SelectionResult,
  ctx: DataContext,
  options: WizardOptions,
): Promise<void> {
  printStepHeader(7, 7, "Confirmacion y generacion");

  const result = runPipeline(config, selection, ctx);
  printFileList(result);

  if (options.dryRun) {
    printDryRun(result.files.length);
    return;
  }

  const isUpdate = existsSync(resolve(config.targetDir, "project-manifest.yaml"));
  const confirmMsg = isUpdate ? "Actualizar archivos existentes?" : "Generar archivos?";
  const confirmed = await askConfirm(confirmMsg);
  if (!confirmed) {
    console.log("\n  Cancelado. No se modificaron archivos.\n");
    return;
  }

  writePipeline(result, false);
  printSuccess(config.targetDir, result.files.length);

  const cli = config.target === "claude" ? "claude" : "opencode --agent orchestrator";
  const cliName = config.target === "claude" ? "Claude Code" : "OpenCode (orquestador)";
  const launch = await askConfirm(`Abrir ${cliName} en ${config.targetDir}?`);
  if (launch) {
    console.log(`\n  Iniciando ${cliName}...\n`);
    execSync(`start powershell -NoExit -Command "cd '${config.targetDir}'; ${cli}"`, { stdio: "ignore" });
  }
}
