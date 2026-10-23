import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";

/** Short links to things whose page needs looking up (from search results and notifications). */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const n = Number(id);
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));
  if (!(await getUser())) return to("/login");
  switch (kind) {
    case "comment": {
      const c = db().prepare("select target_type t, target_id i from comments where id = ?").get(n) as { t: string; i: number } | undefined;
      if (!c) break;
      const base = c.t === "post" ? `/posts/${c.i}` : c.t === "poll" ? `/polls/${c.i}` : c.t === "event" ? `/events/${c.i}` : "/";
      return to(`${base}#c-${n}`);
    }
    case "reply": {
      const r = db().prepare("select thread_id t from forum_posts where id = ?").get(n) as { t: number } | undefined;
      if (r) return to(`/forum/t/${r.t}?p=${n}#p-${n}`);
      break;
    }
    case "message": {
      const m = db().prepare("select room_id r from messages where id = ?").get(n) as { r: number } | undefined;
      if (m) return to(`/chat/${m.r}?m=${n}`);
      break;
    }
    case "group": {
      const g = db().prepare("select slug from groups where id = ?").get(n) as { slug: string } | undefined;
      if (g) return to(`/groups/${encodeURIComponent(g.slug)}`);
      break;
    }
    case "user": {
      const u = db().prepare("select username from users where id = ?").get(n) as { username: string } | undefined;
      if (u) return to(`/u/${encodeURIComponent(u.username)}`);
      break;
    }
  }
  return to("/");
}
