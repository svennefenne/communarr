import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { SetupForm } from "@/components/auth/AuthForms";

export const metadata = { title: "Set up" };

export default function SetupPage() {
  if (hasAnyUser()) redirect("/login");
  return (
    <AuthShell siteName="Hooden" eyebrow="First start" title="Make yourself the admin" intro="This account runs the place: it invites friends, sets the look and keeps things tidy. You can make others admins later.">
      <SetupForm />
    </AuthShell>
  );
}
