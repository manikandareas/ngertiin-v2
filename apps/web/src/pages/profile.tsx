import { AppShell } from "../components/app-shell";
import { useCurrentUser } from "../features/current-user/api/use-current-user";
import { ProfileForm } from "../features/current-user/components/profile-form";

export default function ProfilePage() {
  const currentUser = useCurrentUser();

  return (
    <AppShell>
      <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Profil</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Preferensi belajar</h1>
        <p className="mt-3 leading-7 text-slate-600">
          Timezone menentukan batas hari untuk perhitungan streak.
        </p>
        {currentUser.isPending ? (
          <p className="mt-8 text-sm text-slate-500">Memuat profil…</p>
        ) : currentUser.isError ? (
          <p className="mt-8 text-sm text-red-700">Profil belum dapat dimuat.</p>
        ) : (
          <ProfileForm user={currentUser.data} />
        )}
      </section>
    </AppShell>
  );
}
