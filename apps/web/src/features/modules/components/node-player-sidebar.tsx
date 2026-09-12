import type { PublicActivity } from "@ngertiin/contracts/api";
import { type JSX, useEffect, useId, useRef, useState } from "react";
import styles from "./node-player.module.css";

interface NodePlayerSidebarProps {
  title: string;
  activities: PublicActivity[];
  slide: number;
  showResult: boolean;
}

function getActivityTitle(activity: PublicActivity): string {
  switch (activity.type) {
    case "lesson":
      return "format" in activity.content
        ? activity.content.title
        : activity.content.introduction?.trim() || activity.content.explanation;
    case "flashcard":
      return activity.content.cards[0]?.front || "Kartu pengingat";
    case "multiple_choice":
      return activity.content.question;
    case "true_false":
      return activity.content.statement;
    case "short_answer":
      return activity.content.prompt;
  }
}

export function NodePlayerSidebar({
  title,
  activities,
  slide,
  showResult,
}: NodePlayerSidebarProps): JSX.Element {
  const [isContentsOpen, setContentsOpen] = useState(false);
  const contentsId = useId();
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!showResult) {
      const list = listRef.current;
      const item = list?.children[slide] as HTMLElement | undefined;
      if (!list || !item) return;
      if (list.scrollWidth > list.clientWidth) {
        list.scrollTo({ left: item.offsetLeft });
      } else if (list.scrollHeight > list.clientHeight) {
        list.scrollTo({ top: item.offsetTop });
      }
    }
  }, [slide, showResult]);

  return (
    <aside
      aria-label="Ringkasan node"
      className={`${styles.sidebar} flex min-h-0 min-w-0 flex-col self-start md:sticky md:top-24 md:max-h-[calc(100dvh-8rem)]`}
      data-open={isContentsOpen}
      onMouseEnter={() => setContentsOpen(true)}
      onMouseLeave={() => setContentsOpen(false)}
      onFocus={() => setContentsOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setContentsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setContentsOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-label={`Daftar isi: ${title}`}
        aria-expanded={isContentsOpen}
        aria-controls={contentsId}
        onClick={() => setContentsOpen(true)}
      >
        {showResult ? (
          <span className={styles.line} data-active="true" />
        ) : (
          activities.map((activity, index) => (
            <span key={activity.id} className={styles.line} data-active={index === slide} />
          ))
        )}
      </button>
      <div id={contentsId} className={`${styles.contents} gap-5 md:gap-9`}>
        <h1 className="shrink-0 break-words font-display text-xl font-extrabold leading-tight tracking-tight md:text-3xl">
          {title}
        </h1>
        {showResult ? (
          <p className="text-sm font-bold text-link">Hasil belajar</p>
        ) : (
          <ol
            ref={listRef}
            aria-label="Aktivitas dalam node"
            className="relative flex gap-6 overflow-auto pb-2 md:min-h-0 md:flex-col md:gap-5"
          >
            {activities.map((activity, index) => {
              const activityTitle = getActivityTitle(activity);
              return (
                <li
                  key={activity.id}
                  aria-current={index === slide ? "step" : undefined}
                  className={`flex w-56 shrink-0 items-baseline gap-3 text-sm md:w-auto ${index === slide ? "font-extrabold text-link" : "text-muted-foreground"}`}
                >
                  <span className="shrink-0 text-xs tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 line-clamp-2 break-words" title={activityTitle}>
                    {activityTitle}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}
