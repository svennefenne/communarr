import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { inviteState } from "@/lib/accounts";
import { getSettings } from "@/lib/settings";
import { userById } from "@/lib/users";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/AuthForms";

export const metadata = { title: "You're invited" };

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (await getUser()) redirect("/");
  const s = getSettings();
  const st = inviteState(code);
  if (!st.ok)
    return (
      <AuthShell siteName={s.siteName} eyebrow="Invitation" title="This link doesn't work">
        <div className="form-error">{st.error}</div>
      </AuthShell>
    );
  const by = st.invite.created_by ? userById(st.invite.created_by) : null;
  return (
    <AuthShell siteName={s.siteName} eyebrow="Invitation" title="You're invited" intro={<>{by ? <><b>{by.name}</b> invited you to </> : "Welcome to "}{s.siteName}. {s.tagline}</>}>
      <SignupForm code={code} />
    </AuthShell>
  );
}
