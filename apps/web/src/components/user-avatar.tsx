import { useState } from "react";
import { cn } from "../lib/utils";

export function UserAvatar({
  avatarUrl,
  name,
  className,
}: {
  avatarUrl: string;
  name: string | null;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden bg-muted font-bold text-muted-foreground",
        className,
      )}
    >
      {failedUrl === avatarUrl ? (
        Array.from(name?.trim() || "?")[0]?.toLocaleUpperCase("id-ID")
      ) : (
        <img
          src={avatarUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedUrl(avatarUrl)}
        />
      )}
    </span>
  );
}
