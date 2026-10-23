import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { requestT } from "@/lib/t";
import { getPost } from "@/lib/posts";
import { PostEditor } from "@/components/feed/PostEditor";
import { BackPill } from "@/components/ui/BackPill";

export async function generateMetadata() {
  return { title: (await requestT())("Edit post") };
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const p = getPost(u, id);
  if (!p) notFound();
  if (!p.canEdit && !(p.kind === "news" && u.isAdmin)) redirect(`/posts/${id}`);
  const t = await requestT();
  return (
    <div className="page narrow">
      <BackPill href={`/posts/${id}`} />
      <div className="page-head">
        <div>
          <span className="eyebrow">{t(p.kind === "news" ? "News" : "Post")}</span>
          <h1 className="display page-title">{t("Edit")}</h1>
        </div>
      </div>
      <div className="panel panel-pad">
        <PostEditor post={p} />
      </div>
    </div>
  );
}
