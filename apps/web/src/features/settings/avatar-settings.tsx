import { useAuth } from "@clerk/react";
import type { CurrentUser } from "@ngertiin/contracts/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { DialogFrame } from "../../components/ui/dialog-frame";
import { Input } from "../../components/ui/input";
import { UserAvatar } from "../../components/user-avatar";
import { updateAvatar } from "../../lib/api";
import { currentUserQueryKey } from "../current-user/api/use-current-user";
import { leaderboardQueryKey } from "../leaderboard/use-leaderboard";
import { SettingsRow } from "./settings-row";
import { settingsError } from "./use-settings-form";

export function AvatarSettings({ user }: { user: CurrentUser }) {
  const { getToken, userId } = useAuth();
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const upload = useMutation({
    mutationFn: (next: File | null) => updateAvatar(getToken, next),
    onSuccess: (updated) => {
      client.setQueryData(currentUserQueryKey(userId), updated);
      void client.invalidateQueries({ queryKey: leaderboardQueryKey(userId) });
      setFile(null);
      setConfirm(false);
      if (input.current) input.current.value = "";
    },
  });
  return (
    <SettingsRow
      title="Foto profil"
      description="Foto yang sama muncul di sidebar, profil, dan leaderboard. JPG, PNG, atau WebP maksimal 5 MB."
    >
      <div className="flex items-center gap-4">
        <UserAvatar
          avatarUrl={preview ?? user.avatarUrl}
          name={user.displayName}
          className="size-20 rounded-2xl"
        />
        <div className="min-w-0 space-y-2">
          <label htmlFor="avatar-file" className="text-sm font-semibold">
            Pilih foto
          </label>
          <Input
            ref={input}
            id="avatar-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={upload.isPending}
            onChange={(event) => {
              const next = event.target.files?.[0];
              upload.reset();
              setError(null);
              setFile(null);
              if (!next) return;
              if (
                !["image/jpeg", "image/png", "image/webp"].includes(next.type) ||
                next.size > 5 * 1024 * 1024 ||
                !next.size
              ) {
                setError("Pilih JPG, PNG, atau WebP maksimal 5 MB.");
                event.target.value = "";
                return;
              }
              setFile(next);
            }}
          />
        </div>
      </div>
      {file && (
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={upload.isPending} onClick={() => upload.mutate(file)}>
            {upload.isPending ? "Mengunggah…" : "Gunakan foto ini"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={upload.isPending}
            onClick={() => {
              setFile(null);
              if (input.current) input.current.value = "";
            }}
          >
            Batal
          </Button>
        </div>
      )}
      {user.hasCustomAvatar && (
        <Button type="button" asChild variant="ghost" disabled={upload.isPending}>
          <button
            type="button"
            ref={resetButton}
            onClick={() => {
              upload.reset();
              setConfirm(true);
            }}
          >
            Kembali ke avatar default
          </button>
        </Button>
      )}
      {(error || upload.isError) && (
        <p role="alert" className="text-sm text-destructive">
          {error ?? settingsError(upload.error)}
        </p>
      )}
      {upload.isSuccess && (
        <p role="status" className="text-sm text-primary">
          Foto profil diperbarui.
        </p>
      )}
      <DialogFrame
        open={confirm}
        title="Gunakan avatar otomatis?"
        description="Foto profil saat ini akan dihapus. Kamu bisa mengunggah foto lagi kapan saja."
        busy={upload.isPending}
        onClose={() => setConfirm(false)}
        returnFocus={() => resetButton.current?.focus()}
      >
        <div className="flex gap-3">
          <Button type="button" disabled={upload.isPending} onClick={() => upload.mutate(null)}>
            {upload.isPending ? "Menghapus…" : "Gunakan avatar otomatis"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={upload.isPending}
            onClick={() => setConfirm(false)}
          >
            Batal
          </Button>
        </div>
        {upload.isError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {settingsError(upload.error)}
          </p>
        )}
      </DialogFrame>
    </SettingsRow>
  );
}
