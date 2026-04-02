#!/usr/bin/env bun
import path from "node:path";
import { $ } from "bun";
import { generate } from "random-words";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { ArgumentsCamelCase, Argv } from "yargs";

const CLI_NAME = "worktree";
const INTERNAL_COMPLETION_COMMAND = "__completion";

const BASH_COMPLETION_TEMPLATE = `###-begin-{{app_name}}-completions-###
#
# yargs command completion script
#
# Installation: {{app_path}} {{completion_command}} >> ~/.bashrc
#    or {{app_path}} {{completion_command}} >> ~/.bash_profile on OSX.
#
_{{app_name}}_yargs_completions()
{
    local cur_word args type_list

    cur_word="\${COMP_WORDS[COMP_CWORD]}"
    args=("\${COMP_WORDS[@]}")

    # ask yargs to generate completions.
    # see https://stackoverflow.com/a/40944195/7080036 for the spaces-handling awk
    mapfile -t type_list < <({{app_path}} --get-yargs-completions "\${args[@]}")
    mapfile -t COMPREPLY < <(compgen -W "$( printf '%q ' "\${type_list[@]}" )" -- "\${cur_word}" |
        awk '/ / { print "\\""$0"\\"" } /^[^ ]+$/ { print $0 }')

    # if no match was found, fall back to filename completion
    if [ \${#COMPREPLY[@]} -eq 0 ]; then
      COMPREPLY=()
    fi

    return 0
}
complete -o bashdefault -o default -F _{{app_name}}_yargs_completions {{app_name}}
###-end-{{app_name}}-completions-###
`;

const ZSH_COMPLETION_TEMPLATE = `#compdef {{app_name}}
###-begin-{{app_name}}-completions-###
#
# yargs command completion script
#
# Installation: {{app_path}} {{completion_command}} >> ~/.zshrc
#    or {{app_path}} {{completion_command}} >> ~/.zprofile on OSX.
#
_{{app_name}}_yargs_completions()
{
  local reply
  local si=$IFS
  IFS=$'\n' reply=($(COMP_CWORD="$((CURRENT-1))" COMP_LINE="$BUFFER" COMP_POINT="$CURSOR" {{app_path}} --get-yargs-completions "\${words[@]}"))
  IFS=$si
  if [[ \${#reply} -gt 0 ]]; then
    _describe 'values' reply
  else
    _default
  fi
}
if [[ "'\${zsh_eval_context[-1]}" == "loadautofunc" ]]; then
  _{{app_name}}_yargs_completions "$@"
else
  compdef _{{app_name}}_yargs_completions {{app_name}}
fi
###-end-{{app_name}}-completions-###
`;

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

export type WorktreeEntry = {
  path: string;
  branchName: string;
  codeName: string;
  isCurrent: boolean;
};

export type SupportedShell = "bash" | "zsh";

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

export function parseWorktreeList(
  porcelainOutput: string,
  gitRoot: string,
  repoName: string
): WorktreeEntry[] {
  const worktreeRoot = path.join(path.dirname(gitRoot), `${repoName}.worktrees`);
  const blocks = porcelainOutput
    .trim()
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split("\n");
    const worktreePath = lines.find((line) => line.startsWith("worktree "))?.slice(9) ?? "";
    const branchRef = lines.find((line) => line.startsWith("branch "))?.slice(7) ?? "";
    const branchName = branchRef.startsWith("refs/heads/")
      ? branchRef.slice("refs/heads/".length)
      : "(detached)";
    const isCurrent = worktreePath === gitRoot;
    const codeName = worktreePath.startsWith(`${worktreeRoot}${path.sep}`)
      ? path.basename(worktreePath)
      : "root";

    return {
      path: worktreePath,
      branchName,
      codeName,
      isCurrent,
    };
  });
}

export function formatWorktreeList(entries: WorktreeEntry[]): string[] {
  const branchWidth = Math.max("BRANCH".length, ...entries.map((entry) => entry.branchName.length));
  const codeWidth = Math.max("CODE-NAME".length, ...entries.map((entry) => entry.codeName.length));

  const lines = [
    `${"CURRENT".padEnd(7)}  ${"BRANCH".padEnd(branchWidth)}  ${"CODE-NAME".padEnd(codeWidth)}`,
  ];

  for (const entry of entries) {
    lines.push(
      `${entry.isCurrent ? "*" : " "}`.padEnd(7) +
        `  ${entry.branchName.padEnd(branchWidth)}  ${entry.codeName.padEnd(codeWidth)}`
    );
  }

  return lines;
}

export function detectShell(shell?: string): SupportedShell {
  return shell?.includes("zsh") ? "zsh" : "bash";
}

export function renderCompletionScript(
  shell: SupportedShell,
  appPath = CLI_NAME,
  completionCommand = "completion"
): string {
  const template = shell === "zsh" ? ZSH_COMPLETION_TEMPLATE : BASH_COMPLETION_TEMPLATE;

  return template
    .replaceAll("{{app_name}}", CLI_NAME)
    .replaceAll("{{app_path}}", appPath)
    .replaceAll("{{completion_command}}", completionCommand);
}

export function renderCompletionInstructions(
  shell: SupportedShell,
  appPath = CLI_NAME
): string[] {
  const rcFile = shell === "zsh" ? "~/.zshrc" : "~/.bashrc";

  return [
    `▶ Shell completion for ${shell}`,
    "",
    "Run this once in your current shell:",
    `  source <(${appPath} completion ${shell} --script)`,
    "",
    "Persist it for future shells:",
    `  echo 'source <(${appPath} completion ${shell} --script)' >> ${rcFile}`,
    "",
    "To print the raw completion script:",
    `  ${appPath} completion ${shell} --script`,
  ];
}

export function shouldCompleteWorktreeNames(argv: ArgumentsCamelCase): boolean {
  const tokens = argv._.map((token) => String(token));
  const commandIndex = tokens.findIndex((token) => token === "switch" || token === "checkout");

  if (commandIndex === -1) {
    return false;
  }

  return tokens.length - commandIndex - 1 <= 1;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getGitRoot(): Promise<string> {
  const result = await $`git rev-parse --show-toplevel`.text();
  return result.trim();
}

async function getWorktreeEntries(gitRoot: string): Promise<WorktreeEntry[]> {
  const repoName = path.basename(gitRoot);
  const porcelain = await $`git worktree list --porcelain`.text();
  return parseWorktreeList(porcelain, gitRoot, repoName);
}

export async function getWorktreeNameCompletions(current = ""): Promise<string[]> {
  let gitRoot: string;

  try {
    gitRoot = await getGitRoot();
  } catch {
    return [];
  }

  const entries = await getWorktreeEntries(gitRoot);
  return entries
    .map((entry) => entry.codeName)
    .filter((name, index, names) => names.indexOf(name) === index)
    .filter((name) => name.startsWith(current));
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export async function commandAdd(branchName: string | undefined): Promise<void> {
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

  const vscodeSource = path.join(gitRoot, ".vscode");
  try {
    await $`test -d ${vscodeSource}`.quiet();
    await $`cp -r ${vscodeSource} ${targetPath}/`;
  } catch {
    // .vscode does not exist, skip silently.
  }

  console.log("✓ Worktree ready");
  console.log(`\n  worktree switch ${safeName}\n`);
}

export async function commandSwitch(name: string): Promise<void> {
  let gitRoot: string;
  try {
    gitRoot = await getGitRoot();
  } catch {
    console.error("Error: not a git repository");
    process.exit(1);
  }

  const repoName = path.basename(gitRoot);
  const targetPath = name === "root" ? gitRoot : buildTargetPath(gitRoot, repoName, name);
  const currentPath = process.cwd();

  try {
    await $`test -d ${targetPath}`.quiet();
  } catch {
    console.error(`Error: worktree '${name}' not found`);
    process.exit(1);
  }

  if (path.resolve(currentPath) === path.resolve(targetPath)) {
    console.log(`▶ Already in worktree: ${name}`);
    return;
  }

  process.chdir(targetPath);
  Bun.spawnSync([process.env.SHELL ?? "zsh"], {
    stdio: ["inherit", "inherit", "inherit"],
  });
}

export async function commandList(): Promise<void> {
  let gitRoot: string;
  try {
    gitRoot = await getGitRoot();
  } catch {
    console.error("Error: not a git repository");
    process.exit(1);
  }

  const entries = await getWorktreeEntries(gitRoot);

  console.log("▶ Available worktrees");
  for (const line of formatWorktreeList(entries)) {
    console.log(line);
  }
  console.log("\n  worktree checkout <code-name>");
}

// ---------------------------------------------------------------------------
// CLI setup
// ---------------------------------------------------------------------------

export function buildCli(argv = hideBin(process.argv)): Argv {
  return yargs(argv)
    .scriptName(CLI_NAME)
    .strictCommands()
    .demandCommand(1)
    .recommendCommands()
    .help()
    .showHelpOnFail(true)
    .completion(INTERNAL_COMPLETION_COMMAND, false, async (current, parsedArgv, fallback, done) => {
      if (!shouldCompleteWorktreeNames(parsedArgv)) {
        fallback((_, completions) => {
          done(completions ?? []);
        });
        return;
      }

      const [defaultCompletions, worktreeCompletions] = await Promise.all([
        new Promise<string[]>((resolve) => {
          fallback((_, completions) => resolve(completions ?? []));
        }),
        getWorktreeNameCompletions(current),
      ]);

      done([...new Set([...defaultCompletions, ...worktreeCompletions])]);
    })
    .command(
      "add [branchName]",
      "create a new worktree (generates codename if omitted)",
      (command) =>
        command.positional("branchName", {
          type: "string",
          describe: "Branch name to create or reuse for the worktree",
        }),
      async (args) => {
        await commandAdd(args.branchName as string | undefined);
      }
    )
    .command(
      "list",
      "list worktrees with branch names and code names",
      (command) => command,
      async () => {
        await commandList();
      }
    )
    .command({
      command: "switch <name>",
      aliases: ["checkout"],
      describe: "open a subshell in the worktree directory",
      builder: (command) =>
        command.positional("name", {
          type: "string",
          describe: "Sanitized worktree name or root",
        }),
      handler: async (args) => {
        await commandSwitch(String(args.name));
      },
    })
    .command(
      "completion [shell]",
      "show shell completion setup instructions",
      (command) =>
        command
          .positional("shell", {
            choices: ["bash", "zsh"] as const,
            describe: "Shell to generate the completion script for",
            type: "string",
          })
          .option("script", {
            type: "boolean",
            default: false,
            describe: "Print the raw completion script instead of setup instructions",
          }),
      (args) => {
        const shell = (args.shell as SupportedShell | undefined) ?? detectShell(process.env.SHELL);
        const output = args.script
          ? renderCompletionScript(shell)
          : renderCompletionInstructions(shell).join("\n");

        console.log(output);
      }
    );
}

export async function getCliCompletions(args: string[]): Promise<string[]> {
  const completionArgs = [...args];
  const current = completionArgs.pop() ?? "";
  const tokens =
    completionArgs[0] === CLI_NAME || path.basename(completionArgs[0] ?? "") === CLI_NAME
      ? completionArgs.slice(1)
      : completionArgs;

  const command = tokens[0];
  const globalOptions = ["--version", "--help"];
  const commands = ["add", "list", "switch", "checkout", "completion"];
  const shellChoices: SupportedShell[] = ["bash", "zsh"];

  if (current.startsWith("-")) {
    return globalOptions.filter((option) => option.startsWith(current));
  }

  if (!command) {
    return [...commands, ...globalOptions].filter((value) => value.startsWith(current));
  }

  if ((command === "switch" || command === "checkout") && tokens.length <= 1) {
    const worktreeNames = await getWorktreeNameCompletions(current);
    return [...globalOptions, ...worktreeNames].filter((value) => value.startsWith(current));
  }

  if (command === "completion" && tokens.length <= 1) {
    return [...globalOptions, ...shellChoices].filter((value) => value.startsWith(current));
  }

  return globalOptions.filter((option) => option.startsWith(current));
}

async function main(): Promise<void> {
  try {
    const args = hideBin(process.argv);
    const completionFlagIndex = args.indexOf("--get-yargs-completions");

    if (completionFlagIndex !== -1) {
      const completionArgs = args.slice(completionFlagIndex + 1);
      const completions = await getCliCompletions(completionArgs);

      for (const completion of completions) {
        console.log(completion);
      }

      return;
    }

    await buildCli(args).parseAsync();
  } catch (error) {
    if (error instanceof Error && error.message) {
      console.error(error.message);
    }
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}
