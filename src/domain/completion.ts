import type { ArgumentsCamelCase } from "yargs";
import type { SupportedShell } from "./types";

const CLI_NAME = "worktree";

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
  const commandIndex = tokens.findIndex(
    (token) => token === "switch" || token === "checkout" || token === "remove"
  );

  if (commandIndex === -1) {
    return false;
  }

  return tokens.length - commandIndex - 1 <= 1;
}
