import { redirect } from "next/navigation";
import { getUser, hasAnyUser } from "@/lib/auth";
import { defaultTextIn, getSettings } from "@/lib/settings";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";
import { mailReady } from "@/lib/mail";
import { requestT } from "@/lib/t";

export async function generateMetadata() {
  return { title: (await requestT())("Log in") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!hasAnyUser()) redirect("/setup");
  if (await getUser()) redirect("/");
  const { next } = await searchParams;
  const s = getSettings();
  const t = await requestT();
  return (
    <AuthShell siteName={s.siteName} eyebrow={t("Members only")} title={t("Welcome back")} intro={defaultTextIn("welcome", s.welcome, t.lang)}>
      <LoginForm next={next || "/"} canSignUp={s.registration === "open"} mail={mailReady()} />
    </AuthShell>
  );
}
