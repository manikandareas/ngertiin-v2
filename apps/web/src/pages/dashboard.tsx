import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useDashboard } from "../features/dashboard/api/use-dashboard";
import { DashboardContent } from "../features/dashboard/components/dashboard-content";

export default function DashboardPage() {
  const dashboard = useDashboard();
  return (
    <AppShell>
      {dashboard.isPending ? (
        <section role="status" className="space-y-6">
          <h1 className="text-heading-sm font-extrabold">Menyiapkan ruang belajarmu…</h1>
          <div className="h-24 rounded-card bg-muted motion-safe:animate-pulse" />
          <div className="grid gap-5 sm:grid-cols-2">
            {[0, 1].map((key) => (
              <div
                key={key}
                className="h-24 rounded-card border-2 bg-muted motion-safe:animate-pulse"
              />
            ))}
          </div>
        </section>
      ) : dashboard.isError || !dashboard.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Dashboard belum dapat dimuat</CardTitle>
            <p className="text-muted-foreground">Periksa koneksi, lalu coba lagi.</p>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => dashboard.refetch()}>
              Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DashboardContent data={dashboard.data} />
      )}
    </AppShell>
  );
}
