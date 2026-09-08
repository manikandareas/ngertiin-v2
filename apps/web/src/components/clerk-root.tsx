import { ClerkProvider } from "@clerk/react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { isClerkConfigured, webEnvironment } from "../config";

export function ClerkRoot({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  if (!isClerkConfigured) {
    return children;
  }

  return (
    <ClerkProvider
      publishableKey={webEnvironment.VITE_CLERK_PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
