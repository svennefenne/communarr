import { redirect } from "next/navigation";
import { getUser, hasAnyUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!hasAnyUser()) redirect("/setup");
  if (await getUser()) redirect("/");
  const { next } = await searchParams;
  const s = getSettings();
  return (
    <AuthShell siteName={s.siteName} eyebrow="Members only" title="Welcome back" intro={s.welcome}>
      <LoginForm next={next || "/"} canSignUp={s.registration === "open"} />
    </AuthShell>
  );
}
