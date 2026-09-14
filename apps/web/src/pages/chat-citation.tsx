import { Link, Navigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { citationDestination } from "../features/chat/citation-location";
import { useCitationLocation } from "../features/chat/use-citation-location";

export default function ChatCitationPage() {
  const citation = useCitationLocation();
  const destination = citation.data ? citationDestination(citation.data) : null;
  if (destination) {
    const params = new URLSearchParams();
    for (const key of ["threadId", "messageId", "citationId"]) {
      params.set(key, citation.params.get(key) ?? "");
    }
    return <Navigate replace to={`${destination}?${params}`} />;
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
      <div className="max-w-md space-y-4 text-center">
        {citation.valid && citation.isPending ? (
          <p role="status">Membuka materi rujukan…</p>
        ) : (
          <>
            <h1 className="text-lg font-bold">Rujukan belum dapat dibuka</h1>
            <p className="text-sm text-muted-foreground">
              Materi atau percakapannya mungkin sudah dihapus, atau aksesnya telah berubah.
            </p>
            {citation.valid ? (
              <Button variant="outline" onClick={() => void citation.refetch()}>
                Coba lagi
              </Button>
            ) : null}
            <Button asChild variant="link">
              <Link to={citation.valid ? `/chat/${citation.threadId}` : "/chat"}>
                Kembali ke chat
              </Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
