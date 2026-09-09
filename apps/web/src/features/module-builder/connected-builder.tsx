import { useAuth } from "@clerk/react";
import { DEFAULT_GENERATION_SETTINGS, type GenerationSettings } from "@ngertiin/contracts/api";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { useCurrentUser } from "../current-user/api/use-current-user";
import { useCreateModule } from "../modules/api/use-modules";
import { useSaveSource } from "../sources/use-save-source";
import { BuilderForm } from "./builder-form";
import { SelectedStatus } from "./selected-source-status";
import { SourceLibrary } from "./source-library";
import { useModuleBuilder } from "./use-module-builder";

export function ConnectedBuilder() {
  const { userId } = useAuth();
  return <BuilderPreferences key={userId} />;
}
function BuilderPreferences() {
  const profile = useCurrentUser();
  const [fallback, setFallback] = useState(false);
  if (!profile.data && !fallback)
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6" role="status">
        <p>
          {profile.isError
            ? "Preferensi belajar belum dapat dimuat."
            : "Memuat preferensi belajar…"}
        </p>
        {profile.isError && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void profile.refetch()} disabled={profile.isFetching}>
              Coba lagi
            </Button>
            <Button variant="outline" onClick={() => setFallback(true)}>
              Gunakan default aplikasi
            </Button>
          </div>
        )}
      </div>
    );
  return (
    <UserBuilder
      defaults={
        fallback
          ? DEFAULT_GENERATION_SETTINGS
          : (profile.data?.defaultGenerationSettings ?? DEFAULT_GENERATION_SETTINGS)
      }
    />
  );
}
function UserBuilder({ defaults }: { defaults: GenerationSettings }) {
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
  const state = useModuleBuilder(
    {
      save,
      create: async (input, key) => {
        const result = await module.mutateAsync({ input, key });
        if (active.current)
          navigate(`/modules/new?moduleId=${result.module.id}`, { replace: true });
      },
    },
    defaults,
  );
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
