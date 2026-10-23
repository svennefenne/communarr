import { requireUser } from "@/lib/auth";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { requestT } from "@/lib/t";

export async function generateMetadata() {
  return { title: (await requestT())("Settings") };
}

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const t = await requestT();
  return (
    <div className="page mid">
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("Make it yours")}</span>
          <h1 className="display page-title">{t("Settings")}</h1>
        </div>
      </div>
      <SettingsTabs />
      {children}
    </div>
  );
}
