#!/usr/bin/env bun
import path from "node:path";
import { $ } from "bun";
import { generate } from "random-words";

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

export type WorktreeEntry = {
  path: string;
  branchName: string;
  codeName: string;
  isCurrent: boolean;
};

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

export function generateCodename(): string {
  return generate({ exactly: 2, join: "-" }) as string;
}

export function parseWorktreeList(
  porcelainOutput: string,
  gitRoot: string,
  repoName: string
): WorktreeEntry[] {
  const worktreeRoot = path.join(path.dirname(gitRoot), `${repoName}.worktrees`);
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
    const codeName = worktreePath.startsWith(`${worktreeRoot}${path.sep}`)
      ? path.basename(worktreePath)
      : "root";

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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getGitRoot(): Promise<string> {
  const result = await $`git rev-parse --show-toplevel`.text();
  return result.trim();
}

async function getWorktreeEntries(gitRoot: string): Promise<WorktreeEntry[]> {
  const repoName = path.basename(gitRoot);
  const porcelain = await $`git worktree list --porcelain`.text();
  return parseWorktreeList(porcelain, gitRoot, repoName);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function commandAdd(branchName: string | undefined): Promise<void> {
  let name = branchName;

  if (!name) {
    name = generateCodename();
    console.log(`▶ No branch name provided. Using generated codename: ${name}`);
  }

  let gitRoot: string;
  try {
    gitRoot = await getGitRoot();
  } catch {
    console.error("Error: not a git repository");
    process.exit(1);
  }

  const repoName = path.basename(gitRoot);
  const safeName = sanitizeBranchName(name);
  const targetPath = buildTargetPath(gitRoot, repoName, name);

  console.log(`▶ Creating worktree: ${safeName}`);

  let branchExists = false;
  try {
    await $`git show-ref --verify refs/heads/${name}`.quiet();
    branchExists = true;
  } catch {
    branchExists = false;
  }

  if (branchExists) {
    await $`git worktree add ${targetPath} ${name}`;
  } else {
    await $`git worktree add -b ${name} ${targetPath}`;
  }

  // Copy .vscode if present (silently skip if not)
  const vscodeSource = path.join(gitRoot, ".vscode");
  try {
    await $`test -d ${vscodeSource}`.quiet();
    await $`cp -r ${vscodeSource} ${targetPath}/`;
  } catch {
    // .vscode does not exist — skip silently
  }

  console.log(`✓ Worktree ready`);
  console.log(`\n  worktree switch ${safeName}\n`);
}

async function commandSwitch(name: string | undefined): Promise<void> {
  if (!name) {
    console.error("Usage: worktree switch <name>");
    process.exit(1);
  }

  let gitRoot: string;
  try {
    gitRoot = await getGitRoot();
  } catch {
    console.error("Error: not a git repository");
    process.exit(1);
  }

  const repoName = path.basename(gitRoot);
  const targetPath = name === "root" ? gitRoot : buildTargetPath(gitRoot, repoName, name);
  const currentPath = process.cwd();

  try {
    await $`test -d ${targetPath}`.quiet();
  } catch {
    console.error(`Error: worktree '${name}' not found`);
    process.exit(1);
  }

  if (path.resolve(currentPath) === path.resolve(targetPath)) {
    console.log(`▶ Already in worktree: ${name}`);
    return;
  }

  process.chdir(targetPath);
  Bun.spawnSync([process.env.SHELL ?? "zsh"], {
    stdio: ["inherit", "inherit", "inherit"],
  });
}

async function commandList(): Promise<void> {
  let gitRoot: string;
  try {
    gitRoot = await getGitRoot();
  } catch {
    console.error("Error: not a git repository");
    process.exit(1);
  }

  const entries = await getWorktreeEntries(gitRoot);

  console.log("▶ Available worktrees");
  for (const line of formatWorktreeList(entries)) {
    console.log(line);
  }
  console.log("\n  worktree checkout <code-name>");
}

// ---------------------------------------------------------------------------
// Main CLI dispatch
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [command] = args;
  const arg1 = args[1];

  switch (command) {
    case "add":
      await commandAdd(arg1);
      break;
    case "switch":
    case "checkout":
      await commandSwitch(arg1);
      break;
    case "list":
      await commandList();
      break;
    default:
      console.error("Usage: worktree <command>");
      console.error("Commands:");
      console.error("  add [branchName]   create a new worktree (generates codename if omitted)");
      console.error("  list               list worktrees with branch names and code names");
      console.error("  switch <name>      open a subshell in the worktree directory");
      console.error("  checkout <name>    alias for switch");
      process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
