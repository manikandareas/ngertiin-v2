import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useDashboard } from "../features/dashboard/api/use-dashboard";
import { DashboardContent } from "../features/dashboard/components/dashboard-content";

export default function DashboardPage() {
  const dashboard = useDashboard();
  const fallback = dashboard.isPending ? (
    <div role="status" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <span className="sr-only">Memuat ringkasan belajar…</span>
      <div aria-hidden="true" className="h-64 bg-muted motion-safe:animate-pulse" />
      <div
        aria-hidden="true"
        className="h-64 rounded-card border-2 bg-muted motion-safe:animate-pulse"
      />
    </div>
  ) : (
    <Card role="alert" className="items-start p-6">
      <h2 className="font-display text-subheading font-bold">Ringkasan belum dapat dimuat.</h2>
      <p className="text-sm text-muted-foreground">Coba muat ulang untuk membuka meja belajarmu.</p>
      <Button variant="outline" onClick={() => void dashboard.refetch()}>
        Coba lagi
      </Button>
    </Card>
  );
  return (
    <AppShell workspace>
      <DashboardContent data={dashboard.data} fallback={fallback} />
    </AppShell>
  );
}
