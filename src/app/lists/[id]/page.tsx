import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getList } from "@/lib/lists";
import { getSettings } from "@/lib/settings";
import { markReadByUrl } from "@/lib/notify";
import { requestT } from "@/lib/t";
import { ListDetail } from "@/components/lists/ListDetail";
import { BackPill } from "@/components/ui/BackPill";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const l = getList(u, Number((await params).id));
  return { title: l ? l.title : (await requestT())("List") };
}

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (!getSettings().features.lists) notFound();
  const id = Number((await params).id);
  const l = getList(u, id);
  if (!l) notFound();
  markReadByUrl(u.id, `/lists/${id}`);
  const t = await requestT();
  return (
    // (a list with many columns gets the wide page, so they fit side by side)
    <div className={`${l.columns.length > 4 ? "page" : "page mid"} follows-middle`} data-middle>
      <BackPill href="/lists" label={t("Lists")} />
      <ListDetail list={l} />
    </div>
  );
}
