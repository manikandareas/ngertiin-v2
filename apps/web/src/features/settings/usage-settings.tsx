import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import { useUsage } from "../usage/use-usage";
import { SettingsRow } from "./settings-row";
export function UsageSettings({ timezone }: { timezone: string }) {
  const usage = useUsage();
  if (!usage.data)
    return (
      <div className="space-y-3 py-8" role="status">
        <p>{usage.isError ? "Penggunaan belum dapat dimuat." : "Memuat penggunaan…"}</p>
        {usage.isError && (
          <Button type="button" onClick={() => void usage.refetch()} disabled={usage.isFetching}>
            Coba lagi
          </Button>
        )}
      </div>
    );
  return (
    <>
      <SettingsRow
        title="Kuota minggu ini"
        description={`Diisi ulang ${new Intl.DateTimeFormat("id-ID", { timeZone: timezone, dateStyle: "full", timeStyle: "short" }).format(new Date(usage.data.resetAt))} (${timezone}).`}
      >
        {(["modules", "sources"] as const).map((key) => {
          const quota = usage.data[key];
          return (
            <div key={key} className="space-y-2">
              <div className="flex justify-between gap-4 text-sm">
                <span className="font-semibold">
                  {key === "modules" ? "Modul" : "Sumber belajar"}
                </span>
                <span>
                  {quota.used} / {quota.limit} dipakai
                </span>
              </div>
              <Progress
                max={quota.limit}
                value={quota.used}
                aria-label={key === "modules" ? "Pemakaian modul" : "Pemakaian sumber"}
              />
              <p className="text-sm text-muted-foreground">
                Sisa {quota.remaining} dari {quota.limit} minggu ini.
              </p>
            </div>
          );
        })}
        {usage.isError && (
          <p role="alert" className="text-sm text-destructive">
            Pembaruan penggunaan gagal. Data terakhir ditampilkan.{" "}
            <button type="button" className="underline" onClick={() => void usage.refetch()}>
              Coba lagi
            </button>
          </p>
        )}
      </SettingsRow>
      {usage.data.activeModuleId && (
        <SettingsRow
          title="Pembuatan sedang berjalan"
          description="Lanjutkan proses modul yang sudah kamu mulai."
        >
          <Button type="button" asChild>
            <Link to={`/modules/new?moduleId=${usage.data.activeModuleId}`}>
              Lanjutkan pembuatan modul
            </Link>
          </Button>
        </SettingsRow>
      )}
    </>
  );
}
