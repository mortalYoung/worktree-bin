import type { PromptFn } from "../domain/types";
import { getCurrentWorktreeEntries, getPrimaryGitRoot, fetchAllPrune, listRemoteBranches } from "../infra/git";
import { promptYesNo } from "../infra/prompt";
import { removeWorktreeEntry } from "./remove";
import { exitNotGitRepository } from "./shared";

async function isWorktreeBranchPruned(branchName: string): Promise<boolean> {
  if (branchName === "(detached)") {
    return false;
  }

  const remoteBranches = await listRemoteBranches();
  return !remoteBranches.some((remoteBranch) => remoteBranch.endsWith(`/${branchName}`));
}

export async function commandPrune(prompt: PromptFn = promptYesNo): Promise<void> {
  let gitRoot: string;
  let entries;
  try {
    gitRoot = await getPrimaryGitRoot();
    entries = (await getCurrentWorktreeEntries()).filter((entry) => !entry.isCurrent);
  } catch {
    exitNotGitRepository();
  }

  console.log("▶ Pruning remote-tracking branches");
  await fetchAllPrune();

  let foundPrunedBranch = false;

  for (const entry of entries) {
    if (!(await isWorktreeBranchPruned(entry.branchName))) {
      continue;
    }

    foundPrunedBranch = true;

    const shouldDelete = await prompt(
      `Branch '${entry.branchName}' for worktree '${entry.codeName}' is gone. Delete ${entry.path}?`
    );

    if (!shouldDelete) {
      console.log(`• Kept worktree: ${entry.codeName}`);
      continue;
    }

    await removeWorktreeEntry(gitRoot, entry);
  }

  if (!foundPrunedBranch) {
    console.log("✓ No pruned worktrees found");
  }
}
