import { SignUp } from "@clerk/react";
import { AuthLayout } from "../components/auth-layout";
import { isClerkConfigured } from "../config";

export default function SignUpPage() {
  return (
    <AuthLayout>
      {isClerkConfigured ? (
        <SignUp
          routing="path"
          path="/sign-up"
          appearance={{ elements: { rootBox: "w-full", cardBox: "w-full" } }}
        />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Halaman daftar belum tersedia. Silakan coba lagi nanti.
        </p>
      )}
    </AuthLayout>
  );
}
