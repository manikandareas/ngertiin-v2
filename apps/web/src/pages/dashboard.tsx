import { useUser } from "@clerk/react";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useDashboard } from "../features/dashboard/api/use-dashboard";
import { DashboardContent } from "../features/dashboard/components/dashboard-content";

export default function DashboardPage() {
  const dashboard = useDashboard();
  const { user } = useUser();
  const fallback = dashboard.isPending ? (
    <div role="status" className="h-40 rounded-card bg-muted p-6 motion-safe:animate-pulse">
      Memuat ringkasan belajar…
    </div>
  ) : (
    <Card className="p-5">
      <p>Ringkasan belum dapat dimuat.</p>
      <Button variant="outline" onClick={() => void dashboard.refetch()}>
        Coba lagi
      </Button>
    </Card>
  );
  return (
    <AppShell workspace>
      <DashboardContent
        data={dashboard.data}
        name={user?.firstName ?? undefined}
        fallback={fallback}
      />
    </AppShell>
  );
}
