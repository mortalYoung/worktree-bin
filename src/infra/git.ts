import path from "node:path";
import { $ } from "bun";
import { parseWorktreeList } from "../domain/worktree";
import type { WorktreeEntry } from "../domain/types";

export async function getGitRoot(): Promise<string> {
  const result = await $`git rev-parse --show-toplevel`.text();
  return result.trim();
}

export async function getPrimaryGitRoot(): Promise<string> {
  const result = await $`git rev-parse --path-format=absolute --git-common-dir`.text();
  return path.dirname(result.trim());
}

export async function getPorcelainWorktreeList(): Promise<string> {
  return await $`git worktree list --porcelain`.text();
}

export async function getWorktreeEntries(
  gitRoot: string,
  porcelain?: string
): Promise<WorktreeEntry[]> {
  const repoName = path.basename(gitRoot);
  const source = porcelain ?? (await getPorcelainWorktreeList());
  return parseWorktreeList(source, gitRoot, repoName);
}

export async function getCurrentWorktreeEntries(): Promise<WorktreeEntry[]> {
  const gitRoot = await getPrimaryGitRoot();
  const porcelain = await getPorcelainWorktreeList();
  return getWorktreeEntries(gitRoot, porcelain);
}

export async function doesLocalBranchExist(branchName: string): Promise<boolean> {
  try {
    await $`git show-ref --verify refs/heads/${branchName}`.quiet();
    return true;
  } catch {
    return false;
  }
}

export async function addExistingBranchWorktree(
  targetPath: string,
  branchName: string
): Promise<void> {
  await $`git worktree add ${targetPath} ${branchName}`;
}

export async function addNewBranchWorktree(
  targetPath: string,
  branchName: string
): Promise<void> {
  await $`git worktree add -b ${branchName} ${targetPath}`;
}

export async function removeGitWorktree(worktreePath: string, force = false): Promise<void> {
  if (force) {
    await $`git worktree remove --force ${worktreePath}`;
  } else {
    await $`git worktree remove ${worktreePath}`;
  }
}

export async function fetchAllPrune(): Promise<void> {
  await $`git fetch --all --prune`;
}

export async function listRemoteBranches(): Promise<string[]> {
  return (await $`git for-each-ref --format=${"%(refname:short)"} refs/remotes`.text())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.endsWith("/HEAD"));
}
