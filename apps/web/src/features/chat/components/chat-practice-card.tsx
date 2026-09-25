import { practiceDetailResponseSchema } from "@ngertiin/contracts/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { requestApi, type TokenResolver } from "../../../lib/api";

export function ChatPracticeCard({
  practiceId,
  moduleId,
  getToken,
}: {
  practiceId: string;
  moduleId: string;
  getToken: TokenResolver;
}) {
  const practice = useQuery({
    queryKey: ["practice", practiceId],
    queryFn: async () =>
      (await requestApi(`/practices/${practiceId}`, getToken, practiceDetailResponseSchema)).data,
    refetchInterval: (query) =>
      query.state.data?.status === "ready" || query.state.data?.status === "failed" ? false : 3000,
  });
  return (
    <div className="mt-4 max-w-xl rounded-2xl border bg-card p-4 text-sm shadow-sm">
      <p className="font-semibold">{practice.data?.title ?? "Latihan sedang dibuat"}</p>
      <p className="mt-1 text-muted-foreground">
        {practice.isError
          ? "Status latihan belum dapat dimuat"
          : practice.data?.status === "ready"
            ? "Siap dikerjakan"
            : practice.data?.status === "failed"
              ? "Pembuatan belum berhasil"
              : "Menyusun latihan…"}
      </p>
      <Link
        className="mt-3 inline-block font-medium text-primary underline underline-offset-4"
        to={`/modules/${moduleId}/practice/${practiceId}`}
      >
        Lihat latihan
      </Link>
    </div>
  );
}
