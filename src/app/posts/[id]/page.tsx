import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPost } from "@/lib/posts";
import { markReadByUrl } from "@/lib/notify";
import { requestT } from "@/lib/t";
import { PostCard } from "@/components/feed/PostCard";
import { BackPill } from "@/components/ui/BackPill";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const p = getPost(u, Number((await params).id));
  const t = await requestT();
  return { title: p ? p.title || t("{name}'s post", { name: p.author.name }) : t("Post") };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = Number((await params).id);
  const p = getPost(u, id);
  if (!p) notFound();
  markReadByUrl(u.id, `/posts/${id}`);
  return (
    <div className="page narrow">
      <BackPill href={p.kind === "news" ? "/news" : "/"} />
      <PostCard post={p} full />
    </div>
  );
}
