import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/notify";
import { requestT } from "@/lib/t";
import { NotificationList } from "@/components/shell/NotificationList";

export async function generateMetadata() {
  return { title: (await requestT())("Notifications") };
}
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const u = await requireUser();
  const t = await requestT();
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("What you missed")}</span>
          <h1 className="display page-title">{t("Notifications")}</h1>
        </div>
      </div>
      <NotificationList initial={listNotifications(u.id, { limit: 30 })} />
    </div>
  );
}
