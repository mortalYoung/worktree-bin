export type WorktreeEntry = {
  path: string;
  branchName: string;
  codeName: string;
  isCurrent: boolean;
};

export type SupportedShell = "bash" | "zsh";
export type PromptFn = (message: string) => Promise<boolean>;
