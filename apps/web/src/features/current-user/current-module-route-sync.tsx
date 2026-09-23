import { useEffect, useRef } from "react";
import { useLocation, useMatch } from "react-router-dom";
import { useModule } from "../modules/api/use-modules";
import { useCurrentUser } from "./api/use-current-user";
import { useSelectCurrentModule } from "./api/use-select-current-module";

export function CurrentModuleRouteSync() {
  const { pathname, search } = useLocation();
  const match = useMatch("/modules/:moduleId/*");
  const routeId = match?.params.moduleId;
  const queryId =
    pathname === "/modules/new" || pathname === "/chat"
      ? new URLSearchParams(search).get("moduleId")
      : null;
  const moduleId = (routeId === "new" ? null : routeId) ?? queryId ?? undefined;
  const module = useModule(moduleId);
  const currentUser = useCurrentUser();
  const select = useSelectCurrentModule();
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!moduleId) {
      attempted.current = null;
      return;
    }
    if (!module.data || !currentUser.data || module.data.status === "archived") return;
    if (attempted.current === moduleId) return;
    attempted.current = moduleId;
    if (currentUser.data.currentModuleId !== moduleId) select.mutate(moduleId);
  }, [moduleId, module.data, currentUser.data, select.mutate]);

  return null;
}
