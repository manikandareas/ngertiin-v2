import type { PracticeAnswer } from "@ngertiin/contracts/api";

export function hasPracticeAnswer(answer: PracticeAnswer | undefined): boolean {
  return answer !== undefined && (answer.type !== "short_answer" || answer.text.trim() !== "");
}
