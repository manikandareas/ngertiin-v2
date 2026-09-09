import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

export function useConnectionFeedback() {
  const [params, setParams] = useSearchParams();
  const connection = params.get("connection");
  useEffect(() => {
    if (!connection) return;
    if (connection === "connected") {
      toast.success("Koneksi akun berhasil diperbarui.", { id: "settings-connection" });
    } else {
      toast.warning("Koneksi akun belum selesai", {
        id: "settings-connection",
        description: "Proses belum selesai atau dibatalkan. Kamu bisa mencoba lagi.",
      });
    }
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("connection");
        next.delete("provider");
        return next;
      },
      { replace: true },
    );
  }, [connection, setParams]);
}
