import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canSeeThread, categories, countView, markThreadRead, pageOfReply, threadPage, threadRow } from "@/lib/forum";
import { markReadByUrl } from "@/lib/notify";
import { ThreadView } from "@/components/forum/ThreadView";
import { BackPill } from "@/components/ui/BackPill";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const t = threadRow(Number((await params).id));
  return { title: t && canSeeThread(u, t) ? t.title : "Thread" };
}

export default async function ThreadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; p?: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const sp = await searchParams;
  // a link to a reply (?p=…) lands on the page it's on
  if (sp.p && !sp.page) {
    const pg = pageOfReply(id, Number(sp.p));
    if (pg > 1) redirect(`/forum/t/${id}?page=${pg}#p-${sp.p}`);
  }
  const data = threadPage(u, id, Number(sp.page) || 1);
  if (!data) notFound();
  countView(id);
  markThreadRead(u, id);
  markReadByUrl(u.id, `/forum/t/${id}`);
  const cats = categories(u).map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
  return (
    <div className="page mid">
      <BackPill href={`/forum/${data.category.slug}`} label={data.category.name} />
      <ThreadView {...data} categories={cats} />
    </div>
  );
}
