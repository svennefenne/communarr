import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { mailReady } from "@/lib/mail";
import { getSettings } from "@/lib/settings";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/AuthForms";
import { requestT } from "@/lib/t";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await requestT())("Forgot your password?") };
}

/** Forgot your password or your username: one mail has both (the username, and a link for a new password). */
export default async function ForgotPage() {
  if (await getUser()) redirect("/settings/account");
  const s = getSettings();
  const t = await requestT();
  return (
    <AuthShell
      siteName={s.siteName}
      eyebrow={t("Password")}
      title={t("Forgot it?")}
      intro={mailReady() ? t("Write your username or your email address. We'll mail you the username and a link to choose a new password.") : undefined}
    >
      {mailReady() ? (
        <ForgotForm />
      ) : (
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            {t("This site can't send mail yet. Ask an admin for a password reset link.")}
          </p>
          <Link href="/login" className="btn btn-block">
            {t("Back to log in")}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
