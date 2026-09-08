import { useAuth } from "@clerk/react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateModule } from "../modules/api/use-modules";
import { useSaveSource } from "../sources/use-save-source";
import { BuilderForm } from "./builder-form";
import { SelectedStatus } from "./selected-source-status";
import { SourceLibrary } from "./source-library";
import { useModuleBuilder } from "./use-module-builder";

export function ConnectedBuilder() {
  const { userId } = useAuth();
  return <UserBuilder key={userId} />;
}
function UserBuilder() {
  const save = useSaveSource();
  const navigate = useNavigate();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const module = useCreateModule();
  const state = useModuleBuilder({
    save,
    create: async (input, key) => {
      const result = await module.mutateAsync({ input, key });
      if (active.current) navigate(`/modules/new?moduleId=${result.module.id}`, { replace: true });
    },
  });
  return (
    <BuilderForm
      state={state}
      library={(menu) => <SourceLibrary state={state} menu={menu} />}
      statuses={state.selected.map((item) => (
        <SelectedStatus key={item.source.id} source={item.source} setStatuses={state.setStatuses} />
      ))}
    />
  );
}
