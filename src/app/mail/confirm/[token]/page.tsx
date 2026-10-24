import Link from "next/link";
import { confirmEmail } from "@/lib/accountMail";
import { announceNewMember } from "@/lib/accounts";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AuthShell } from "@/components/auth/AuthShell";
import { requestT } from "@/lib/t";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await requestT())("Confirm your address") };
}

/**
 * The link in the confirmation mail: opening it confirms the address (whoever opens it had the mail,
 * which is the point; a mail program peeking at the link first does no harm). For a new account it
 * also opens the account (or hands it on to an admin), and the admins hear about it; logging in is
 * still with the password.
 */
export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = getSettings();
  const t = await requestT();
  const r = confirmEmail(token);
  if (r.ok && r.opened) announceNewMember(r.userId, r.opened === "pending");
  const me = await getUser();
  const title = !r.ok ? t("This link doesn't work") : r.opened === "in" ? t("You're in!") : t("Address confirmed");
  return (
    <AuthShell siteName={s.siteName} eyebrow={t("Email address")} title={title}>
      <div className="stack">
        {!r.ok ? (
          <div className="form-error">{t(r.error)}</div>
        ) : r.opened === "in" ? (
          <div className="form-ok">{t("{email} is confirmed and your account is open. Log in with your username and password.", { email: r.email })}</div>
        ) : r.opened === "pending" ? (
          <div className="form-ok">{t("{email} is confirmed. An admin will let you in soon; then you can log in.", { email: r.email })}</div>
        ) : (
          <div className="form-ok">{t("{email} is your account's address now: you can get a new password by mail, and the notifications you choose.", { email: r.email })}</div>
        )}
        {me ? (
          <Link href="/settings/account" className="btn btn-primary btn-block">
            {t("Go to your settings")}
          </Link>
        ) : r.ok && r.opened === "pending" ? null : (
          <Link href="/login" className="btn btn-primary btn-block">
            {t("Log in")}
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
