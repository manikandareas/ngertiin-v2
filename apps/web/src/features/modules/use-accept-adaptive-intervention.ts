import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ApiProblemError } from "../../lib/api";
import { useAdaptiveDecision } from "./api/use-modules";

export function useAcceptAdaptiveIntervention(interventionId: string, moduleId?: string) {
  const navigate = useNavigate();
  const decision = useAdaptiveDecision(interventionId, moduleId);
  const command = useRef<{ interventionId: string; key: string } | null>(null);
  const accepting = useRef(false);
  const activeInterventionId = useRef<string | null>(interventionId);
  useEffect(() => {
    activeInterventionId.current = interventionId;
    return () => {
      activeInterventionId.current = null;
    };
  }, [interventionId]);

  async function accept(): Promise<void> {
    if (accepting.current) return;
    accepting.current = true;
    if (command.current?.interventionId !== interventionId) {
      command.current = { interventionId, key: crypto.randomUUID() };
    }
    try {
      await decision.mutateAsync({ decision: "accept", key: command.current.key });
      // Do not pull the learner away from core work if they already left this screen.
      if (activeInterventionId.current === interventionId) {
        navigate(`/adaptive-interventions/${interventionId}`);
      }
    } catch {
      // Reuse the command key after an ambiguous response; expose the mutation error to the UI.
    } finally {
      accepting.current = false;
    }
  }

  let error: string | null = null;
  if (decision.error instanceof ApiProblemError) error = decision.error.problem.detail;
  else if (decision.error) error = "Pilihanmu belum tersimpan. Coba lagi.";

  return { accept, isPending: decision.isPending, error };
}
