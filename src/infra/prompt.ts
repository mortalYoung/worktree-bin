import { createInterface } from "node:readline/promises";

export async function promptYesNo(message: string): Promise<boolean> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const answer = (await readline.question(`${message} [y/N] `)).trim().toLowerCase();

      if (answer === "" || answer === "n" || answer === "no") {
        return false;
      }

      if (answer === "y" || answer === "yes") {
        return true;
      }
    }
  } finally {
    readline.close();
  }
}
