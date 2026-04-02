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

`<name>` is the sanitized directory name shown at the end of `worktree add`. Use `root` to switch back to the primary repository worktree.

If the target worktree is already the current directory, no subshell is opened.

```bash
worktree switch feature-my-feature
# now inside ~/Projects/my-app.worktrees/feature-my-feature
# type `exit` to go back
```

`checkout` is an alias for `switch`.

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

### `worktree completion [shell]`

Shows setup instructions for shell completion for `bash` or `zsh`.

- `shell` is optional. If omitted, the command detects the shell from `$SHELL`.
- The generated script includes dynamic completion for `worktree switch <name>` and `worktree checkout <name>`, using the current repository's worktree code names such as `root` or `feature-my-feature`.
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
