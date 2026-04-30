import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __engineDir = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATES_DIR = join(__engineDir, "../../../templates/opencode");
const cache = new Map<string, HandlebarsTemplateDelegate>();

// Register helper for equality check
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);

// Collapse multiline strings into one line (for use inside JS string literals)
Handlebars.registerHelper("oneline", (str: unknown) =>
  typeof str === "string" ? str.replace(/\s*\n\s*/g, " ").trim() : str,
);

export function renderTemplate(templateName: string, data: Record<string, unknown>): string {
  if (!cache.has(templateName)) {
    const raw = readFileSync(join(TEMPLATES_DIR, templateName), "utf-8");
    cache.set(templateName, Handlebars.compile(raw, { noEscape: true }));
  }
  const template = cache.get(templateName)!;
  return template(data).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
