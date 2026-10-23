import { currentSessionId, requireUser } from "@/lib/auth";
import { sessionsOf } from "@/lib/profile";
import { AccountForm } from "@/components/settings/AccountForm";

export const dynamic = "force-dynamic";

export default async function AccountSettings() {
  const u = await requireUser();
  return <AccountForm username={u.username} sessions={sessionsOf(u.id)} current={await currentSessionId()} />;
}
