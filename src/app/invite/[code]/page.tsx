import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { inviteState } from "@/lib/accounts";
import { defaultTextIn, getSettings } from "@/lib/settings";
import { userById } from "@/lib/users";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/AuthForms";
import { mailReady } from "@/lib/mail";
import { requestT } from "@/lib/t";

export async function generateMetadata() {
  return { title: (await requestT())("You're invited") };
}

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (await getUser()) redirect("/");
  const s = getSettings();
  const t = await requestT();
  const st = inviteState(code);
  if (!st.ok)
    return (
      <AuthShell siteName={s.siteName} eyebrow={t("Invitation")} title={t("This link doesn't work")}>
        <div className="form-error">{t(st.error)}</div>
      </AuthShell>
    );
  const by = st.invite.created_by ? userById(st.invite.created_by) : null;
  // the inviter's name in bold, wherever the sentence puts it
  const [before, after = ""] = t("{name} invited you to {site}.", { site: s.siteName }).split("{name}");
  return (
    <AuthShell
      siteName={s.siteName}
      eyebrow={t("Invitation")}
      title={t("You're invited")}
      intro={
        <>
          {by ? (
            <>
              {before}
              <b>{by.name}</b>
              {after}
            </>
          ) : (
            t("Welcome to {site}.", { site: s.siteName })
          )}{" "}
          {defaultTextIn("tagline", s.tagline, t.lang)}
        </>
      }
    >
      <SignupForm code={code} mail={mailReady()} />
    </AuthShell>
  );
}
