"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleCheck, Hourglass, Mail } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { removeEmailAction, setEmailAction } from "@/app/actions/settings";

/**
 * Settings → Account: your email address, for a new password by mail and the notifications you
 * choose. A new address only takes over once the link mailed to it is clicked.
 */
export function EmailSettings({ email, pending, ready }: { email: string | null; pending: string | null; ready: boolean }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [value, setValue] = useState(pending ?? email ?? "");
  const [busy, start] = useTransition();
  const send = (to: string) =>
    start(async () => {
      const r = await setEmailAction(to);
      if (r.ok) {
        toast(t("A link to confirm it is on its way to {email}.", { email: r.data }));
        router.refresh();
      } else toast(r.error, { kind: "err" });
    });
  return (
    <section className="panel panel-pad stack">
      <h2 className="h2">{t("Email address")}</h2>
      <p className="small muted" style={{ margin: 0 }}>
        {t("For a new password if you forget yours, and the notifications you choose to get by mail. Nobody else on the site sees it.")}{" "}
        <Link href="/settings/notifications" className="link">
          {t("Choose which mails you get")}
        </Link>
      </p>
      {!ready ? (
        <p className="small muted" style={{ margin: 0 }}>
          {t("This site can't send mail yet: an admin sets it up under Admin → Mail.")}
        </p>
      ) : (
        <>
          {email ? (
            <div className="row small">
              <CircleCheck size={16} style={{ color: "var(--ok)" }} aria-hidden />
              <span>{t("{email} is confirmed.", { email })}</span>
            </div>
          ) : null}
          {pending ? (
            <div className="row small wrap">
              <Hourglass size={16} className="muted" aria-hidden />
              <span>{t("Waiting for you to click the link mailed to {email}.", { email: pending })}</span>
              <button type="button" className="btn btn-ghost btn-xs" disabled={busy} onClick={() => send(pending)}>
                {t("Send it again")}
              </button>
            </div>
          ) : null}
          <form
            className="input-group"
            onSubmit={(e) => {
              e.preventDefault();
              send(value);
            }}
          >
            <input className="input" type="email" value={value} onChange={(e) => setValue(e.target.value)} maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder={t("you@example.com")} aria-label={t("Email address")} />
            <button type="submit" className={`btn ${busy ? "loading" : ""}`} disabled={!value.trim() || value.trim().toLowerCase() === (email ?? "")}>
              <Mail size={15} /> {email ? t("Change") : t("Confirm")}
            </button>
          </form>
          {email || pending ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: "flex-start" }}
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const r = await removeEmailAction();
                  if (r.ok) {
                    setValue("");
                    toast(t("Address removed: no more mails."));
                    router.refresh();
                  } else toast(r.error, { kind: "err" });
                })
              }
            >
              {t("Remove the address")}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
