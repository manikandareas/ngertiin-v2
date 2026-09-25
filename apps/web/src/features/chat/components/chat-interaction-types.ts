import type { ChatInteraction, RespondChatInteraction } from "@ngertiin/contracts/api";

export type InteractionFormProps = {
  interaction: ChatInteraction;
  busy: boolean;
  statusLabel: string;
  submit: (decision: RespondChatInteraction) => Promise<void>;
};
