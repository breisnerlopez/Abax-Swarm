import type { ProjectConfig, DataContext } from "../engine/types.js";
import type { GeneratedFile } from "./opencode/agent-generator.js";

/**
 * In ProjectMode === "document", emit a minimal MkDocs Material scaffold so the
 * deliverables produced by agents are immediately navigable in a docs site.
 *
 * Files emitted (only when called):
 * - mkdocs.yml         — site config with nav inferred from the 5 phases.
 * - requirements.txt   — single dependency: mkdocs-material.
 * - docs/index.md      — landing page.
 *
 * Existing files are NOT overwritten by Abax — that's the writePipeline layer's
 * job, but the wizard will warn before re-running on a populated docs/.
 */
export function generateDocsSiteFiles(config: ProjectConfig, ctx: DataContext): GeneratedFile[] {
  const phases = ctx.documentMode?.phases ?? [];
  const navItems = phases.map((p) => `  - ${p.name}: ${p.id}/index.md`).join("\n");

  const mkdocs = `site_name: ${config.name}
site_description: ${config.description}
theme:
  name: material
  palette:
    - scheme: default
      primary: indigo
      accent: indigo
    - scheme: slate
      primary: indigo
      accent: indigo
  features:
    - navigation.tabs
    - navigation.sections
    - navigation.expand
    - search.highlight
    - search.suggest
    - content.code.copy
markdown_extensions:
  - admonition
  - pymdownx.details
  - pymdownx.superfences
  - tables
  - toc:
      permalink: true
nav:
  - Inicio: index.md
${navItems}
`;

  const requirements = `mkdocs-material>=9.5\n`;

  const indexMd = `# ${config.name}

> ${config.description}

Esta documentacion fue generada por **Abax Swarm** en modo \`document\`.
Cubre cuatro ejes: tecnico, funcional, negocio y operativo.

## Como navegar

La barra superior tiene una pestana por cada fase del flujo de documentacion:

${phases.map((p) => `- **${p.name}**: ${p.description}`).join("\n")}

## Como ejecutar el sitio localmente

\`\`\`bash
pip install -r requirements.txt
mkdocs serve
\`\`\`

Despues abre <http://localhost:8000>.
`;

  const phaseSeeds: GeneratedFile[] = phases.map((p) => ({
    path: `docs/${p.id}/index.md`,
    content: `# ${p.name}\n\n${p.description}\n\n> Esta carpeta se ira llenando con los entregables que produzcan los agentes en esta fase.\n`,
  }));

  return [
    { path: "mkdocs.yml", content: mkdocs },
    { path: "requirements.txt", content: requirements },
    { path: "docs/index.md", content: indexMd },
    ...phaseSeeds,
  ];
}
