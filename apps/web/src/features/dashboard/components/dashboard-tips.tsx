import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BubbleChatIcon,
  MegaphoneIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";

export function DashboardTips({
  learningHref,
  chatHref,
}: {
  learningHref: string;
  chatHref: string;
}) {
  const [index, setIndex] = useState(0);
  const tips = [
    {
      title: "Belajar juga bisa didengar.",
      description: "Putar audio materi dan ikuti paragraf yang sedang dibacakan.",
      href: learningHref,
    },
    {
      title: "Bingung? Mulai dari satu pertanyaan.",
      description: "Bahas bagian yang belum kamu pahami bersama Timo.",
      href: chatHref,
    },
  ];
  const tip = tips[index];
  return (
    <section
      aria-labelledby="dashboard-tips-heading"
      className="rounded-card bg-[light-dark(#f2f0e9,#252522)] p-5"
    >
      <h2
        id="dashboard-tips-heading"
        className="flex items-center gap-2 font-display text-base font-extrabold"
      >
        <HugeiconsIcon
          icon={MegaphoneIcon}
          size={17}
          strokeWidth={1.5}
          aria-hidden="true"
          className="text-adaptive-foreground"
        />
        Pengumuman
      </h2>
      <div className="mt-4" aria-live="polite" aria-atomic="true">
        <h3 className="font-display text-[15px] leading-snug font-medium">{tip.title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{tip.description}</p>
        <div
          aria-hidden="true"
          className="mt-3.5 rounded-xl bg-card p-3.5 text-[11px] leading-relaxed"
        >
          {index === 0 ? (
            <>
              <span className="bg-adaptive-subtle px-1 py-0.5 text-adaptive-foreground">
                Pemahaman tumbuh, satu paragraf demi satu paragraf.
              </span>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-link">
                <HugeiconsIcon icon={PlayIcon} size={13} strokeWidth={1.5} />
                <span className="h-0.5 min-w-4 flex-1 rounded bg-secondary" />
                Audio materi
              </div>
            </>
          ) : (
            <>
              <span className="font-bold">Kamu</span>
              <p className="mt-1 text-muted-foreground">Bisa jelaskan dengan contoh sederhana?</p>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-link">
                <HugeiconsIcon icon={BubbleChatIcon} size={14} strokeWidth={1.5} />
                Bahas bersama Timo
              </div>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-muted-foreground"
            aria-label="Tips sebelumnya"
            onClick={() => setIndex((index + tips.length - 1) % tips.length)}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={1.5} />
          </Button>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {index + 1} / {tips.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-muted-foreground"
            aria-label="Tips berikutnya"
            onClick={() => setIndex((index + 1) % tips.length)}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={1.5} />
          </Button>
        </div>
        <Button asChild variant="link" size="sm" className="h-8 px-0 text-[11px]">
          <Link to={tip.href} aria-label={`Coba: ${tip.title}`}>
            Coba{" "}
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
