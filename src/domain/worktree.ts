import path from "node:path";
import type { WorktreeEntry } from "./types";

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

export function parseWorktreeList(
  porcelainOutput: string,
  gitRoot: string,
  _repoName: string
): WorktreeEntry[] {
  const blocks = porcelainOutput
    .trim()
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split("\n");
    const worktreePath = lines.find((line) => line.startsWith("worktree "))?.slice(9) ?? "";
    const branchRef = lines.find((line) => line.startsWith("branch "))?.slice(7) ?? "";
    const branchName = branchRef.startsWith("refs/heads/")
      ? branchRef.slice("refs/heads/".length)
      : "(detached)";
    const isCurrent = worktreePath === gitRoot;
    const codeName = isCurrent ? "root" : path.basename(worktreePath);

    return {
      path: worktreePath,
      branchName,
      codeName,
      isCurrent,
    };
  });
}

export function formatWorktreeList(entries: WorktreeEntry[]): string[] {
  const branchWidth = Math.max("BRANCH".length, ...entries.map((entry) => entry.branchName.length));
  const codeWidth = Math.max("CODE-NAME".length, ...entries.map((entry) => entry.codeName.length));

  const lines = [
    `${"CURRENT".padEnd(7)}  ${"BRANCH".padEnd(branchWidth)}  ${"CODE-NAME".padEnd(codeWidth)}`,
  ];

  for (const entry of entries) {
    lines.push(
      `${entry.isCurrent ? "*" : " "}`.padEnd(7) +
        `  ${entry.branchName.padEnd(branchWidth)}  ${entry.codeName.padEnd(codeWidth)}`
    );
  }

  return lines;
}
