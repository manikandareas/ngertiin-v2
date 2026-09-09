import type { CurrentUser } from "@ngertiin/contracts/api";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Field, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { SettingsRow } from "./settings-row";
import { settingsError, useSettingsForm } from "./use-settings-form";

export function ProfileSettings({
  user,
  onDirty,
}: {
  user: CurrentUser;
  onDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? user.displayName ?? "";
  const dirty = name !== (user.displayName ?? "");
  const save = useSettingsForm(dirty, onDirty);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ displayName: name.trim() || null }, { onSuccess: () => setDraft(null) });
      }}
    >
      <SettingsRow
        title="Nama tampilan"
        description="Nama yang teman belajar lihat di profil dan leaderboard."
      >
        <Field>
          <FieldLabel htmlFor="display-name">Nama tampilan</FieldLabel>
          <Input
            id="display-name"
            autoComplete="nickname"
            value={name}
            disabled={save.isPending}
            onChange={(event) => {
              setDraft(event.target.value);
              save.reset();
            }}
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || save.isPending}
            onClick={() => {
              setDraft(null);
              save.reset();
            }}
          >
            Batal
          </Button>
        </div>
        {save.isError && (
          <p role="alert" className="text-sm text-destructive">
            {settingsError(save.error)}
          </p>
        )}
        {save.isSuccess && (
          <p role="status" className="text-sm text-primary">
            Nama tampilan tersimpan.
          </p>
        )}
      </SettingsRow>
    </form>
  );
}
