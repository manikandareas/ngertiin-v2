import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { useSoundPreference } from "../../lib/sound-preference";
import { SettingsRow } from "./settings-row";

export function SoundSettings() {
  const { soundEnabled, setSoundEnabled } = useSoundPreference();
  return (
    <SettingsRow
      title="Efek suara"
      description="Putar suara singkat saat hasil assessment baru tersedia. Langsung berlaku dan tersimpan di browser ini."
    >
      <RadioGroup
        aria-label="Efek suara hasil assessment"
        value={soundEnabled ? "on" : "off"}
        onValueChange={(value) => setSoundEnabled(value === "on")}
        className="flex flex-wrap gap-6"
      >
        <label htmlFor="sound-on" className="flex cursor-pointer items-center gap-2 text-sm">
          <RadioGroupItem id="sound-on" value="on" />
          Aktif
        </label>
        <label htmlFor="sound-off" className="flex cursor-pointer items-center gap-2 text-sm">
          <RadioGroupItem id="sound-off" value="off" />
          Nonaktif
        </label>
      </RadioGroup>
    </SettingsRow>
  );
}
