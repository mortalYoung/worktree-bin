import { generate } from "random-words";

export function generateCodename(): string {
  return generate({ exactly: 2, join: "-" }) as string;
}
