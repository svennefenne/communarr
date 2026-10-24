import Link from "next/link";
import { unsubscribeUser } from "@/lib/accountMail";
import { maskEmail } from "@/lib/mail";
import { getSettings } from "@/lib/settings";
import { AuthShell } from "@/components/auth/AuthShell";
import { UnsubscribeForm } from "@/components/auth/AuthForms";
import { requestT } from "@/lib/t";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await requestT())("Notification mails") };
}

/**
 * The "Stop all notification mails" link at the bottom of a notification mail (no log-in needed).
 * Opening it does nothing yet (mail programs peek at links): the button does it, and turns them back on.
 */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = getSettings();
  const t = await requestT();
  const who = unsubscribeUser(token);
  if (!who)
    return (
      <AuthShell siteName={s.siteName} eyebrow={t("Notification mails")} title={t("This link doesn't work")}>
        <div className="stack">
          <div className="form-error">{t("Choose which mails you get under Settings → Notifications instead.")}</div>
          <Link href="/settings/notifications" className="btn btn-block">
            {t("Go to your settings")}
          </Link>
        </div>
      </AuthShell>
    );
  return (
    <AuthShell siteName={s.siteName} eyebrow={t("Notification mails")} title={who.name} intro={who.email ? maskEmail(who.email) : undefined}>
      <UnsubscribeForm token={token} on={who.on} />
    </AuthShell>
  );
}
