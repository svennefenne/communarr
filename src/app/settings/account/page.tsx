import { currentSessionId, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sessionsOf } from "@/lib/profile";
import { mailReady } from "@/lib/mail";
import { pendingEmail } from "@/lib/accountMail";
import { AccountForm } from "@/components/settings/AccountForm";
import { EmailSettings } from "@/components/settings/EmailSettings";

export const dynamic = "force-dynamic";

/** Settings → Account: your alias and username first, then your email address, password and devices. */
export default async function AccountSettings() {
  const u = await requireUser();
  const email = (db().prepare("select email from users where id = ?").get(u.id) as { email: string | null }).email;
  return (
    <AccountForm
      username={u.username}
      alias={u.alias}
      sessions={sessionsOf(u.id)}
      current={await currentSessionId()}
      email={<EmailSettings email={email} pending={pendingEmail(u.id)} ready={mailReady()} />}
    />
  );
}
