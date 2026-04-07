import { cleanupEmptyManagedWorktreeRoot } from "../infra/fs";
import { getCurrentWorktreeEntries, getPrimaryGitRoot, removeGitWorktree } from "../infra/git";
import type { WorktreeEntry } from "../domain/types";
import { exitNotGitRepository } from "./shared";

async function removeWorktreeEntry(gitRoot: string, entry: WorktreeEntry): Promise<void> {
  await removeGitWorktree(entry.path);
  cleanupEmptyManagedWorktreeRoot(gitRoot, entry.path);
  console.log(`✓ Removed worktree: ${entry.codeName}`);
}

export async function commandRemove(name: string): Promise<void> {
  let gitRoot: string;
  let entries: WorktreeEntry[];
  try {
    gitRoot = await getPrimaryGitRoot();
    entries = await getCurrentWorktreeEntries();
  } catch {
    exitNotGitRepository();
  }

  if (name === "root") {
    console.error("Error: cannot remove root worktree");
    process.exit(1);
  }

  const entry = entries.find((candidate) => candidate.codeName === name);

  if (!entry) {
    console.error(`Error: worktree '${name}' not found`);
    process.exit(1);
  }

  await removeWorktreeEntry(gitRoot, entry);
}

export { removeWorktreeEntry };
