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

Opens a new subshell in the worktree directory. Exit the subshell (`exit` or `Ctrl-D`) to return to the original directory.

`<name>` is the sanitized directory name shown at the end of `worktree add`.

```bash
worktree switch feature-my-feature
# now inside ~/Projects/my-app.worktrees/feature-my-feature
# type `exit` to go back
```

`checkout` is an alias for `switch`.

## Development

```bash
bun install   # install dependencies
bun test      # run tests
```
