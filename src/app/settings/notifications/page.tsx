import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { devices } from "@/lib/push";
import { feedToken } from "@/lib/events";
import { mailReady } from "@/lib/mail";
import { baseUrl } from "@/lib/url";
import { NotifySettings } from "@/components/settings/NotifySettings";

export const dynamic = "force-dynamic";

export default async function NotificationSettings() {
  const u = await requireUser();
  const base = await baseUrl();
  const tok = feedToken(u.id);
  const email = (db().prepare("select email from users where id = ?").get(u.id) as { email: string | null }).email;
  return (
    <NotifySettings
      prefs={u.notify}
      devices={devices(u.id).map((d) => ({ id: d.id, ua: d.ua, createdAt: d.createdAt, lastOk: d.lastOk }))}
      feed={{ mine: `${base}/cal/${tok}.ics`, all: `${base}/cal/${tok}.ics?all=1` }}
      mail={{ ready: mailReady(), email }}
    />
  );
}
