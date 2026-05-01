import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { ConfirmInput } from "../../../../src/cli/components/ConfirmInput.tsx";

const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe("ConfirmInput", () => {
  it("'y' resolves to true", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <ConfirmInput label="¿Continuar?" onSubmit={onSubmit} />,
    );
    await wait();
    stdin.write("y");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it("'n' resolves to false", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <ConfirmInput label="¿Continuar?" onSubmit={onSubmit} />,
    );
    await wait();
    stdin.write("n");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith(false);
  });

  it("Enter without input uses defaultValue=true", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <ConfirmInput
        label="¿Continuar?"
        defaultValue={true}
        onSubmit={onSubmit}
      />,
    );
    await wait();
    stdin.write("\r");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith(true);
  });

  it("Enter without input uses defaultValue=false", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <ConfirmInput
        label="¿Continuar?"
        defaultValue={false}
        onSubmit={onSubmit}
      />,
    );
    await wait();
    stdin.write("\r");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith(false);
  });

  it("'s' (Spanish 'sí') resolves to true", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <ConfirmInput label="¿Continuar?" onSubmit={onSubmit} />,
    );
    await wait();
    stdin.write("s");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith(true);
  });
});
