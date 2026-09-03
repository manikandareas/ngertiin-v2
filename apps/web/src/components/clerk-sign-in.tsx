import { SignIn } from "@clerk/react";

export default function ClerkSignIn() {
  return <SignIn routing="path" path="/sign-in" />;
}
