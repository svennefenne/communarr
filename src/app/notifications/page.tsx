import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/notify";
import { NotificationList } from "@/components/shell/NotificationList";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const u = await requireUser();
  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <span className="eyebrow">What you missed</span>
          <h1 className="display page-title">Notifications</h1>
        </div>
      </div>
      <NotificationList initial={listNotifications(u.id, { limit: 30 })} />
    </div>
  );
}
