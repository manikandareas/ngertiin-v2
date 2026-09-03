import { SignIn } from "@clerk/react";
import { AppShell } from "../components/app-shell";

import { isClerkConfigured } from "../config";

export default function SignInPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-md flex-col items-center">
        {isClerkConfigured ? (
          <SignIn fallbackRedirectUrl="/dashboard" routing="path" path="/sign-in" />
        ) : (
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold">Hubungkan Clerk</h1>
            <p className="mt-3 leading-7 text-slate-600">
              Isi VITE_CLERK_PUBLISHABLE_KEY di file .env untuk mengaktifkan halaman masuk.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
