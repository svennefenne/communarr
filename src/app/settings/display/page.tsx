import { requireUser } from "@/lib/auth";
import { DisplaySettings } from "@/components/settings/DisplaySettings";

export default async function DisplayPage() {
  const u = await requireUser();
  return <DisplaySettings prefs={u.theme} />;
}
