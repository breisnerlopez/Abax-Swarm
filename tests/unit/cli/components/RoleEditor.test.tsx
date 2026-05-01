import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { RoleEditor } from "../../../../src/cli/components/RoleEditor.tsx";

const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe("RoleEditor", () => {
  const roles = [
    { id: "pm", name: "Project Manager", reason: "indispensable", removable: false },
    { id: "ba", name: "Business Analyst", reason: "indispensable", removable: false },
    { id: "fe", name: "Frontend Dev", reason: "recommended", removable: true },
  ];
  const available = [
    { id: "se", name: "Security Architect", category: "technical", tier: "2" },
    { id: "ux", name: "UX Designer", category: "support", tier: "2" },
  ];

  it("renders the team in list mode", () => {
    const { lastFrame } = render(
      <RoleEditor roles={roles} availableRoles={available} onSubmit={() => {}} />,
    );
    const out = lastFrame() ?? "";
    expect(out).toContain("Project Manager");
    expect(out).toContain("Business Analyst");
    expect(out).toContain("Frontend Dev");
    expect(out).toContain("Equipo actual (3 roles)");
  });

  it("Enter (continue) submits with current role ids", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <RoleEditor roles={roles} availableRoles={available} onSubmit={onSubmit} />,
    );
    await wait();
    stdin.write("\r");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith(["pm", "ba", "fe"]);
  });

  it("'c' also confirms", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <RoleEditor roles={roles} availableRoles={available} onSubmit={onSubmit} />,
    );
    await wait();
    stdin.write("c");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith(["pm", "ba", "fe"]);
  });

  it("'q' enters remove mode (frame shows 'Marca roles a quitar')", async () => {
    const { stdin, lastFrame } = render(
      <RoleEditor roles={roles} availableRoles={available} onSubmit={() => {}} />,
    );
    await wait();
    stdin.write("q");
    await wait();
    expect(lastFrame()).toContain("Marca roles a quitar");
  });

  it("'a' enters add mode when there are available roles", async () => {
    const { stdin, lastFrame } = render(
      <RoleEditor roles={roles} availableRoles={available} onSubmit={() => {}} />,
    );
    await wait();
    stdin.write("a");
    await wait();
    expect(lastFrame()).toContain("Marca roles a agregar");
  });

  it("can remove a removable role: q -> down (skip indispensables) -> space -> Enter -> Enter (continue)", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <RoleEditor roles={roles} availableRoles={available} onSubmit={onSubmit} />,
    );
    await wait();
    stdin.write("q"); // remove mode
    await wait();
    stdin.write("\u001b[B"); // cursor on ba
    await wait();
    stdin.write("\u001b[B"); // cursor on fe (removable)
    await wait();
    stdin.write(" "); // mark fe
    await wait();
    stdin.write("\r"); // commit removal
    await wait();
    stdin.write("\r"); // continue
    await wait();
    expect(onSubmit).toHaveBeenCalledWith(["pm", "ba"]);
  });
});
