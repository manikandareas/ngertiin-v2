import type { ChatRunError } from "@ngertiin/contracts/api";

export class LearningRunError extends Error {
  constructor(readonly code: ChatRunError) {
    super(code);
  }
}
