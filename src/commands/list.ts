import { formatWorktreeList } from "../domain/worktree";
import { getCurrentWorktreeEntries, getPorcelainWorktreeList } from "../infra/git";
import { exitNotGitRepository } from "./shared";

export async function commandList(): Promise<void> {
  try {
    const entries = await getCurrentWorktreeEntries();
    console.log("▶ Available worktrees");
    for (const line of formatWorktreeList(entries)) {
      console.log(line);
    }
    console.log("\n  worktree checkout <code-name>");
  } catch {
    exitNotGitRepository();
  }
}

export async function commandListPorcelain(): Promise<void> {
  try {
    process.stdout.write(await getPorcelainWorktreeList());
  } catch {
    exitNotGitRepository();
  }
}
