import { useAuth } from "@clerk/react";
import type { Source } from "@ngertiin/contracts/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  sourceQueryKey,
  sourcesQueryRootKey,
  useCreatePdfSource,
  useCreateTextSource,
  useCreateUrlSource,
} from "./api/use-sources";
import type { SourceCommand } from "./use-source-form";
export function useSaveSource() {
  const { userId } = useAuth();
  const client = useQueryClient();
  const text = useCreateTextSource();
  const url = useCreateUrlSource();
  const pdf = useCreatePdfSource();
  return async (command: SourceCommand) => {
    const fields = command.title.trim() ? { title: command.title } : {};
    let source: Source;
    switch (command.kind) {
      case "text":
        source = await text.mutateAsync({
          input: { ...fields, text: command.value },
          key: command.key,
        });
        break;
      case "url":
        source = await url.mutateAsync({
          input: { ...fields, url: command.value },
          key: command.key,
        });
        break;
      case "pdf":
        if (!command.file) throw new Error("Pilih PDF untuk ditambahkan.");
        source = await pdf.mutateAsync({ fields, file: command.file, key: command.key });
        break;
    }
    client.setQueryData(sourceQueryKey(userId, source.id), source);
    void client.invalidateQueries({ queryKey: sourcesQueryRootKey(userId) });
    return source;
  };
}
