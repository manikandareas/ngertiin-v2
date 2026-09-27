import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dashboard } from "@ngertiin/contracts/api";
import { Link } from "react-router-dom";

export function DashboardStats({ stats }: Pick<Dashboard, "stats">) {
  const xp = new Intl.NumberFormat("id-ID").format(stats.totalXp);
  return (
    <section className="flex flex-wrap items-stretch gap-2.5" aria-label="Pencapaian belajar">
      <div className="flex flex-1 min-w-0 items-center gap-2 rounded-2xl bg-[light-dark(#ffe4db,#e9a18b)] px-3 py-3 text-[#713c30]">
        <svg aria-hidden="true" viewBox="0 0 44 48" className="h-10 w-8 shrink-0" fill="none">
          <path d="M9 39c6 6 21 6 27-2" stroke="#b5634d" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M23 5c2 9 12 11 12 23a13 13 0 0 1-26 0c0-5 2-9 6-13 0 5 2 7 4 8 4-5 5-11 4-18Z"
            fill="#d96b4d"
            stroke="#713c30"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M23 22c1 5 6 7 6 12a7 7 0 0 1-14 0c0-4 5-7 8-12Z" fill="#ffe8ad" />
          <path
            d="m35 9 1-3m3 8 3-1M7 11l-2-2"
            stroke="#713c30"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path d="M14 27c-1 3-1 5 0 7" stroke="#fff4e9" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div>
          <p className="font-display text-base leading-tight font-extrabold tabular-nums">
            {stats.currentStreak} <span className="text-sm font-bold">hari</span>
          </p>
          <p className="mt-1 text-[10px] font-medium">Rekor: {stats.longestStreak} hari</p>
        </div>
      </div>
      <Link
        to="/leaderboard"
        aria-label={`${xp} XP. Lihat leaderboard`}
        className="group relative flex flex-1 min-w-0 items-center gap-2 rounded-2xl bg-[light-dark(#def0df,#9fcca8)] px-3 py-3 pr-7 text-[#28533f] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transform-none"
      >
        <svg aria-hidden="true" viewBox="0 0 44 48" className="h-10 w-8 shrink-0" fill="none">
          <path
            d="m15 33-3 11 10-5 9 5-2-13"
            fill="#6d9e7d"
            stroke="#28533f"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="m22 5 5 3 6 1 2 6 4 5-3 6-1 6-6 2-7 3-6-3-6-2-1-6-3-6 4-5 2-6 6-1 4-3Z"
            fill="#f2f6ce"
            stroke="#28533f"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="m22 12 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"
            fill="#70a285"
            stroke="#28533f"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path d="m4 6 1-3m34 5 3-2" stroke="#28533f" strokeWidth="1.5" strokeLinecap="round" />
          <path d="m21 17-1 3-3 1" stroke="#eff9ed" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div>
          <p className="font-display text-base leading-tight font-extrabold tabular-nums">
            {xp} <span className="text-sm font-bold">XP</span>
          </p>
          <p className="mt-1 text-[10px] font-medium">Total XP</p>
        </div>
        <HugeiconsIcon
          icon={ArrowUpRight01Icon}
          size={12}
          strokeWidth={1.8}
          aria-hidden="true"
          className="absolute right-2.5 bottom-3.5"
        />
      </Link>
    </section>
  );
}
