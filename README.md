# worktree-bin

A CLI tool for creating git worktrees with an opinionated directory convention.

## Install

```bash
bun link
```

## Usage

```bash
worktree add <branchName>
```

Creates a worktree at `../<repo-name>.worktrees/<branchName>` relative to the repository root.

- If the branch does not exist, it is created automatically.
- Branch names with slashes (e.g. `feature/foo`) are normalized to dashes in the directory name (`feature-foo`), while the actual branch name remains unchanged.
- If a `.vscode` directory exists in the repository root, it is copied into the new worktree automatically.

**Example:**

```bash
# Inside ~/Projects/my-app
worktree add feature/my-feature

# Creates worktree at:
# ~/Projects/my-app.worktrees/feature-my-feature
# with branch: feature/my-feature
```

## Development

```bash
bun install   # install dependencies
bun test      # run tests
```
