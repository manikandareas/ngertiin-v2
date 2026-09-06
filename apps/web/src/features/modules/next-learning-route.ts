import type { ModuleSummary, NextLearningAction } from "@ngertiin/contracts/api";

export function nextLearningRoute(action: NextLearningAction): string | null {
  switch (action.type) {
    case "wait_for_module":
    case "retry_module":
      return `/modules/${action.moduleId}`;
    case "start_core_node":
    case "resume_core_node":
    case "start_adaptive_node":
    case "resume_adaptive_node":
      return `/modules/${action.moduleId}/nodes/${action.nodeId}`;
    case "offer_optional_review":
    case "wait_for_adaptive":
      return `/adaptive-interventions/${action.interventionId}`;
    case "module_completed":
      return `/modules/${action.moduleId}/journey`;
    case "none":
      return null;
  }
}

export function moduleOverviewRoute(module: Pick<ModuleSummary, "id" | "status">): string {
  if (module.status === "ready" || module.status === "archived") {
    return `/modules/${module.id}/journey`;
  }
  return `/modules/${module.id}`;
}
