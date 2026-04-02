# worktree-bin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个全局 CLI 工具 `worktree`，支持 `worktree add <branchName>` 命令，将 git worktree 创建到约定路径并自动复制 `.vscode`。

**Architecture:** 单文件 `index.ts` 包含所有逻辑，纯函数（sanitizeBranchName、buildTargetPath）单独导出供测试，主逻辑在 `main()` 中通过 `Bun.$` 执行 shell 命令。`package.json` 新增 `bin` 字段，通过 `bun link` 全局安装。

**Tech Stack:** Bun, TypeScript, Bun.$（shell 命令执行），node:path（路径拼接），bun:test（单元测试）

---

### Task 1: 更新 package.json，添加 bin 字段

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 修改 package.json**

将文件内容改为：

```json
{
  "name": "worktree-bin",
  "module": "index.ts",
  "type": "module",
  "private": true,
  "bin": {
    "worktree": "./index.ts"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: 验证 JSON 合法**

```bash
bun run -e "import pkg from './package.json'; console.log(pkg.bin)"
```

Expected output:
```
{ worktree: './index.ts' }
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add bin field for worktree CLI"
```

---

### Task 2: 实现并测试纯辅助函数

**Files:**
- Modify: `index.ts`
- Create: `index.test.ts`

- [ ] **Step 1: 先写测试文件（TDD - 先让测试失败）**

创建 `index.test.ts`：

```ts
import { test, expect } from "bun:test";
import { sanitizeBranchName, buildTargetPath } from "./index";

test("sanitizeBranchName: no slashes → unchanged", () => {
  expect(sanitizeBranchName("main")).toBe("main");
});

test("sanitizeBranchName: single slash → dash", () => {
  expect(sanitizeBranchName("feature/my-branch")).toBe("feature-my-branch");
});

test("sanitizeBranchName: multiple slashes → all dashes", () => {
  expect(sanitizeBranchName("feat/scope/detail")).toBe("feat-scope-detail");
});

test("buildTargetPath: normal branch", () => {
  expect(buildTargetPath("/Users/user/my-project", "my-project", "main"))
    .toBe("/Users/user/my-project.worktrees/main");
});

test("buildTargetPath: branch with slash → sanitized dir name", () => {
  expect(buildTargetPath("/Users/user/my-project", "my-project", "feature/foo"))
    .toBe("/Users/user/my-project.worktrees/feature-foo");
});
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
bun test
```

Expected: 报错 `SyntaxError` 或 `Cannot find module` —— 因为 `index.ts` 还没导出这些函数。

- [ ] **Step 3: 在 index.ts 实现这两个纯函数并导出**

将 `index.ts` 全部内容替换为：

```ts
#!/usr/bin/env bun
import path from "node:path";

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
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
bun test
```

Expected output:
```
bun test v*
index.test.ts:
✓ sanitizeBranchName: no slashes → unchanged
✓ sanitizeBranchName: single slash → dash
✓ sanitizeBranchName: multiple slashes → all dashes
✓ buildTargetPath: normal branch
✓ buildTargetPath: branch with slash → sanitized dir name
5 pass, 0 fail
```

- [ ] **Step 5: Commit**

```bash
git add index.ts index.test.ts
git commit -m "feat: add sanitizeBranchName and buildTargetPath with tests"
```

---

### Task 3: 实现 main() CLI 逻辑

**Files:**
- Modify: `index.ts`

- [ ] **Step 1: 在 index.ts 末尾追加 main() 函数及调用**

在现有 `index.ts` 内容末尾追加：

```ts
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

main();
```

同时在文件顶部的 `import path` 行下方加上：

```ts
import { $ } from "bun";
```

- [ ] **Step 2: 确认测试仍然通过（main() 不影响单元测试）**

```bash
bun test
```

Expected: 5 pass, 0 fail（与之前相同）

- [ ] **Step 3: Commit**

```bash
git add index.ts
git commit -m "feat: implement worktree add CLI command"
```

---

### Task 4: 安装并手动验证

**Files:** 无文件改动，仅验证步骤。

- [ ] **Step 1: 全局链接**

在 `worktree-bin` 仓库根目录执行：

```bash
bun link
```

Expected output 包含类似：
```
Success! worktree -> /Users/.../worktree-bin/index.ts
```

- [ ] **Step 2: 确认命令可用**

```bash
which worktree
worktree --help 2>&1 || true
```

Expected: 打印 usage 信息并以非零退出。

- [ ] **Step 3: 在一个真实 git 仓库中测试**

```bash
# 找一个现有 git 仓库
cd ~/Projects/some-git-repo

# 测试已有分支（将 main 替换为该仓库实际存在的分支名）
worktree add main

# 验证 worktree 创建成功
git worktree list
ls ../some-git-repo.worktrees/
```

Expected: 列出新建的 worktree，目录存在。

- [ ] **Step 4: 测试带斜杠的分支名**

```bash
worktree add feature/test-slash
ls ../some-git-repo.worktrees/
```

Expected: 目录名为 `feature-test-slash`，不是 `feature/test-slash`。

- [ ] **Step 5: 清理测试 worktree**

```bash
git worktree remove ../some-git-repo.worktrees/main
git worktree remove ../some-git-repo.worktrees/feature-test-slash
# 如果 -b 创建了新分支，也删除它
git branch -d feature/test-slash 2>/dev/null || true
```
