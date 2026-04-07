import path from "node:path";
import { getCurrentWorktreeEntries } from "../infra/git";

const CLI_NAME = "worktree";
const GLOBAL_OPTIONS = ["--version", "--help"];
const COMMANDS = ["add", "list", "prune", "remove", "switch", "checkout", "completion"];
const ADD_OPTIONS = ["--prefix"];
const LIST_OPTIONS = ["--porcelain"];
const COMPLETION_OPTIONS = ["--script"];
const SHELL_CHOICES = ["bash", "zsh"];

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

  if (current.startsWith("-")) {
    if (command === "add") {
      return [...GLOBAL_OPTIONS, ...ADD_OPTIONS].filter((option) => option.startsWith(current));
    }

    if (command === "list") {
      return [...GLOBAL_OPTIONS, ...LIST_OPTIONS].filter((option) => option.startsWith(current));
    }

    if (command === "completion") {
      return [...GLOBAL_OPTIONS, ...COMPLETION_OPTIONS].filter((option) =>
        option.startsWith(current)
      );
    }

    return GLOBAL_OPTIONS.filter((option) => option.startsWith(current));
  }

  if (!command) {
    return [...COMMANDS, ...GLOBAL_OPTIONS].filter((value) => value.startsWith(current));
  }

  if ((command === "switch" || command === "checkout" || command === "remove") && tokens.length <= 1) {
    const worktreeNames = await getWorktreeNameCompletions(current);
    return [...GLOBAL_OPTIONS, ...worktreeNames].filter((value) => value.startsWith(current));
  }

  if (command === "completion" && tokens.length <= 1) {
    return [...GLOBAL_OPTIONS, ...SHELL_CHOICES].filter((value) => value.startsWith(current));
  }

  return GLOBAL_OPTIONS.filter((option) => option.startsWith(current));
}
