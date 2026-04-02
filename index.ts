#!/usr/bin/env bun
import path from "node:path";
import { $ } from "bun";
import { generate } from "random-words";

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

export function generateCodename(): string {
  return generate({ exactly: 2, join: "-" }) as string;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getGitRoot(): Promise<string> {
  const result = await $`git rev-parse --show-toplevel`.text();
  return result.trim();
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
  const targetPath = buildTargetPath(gitRoot, repoName, name);

  try {
    await $`test -d ${targetPath}`.quiet();
  } catch {
    console.error(`Error: worktree '${name}' not found`);
    process.exit(1);
  }

  process.chdir(targetPath);
  Bun.spawnSync([process.env.SHELL ?? "zsh"], {
    stdio: ["inherit", "inherit", "inherit"],
  });
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
    default:
      console.error("Usage: worktree <command>");
      console.error("Commands:");
      console.error("  add [branchName]   create a new worktree (generates codename if omitted)");
      console.error("  switch <name>      open a subshell in the worktree directory");
      console.error("  checkout <name>    alias for switch");
      process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
