import { describe, it, expect } from "vitest";
import {
  validateGatesAgainstTeam,
  validateGatesForDocumentMode,
} from "../../../src/validator/gates-validator.js";
import type { PhaseDeliverables } from "../../../src/loader/schemas.js";

/**
 * Minimal phase-deliverables fixture — covers the generic shape (gates +
 * deliverables) without depending on the project-wide YAML. Mirrors the
 * schema after the v0.1.40 extension.
 */
const fixture: PhaseDeliverables = {
  phases: [
    {
      id: "construction",
      name: "Construccion",
      gate_approver: "tech-lead",
      gates: [
        { type: "git-check", id: "not-on-main", check: "branch", not_in: ["main"], on_failure: "block" },
        { type: "attestation", id: "smoke", attestor_role: "devops", deliverable: "env", on_failure: "block" },
      ],
      deliverables: [
        {
          id: "env",
          name: "Env verification",
          responsible: "devops",
          approver: "tech-lead",
          mandatory: true,
          artifact_type: "document",
          verification: [],
          attestation_required: true,
        },
        {
          id: "optional-doc",
          name: "Optional doc",
          responsible: "tech-writer",
          approver: "tech-lead",
          mandatory: false,
          artifact_type: "document",
          verification: [],
          attestation_required: false,
        },
      ],
    },
  ],
};

describe("validateGatesAgainstTeam", () => {
  it("returns no warnings when every referenced role exists in the team", () => {
    const result = validateGatesAgainstTeam(
      fixture,
      new Set(["tech-lead", "devops", "tech-writer"]),
    );
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("warns when an attestation gate references a role not in the team", () => {
    const result = validateGatesAgainstTeam(
      fixture,
      new Set(["tech-lead", "tech-writer"]), // devops missing
    );
    const msg = result.warnings.join("\n");
    expect(msg).toMatch(/gate "smoke".*attestor_role "devops".*not in team/);
  });

  it("warns when a mandatory deliverable's responsible is missing", () => {
    const result = validateGatesAgainstTeam(
      fixture,
      new Set(["tech-lead"]), // devops missing
    );
    const msg = result.warnings.join("\n");
    expect(msg).toMatch(/deliverable "env" \(mandatory\): responsible "devops" not in team/);
  });

  it("does NOT warn when a NON-mandatory deliverable's responsible is missing", () => {
    const result = validateGatesAgainstTeam(
      fixture,
      new Set(["tech-lead", "devops"]), // tech-writer missing, but optional-doc is non-mandatory
    );
    const msg = result.warnings.join("\n");
    expect(msg).not.toMatch(/optional-doc/);
  });

  it("warns when phase.gate_approver is not in the team", () => {
    const result = validateGatesAgainstTeam(
      fixture,
      new Set(["devops", "tech-writer"]), // tech-lead missing
    );
    const msg = result.warnings.join("\n");
    expect(msg).toMatch(/Phase "construction": gate_approver "tech-lead" is not in the team/);
  });
});

describe("validateGatesForDocumentMode", () => {
  it("warns when a phase declares gates but the phase id is not in document mode", () => {
    const result = validateGatesForDocumentMode(fixture, ["discovery", "documentation", "publication"]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatch(/Phase "construction" declares 2 gate\(s\)/);
  });

  it("does not warn when the phase id IS one of the document phases", () => {
    const result = validateGatesForDocumentMode(fixture, ["construction"]);
    expect(result.warnings).toEqual([]);
  });

  it("does not warn for a phase with zero gates even if it's outside document mode", () => {
    const noGates: PhaseDeliverables = {
      phases: [{ ...fixture.phases[0], gates: [] }],
    };
    const result = validateGatesForDocumentMode(noGates, ["discovery"]);
    expect(result.warnings).toEqual([]);
  });
});
