import Link from "next/link";
import { confirmEmail } from "@/lib/accountMail";
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
 * which is the point; a mail program peeking at the link first does no harm).
 */
export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = getSettings();
  const t = await requestT();
  const r = confirmEmail(token);
  const me = await getUser();
  return (
    <AuthShell siteName={s.siteName} eyebrow={t("Email address")} title={r.ok ? t("Address confirmed") : t("This link doesn't work")}>
      <div className="stack">
        {r.ok ? (
          <div className="form-ok">{t("{email} is your account's address now: you can get a new password by mail, and the notifications you choose.", { email: r.email })}</div>
        ) : (
          <div className="form-error">{t(r.error)}</div>
        )}
        <Link href={me ? "/settings/account" : "/login"} className="btn btn-primary btn-block">
          {me ? t("Go to your settings") : t("Log in")}
        </Link>
      </div>
    </AuthShell>
  );
}
