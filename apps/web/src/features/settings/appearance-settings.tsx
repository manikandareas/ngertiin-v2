import { toast } from "sonner";
import { useTheme } from "../../components/theme-provider";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { SettingsRow } from "./settings-row";

const themes = [
  { value: "light", label: "Terang", previewClassName: "bg-white" },
  { value: "dark", label: "Gelap", previewClassName: "bg-slate-950" },
  {
    value: "system",
    label: "Ikuti perangkat",
    previewClassName: "bg-gradient-to-r from-white from-50% to-slate-950 to-50%",
  },
] as const;
export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  return (
    <SettingsRow
      title="Tema aplikasi"
      description="Pilih suasana yang nyaman untuk belajar. Langsung berlaku dan tersimpan di browser ini."
    >
      <RadioGroup
        value={theme}
        onValueChange={(value) => {
          if (value !== theme && (value === "light" || value === "dark" || value === "system")) {
            setTheme(value);
            toast.info("Tema tampilan diperbarui.", { id: "settings-theme" });
          }
        }}
        aria-label="Tema aplikasi"
        className="grid-cols-3 gap-2 sm:gap-4"
      >
        {themes.map(({ value, label, previewClassName }) => (
          <label
            htmlFor={`theme-${value}`}
            key={value}
            className="cursor-pointer space-y-3 rounded-xl border p-2 has-[[data-state=checked]]:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring sm:p-3"
          >
            <div
              aria-hidden="true"
              className={`flex h-20 overflow-hidden rounded-md border ${previewClassName}`}
            >
              <div className="w-1/4 border-r bg-teal-500/20" />
              <div className="flex-1 space-y-2 p-3">
                <div className="h-2 w-3/4 rounded bg-teal-500/60" />
                <div className="h-2 rounded bg-slate-400/30" />
                <div className="h-5 rounded bg-teal-500/20" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold sm:text-sm">
              <RadioGroupItem id={`theme-${value}`} value={value} />
              {label}
            </div>
          </label>
        ))}
      </RadioGroup>
    </SettingsRow>
  );
}
