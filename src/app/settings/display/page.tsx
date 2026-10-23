import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { memberLang } from "@/lib/t";
import { DisplaySettings } from "@/components/settings/DisplaySettings";

export default async function DisplayPage() {
  const u = await requireUser();
  return <DisplaySettings prefs={u.theme} language={{ own: memberLang(u.id), site: getSetting("language") }} />;
}
