import { useAuth } from "@clerk/react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { isClerkConfigured } from "../config";

function ClerkAuthenticatedRoute({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <AppShell>
        <p className="text-sm text-slate-500">Memeriksa sesi…</p>
      </AppShell>
    );
  }
  return isSignedIn ? children : <Navigate replace to="/sign-in" />;
}

export function AuthenticatedRoute({ children }: { children: ReactNode }) {
  if (!isClerkConfigured) {
    return <Navigate replace to="/sign-in" />;
  }
  return <ClerkAuthenticatedRoute>{children}</ClerkAuthenticatedRoute>;
}
