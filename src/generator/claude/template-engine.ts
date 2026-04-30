import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __engineDir = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATES_DIR = join(__engineDir, "../../../templates/claude");
const cache = new Map<string, HandlebarsTemplateDelegate>();

// Register helper for equality check
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);

export function renderTemplate(templateName: string, data: Record<string, unknown>): string {
  if (!cache.has(templateName)) {
    const raw = readFileSync(join(TEMPLATES_DIR, templateName), "utf-8");
    cache.set(templateName, Handlebars.compile(raw, { noEscape: true }));
  }
  const template = cache.get(templateName)!;
  return template(data).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
