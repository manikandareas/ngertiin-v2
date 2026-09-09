import { useUser } from "@clerk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { DialogFrame } from "../components/ui/dialog-frame";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useCurrentUser } from "../features/current-user/api/use-current-user";
import { AppearanceSettings } from "../features/settings/appearance-settings";
import { AvatarSettings } from "../features/settings/avatar-settings";
import { EmailSettings } from "../features/settings/email-settings";
import { LearningSettings } from "../features/settings/learning-settings";
import { ProfileSettings } from "../features/settings/profile-settings";
import { SessionSettings } from "../features/settings/session-settings";
import { SocialSettings } from "../features/settings/social-settings";
import { SoundSettings } from "../features/settings/sound-settings";
import { UsageSettings } from "../features/settings/usage-settings";
import { useConnectionFeedback } from "../features/settings/use-connection-feedback";

const tabs = [
  { value: "account", label: "Profil & akun" },
  { value: "appearance", label: "Tampilan" },
  { value: "learning", label: "Preferensi belajar" },
  { value: "usage", label: "Penggunaan" },
];
export default function SettingsPage() {
  const profile = useCurrentUser();
  const { user } = useUser();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = tabs.find((item) => item.value === requested)?.value ?? "account";
  useConnectionFeedback();
  const [dirty, setDirty] = useState(false);
  const onDirty = useCallback((value: boolean) => setDirty(value), []);
  const blocker = useBlocker(dirty);
  const focus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (blocker.state === "blocked")
      focus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [blocker.state]);
  const profileState = (
    <div className="space-y-4 py-8">
      <p role="status">
        {profile.isError ? "Profil belajar belum dapat dimuat." : "Memuat profil belajar…"}
      </p>
      {profile.isError && (
        <Button type="button" disabled={profile.isFetching} onClick={() => void profile.refetch()}>
          Coba lagi
        </Button>
      )}
    </div>
  );
  return (
    <AppShell unsavedChanges={dirty}>
      <section className="mx-auto w-full max-w-5xl">
        <header className="mb-7">
          <h1 className="mt-2 font-display text-3xl font-extrabold">Pengaturan</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Atur akun dan cara belajar yang paling nyaman untukmu.
          </p>
        </header>
        <Tabs
          activationMode="manual"
          value={tab}
          onValueChange={(value) => {
            const next = new URLSearchParams(params);
            next.set("tab", value);
            next.delete("connection");
            next.delete("provider");
            setParams(next);
          }}
        >
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList aria-label="Bagian pengaturan">
              {tabs.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="account">
            {profile.data ? (
              <>
                <AvatarSettings user={profile.data} />
                <ProfileSettings user={profile.data} onDirty={onDirty} />
              </>
            ) : (
              profileState
            )}
            {user ? (
              <>
                <EmailSettings />
                <SocialSettings />
                <SessionSettings unsavedChanges={dirty} />
              </>
            ) : (
              <p role="status" className="py-8">
                Memuat akun…
              </p>
            )}
          </TabsContent>
          <TabsContent value="appearance">
            <AppearanceSettings />
          </TabsContent>
          <TabsContent value="learning">
            <SoundSettings />
            {profile.data ? (
              <LearningSettings user={profile.data} onDirty={onDirty} />
            ) : (
              profileState
            )}
          </TabsContent>
          <TabsContent value="usage">
            {profile.data ? <UsageSettings timezone={profile.data.timezone} /> : profileState}
          </TabsContent>
        </Tabs>
        <DialogFrame
          open={blocker.state === "blocked"}
          title="Perubahan belum disimpan"
          description="Simpan perubahan terlebih dahulu, atau tinggalkan halaman dan buang perubahan ini."
          onClose={() => {
            if (blocker.state === "blocked") blocker.reset();
          }}
          returnFocus={() => focus.current?.focus()}
        >
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => {
                if (blocker.state === "blocked") blocker.reset();
              }}
            >
              Tetap di sini
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (blocker.state === "blocked") {
                  setDirty(false);
                  blocker.proceed();
                }
              }}
            >
              Buang perubahan
            </Button>
          </div>
        </DialogFrame>
      </section>
    </AppShell>
  );
}
