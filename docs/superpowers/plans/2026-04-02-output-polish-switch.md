# Output Polish + worktree switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 美化 `worktree add` 输出，新增 `worktree switch` / `checkout` 命令（在 worktree 目录开新 subshell），并在 `add` 末尾打印 switch 提示。

**Architecture:** 将 `main()` 中的命令逻辑拆成独立函数 `commandAdd` / `commandSwitch`，通过 `switch` 语句分发。所有纯辅助函数保持不变，`buildTargetPath` 可直接复用于 switch 路径计算（sanitized name 经过再次 sanitize 是幂等的）。

**Tech Stack:** Bun, TypeScript, Bun.spawnSync, bun:test

---

### Task 1: 美化 add 输出并将逻辑提取到 commandAdd

**Files:**
- Modify: `index.ts`
- Modify: `index.test.ts`

- [ ] **Step 1: 将 index.ts 中 main() 的 add 逻辑提取为 commandAdd，并更新输出**

将 `index.ts` 全部内容替换为：

```ts
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
```

- [ ] **Step 2: 运行测试，确认已有 7 个测试全部通过（重构未破坏任何东西）**

```bash
bun test
```

Expected: 7 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add index.ts
git commit -m "feat: polish add output and extract commandAdd/commandSwitch"
```

---

### Task 2: 更新 README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README.md**

将 `README.md` 内容替换为：

```markdown
# worktree-bin

A CLI tool for creating git worktrees with an opinionated directory convention.

## Install

```bash
bun link
```

## Usage

### `worktree add [branchName]`

Creates a worktree at `../<repo-name>.worktrees/<branchName>` relative to the repository root.

- If `branchName` is omitted, a random 2-word codename is generated (e.g. `strip-away`).
- Branch names with slashes (e.g. `feature/foo`) are normalized to dashes in the directory name (`feature-foo`), while the actual branch name remains unchanged.
- If a `.vscode` directory exists in the repository root, it is copied into the new worktree automatically.

**Example:**

```bash
# Inside ~/Projects/my-app
worktree add feature/my-feature
# ▶ Creating worktree: feature-my-feature
# ✓ Worktree ready
#
#   worktree switch feature-my-feature

worktree add
# ▶ No branch name provided. Using generated codename: strip-away
# ▶ Creating worktree: strip-away
# ✓ Worktree ready
#
#   worktree switch strip-away
```

### `worktree switch <name>` / `worktree checkout <name>`

Opens a new subshell in the worktree directory. Exit the subshell to return to the original directory.

`<name>` is the sanitized directory name (slashes replaced with dashes).

```bash
worktree switch feature-my-feature
# now inside ~/Projects/my-app.worktrees/feature-my-feature
# exit to go back
```

`checkout` is an alias for `switch`.

## Development

```bash
bun install   # install dependencies
bun test      # run tests
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with switch/checkout commands and new output format"
```
