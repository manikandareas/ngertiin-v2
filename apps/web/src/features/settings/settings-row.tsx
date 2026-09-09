import type { ReactNode } from "react";
import { Separator } from "../../components/ui/separator";

export function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="grid gap-5 py-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-12">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
      <Separator />
    </>
  );
}
