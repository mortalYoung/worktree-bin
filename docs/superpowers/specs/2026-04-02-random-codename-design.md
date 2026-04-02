# random codename for worktree add Design Spec

**Date:** 2026-04-02  
**Status:** Approved

## Overview

When `worktree add` is invoked without a branch name argument, generate a 2-word random codename using the `random-words` library and use it as the branch name, instead of exiting with an error.

## Behavior

| Invocation | Branch name used |
|------------|-----------------|
| `worktree add feature/foo` | `feature/foo` (unchanged) |
| `worktree add` | generated codename, e.g. `strip-away` |

When a codename is generated, print a message to stderr before proceeding:

```
No branch name provided. Using generated codename: strip-away
```

All subsequent steps (worktree path construction, `.vscode` copy) are identical to the explicit-name flow.

## Code Changes

### `package.json`

`random-words` moves from a transient install to a declared runtime dependency (`dependencies`, not `devDependencies`).

### `index.ts`

Add a new exported pure function:

```ts
export function generateCodename(): string {
  return generate({ exactly: 2, join: "-" }) as string;
}
```

Replace the existing `if (!branchName) { ...exit(1) }` block with:

```ts
if (!branchName) {
  const codename = generateCodename();
  console.error(`No branch name provided. Using generated codename: ${codename}`);
  branchName = codename;
}
```

Note: `branchName` must be declared with `let` instead of being destructured as a `const` to allow reassignment.

### `index.test.ts`

Add tests for `generateCodename`:

```ts
test("generateCodename: returns a string", () => {
  expect(typeof generateCodename()).toBe("string");
});

test("generateCodename: contains exactly one dash separating two words", () => {
  const name = generateCodename();
  const parts = name.split("-");
  expect(parts.length).toBe(2);
  expect(parts[0].length).toBeGreaterThan(0);
  expect(parts[1].length).toBeGreaterThan(0);
});
```

## Non-Goals

- Configurable word count (always 2)
- Seeding / reproducible codenames
- Preventing collisions with existing branches
