import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Join" };

export default async function SignupPage() {
  if (await getUser()) redirect("/");
  const s = getSettings();
  if (s.registration !== "open") redirect("/login");
  return (
    <AuthShell siteName={s.siteName} eyebrow="Join" title="Make an account" intro={s.approveNew ? "An admin lets new members in, so it may take a little while." : s.tagline}>
      <SignupForm />
    </AuthShell>
  );
}
