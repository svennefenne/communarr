import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { defaultTextIn, getSettings } from "@/lib/settings";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/AuthForms";
import { mailReady } from "@/lib/mail";
import { requestT } from "@/lib/t";

export async function generateMetadata() {
  return { title: (await requestT())("Join") };
}

export default async function SignupPage() {
  if (await getUser()) redirect("/");
  const s = getSettings();
  if (s.registration !== "open") redirect("/login");
  const t = await requestT();
  return (
    <AuthShell siteName={s.siteName} eyebrow={t("Join")} title={t("Make an account")} intro={s.approveNew ? t("An admin lets new members in, so it may take a little while.") : defaultTextIn("tagline", s.tagline, t.lang)}>
      <SignupForm mail={mailReady()} />
    </AuthShell>
  );
}
