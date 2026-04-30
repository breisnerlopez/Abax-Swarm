import * as readline from "readline/promises";
import { stdin, stdout } from "process";

let rl: readline.Interface | null = null;

function getRL(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({ input: stdin, output: stdout });
  }
  return rl;
}

export function closeRL(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

/**
 * Ask a text question with optional default.
 */
export async function askText(question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = await getRL().question(`  ${question}${suffix}: `);
  return answer.trim() || defaultValue || "";
}

/**
 * Ask user to pick one option from a numbered list.
 */
export async function askSelect<T extends { label: string; value: string }>(
  question: string,
  options: T[],
): Promise<T> {
  console.log(`\n  ${question}\n`);
  for (let i = 0; i < options.length; i++) {
    console.log(`    ${i + 1}. ${options[i].label}`);
  }
  console.log();

  while (true) {
    const answer = await getRL().question(`  Selecciona (1-${options.length}): `);
    const num = parseInt(answer.trim(), 10);
    if (num >= 1 && num <= options.length) {
      return options[num - 1];
    }
    console.log(`  ⚠ Ingresa un numero entre 1 y ${options.length}`);
  }
}

/**
 * Ask user to toggle multiple items (space-separated numbers).
 */
export async function askMultiSelect<T extends { label: string; value: string }>(
  question: string,
  options: T[],
): Promise<T[]> {
  console.log(`\n  ${question}`);
  console.log(`  (Numeros separados por espacio, "todos" para todos, "ninguno" para saltar)\n`);

  for (let i = 0; i < options.length; i++) {
    console.log(`    ${i + 1}. ${options[i].label}`);
  }
  console.log();

  const answer = await getRL().question(`  Seleccion: `);
  const trimmed = answer.trim().toLowerCase();

  if (!trimmed || trimmed === "ninguno" || trimmed === "0") {
    return [];
  }

  if (trimmed === "todos" || trimmed === "all" || trimmed === "*") {
    return [...options];
  }

  const nums = trimmed
    .split(/[\s,]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => n >= 1 && n <= options.length);

  return [...new Set(nums)].map((n) => options[n - 1]);
}

/**
 * Ask yes/no confirmation.
 */
export async function askConfirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "[S/n]" : "[s/N]";
  const answer = await getRL().question(`  ${question} ${hint}: `);
  const trimmed = answer.trim().toLowerCase();

  if (!trimmed) return defaultYes;
  return trimmed === "s" || trimmed === "si" || trimmed === "y" || trimmed === "yes";
}

export interface RoleEntry {
  id: string;
  name: string;
  reason: string;
  removable: boolean;
}

export interface AvailableRole {
  id: string;
  name: string;
  category: string;
  tier: string;
}

/**
 * Interactive role editor: add/remove roles freely, loop until user confirms.
 */
export async function askRoleToggle(
  roles: RoleEntry[],
  availableRoles?: AvailableRole[],
): Promise<string[]> {
  const current = new Map<string, RoleEntry>();
  for (const r of roles) current.set(r.id, r);

  while (true) {
    printCurrentRoles(current);

    const hasAvailable = availableRoles && availableRoles.some((a) => !current.has(a.id));

    console.log("  Opciones:");
    console.log("    [Q] Quitar roles");
    if (hasAvailable) console.log("    [A] Agregar roles");
    console.log("    [C] Continuar con este equipo\n");

    const action = await getRL().question("  Accion: ");
    const trimmed = action.trim().toLowerCase();

    if (trimmed === "c" || trimmed === "") {
      break;
    } else if (trimmed === "q") {
      await removeRolesInteractive(current);
    } else if (trimmed === "a" && hasAvailable) {
      await addRolesInteractive(current, availableRoles!);
    } else {
      console.log("  Opcion no valida.\n");
    }
  }

  return Array.from(current.keys());
}

function printCurrentRoles(current: Map<string, RoleEntry>): void {
  console.log("\n  Equipo actual:\n");
  let i = 1;
  for (const r of current.values()) {
    const tag =
      r.reason === "indispensable"
        ? "(indispensable)"
        : r.reason === "dependency"
          ? "(dependencia)"
          : r.reason === "manual"
            ? "(agregado manual)"
            : `(${r.reason})`;
    console.log(`    ${i}. ${r.name} ${tag}`);
    i++;
  }
  console.log();
}

async function removeRolesInteractive(current: Map<string, RoleEntry>): Promise<void> {
  const entries = Array.from(current.values());
  console.log("\n  Roles disponibles para quitar:\n");
  for (let i = 0; i < entries.length; i++) {
    const warn = !entries[i].removable ? " ⚠ indispensable" : "";
    console.log(`    ${i + 1}. ${entries[i].name}${warn}`);
  }

  const answer = await getRL().question("\n  Numeros a quitar (separados por espacio, \"todos\" para todos, Enter para cancelar): ");
  const trimmed = answer.trim().toLowerCase();
  if (!trimmed) return;

  const toRemove = (trimmed === "todos" || trimmed === "all" || trimmed === "*")
    ? [...entries]
    : trimmed
        .split(/[\s,]+/)
        .map((s) => parseInt(s, 10) - 1)
        .filter((i) => i >= 0 && i < entries.length)
        .map((i) => entries[i]);
  const indispensables = toRemove.filter((r) => !r.removable);

  if (indispensables.length > 0) {
    console.log(`\n  ⚠ Atencion: ${indispensables.map((r) => r.name).join(", ")} son indispensables.`);
    const confirm = await askConfirm("Quitar de todas formas?", false);
    if (!confirm) {
      // Only remove the non-indispensable ones
      for (const r of toRemove) {
        if (r.removable) current.delete(r.id);
      }
      return;
    }
  }

  for (const r of toRemove) {
    current.delete(r.id);
  }
}

async function addRolesInteractive(
  current: Map<string, RoleEntry>,
  availableRoles: AvailableRole[],
): Promise<void> {
  const notSelected = availableRoles.filter((a) => !current.has(a.id));
  if (notSelected.length === 0) {
    console.log("\n  No hay roles adicionales disponibles.\n");
    return;
  }

  console.log("\n  Roles disponibles para agregar:\n");
  for (let i = 0; i < notSelected.length; i++) {
    const r = notSelected[i];
    console.log(`    ${i + 1}. ${r.name} [${r.category}, tier ${r.tier}]`);
  }

  const answer = await getRL().question("\n  Numeros a agregar (separados por espacio, \"todos\" para todos, Enter para cancelar): ");
  const trimmed = answer.trim().toLowerCase();
  if (!trimmed) return;

  if (trimmed === "todos" || trimmed === "all" || trimmed === "*") {
    for (const r of notSelected) {
      current.set(r.id, { id: r.id, name: r.name, reason: "manual", removable: true });
    }
    return;
  }

  const indices = trimmed
    .split(/[\s,]+/)
    .map((s) => parseInt(s, 10) - 1)
    .filter((i) => i >= 0 && i < notSelected.length);

  for (const i of indices) {
    const r = notSelected[i];
    current.set(r.id, {
      id: r.id,
      name: r.name,
      reason: "manual",
      removable: true,
    });
  }
}
