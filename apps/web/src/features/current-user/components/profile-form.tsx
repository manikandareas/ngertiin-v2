import { useAuth } from "@clerk/react";
import type { CurrentUser } from "@ngertiin/contracts/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { UserAvatar } from "../../../components/user-avatar";
import { ApiProblemError, patchCurrentUser } from "../../../lib/api";
import { currentUserQueryKey } from "../api/use-current-user";

function fieldMessage(error: unknown, path: string): string | undefined {
  if (!(error instanceof ApiProblemError)) {
    return undefined;
  }
  return error.problem.errors?.find((fieldError) => fieldError.path === path)?.message;
}

export function ProfileForm({ user }: { user: CurrentUser }) {
  const { getToken, userId } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [timezone, setTimezone] = useState(user.timezone);
  const mutation = useMutation({
    mutationFn: () =>
      patchCurrentUser(getToken, {
        displayName: displayName === "" ? null : displayName,
        timezone,
      }),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(currentUserQueryKey(userId), updatedUser);
    },
  });
  const displayNameError = fieldMessage(mutation.error, "displayName");
  const timezoneError = fieldMessage(mutation.error, "timezone");
  const generalError =
    mutation.error instanceof ApiProblemError
      ? mutation.error.problem.detail
      : mutation.isError
        ? "Profil belum dapat disimpan."
        : undefined;

  return (
    <form
      className="mt-8 space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <UserAvatar
        avatarUrl={user.avatarUrl}
        name={user.displayName}
        className="size-20 rounded-2xl"
      />
      <div>
        <label className="text-sm font-semibold" htmlFor="displayName">
          Nama tampilan
        </label>
        <input
          aria-describedby={displayNameError ? "displayName-error" : undefined}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-teal-600"
          id="displayName"
          onChange={(event) => setDisplayName(event.target.value)}
          type="text"
          value={displayName}
        />
        {displayNameError ? (
          <p className="mt-2 text-sm text-red-700" id="displayName-error">
            {displayNameError}
          </p>
        ) : null}
      </div>
      <div>
        <label className="text-sm font-semibold" htmlFor="timezone">
          Timezone IANA
        </label>
        <input
          aria-describedby={timezoneError ? "timezone-error" : undefined}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-teal-600"
          id="timezone"
          onChange={(event) => setTimezone(event.target.value)}
          placeholder="Asia/Makassar"
          type="text"
          value={timezone}
        />
        {timezoneError ? (
          <p className="mt-2 text-sm text-red-700" id="timezone-error">
            {timezoneError}
          </p>
        ) : null}
      </div>
      {generalError && !displayNameError && !timezoneError ? (
        <p className="text-sm text-red-700" role="alert">
          {generalError}
        </p>
      ) : null}
      {mutation.isSuccess ? (
        <p className="text-sm text-teal-700" role="status">
          Profil tersimpan.
        </p>
      ) : null}
      <Button disabled={mutation.isPending} type="submit">
        {mutation.isPending ? "Menyimpan…" : "Simpan profil"}
      </Button>
    </form>
  );
}
