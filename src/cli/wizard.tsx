import { render } from "ink";
import { WizardApp } from "./WizardApp.js";
import type { DataContext } from "../engine/types.js";

interface WizardOptions {
  dryRun: boolean;
}

/**
 * Mounts the Ink wizard and resolves when the wizard exits.
 */
export async function runWizard(
  ctx: DataContext,
  options: WizardOptions,
): Promise<void> {
  const { waitUntilExit } = render(<WizardApp ctx={ctx} options={options} />);
  await waitUntilExit();
}
