import { requireUser } from "@/lib/auth";
import { getSetting, getSettings } from "@/lib/settings";
import { memberLang, requestT } from "@/lib/t";
import { DisplaySettings } from "@/components/settings/DisplaySettings";
import { VoiceSettings } from "@/components/voice/VoiceSettings";

export default async function DisplayPage() {
  const u = await requireUser();
  const t = await requestT();
  return (
    <div className="stack loose">
      <DisplaySettings prefs={u.theme} language={{ own: memberLang(u.id), site: getSetting("language") }} />
      {/* (kept on this device: another computer has another microphone and keyboard) */}
      {getSettings().features.voice ? (
        <section className="panel panel-pad stack">
          <h2 className="h2">{t("Voice chat")}</h2>
          <p className="small muted" style={{ margin: 0 }}>
            {t("For this device. The same settings are behind the gear in a call.")}
          </p>
          <VoiceSettings />
        </section>
      ) : null}
    </div>
  );
}
