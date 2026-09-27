import {
  ArrowUpRight01Icon,
  BookOpen01Icon,
  BubbleChatIcon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/card";

export function DashboardQuickActions({
  moduleId,
  chatHref,
}: {
  moduleId?: string;
  chatHref: string;
}) {
  const actions = [
    {
      label: moduleId ? "Buat Practice" : "Pilih modul untuk Practice",
      href: moduleId ? `/modules/${moduleId}/practice/new` : "/modules",
      icon: Task01Icon,
      tone: "bg-(--flashcard-lavender-surface) text-(--flashcard-lavender-ink)",
    },
    {
      label: "Tanya Timo",
      href: chatHref,
      icon: BubbleChatIcon,
      tone: "bg-secondary text-secondary-foreground",
    },
    {
      label: "Pustaka",
      href: "/sources",
      icon: BookOpen01Icon,
      tone: "bg-(--flashcard-peach-surface) text-(--flashcard-peach-ink)",
    },
  ];
  return (
    <Card className="gap-2 border p-5">
      <h2 className="font-display text-sm font-extrabold">Tindakan cepat</h2>
      <nav aria-label="Tindakan cepat" className="grid gap-0.5">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.href}
            className="flex min-h-10 items-center gap-2.5 rounded-lg py-2 text-xs font-semibold hover:text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${action.tone}`}>
              <HugeiconsIcon icon={action.icon} size={17} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span>{action.label}</span>
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              size={14}
              strokeWidth={1.5}
              aria-hidden="true"
              className="ml-auto shrink-0 text-muted-foreground"
            />
          </Link>
        ))}
      </nav>
    </Card>
  );
}
