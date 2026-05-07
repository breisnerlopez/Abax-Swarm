import type { PipelineResult } from "./pipeline.js";
import type { SelectionResult } from "../engine/types.js";
import type { DataContext } from "../engine/types.js";

const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export function printBanner(): void {
  console.log(`
${CYAN}${BOLD}  ╔══════════════════════════════════════════╗
  ║        Abax Swarm · v0.1.0               ║
  ║   AI Agent Orchestration for Software    ║
  ╚══════════════════════════════════════════╝${RESET}
`);
}

export function printStepHeader(step: number, total: number, title: string): void {
  console.log(`\n${BOLD}  ── Paso ${step}/${total}: ${title} ──${RESET}\n`);
}

export function printSelectionSummary(selection: SelectionResult, _ctx: DataContext): void {
  console.log(`\n${BOLD}  Resumen de seleccion:${RESET}`);
  console.log(`  Roles: ${selection.roles.length}`);
  console.log(`  Modelo de gobierno: ${selection.governanceModel}`);

  if (selection.warnings.length > 0) {
    console.log(`\n${YELLOW}  Advertencias:${RESET}`);
    for (const w of selection.warnings) {
      console.log(`  ${YELLOW}⚠${RESET} ${w.message}`);
    }
  }
}

export interface RolePreviewEntry {
  roleId: string;
  name: string;
  reason: "indispensable" | "recommended" | "criteria" | "dependency" | "manual";
  criteriaSource?: string;
}

const MAGENTA = "\x1b[35m";

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  indispensable: { label: "INDISPENSABLE", color: GREEN },
  recommended: { label: "RECOMENDADO", color: CYAN },
  criteria: { label: "CRITERIO", color: MAGENTA },
  dependency: { label: "DEPENDENCIA", color: YELLOW },
  manual: { label: "MANUAL", color: DIM },
};

export function printRolePreview(roles: RolePreviewEntry[]): void {
  console.log(`\n${BOLD}  Roles para este proyecto:${RESET}\n`);
  console.log(`  ${"#".padEnd(4)} ${"Rol".padEnd(28)} Tipo`);
  console.log(`  ${"─".repeat(4)} ${"─".repeat(28)} ${"─".repeat(22)}`);

  let indispensableCount = 0;
  let recommendedCount = 0;
  let criteriaCount = 0;

  for (let i = 0; i < roles.length; i++) {
    const r = roles[i];
    const { label, color } = REASON_LABELS[r.reason] ?? { label: r.reason, color: DIM };
    const extra = r.criteriaSource ? ` (${r.criteriaSource})` : "";
    console.log(`  ${String(i + 1).padEnd(4)} ${r.name.padEnd(28)} ${color}${label}${RESET}${extra}`);

    if (r.reason === "indispensable") indispensableCount++;
    else if (r.reason === "recommended") recommendedCount++;
    else if (r.reason === "criteria") criteriaCount++;
  }

  console.log();
  console.log(`  ${GREEN}■${RESET} Indispensables: ${indispensableCount}   ${CYAN}■${RESET} Recomendados: ${recommendedCount}   ${MAGENTA}■${RESET} Por criterio: ${criteriaCount}`);
  console.log();
}

export function printFileList(result: PipelineResult): void {
  console.log(`\n${BOLD}  Archivos a generar (${result.files.length}):${RESET}\n`);

  const groups = new Map<string, string[]>();
  for (const f of result.files) {
    const dir = f.path.split("/").slice(0, -1).join("/") || ".";
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(f.path.split("/").pop()!);
  }

  for (const [dir, files] of groups) {
    console.log(`  ${CYAN}${dir}/${RESET}`);
    for (const file of files) {
      console.log(`    ${DIM}├─${RESET} ${file}`);
    }
  }

  printValidatorFindings(result);
}

/**
 * Render validator findings with collapse semantics (introduced in 0.1.41):
 *
 *  - 0 warnings, 0 notices         → nothing printed (silent success)
 *  - <= MAX_INLINE warnings        → all printed in full
 *  - > MAX_INLINE warnings         → first WARNING_PREVIEW shown, rest collapsed
 *                                    behind a hint to run `abax-swarm validate`
 *  - notices                       → count only, never inline (use --verbose)
 */
const MAX_INLINE_WARNINGS = 10;
const WARNING_PREVIEW = 5;

export function printValidatorFindings(result: PipelineResult, verbose = false): void {
  const w = result.orchestratorWarnings;
  const n = result.orchestratorNotices;
  const s = result.sponsorApprovals;

  if (w.length === 0 && n.length === 0 && s.length === 0) return;

  // Sponsor approvals come FIRST: this is the most important signal —
  // these are decisions the user personally makes. Always shown,
  // never collapsed past a soft preview.
  if (s.length > 0) {
    console.log(
      `\n${BOLD}${CYAN}  🎯 Aprobaciones que requieren tu rol como sponsor (${s.length}):${RESET}`,
    );
    const SPONSOR_PREVIEW = 8;
    const items = verbose ? s : s.slice(0, SPONSOR_PREVIEW);
    for (const a of items) {
      console.log(`  ${CYAN}•${RESET} ${a.phaseName} / ${a.deliverableName}`);
    }
    if (!verbose && s.length > SPONSOR_PREVIEW) {
      console.log(
        `  ${DIM}… y ${s.length - SPONSOR_PREVIEW} más. Usa --verbose para ver todas.${RESET}`,
      );
    }
    console.log(
      `  ${DIM}El orquestador pedirá tu aprobación explícita en cada uno.${RESET}`,
    );
  }

  if (w.length > 0) {
    console.log(`\n${YELLOW}  Advertencias del orquestador (${w.length}):${RESET}`);
    if (verbose || w.length <= MAX_INLINE_WARNINGS) {
      for (const m of w) console.log(`  ${YELLOW}⚠${RESET} ${m}`);
    } else {
      for (let i = 0; i < WARNING_PREVIEW; i++) {
        console.log(`  ${YELLOW}⚠${RESET} ${w[i]}`);
      }
      console.log(
        `  ${DIM}… y ${w.length - WARNING_PREVIEW} más. ` +
          `Ejecuta ${BOLD}abax-swarm validate${RESET}${DIM} (con --verbose) para ver el detalle.${RESET}`,
      );
    }
  }

  if (n.length > 0) {
    if (verbose) {
      console.log(`\n${CYAN}  Notas informativas (${n.length}):${RESET}`);
      for (const m of n) console.log(`  ${CYAN}ℹ${RESET} ${m}`);
    } else {
      console.log(
        `\n  ${CYAN}ℹ${RESET} ${n.length} ${n.length === 1 ? "nota informativa" : "notas informativas"} ` +
          `(fallbacks aplicados o roles opcionales). ${DIM}Usa --verbose para verlos.${RESET}`,
      );
    }
  }
}

export function printSuccess(targetDir: string, fileCount: number): void {
  console.log(`\n${GREEN}${BOLD}  ✓ Proyecto generado exitosamente${RESET}`);
  console.log(`  ${DIM}${fileCount} archivos escritos en ${targetDir}${RESET}\n`);
}

export function printDryRun(fileCount: number): void {
  console.log(`\n${YELLOW}${BOLD}  ⚡ Modo dry-run: ${fileCount} archivos se generarian${RESET}`);
  console.log(`  ${DIM}Ejecuta sin --dry-run para escribir a disco${RESET}\n`);
}

export function printExistingConfig(
  manifest: { project: { name: string; size: string; stack: string }; team?: { roles?: Array<{ id: string; name?: string }> } },
  targetDir: string,
): void {
  console.log(`${YELLOW}${BOLD}  ⚠ Configuracion existente detectada en:${RESET}`);
  console.log(`  ${DIM}${targetDir}/project-manifest.yaml${RESET}\n`);
  console.log(`  Proyecto: ${BOLD}${manifest.project.name}${RESET}`);
  console.log(`  Tamano:   ${manifest.project.size}`);
  console.log(`  Stack:    ${manifest.project.stack}`);
  if (manifest.team?.roles?.length) {
    console.log(`  Roles:    ${manifest.team.roles.map((r) => r.name ?? r.id).join(", ")}`);
  }
  console.log(`\n  ${YELLOW}Los archivos seran sobrescritos con la nueva configuracion.${RESET}\n`);
}

export function printRoleTable(roles: Array<{ id: string; name: string; tier: string; category: string }>): void {
  console.log(`\n${BOLD}  Roles disponibles:${RESET}\n`);
  console.log(`  ${"ID".padEnd(25)} ${"Nombre".padEnd(30)} ${"Tier".padEnd(6)} Categoria`);
  console.log(`  ${"─".repeat(25)} ${"─".repeat(30)} ${"─".repeat(6)} ${"─".repeat(15)}`);
  for (const r of roles) {
    console.log(`  ${r.id.padEnd(25)} ${r.name.padEnd(30)} ${String(r.tier).padEnd(6)} ${r.category}`);
  }
}

export function printStackTable(stacks: Array<{ id: string; name: string; frontend: string; backend: string }>): void {
  console.log(`\n${BOLD}  Stacks disponibles:${RESET}\n`);
  console.log(`  ${"ID".padEnd(25)} ${"Nombre".padEnd(30)} ${"Frontend".padEnd(15)} Backend`);
  console.log(`  ${"─".repeat(25)} ${"─".repeat(30)} ${"─".repeat(15)} ${"─".repeat(15)}`);
  for (const s of stacks) {
    console.log(`  ${s.id.padEnd(25)} ${s.name.padEnd(30)} ${s.frontend.padEnd(15)} ${s.backend}`);
  }
}
