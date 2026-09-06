import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { composerFieldClassName as field } from "./composer-presentation";
import { MaterialSettings } from "./material-settings";
import type { ComposerState } from "./use-composer";

type ComposerPanelProps = {
  state: ComposerState;
  library?: ReactNode;
  onClose: () => void;
};
export function ComposerPanel({ state, library, onClose }: ComposerPanelProps) {
  const pdfInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!state.file && pdfInput.current) pdfInput.current.value = "";
  }, [state.file]);
  if (!state.panel) return null;
  return (
    <div id="composer-panel" className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-extrabold">
          {
            {
              pdf: "Tambahkan PDF",
              url: "Tambahkan tautan",
              library: "Pilih materi lama",
              focus: "Fokus belajar",
              manage: "Atur materi",
            }[state.panel]
          }
        </h2>
        <Button type="button" size="sm" variant="ghost" aria-label="Tutup panel" onClick={onClose}>
          <X />
        </Button>
      </div>
      {state.panel === "url" ? (
        <>
          <label className="block text-sm">
            URL halaman publik
            <input
              type="url"
              className={field}
              value={state.url}
              placeholder="https://contoh.id/artikel"
              onChange={(e) => state.setUrl(e.target.value)}
            />
          </label>
          <p className="text-caption text-muted-foreground">HTTP/HTTPS publik tanpa login.</p>
          <Button type="button" size="sm" onClick={() => void state.add("url")}>
            Tambahkan tautan
          </Button>
        </>
      ) : null}
      {state.panel === "pdf" ? (
        <>
          <label className="block text-sm">
            File PDF
            <input
              ref={pdfInput}
              type="file"
              accept="application/pdf,.pdf"
              className={`${field} text-sm`}
              onChange={(e) => state.setFile(e.target.files?.[0])}
            />
          </label>
          <p className="text-caption text-muted-foreground">
            {state.file?.name ?? "Maksimum 25 MiB. Diproses per halaman."}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={!state.file}
            onClick={() => void state.add("pdf")}
          >
            Tambahkan PDF
          </Button>
        </>
      ) : null}
      {state.panel === "library" ? library : null}
      {state.panel === "focus" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {[
              "Jelaskan konsep untuk pemula.",
              "Hubungkan dengan contoh sehari-hari.",
              "Fokus pada persiapan ujian.",
            ].map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant="secondary"
                className="h-auto whitespace-normal py-2 text-left normal-case tracking-normal"
                onClick={() => state.setInstruction(value)}
              >
                {value}
              </Button>
            ))}
          </div>
          <label className="block text-sm">
            Instruksi belajar
            <textarea
              className={field}
              value={state.instruction}
              onChange={(e) => state.setInstruction(e.target.value)}
            />
          </label>
          <p className="text-caption text-muted-foreground">
            {Array.from(state.instruction).length.toLocaleString("id-ID")} / 4.000 karakter Unicode
          </p>
        </>
      ) : null}
      {state.panel === "manage" ? <MaterialSettings state={state} /> : null}
    </div>
  );
}
