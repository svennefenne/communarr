import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { siteLook, themeFor } from "@/lib/themes";
import { getSettings } from "@/lib/settings";
import { themeFromScheme } from "@/lib/theme";
import { ThemeEditor } from "@/components/theme/ThemeEditor";

export const dynamic = "force-dynamic";

/** /settings/theme/new (?from=<a shared theme>) or /settings/theme/<id>: build a theme. */
export default async function EditThemePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const u = await requireUser();
  if (!getSettings().allowCustomThemes) redirect("/settings/theme");
  const { id } = await params;
  const { from } = await searchParams;
  if (id === "new") {
    const src = from ? themeFor(Number(from), u.id) : null;
    const base = src ? src.data : u.theme.custom ? themeFor(u.theme.custom, u.id)?.data ?? themeFromScheme(u.theme.scheme) : themeFromScheme(u.theme.scheme);
    return <ThemeEditor id={null} initial={base} name={src ? `${src.name} (mine)` : "My theme"} shared={false} site={siteLook()} textSize={u.theme.textSize} />;
  }
  const t = themeFor(Number(id), u.id);
  if (!t || !t.mine) notFound();
  return <ThemeEditor id={t.id} initial={t.data} name={t.name} shared={t.shared} site={siteLook()} textSize={u.theme.textSize} />;
}
