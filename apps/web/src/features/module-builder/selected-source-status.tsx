import type { Source } from "@ngertiin/contracts/api";
import { useEffect } from "react";
import { Button } from "../../components/ui/button";
import { useSource } from "../sources/api/use-sources";
import { SourceRetry } from "./source-retry";
import type { ModuleBuilderState } from "./use-module-builder";

export function SelectedStatus({
  source,
  setStatuses,
}: {
  source: Source;
  setStatuses: ModuleBuilderState["setStatuses"];
}) {
  const query = useSource(source.id);
  useEffect(() => {
    setStatuses((current) => ({
      ...current,
      [source.id]: { source: query.data, error: query.isError },
    }));
  }, [query.data, query.isError, source.id, setStatuses]);
  if (query.isError)
    return (
      <div className="text-sm text-destructive" role="alert">
        Status {source.title ?? "materi"} belum dapat dibaca.{" "}
        <Button type="button" size="sm" variant="link" onClick={() => void query.refetch()}>
          Periksa lagi
        </Button>
      </div>
    );
  return query.data?.status === "failed" ? <SourceRetry source={query.data} /> : null;
}
