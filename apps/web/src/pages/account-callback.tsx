import { useUser } from "@clerk/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../components/auth-layout";
import { Button } from "../components/ui/button";

export default function AccountCallbackPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const provider = params.get("provider");
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;
    void user
      .reload()
      .then((updated) => {
        const connected =
          (provider === "google" || provider === "github") &&
          updated.externalAccounts.some(
            (account) =>
              account.provider === provider && account.verification?.status === "verified",
          );
        navigate(`/settings?tab=account&connection=${connected ? "connected" : "cancelled"}`, {
          replace: true,
        });
      })
      .catch(() => {
        started.current = false;
        setFailed(true);
      });
  }, [user, provider, navigate]);
  return (
    <AuthLayout>
      <div className="space-y-4 text-center">
        <p role="status">
          {failed ? "Status koneksi belum dapat dimuat." : "Memeriksa koneksi akun…"}
        </p>
        <Button asChild variant="outline">
          <Link to="/settings?tab=account&connection=cancelled">Kembali ke pengaturan akun</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}
