# Random Codename for worktree add Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当 `worktree add` 不传参数时，用 `random-words` 生成两词代号作为分支名，替代原来的报错退出。

**Architecture:** 新增纯函数 `generateCodename()` 封装 `random-words` 调用，`main()` 中将原来的错误退出替换为调用该函数并打印提示，`branchName` 改为 `let` 以支持重新赋值。

**Tech Stack:** Bun, TypeScript, random-words@2.0.1, bun:test

---

### Task 1: 声明 random-words 依赖并实现 generateCodename

**Files:**
- Modify: `package.json`
- Modify: `index.ts`
- Modify: `index.test.ts`

- [ ] **Step 1: 将 random-words 写入 package.json 的 dependencies**

将 `package.json` 改为：

```json
{
  "name": "worktree-bin",
  "module": "index.ts",
  "type": "module",
  "private": true,
  "bin": {
    "worktree": "./index.ts"
  },
  "dependencies": {
    "random-words": "^2.0.1"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: 先写失败测试**

先将 `index.test.ts` 第 2 行的 import 改为包含 `generateCodename`：

```ts
import { sanitizeBranchName, buildTargetPath, generateCodename } from "./index";
```

然后在文件末尾追加：

```ts
test("generateCodename: returns a string", () => {
  expect(typeof generateCodename()).toBe("string");
});

test("generateCodename: contains exactly one dash separating two non-empty words", () => {
  const name = generateCodename();
  const parts = name.split("-");
  expect(parts.length).toBe(2);
  expect(parts[0].length).toBeGreaterThan(0);
  expect(parts[1].length).toBeGreaterThan(0);
});
```

- [ ] **Step 3: 运行测试，确认失败**

```bash
bun test
```

Expected: 报错 `Export named 'generateCodename' not found`

- [ ] **Step 4: 在 index.ts 顶部新增 import 并实现 generateCodename**

在 `index.ts` 的 `import { $ } from "bun";` 行下方加入：

```ts
import { generate } from "random-words";
```

在 `buildTargetPath` 函数之后、`// Main CLI logic` 注释之前加入：

```ts
export function generateCodename(): string {
  return generate({ exactly: 2, join: "-" }) as string;
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
bun test
```

Expected:
```
 7 pass
 0 fail
Ran 7 tests across 1 file.
```

- [ ] **Step 6: 将 main() 中的错误退出替换为代号生成**

将 `index.ts` 中的：

```ts
  const [command, branchName] = args;
```

改为：

```ts
  const [command] = args;
  let branchName = args[1];
```

将：

```ts
  if (!branchName) {
    console.error("Usage: worktree add <branchName>");
    process.exit(1);
  }
```

改为：

```ts
  if (!branchName) {
    branchName = generateCodename();
    console.error(`No branch name provided. Using generated codename: ${branchName}`);
  }
```

- [ ] **Step 7: 运行测试，确认仍然全部通过**

```bash
bun test
```

Expected: 7 pass, 0 fail

- [ ] **Step 8: Commit**

```bash
git add package.json index.ts index.test.ts
git commit -m "feat: generate random codename when no branch name provided"
```
