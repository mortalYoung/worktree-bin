#!/usr/bin/env bun
import { hideBin } from "yargs/helpers";
import { buildCli } from "./src/cli/buildCli";
import { getCliCompletions } from "./src/cli/completion";

export type { WorktreeEntry, SupportedShell, PromptFn } from "./src/domain/types";

export { generateCodename } from "./src/domain/codename";
export { buildGeneratedBranchName } from "./src/domain/branchName";
export {
  detectShell,
  renderCompletionInstructions,
  renderCompletionScript,
  shouldCompleteWorktreeNames,
} from "./src/domain/completion";
export {
  buildTargetPath,
  formatWorktreeList,
  parseWorktreeList,
  sanitizeBranchName,
} from "./src/domain/worktree";

export { commandAdd } from "./src/commands/add";
export { commandList, commandListPorcelain } from "./src/commands/list";
export { commandPrune } from "./src/commands/prune";
export { commandRemove } from "./src/commands/remove";
export { commandSwitch } from "./src/commands/switch";

export { buildCli, getCliCompletions };

async function main(): Promise<void> {
  try {
    const args = hideBin(process.argv);
    const completionFlagIndex = args.indexOf("--get-yargs-completions");

    if (completionFlagIndex !== -1) {
      const completionArgs = args.slice(completionFlagIndex + 1);
      const completions = await getCliCompletions(completionArgs);

      for (const completion of completions) {
        console.log(completion);
      }

      return;
    }

    await buildCli(args).parseAsync();
  } catch (error) {
    if (error instanceof Error && error.message) {
      console.error(error.message);
    }
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}
