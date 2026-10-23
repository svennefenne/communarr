import { requireUser } from "@/lib/auth";
import { myThemes, sharedThemes, siteLook } from "@/lib/themes";
import { getSettings } from "@/lib/settings";
import { ThemeSettings } from "@/components/theme/ThemeSettings";

export const dynamic = "force-dynamic";

export default async function ThemePage() {
  const u = await requireUser();
  const allow = getSettings().allowCustomThemes;
  return <ThemeSettings prefs={u.theme} site={siteLook()} mine={allow ? myThemes(u.id) : []} shared={allow ? sharedThemes(u.id) : []} allowCustom={allow} />;
}
