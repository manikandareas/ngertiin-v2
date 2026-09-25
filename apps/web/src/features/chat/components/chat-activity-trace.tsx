import {
  type ChatActivity,
  type ChatInteraction,
  type ChatRunStatus,
  isChatRunActive,
} from "@ngertiin/contracts/api";
import {
  Check,
  ChevronDown,
  CirclePause,
  CircleStop,
  Globe,
  LoaderCircle,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import { CHAT_AGENT_NAME } from "../constants";
import { InteractionHistory } from "./chat-interaction-history";
import { ChatMascot } from "./chat-mascot";
import { ToolResultViewport } from "./chat-tool-result-viewport";

const activityStates = {
  running: { icon: LoaderCircle, label: "Sedang berjalan" },
  completed: { icon: Check, label: "Selesai" },
  waiting: { icon: CirclePause, label: "Menunggu jawabanmu" },
  cancelled: { icon: CircleStop, label: "Dihentikan" },
  failed: { icon: TriangleAlert, label: "Tidak selesai" },
};

export function ChatActivityTrace({
  activities,
  interactions = [],
  active,
  status,
  hasText,
}: {
  activities: ChatActivity[];
  interactions?: ChatInteraction[];
  active: boolean;
  status?: ChatRunStatus;
  hasText: boolean;
}) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const waiting = status === "waiting_for_input";
  const stopped = status === "cancelled";
  const failed = status === "failed" || status === "timed_out" || status === "interrupted";
  const working = active && (!status || isChatRunActive(status));
  useEffect(() => {
    // Completion closes even a manually opened trace; later clicks can reopen it.
    if (!working) setManualExpanded(null);
  }, [working]);
  const running = [...activities].reverse().find((item) => item.status === "running");
  const history = interactions.filter((item) => item.status !== "pending");
  const hasDetails = activities.length > 0 || history.length > 0;
  const expanded = manualExpanded ?? working;
  let label: string = CHAT_AGENT_NAME;
  if (working) {
    label = running ? `${running.label}…` : hasText ? "Menyusun jawaban…" : "Menyiapkan jawaban…";
  }
  if (waiting) {
    label = "Menunggu jawabanmu";
  } else if (status === "cancelling") {
    label = "Menghentikan jawaban…";
  } else if (stopped) {
    label = "Dihentikan";
  } else if (failed) {
    label = "Proses terhenti";
  }
  const header = (
    <>
      <ChatMascot className="size-8" thinking={working} />
      <span
        role="status"
        aria-live="polite"
        className={`min-w-0 truncate text-left text-foreground ${working ? "chat-activity-shimmer" : "text-xs font-bold"}`}
        title={label}
      >
        {label}
      </span>
      {hasDetails ? (
        <ChevronDown
          aria-hidden
          className={`size-3.5 shrink-0 transition-[transform,opacity] motion-reduce:transition-none ${expanded ? "rotate-180" : ""} ${working || expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}
        />
      ) : null}
    </>
  );
  return (
    <Collapsible
      open={hasDetails && expanded}
      onOpenChange={setManualExpanded}
      className="mb-3 text-[13px] leading-5 text-muted-foreground"
    >
      {hasDetails ? (
        <CollapsibleTrigger
          aria-label={label}
          className="group -ml-1.5 flex max-w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          {header}
        </CollapsibleTrigger>
      ) : (
        <div className="flex max-w-full items-center gap-2 py-1">{header}</div>
      )}
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-200 motion-reduce:animate-none">
        <div className="mt-2 space-y-3 py-1 sm:ml-2">
          {activities.map((item) => {
            const linked = history.filter((entry) => entry.activityId === item.id);
            if (linked.length)
              return (
                <div key={item.id} className="space-y-3">
                  {linked.map((interaction) => (
                    <InteractionHistory key={interaction.id} interaction={interaction} />
                  ))}
                </div>
              );
            if (item.kind === "reasoning") {
              return item.text ? (
                <p
                  key={item.id}
                  className="whitespace-pre-wrap break-words text-foreground leading-7"
                >
                  {item.text}
                </p>
              ) : null;
            }
            const state =
              item.status === "running" && !working
                ? waiting
                  ? "waiting"
                  : stopped
                    ? "cancelled"
                    : "failed"
                : item.status;
            const Icon =
              state === "running" ? LoaderCircle : item.kind === "search" ? Globe : Wrench;
            const title = item.query ? `${item.label}: “${item.query}”` : item.label;
            if (!item.text && !item.results?.length && state !== "running") {
              return (
                <div key={item.id} title={title} className="flex min-h-8 items-center gap-2 py-1">
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{title}</span>
                  <span className="sr-only">{activityStates[state].label}</span>
                  {state !== "completed" ? (
                    <span className="text-xs">{activityStates[state].label}</span>
                  ) : null}
                </div>
              );
            }
            return (
              <details key={item.id} className="group/tool">
                <summary
                  title={title}
                  className="flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-md py-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
                >
                  <Icon
                    aria-hidden
                    className={`size-4 shrink-0 ${state === "running" ? "motion-safe:animate-spin" : ""}`}
                  />
                  <span className="min-w-0 flex-1 truncate">{title}</span>
                  {state !== "completed" && state !== "running" ? (
                    <span className="shrink-0 text-xs">{activityStates[state].label}</span>
                  ) : (
                    <span className="sr-only">{activityStates[state].label}</span>
                  )}
                  <ChevronDown
                    aria-hidden
                    className="group-open/tool:rotate-180 size-3.5 shrink-0"
                  />
                </summary>
                <ToolResultViewport>
                  {item.text ? (
                    <p className="mb-2 whitespace-pre-wrap break-words">{item.text}</p>
                  ) : null}
                  {item.results?.length ? (
                    <ol className="space-y-4">
                      {item.results.map((result, index) => (
                        <li key={result.url ?? index}>
                          <div className="flex items-baseline gap-2">
                            <span className="min-w-5 shrink-0 rounded-sm border border-border px-1 text-center text-[11px] leading-4">
                              {index + 1}
                            </span>
                            {result.url ? (
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-words text-link hover:underline"
                              >
                                {result.title}
                              </a>
                            ) : (
                              <span className="break-words text-foreground">{result.title}</span>
                            )}
                          </div>
                          {result.url ? (
                            <p className="mt-1 break-all text-xs">{result.url}</p>
                          ) : null}
                          {result.description ? (
                            <p className="mt-1 whitespace-pre-wrap break-words">
                              {result.description}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : !item.text ? (
                    <p>
                      {state === "running"
                        ? "Menunggu hasil…"
                        : state === "completed"
                          ? "Aktivitas selesai. Tidak ada rincian hasil."
                          : activityStates[state].label}
                    </p>
                  ) : null}
                </ToolResultViewport>
              </details>
            );
          })}
          {history
            .filter((item) => !activities.some((activity) => activity.id === item.activityId))
            .map((item) => (
              <InteractionHistory key={item.id} interaction={item} />
            ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
