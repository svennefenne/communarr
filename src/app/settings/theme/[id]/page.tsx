import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { siteLook, themeFor } from "@/lib/themes";
import { getSettings } from "@/lib/settings";
import { themeFromScheme } from "@/lib/theme";
import { ThemeEditor } from "@/components/theme/ThemeEditor";
import { requestT } from "@/lib/t";

export const dynamic = "force-dynamic";

/** /settings/theme/new (?from=<a shared theme>) or /settings/theme/<id>: build a theme. */
export default async function EditThemePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const u = await requireUser();
  if (!getSettings().allowCustomThemes) redirect("/settings/theme");
  const { id } = await params;
  const { from } = await searchParams;
  if (id === "new") {
    const src = from ? themeFor(Number(from), u.id) : null;
    const t = await requestT();
    const base = src ? src.data : u.theme.custom ? themeFor(u.theme.custom, u.id)?.data ?? themeFromScheme(u.theme.scheme) : themeFromScheme(u.theme.scheme);
    return <ThemeEditor id={null} initial={base} name={src ? t("{name} (mine)", { name: src.name }) : t("My theme")} shared={false} site={siteLook()} textSize={u.theme.textSize} />;
  }
  const theme = themeFor(Number(id), u.id);
  if (!theme || !theme.mine) notFound();
  return <ThemeEditor id={theme.id} initial={theme.data} name={theme.name} shared={theme.shared} site={siteLook()} textSize={u.theme.textSize} />;
}
