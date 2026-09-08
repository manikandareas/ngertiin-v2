import { RedirectToSignIn, useAuth } from "@clerk/react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AuthLayout } from "../components/auth-layout";
import { isClerkConfigured } from "../config";

function ClerkAuthenticatedRoute({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <AuthLayout>
        <p className="text-center text-sm text-muted-foreground">Memeriksa sesi…</p>
      </AuthLayout>
    );
  }

  return isSignedIn ? children : <RedirectToSignIn />;
}

export function AuthenticatedRoute({ children }: { children: ReactNode }) {
  if (!isClerkConfigured) {
    return <Navigate replace to="/sign-in" />;
  }
  return <ClerkAuthenticatedRoute>{children}</ClerkAuthenticatedRoute>;
}
