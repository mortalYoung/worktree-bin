#!/usr/bin/env bun
import path from "node:path";
import { $ } from "bun";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

export function sanitizeBranchName(branch: string): string {
  return branch.replaceAll("/", "-");
}

export function buildTargetPath(
  gitRoot: string,
  repoName: string,
  branchName: string
): string {
  const safeName = sanitizeBranchName(branchName);
  return path.join(path.dirname(gitRoot), `${repoName}.worktrees`, safeName);
}

// ---------------------------------------------------------------------------
// Main CLI logic
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command, branchName] = args;

  // Dispatch subcommands
  if (command !== "add") {
    console.error("Usage: worktree <command>");
    console.error("Commands:");
    console.error("  add <branchName>   create a new worktree for the given branch");
    process.exit(1);
  }

  if (!branchName) {
    console.error("Usage: worktree add <branchName>");
    process.exit(1);
  }

  // Resolve git root
  let gitRoot: string;
  try {
    const result = await $`git rev-parse --show-toplevel`.text();
    gitRoot = result.trim();
  } catch {
    console.error("Error: not a git repository");
    process.exit(1);
  }

  const repoName = path.basename(gitRoot);
  const targetPath = buildTargetPath(gitRoot, repoName, branchName);

  // Check if branch already exists
  let branchExists = false;
  try {
    await $`git show-ref --verify refs/heads/${branchName}`.quiet();
    branchExists = true;
  } catch {
    branchExists = false;
  }

  // Create worktree
  if (branchExists) {
    await $`git worktree add ${targetPath} ${branchName}`;
  } else {
    await $`git worktree add -b ${branchName} ${targetPath}`;
  }

  // Copy .vscode if present (silently skip if not)
  const vscodeSource = path.join(gitRoot, ".vscode");
  try {
    await $`test -d ${vscodeSource}`.quiet();
    await $`cp -r ${vscodeSource} ${targetPath}/`;
  } catch {
    // .vscode does not exist — skip silently
  }
}

if (import.meta.main) {
  main();
}
