# worktree-bin Design Spec

**Date:** 2026-04-02  
**Status:** Approved

## Overview

A global CLI tool named `worktree` built with Bun. It wraps `git worktree add` with an opinionated directory convention and automatically copies the `.vscode` configuration into the new worktree.

## Installation

```sh
bun link   # run once from the repo root
```

After linking, `worktree` is available globally via PATH.

## Usage

```sh
worktree add <branchName>
```

## File Structure

Only two files are modified from the initial Bun scaffold:

```
worktree-bin/
├── index.ts       # single entry point, all logic
├── package.json   # add bin field
└── ...
```

## Architecture

### `package.json` changes

Add a `bin` field:

```json
{
  "bin": {
    "worktree": "./index.ts"
  }
}
```

### `index.ts`

Top of file must include a shebang so Bun executes it directly:

```ts
#!/usr/bin/env bun
```

All logic lives in this file with no external dependencies. Uses `Bun.$` for shell command execution.

## Command: `worktree add <branchName>`

### Execution Steps

1. **Validate arguments** — check that `branchName` is provided; if not, print usage and exit(1).
2. **Resolve git root** — run `git rev-parse --show-toplevel` to get the absolute path of the repository root. If this fails, print an error and exit(1).
3. **Derive repo name** — take the last path segment of the git root as `{name}`.
4. **Build target path** — sanitize `branchName` by replacing all `/` with `-` to get `{safeName}`, then construct `../{name}.worktrees/{safeName}` relative to the git root. This is the path passed to `git worktree add`. Example: `feature/my-branch` → `../{name}.worktrees/feature-my-branch`.
5. **Check if branch exists** — run `git show-ref --verify refs/heads/{branchName}`.
   - Branch exists → `git worktree add <targetPath> <branchName>`
   - Branch does not exist → `git worktree add -b <branchName> <targetPath>` (git's flag to create a new branch is `-b`, not `-c`)
6. **Copy `.vscode`** — check if `{gitRoot}/.vscode` exists.
   - Exists → `cp -r {gitRoot}/.vscode {targetPath}/`
   - Does not exist → silently skip

### Error Handling

| Situation | Behavior |
|-----------|----------|
| `branchName` not provided | Print `Usage: worktree add <branchName>` and exit(1) |
| Not inside a git repository | Print `Error: not a git repository` and exit(1) |
| Target worktree path already exists | Pass git's error through to the user, exit(1) |
| `.vscode` directory not found | Silently skip, no output |
| Unknown subcommand (e.g. `worktree foo`) | Print `Usage: worktree <command>` and exit(1) |
| `branchName` contains slashes (e.g. `feature/x`) | Slashes replaced with `-` in the directory name only; the actual branch name passed to git is unchanged |

## Non-Goals (for now)

- `worktree list`, `worktree remove`, or any other subcommands
- Configuration file support
- Windows compatibility
