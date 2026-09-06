import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateModule } from "../modules/api/use-modules";
import {
  sourceQueryKey,
  sourcesQueryRootKey,
  useCreatePdfSource,
  useCreateTextSource,
  useCreateUrlSource,
} from "../sources/api/use-sources";
import { BuilderForm } from "./builder-form";
import { SelectedStatus } from "./selected-source-status";
import { SourceLibrary } from "./source-library";
import { useModuleBuilder } from "./use-module-builder";

export function ConnectedBuilder() {
  const { userId } = useAuth();
  return <UserBuilder key={userId} />;
}
function UserBuilder() {
  const { userId } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const text = useCreateTextSource();
  const url = useCreateUrlSource();
  const pdf = useCreatePdfSource();
  const module = useCreateModule();
  const state = useModuleBuilder({
    save: async (command) => {
      const fields = command.title.trim() ? { title: command.title } : {};
      const source =
        command.kind === "text"
          ? await text.mutateAsync({ input: { ...fields, text: command.value }, key: command.key })
          : command.kind === "url"
            ? await url.mutateAsync({ input: { ...fields, url: command.value }, key: command.key })
            : await pdf.mutateAsync({ fields, file: command.file as File, key: command.key });
      client.setQueryData(sourceQueryKey(userId, source.id), source);
      void client.invalidateQueries({ queryKey: sourcesQueryRootKey(userId) });
      return source;
    },
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
