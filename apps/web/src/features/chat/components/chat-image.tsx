import type { ChatImage } from "@ngertiin/contracts/api";
import { useQuery } from "@tanstack/react-query";
import { WikimediaImage } from "../../../components/wikimedia-image";

type ChatImageViewProps = { image: ChatImage; load: () => Promise<string> };

export function ChatImageView({ image, load }: ChatImageViewProps) {
  const url = useQuery({
    queryKey: ["chat-image", image.id],
    queryFn: load,
    staleTime: 10 * 60 * 1000,
    gcTime: 0,
    retry: false,
  });
  if (!url.data) {
    return url.isPending ? (
      <span className="my-4 block text-xs text-muted-foreground" role="status">
        Memuat ilustrasi…
      </span>
    ) : null;
  }
  return <WikimediaImage image={{ ...image, url: url.data }} refresh={load} />;
}
