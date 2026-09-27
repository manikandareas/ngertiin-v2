import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { CreationLayout } from "../components/creation-layout";
import { Button } from "../components/ui/button";
import { useModule } from "../features/modules/api/use-modules";
import { practiceApi } from "../features/practice/practice-api";
import {
  PracticeCreateForm,
  practiceCreationSteps,
} from "../features/practice/practice-create-form";

export default function NewPracticePage() {
  const { moduleId } = useParams();
  const { getToken, userId } = useAuth();
  const module = useModule(moduleId);
  const client = useQueryClient();
  const navigate = useNavigate();
  return (
    <AppShell workspace>
      {module.data?.status === "ready" && moduleId ? (
        <PracticeCreateForm
          key={`${userId}:${moduleId}`}
          moduleId={moduleId}
          moduleTitle={module.data.title ?? "Modul belajar"}
          onCreate={async (body) => {
            const practice = await practiceApi(getToken).create(moduleId, body);
            void client.invalidateQueries({ queryKey: ["practices", moduleId] });
            navigate(`/modules/${moduleId}/practice/${practice.id}`);
          }}
        />
      ) : (
        <CreationLayout
          steps={practiceCreationSteps}
          step={0}
          title="Buat latihan"
          description="Buat latihan dari materi modulmu."
          backTo={`/modules/${moduleId}/practice`}
          backLabel="Kembali ke latihan"
        >
          {module.isPending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Memuat materi modul…
            </p>
          ) : module.isError ? (
            <div role="alert" className="space-y-4">
              <p>Modul belum dapat dimuat. Periksa koneksi atau aksesmu.</p>
              <Button variant="outline" onClick={() => void module.refetch()}>
                Coba lagi
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p>Modul harus siap dipelajari sebelum kamu membuat latihan.</p>
              <Button asChild variant="outline">
                <Link to={`/modules/${moduleId}/practice`}>Kembali ke latihan</Link>
              </Button>
            </div>
          )}
        </CreationLayout>
      )}
    </AppShell>
  );
}
