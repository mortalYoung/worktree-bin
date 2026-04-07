# worktree-bin

A CLI tool for creating git worktrees with an opinionated directory convention.

## Install

```bash
bun install
bun link
```

## Usage

### `worktree add [branchName]`

Creates a worktree at `../<repo-name>.worktrees/<branchName>` relative to the repository root.

- If `branchName` is omitted, a random 2-word codename is generated (e.g. `strip-away`).
- `--prefix <value>` prepends a prefix to generated branch names when `branchName` is omitted (e.g. `--prefix fix/` produces `fix/strip-away`).
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

worktree add --prefix fix/
# ▶ No branch name provided. Using generated codename: fix/strip-away
# ▶ Creating worktree: fix-strip-away
# ✓ Worktree ready
#
#   worktree switch fix-strip-away
```

### `worktree switch <name>` / `worktree checkout <name>`

Opens a new subshell in the worktree directory. Exit the subshell (`exit` or `Ctrl-D`) to return to the original directory.

`<name>` is the sanitized directory name shown at the end of `worktree add`. Use `root` to switch back to the primary repository worktree.

If the target worktree is already the current directory, no subshell is opened.

```bash
worktree switch feature-my-feature
# now inside ~/Projects/my-app.worktrees/feature-my-feature
# type `exit` to go back
```

`checkout` is an alias for `switch`.

### `worktree remove <name>`

Removes a non-`root` worktree by code-name using `git worktree remove`.

- `root` cannot be removed through this command.
- If the removed worktree was the last entry inside `../<repo-name>.worktrees/`, that now-empty directory is deleted too.

**Example:**

```bash
worktree remove feature-my-feature
# ✓ Removed worktree: feature-my-feature
```

### `worktree list`

Prints all worktrees for the current repository, including the git branch name and the code-name you can pass to `worktree checkout`.

The primary repository worktree is included and marked as current. Its checkout code-name is always `root`.

**Example:**

```bash
worktree list
# ▶ Available worktrees
# CURRENT  BRANCH             CODE-NAME
# *        main               root
#          feature/my-branch  feature-my-branch
#          strip-away         strip-away
#
#   worktree checkout <code-name>
```

### `worktree prune`

Fetches remotes with `--prune`, then checks every non-`root` worktree.

- If no same-named remote branch exists for a worktree branch, the CLI asks whether to delete that worktree.
- `root` is never considered for deletion.

**Example:**

```bash
worktree prune
# ▶ Pruning remote-tracking branches
# Branch 'feature/foo' for worktree 'feature-foo' is gone. Delete /Users/me/my-app.worktrees/feature-foo? [y/N]
# ✓ Removed worktree: feature-foo
```

### `worktree completion [shell]`

Shows setup instructions for shell completion for `bash` or `zsh`.

- `shell` is optional. If omitted, the command detects the shell from `$SHELL`.
- The generated script includes dynamic completion for `worktree switch <name>`, `worktree checkout <name>`, and `worktree remove <name>`, using the current repository's worktree code names such as `root` or `feature-my-feature`.
- By default, the command prints human-friendly setup steps.
- Use `--script` if you want the raw completion script itself.
- This command does not modify your shell rc files automatically.

**Examples:**

```bash
# show setup instructions
worktree completion zsh
worktree completion bash

# one-off in the current shell
source <(worktree completion zsh --script)
source <(worktree completion bash --script)

# persist for future shells
echo 'source <(worktree completion zsh --script)' >> ~/.zshrc
echo 'source <(worktree completion bash --script)' >> ~/.bashrc

# print the raw completion script
worktree completion zsh --script
```

## Development

```bash
bun install   # install dependencies
bun test      # run tests
```

## Internal Structure

The CLI is now organized around separation of concerns:

```text
src/
├── cli/        # yargs setup and completion entry helpers
├── commands/   # command flow orchestration and user-facing output
├── domain/     # pure types and logic
└── infra/      # git, filesystem, and prompt side effects
```

`index.ts` remains the Bun bin entrypoint and compatibility facade. It re-exports the public helpers used by the test suite while delegating implementation to `src/`.
