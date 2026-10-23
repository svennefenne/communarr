import "server-only";
import { db } from "./db";
import { canSeePost, postRow } from "./posts";
import { canSeePoll, pollRow } from "./polls";
import { canSeeEvent, eventRow } from "./events";
import { canSeeThread, threadRow } from "./forum";
import { canSee as canSeeRoom, room } from "./chat";
import { canSeeGroup, groupRow } from "./groups";
import { userById, type User } from "./users";

/** Can this member see this thing? (The one check behind reactions, reports and notifications.) */
export function canSeeTarget(u: User, type: string, id: number): boolean {
  switch (type) {
    case "post": {
      const p = postRow(id);
      return !!p && canSeePost(u, p);
    }
    case "poll": {
      const p = pollRow(id);
      return !!p && canSeePoll(u, p);
    }
    case "event": {
      const e = eventRow(id);
      return !!e && canSeeEvent(u, e);
    }
    case "thread": {
      const t = threadRow(id);
      return !!t && canSeeThread(u, t);
    }
    case "reply": {
      const r = db().prepare("select thread_id t from forum_posts where id = ?").get(id) as { t: number } | undefined;
      const t = r ? threadRow(r.t) : null;
      return !!t && canSeeThread(u, t);
    }
    case "comment": {
      const c = db().prepare("select target_type t, target_id i from comments where id = ?").get(id) as { t: string; i: number } | undefined;
      return !!c && canSeeTarget(u, c.t, c.i);
    }
    case "message": {
      const m = db().prepare("select room_id r, deleted from messages where id = ?").get(id) as { r: number; deleted: number } | undefined;
      const r = m ? room(m.r) : null;
      return !!r && !m!.deleted && canSeeRoom(u, r);
    }
    case "group": {
      const g = groupRow(id);
      return !!g && canSeeGroup(u, g);
    }
    case "user":
      return !!userById(id);
    default:
      return false;
  }
}

/** Of these people, the ones who may see the thing (notifications go only to them). */
export function whoCanSee(userIds: number[], type: string, id: number): number[] {
  return userIds.filter((uid) => {
    const u = userById(uid);
    return !!u && !u.banned && canSeeTarget(u, type, id);
  });
}
