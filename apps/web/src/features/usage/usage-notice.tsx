import { Link } from "react-router-dom";
import { formatUsageReset } from "./usage-presentation";
import { useUsage } from "./use-usage";

export function UsageNotice({
  category,
  showQuota = true,
}: {
  category: "modules" | "sources";
  showQuota?: boolean;
}) {
  const query = useUsage();
  const usage = query.data;
  if (!usage)
    return (
      <p role="status" className="text-xs text-muted-foreground">
        {query.isError ? "Kuota belum dapat dimuat." : "Memuat kuota…"}
      </p>
    );
  const quota = usage[category];
  const label = category === "modules" ? "modul" : "bahan";
  return (
    <div role="status" className="space-y-2 text-xs leading-relaxed text-muted-foreground">
      {showQuota ? (
        <p>
          {quota.remaining
            ? `Sisa ${quota.remaining} dari ${quota.limit} ${label} minggu ini.`
            : `Kuota ${label} minggu ini habis. Tersedia lagi ${formatUsageReset(usage.resetAt)}.`}
        </p>
      ) : null}
      {category === "modules" && usage.activeModuleId ? (
        <Link
          className="block text-link underline underline-offset-4"
          to={`/modules/new?moduleId=${usage.activeModuleId}`}
        >
          Lihat modul yang sedang dibuat
        </Link>
      ) : null}
    </div>
  );
}
