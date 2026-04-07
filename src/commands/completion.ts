import { detectShell, renderCompletionInstructions, renderCompletionScript } from "../domain/completion";
import type { SupportedShell } from "../domain/types";

export function commandCompletion(args: { shell?: SupportedShell; script: boolean }): void {
  const shell = args.shell ?? detectShell(process.env.SHELL);
  const output = args.script
    ? renderCompletionScript(shell)
    : renderCompletionInstructions(shell).join("\n");

  console.log(output);
}
