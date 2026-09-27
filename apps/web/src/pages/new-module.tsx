import { useAuth } from "@clerk/react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { BuilderGeneration } from "../features/module-builder/builder-generation";
import { ConnectedBuilder } from "../features/module-builder/connected-builder";

export default function NewModulePage() {
  const [params] = useSearchParams();
  const { userId } = useAuth();
  const moduleId = params.get("moduleId");
  return (
    <AppShell workspace>
      {moduleId ? (
        <BuilderGeneration key={`${userId}:${moduleId}`} moduleId={moduleId} />
      ) : (
        <ConnectedBuilder />
      )}
    </AppShell>
  );
}
