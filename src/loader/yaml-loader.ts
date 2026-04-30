import { readFileSync, readdirSync } from "fs";
import { join, extname } from "path";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";

export interface LoadResult<T> {
  data: T;
  filePath: string;
}

export interface LoadError {
  filePath: string;
  errors: string[];
}

export interface LoadAllResult<T> {
  items: LoadResult<T>[];
  errors: LoadError[];
}

/**
 * Loads and validates a single YAML file against a Zod schema.
 */
export function loadYamlFile<T>(filePath: string, schema: z.ZodType<T>): LoadResult<T> {
  const raw = readFileSync(filePath, "utf-8");
  const parsed = parseYaml(raw);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new YamlValidationError(filePath, messages);
  }

  return { data: result.data, filePath };
}

/**
 * Loads all YAML files from a directory and validates each against the schema.
 * Files starting with _ are skipped (convention for schema/meta files).
 */
export function loadYamlDirectory<T>(dirPath: string, schema: z.ZodType<T>): LoadAllResult<T> {
  const items: LoadResult<T>[] = [];
  const errors: LoadError[] = [];

  const files = readdirSync(dirPath).filter(
    (f) => !f.startsWith("_") && (extname(f) === ".yaml" || extname(f) === ".yml"),
  );

  for (const file of files) {
    const filePath = join(dirPath, file);
    try {
      const result = loadYamlFile(filePath, schema);
      items.push(result);
    } catch (err) {
      if (err instanceof YamlValidationError) {
        errors.push({ filePath, errors: err.validationErrors });
      } else {
        errors.push({ filePath, errors: [(err as Error).message] });
      }
    }
  }

  return { items, errors };
}

export class YamlValidationError extends Error {
  public readonly validationErrors: string[];

  constructor(filePath: string, validationErrors: string[]) {
    const msg = `Validation failed for ${filePath}:\n${validationErrors.join("\n")}`;
    super(msg);
    this.name = "YamlValidationError";
    this.validationErrors = validationErrors;
  }
}
