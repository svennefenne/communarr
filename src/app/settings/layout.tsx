import { requireUser } from "@/lib/auth";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

export const metadata = { title: "Settings" };

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="page mid">
      <div className="page-head">
        <div>
          <span className="eyebrow">Make it yours</span>
          <h1 className="display page-title">Settings</h1>
        </div>
      </div>
      <SettingsTabs />
      {children}
    </div>
  );
}
