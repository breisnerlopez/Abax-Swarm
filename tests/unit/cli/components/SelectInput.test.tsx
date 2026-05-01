import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { SelectInput } from "../../../../src/cli/components/SelectInput.tsx";

const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe("SelectInput", () => {
  const opts = [
    { label: "Pequeño", value: "small" as const },
    { label: "Mediano", value: "medium" as const },
    { label: "Grande", value: "large" as const },
  ];

  it("renders all options and the label", () => {
    const { lastFrame } = render(
      <SelectInput label="Tamaño:" options={opts} onSubmit={() => {}} />,
    );
    const out = lastFrame() ?? "";
    expect(out).toContain("Tamaño:");
    expect(out).toContain("Pequeño");
    expect(out).toContain("Mediano");
    expect(out).toContain("Grande");
  });

  it("submits the first option when pressing Enter without moving", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <SelectInput label="Tamaño:" options={opts} onSubmit={onSubmit} />,
    );
    await wait();
    stdin.write("\r");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith("small");
  });

  it("submits the second option after one Down arrow", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <SelectInput label="Tamaño:" options={opts} onSubmit={onSubmit} />,
    );
    await wait();
    stdin.write("[B");
    await wait();
    stdin.write("\r");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith("medium");
  });
});
