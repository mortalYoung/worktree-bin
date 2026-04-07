import path from "node:path";
import { getCurrentWorktreeEntries } from "../infra/git";

const CLI_NAME = "worktree";

export async function getWorktreeNameCompletions(current = ""): Promise<string[]> {
  try {
    const entries = await getCurrentWorktreeEntries();

    return entries
      .map((entry) => entry.codeName)
      .filter((name, index, names) => names.indexOf(name) === index)
      .filter((name) => name.startsWith(current));
  } catch {
    return [];
  }
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
  const commands = ["add", "list", "prune", "remove", "switch", "checkout", "completion"];
  const shellChoices = ["bash", "zsh"];

  if (current.startsWith("-")) {
    return globalOptions.filter((option) => option.startsWith(current));
  }

  if (!command) {
    return [...commands, ...globalOptions].filter((value) => value.startsWith(current));
  }

  if ((command === "switch" || command === "checkout" || command === "remove") && tokens.length <= 1) {
    const worktreeNames = await getWorktreeNameCompletions(current);
    return [...globalOptions, ...worktreeNames].filter((value) => value.startsWith(current));
  }

  if (command === "completion" && tokens.length <= 1) {
    return [...globalOptions, ...shellChoices].filter((value) => value.startsWith(current));
  }

  return globalOptions.filter((option) => option.startsWith(current));
}
