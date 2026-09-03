import { ClerkProvider } from "@clerk/react";
import type { ReactNode } from "react";
import { webEnvironment } from "../config";

export function ClerkRoot({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={webEnvironment.VITE_CLERK_PUBLISHABLE_KEY}>
      {children}
    </ClerkProvider>
  );
}
