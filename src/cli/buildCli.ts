import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import type { ArgumentsCamelCase, Argv } from "yargs";
import { shouldCompleteWorktreeNames } from "../domain/completion";
import type { SupportedShell } from "../domain/types";
import { commandAdd } from "../commands/add";
import { commandCompletion } from "../commands/completion";
import { commandList, commandListPorcelain } from "../commands/list";
import { commandPrune } from "../commands/prune";
import { commandRemove } from "../commands/remove";
import { commandSwitch } from "../commands/switch";
import { getWorktreeNameCompletions } from "./completion";

const CLI_NAME = "worktree";
const INTERNAL_COMPLETION_COMMAND = "__completion";

export function buildCli(argv = hideBin(process.argv)): Argv {
  return yargs(argv)
    .scriptName(CLI_NAME)
    .strictCommands()
    .demandCommand(1)
    .recommendCommands()
    .help()
    .showHelpOnFail(true)
    .completion(
      INTERNAL_COMPLETION_COMMAND,
      false,
      async (
        current: string,
        parsedArgv: ArgumentsCamelCase,
        fallback: (done: (err: unknown, completions?: string[]) => void) => void,
        done: (completions: string[]) => void
      ) => {
      if (!shouldCompleteWorktreeNames(parsedArgv)) {
        fallback((_: unknown, completions?: string[]) => {
          done(completions ?? []);
        });
        return;
      }

      const [defaultCompletions, worktreeCompletions] = await Promise.all([
        new Promise<string[]>((resolve) => {
          fallback((_: unknown, completions?: string[]) => resolve(completions ?? []));
        }),
        getWorktreeNameCompletions(current),
      ]);

      done([...new Set([...defaultCompletions, ...worktreeCompletions])]);
      }
    )
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
      (command) =>
        command.option("porcelain", {
          type: "boolean",
          default: false,
          describe: "Print raw porcelain output for scripting",
        }),
      async (args) => {
        if (args.porcelain) {
          await commandListPorcelain();
          return;
        }

        await commandList();
      }
    )
    .command(
      "prune",
      "prune non-root worktrees whose remote branches are missing",
      (command) => command,
      async () => {
        await commandPrune();
      }
    )
    .command({
      command: "remove <name>",
      describe: "remove a worktree and clean up an empty managed worktree directory",
      builder: (command) =>
        command.positional("name", {
          type: "string",
          describe: "Sanitized worktree name",
        }),
      handler: async (args) => {
        await commandRemove(String(args.name));
      },
    })
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
        commandCompletion({
          shell: args.shell as SupportedShell | undefined,
          script: Boolean(args.script),
        });
      }
    );
}
