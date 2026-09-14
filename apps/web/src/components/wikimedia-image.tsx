import type { PublicLessonImage } from "@ngertiin/contracts/api";
import { type JSX, useRef, useState } from "react";

interface WikimediaImageProps {
  image: Omit<PublicLessonImage, "id">;
  refresh: () => Promise<string>;
}

export function WikimediaImage({ image, refresh }: WikimediaImageProps): JSX.Element | null {
  const retried = useRef(false);
  const [url, setUrl] = useState(image.url);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <span className="my-6 block">
      <img
        className="mx-auto h-auto max-w-full rounded-xl"
        src={url}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading="lazy"
        onError={async () => {
          if (retried.current) {
            setHidden(true);
            return;
          }
          retried.current = true;
          try {
            const next = await refresh();
            if (next === url) setHidden(true);
            else setUrl(next);
          } catch {
            setHidden(true);
          }
        }}
      />
      <span className="mt-2 block text-sm leading-6 text-muted-foreground">
        {image.caption}
        <br />
        {image.creator} ·{" "}
        <a href={image.sourceUrl} target="_blank" rel="noreferrer">
          Wikimedia Commons
        </a>{" "}
        ·{" "}
        <a href={image.licenseUrl} target="_blank" rel="noreferrer">
          {image.license}
        </a>
      </span>
    </span>
  );
}
