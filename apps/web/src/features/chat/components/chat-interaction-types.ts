import type { ChatInteraction, RespondChatInteraction } from "@ngertiin/contracts/api";

export type InteractionInput = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  label: string;
  maxLength?: number;
};

export const interactionCardClass =
  "flex w-full min-w-0 max-h-[45dvh] flex-col overflow-hidden rounded-2xl border border-border bg-card text-sm text-card-foreground";

export type InteractionFormProps = {
  interaction: ChatInteraction;
  busy: boolean;
  statusLabel: string;
  submit: (decision: RespondChatInteraction) => Promise<void>;
};
