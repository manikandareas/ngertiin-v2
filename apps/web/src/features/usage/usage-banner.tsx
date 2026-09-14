import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Info } from "lucide-react";
import { Tooltip } from "radix-ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import { formatUsageReset } from "./usage-presentation";
import { useUsage } from "./use-usage";

export function UsageBanner() {
  const query = useUsage();
  const usage = query.data;
  const exhausted = usage?.modules.remaining === 0 || usage?.sources.remaining === 0;
  return (
    <section
      aria-label="Kuota belajar mingguan"
      className="overflow-hidden rounded-xl bg-primary text-primary-foreground dark:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
    >
      <div className="p-3">
        <h2 className="flex items-center text-xs font-semibold gap-0.5">
          Usage minggu ini
          <UsageInfoTooltip />
        </h2>
        {usage ? (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {(
                [
                  ["Modul", usage.modules],
                  ["Bahan", usage.sources],
                ] as const
              ).map(([label, quota]) => (
                <div key={label} className="flex min-w-0 flex-col">
                  <dt className="mt-1 text-[11px] text-primary-foreground">{label} tersisa</dt>
                  <dd className="order-first text-primary-foreground text-xl font-bold leading-none tabular-nums">
                    {quota.remaining}
                    <span className="ml-1 text-[11px] font-medium text-primary-foreground">
                      / {quota.limit}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            {exhausted ? (
              <p className="mt-3 text-[11px] leading-relaxed text-primary-foreground">
                Kuota yang habis tersedia lagi saat reset. Modulmu tetap bisa dipelajari.
              </p>
            ) : null}
          </>
        ) : (
          <div role="status" className="mt-3 text-xs leading-relaxed text-primary-foreground">
            {query.isError ? (
              <>
                <p>Kuota belum dapat dimuat.</p>
                <button
                  type="button"
                  onClick={() => void query.refetch()}
                  className="mt-2 rounded-sm font-semibold text-primary-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-foreground"
                >
                  Coba lagi
                </button>
              </>
            ) : (
              "Memuat sisa kuota…"
            )}
          </div>
        )}
      </div>
      <div className="relative border-t border-dashed border-[#bfba94] dark:border-[#79714b] bg-[#f3e3a1] dark:bg-[#4c442d] px-3 py-2.5 text-[#6b582c] dark:text-[#ecdaa0]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-1.5 -top-1.5 size-3 rounded-full bg-sidebar"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-1.5 -top-1.5 size-3 rounded-full bg-sidebar"
        />
        <p className="text-[11px] leading-relaxed">
          Diisi lagi {usage ? formatUsageReset(usage.resetAt) : "setiap Senin pukul 00.00 WIB"}.
        </p>
        {usage?.activeModuleId ? (
          <Link
            to={`/modules/new?moduleId=${usage.activeModuleId}`}
            className="mt-2 flex items-center justify-between gap-2 rounded-sm text-[11px] font-semibold leading-relaxed hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2e608e] dark:focus-visible:outline-[#bddfff]"
          >
            Lihat modul yang sedang dibuat
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={14}
              className="shrink-0"
              aria-hidden="true"
            />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function UsageInfoTooltip() {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label="Tentang usage minggu ini"
            onClick={() => setOpen(!open)}
            className="-my-1 inline-grid size-6 shrink-0 place-items-center rounded-full hover:bg-primary-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
          >
            <Info className="size-3" aria-hidden="true" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={8}
            collisionPadding={16}
            className="z-50 max-w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md"
          >
            <div className="space-y-2">
              <p>
                <strong className="font-semibold text-primary">Modul tersisa</strong>: jumlah modul
                baru yang masih bisa kamu buat minggu ini.
              </p>
              <p>
                <strong className="font-semibold text-primary">Bahan tersisa</strong>: jumlah bahan
                belajar yang masih bisa kamu tambahkan minggu ini.
              </p>
              <p>
                Kuota diisi ulang <strong className="font-semibold">setiap minggu</strong>. Modul
                yang sudah ada <strong className="font-semibold">tetap bisa dipelajari</strong>,
                meski kuota habis.
              </p>
            </div>
            <Tooltip.Arrow className="fill-popover" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
