import { db, now } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/AuthForms";

export const metadata = { title: "New password" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = getSettings();
  const row = db().prepare("select r.expires_at, u.display_name from resets r join users u on u.id = r.user_id where r.token = ? and r.used = 0").get(token) as { expires_at: number; display_name: string } | undefined;
  if (!row || row.expires_at < now())
    return (
      <AuthShell siteName={s.siteName} eyebrow="Password" title="This link doesn't work">
        <div className="form-error">It has been used or has expired. Ask an admin for a new one.</div>
      </AuthShell>
    );
  return (
    <AuthShell siteName={s.siteName} eyebrow="Password" title={`A new password for ${row.display_name}`}>
      <ResetForm token={token} />
    </AuthShell>
  );
}
