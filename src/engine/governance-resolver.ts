import type { ProjectSize } from "../loader/schemas.js";

export type GovernanceModel = "lightweight" | "controlled" | "corporate";

export interface GovernanceDetails {
  model: GovernanceModel;
  name_es: string;
  description: string;
  committees: string[];
  meeting_frequency: Record<string, string>;
  change_control: string;
  documentation_level: string;
}

const GOVERNANCE_MODELS: Record<ProjectSize, GovernanceDetails> = {
  small: {
    model: "lightweight",
    name_es: "Equipo Ligero",
    description: "Gobierno ligero, sponsor parcial, documentacion minima suficiente.",
    committees: ["Comite de proyecto (quincenal)"],
    meeting_frequency: {
      "Comite de proyecto": "Semanal o quincenal",
      "Mesa tecnica": "Segun necesidad",
      "Comite Go/No Go": "Recomendado",
    },
    change_control: "Simple",
    documentation_level: "Minima suficiente",
  },
  medium: {
    model: "controlled",
    name_es: "Equipo Controlado",
    description: "Gobierno controlado, comite semanal, documentacion completa.",
    committees: [
      "Comite de proyecto (semanal)",
      "Mesa tecnica (semanal)",
      "Comite de defectos (durante pruebas)",
      "Comite Go/No Go (pre-pase)",
    ],
    meeting_frequency: {
      "Comite directivo": "Recomendado",
      "Comite de proyecto": "Semanal",
      "Mesa tecnica": "Semanal",
      "Comite de defectos": "Durante QA/UAT",
      "Comite Go/No Go": "Indispensable",
    },
    change_control: "Formal",
    documentation_level: "Completa",
  },
  large: {
    model: "corporate",
    name_es: "Equipo Corporativo Completo",
    description: "Gobierno corporativo completo, comites por frente, documentacion auditable.",
    committees: [
      "Comite directivo (quincenal/mensual)",
      "Comite de proyecto (semanal)",
      "Comites por frente (semanal)",
      "Mesa tecnica (2x semana)",
      "Comite de defectos (diario en pruebas)",
      "Comite Go/No Go (pre-pase)",
      "Revision post produccion (diario en estabilizacion)",
    ],
    meeting_frequency: {
      "Comite directivo": "Quincenal o mensual",
      "Comite de proyecto": "Semanal",
      "Mesa tecnica": "2 veces por semana",
      "Comite de defectos": "Diario durante pruebas criticas",
      "Comite Go/No Go": "Indispensable",
      "Revision post produccion": "Diario en estabilizacion",
    },
    change_control: "Estricto y trazable",
    documentation_level: "Completa y auditable",
  },
};

export function resolveGovernance(size: ProjectSize): GovernanceDetails {
  return GOVERNANCE_MODELS[size];
}
