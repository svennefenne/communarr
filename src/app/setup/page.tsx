import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { DEFAULTS, hasSetting, setSettings } from "@/lib/settings";
import { LANGS, pickLang } from "@/lib/i18n";
import { requestT } from "@/lib/t";
import { setupLanguageAction } from "@/app/actions/language";
import { AuthShell } from "@/components/auth/AuthShell";
import { SetupForm } from "@/components/auth/AuthForms";

export async function generateMetadata() {
  const t = await requestT();
  return { title: t("Set up") };
}

export default async function SetupPage() {
  if (hasAnyUser()) redirect("/login");
  // the first visit: the browser's language (stored first, so every part of the page agrees)
  if (!hasSetting("language")) {
    setSettings({ language: pickLang((await headers()).get("accept-language")) });
    redirect("/setup");
  }
  const t = await requestT();
  return (
    <AuthShell
      toggle={false}
      siteName={DEFAULTS.siteName}
      eyebrow={t("First start")}
      title={t("Set up your site")}
      intro={t("Two quick steps: what the site is called, then your admin account.")}
    >
      <form action={setupLanguageAction} className="row wrap" style={{ gap: 6, marginBottom: 16 }} aria-label={t("Language")}>
        {LANGS.map((l) => (
          <button key={l.id} type="submit" name="lang" value={l.id} className={`btn btn-sm ${l.id === t.lang ? "btn-primary" : ""}`} aria-pressed={l.id === t.lang}>
            {l.name}
          </button>
        ))}
      </form>
      <SetupForm defaultName={DEFAULTS.siteName} />
    </AuthShell>
  );
}
