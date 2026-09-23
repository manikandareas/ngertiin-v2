import { useState } from "react";
import { cn } from "../../../lib/utils";

type ChatSourceFaviconProps = {
  url: string;
  className?: string;
};

export function ChatSourceFavicon({ url, className }: ChatSourceFaviconProps) {
  const site = new URL(url);
  const src = new URL("/favicon.ico", site.origin).href;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return failedSrc === src ? (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold uppercase text-muted-foreground",
        className,
      )}
    >
      {site.hostname.replace(/^www\./, "").charAt(0)}
    </span>
  ) : (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={16}
      height={16}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={cn("shrink-0 rounded-sm object-contain", className)}
    />
  );
}
