import { Lightbulb, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

export function CreateModuleCard() {
  return (
    <Card className="gap-4 bg-background">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-button bg-accent text-primary">
            <Lightbulb aria-hidden="true" className="size-6" />
          </span>
          <CardTitle>Penasaran sama apa?</CardTitle>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Bawa materimu. Ubah jadi sesuatu yang benar-benar kamu mengerti.
        </p>
      </CardHeader>
      <CardContent>
        <Button asChild variant="secondary" className="w-full normal-case tracking-normal">
          <Link to="/modules/new">
            <Plus aria-hidden="true" />
            Buat modul baru
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
