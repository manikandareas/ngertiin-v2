import { Shield } from "lucide-react";
import { Card } from "../../../components/ui/card";

export function LearningXpCard({ totalXp }: { totalXp: number }) {
  return (
    <Card
      role="region"
      aria-label="Total XP"
      className="flex-row items-center gap-4 bg-background px-5 py-5 sm:px-6"
    >
      <span
        aria-hidden="true"
        className="grid size-14 shrink-0 place-items-center rounded-button bg-accent text-primary"
      >
        <Shield className="size-9 fill-primary/15" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold uppercase tracking-wide">Total XP</h2>
        <p className="mt-1 break-words text-xl font-bold tabular-nums text-muted-foreground">
          {new Intl.NumberFormat("id-ID").format(totalXp)} XP
        </p>
      </div>
    </Card>
  );
}
