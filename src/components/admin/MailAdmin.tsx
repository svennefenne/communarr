"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleAlert, Send } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { Time } from "@/components/ui/Time";
import { SaveBar } from "./Section";
import { saveMailAction, testMailAction } from "@/app/actions/admin";
import type { MailFailure, MailSecurity } from "@/lib/mail";

export interface MailAdminProps {
  settings: { host: string; port: number; security: MailSecurity; user: string; from: string; fromName: string; hasPass: boolean } | null;
  /** where they come from: this page, or SMTP_* in docker-compose.yml */
  source: "admin" | "env" | null;
  lastFailure: MailFailure | null;
  /** your own confirmed address, for the test mail */
  myEmail: string | null;
  siteName: string;
  /** where links in mails go (PUBLIC_URL, or the address you're using) */
  origin: string | null;
}

/** the usual ports for each kind of encryption */
const PORTS: Record<MailSecurity, number> = { starttls: 587, tls: 465, none: 25 };

/**
 * Admin → Mail: the SMTP server the site sends through (a forgotten password, confirming an address,
 * notifications by mail), and a test mail. Without one, password resets are links you make here.
 */
export function MailAdmin({ settings, source, lastFailure, myEmail, siteName, origin }: MailAdminProps) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [v, setV] = useState({
    host: settings?.host ?? "",
    port: String(settings?.port ?? 587),
    security: settings?.security ?? ("starttls" as MailSecurity),
    user: settings?.user ?? "",
    pass: "",
    from: settings?.from ?? "",
    fromName: settings?.fromName ?? "",
  });
  const [to, setTo] = useState(myEmail ?? "");
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const ready = !!settings?.host && !!settings.from;
  const save = () =>
    start(async () => {
      const r = await saveMailAction({ ...v, port: Number(v.port), pass: v.pass ? v.pass : null });
      if (r.ok) {
        toast(v.host ? t("Saved. Send yourself a test mail to see that it works.") : t("Mail is off."));
        setV((x) => ({ ...x, pass: "" }));
        router.refresh();
      } else toast(r.error, { kind: "err" });
    });
  return (
    <div className="stack">
      <div className={`mail-status ${ready ? "on" : ""}`}>
        <span className="mail-lamp" aria-hidden />
        <div>
          <b>{ready ? t("Mail is on") : t("Mail is off")}</b>
          <div className="small muted">
            {ready
              ? source === "env"
                ? t("Sending through {host} as {from}, set in docker-compose.yml (SMTP_HOST…). Saving here takes over from it.", { host: settings!.host, from: settings!.from })
                : t("Sending through {host} as {from}.", { host: settings!.host, from: settings!.from })
              : t("Nobody can get a new password by mail, and nobody gets notifications by mail. Add a mail server to turn both on.")}
          </div>
          {ready && origin ? <div className="small muted">{t("Links in mails go to {origin}.", { origin })}</div> : null}
        </div>
      </div>
      {lastFailure ? (
        <div className="form-error row" style={{ alignItems: "flex-start" }}>
          <CircleAlert size={16} style={{ flex: "none", marginTop: 2 }} aria-hidden />
          <span>
            {t("The last mail that didn't go, to {to}: {error}", { to: lastFailure.to, error: lastFailure.error })}
            {" · "}
            <Time t={lastFailure.at} />
          </span>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="mail-host">{t("SMTP server")}</label>
          <input id="mail-host" className="input" value={v.host} onChange={(e) => setV({ ...v, host: e.target.value })} placeholder="smtp.gmail.com" autoComplete="off" spellCheck={false} />
        </div>
        <div className="grid-2" style={{ gap: 10 }}>
          <div className="field">
            <label htmlFor="mail-security">{t("Encryption")}</label>
            <select
              id="mail-security"
              className="select"
              value={v.security}
              onChange={(e) => {
                const s = e.target.value as MailSecurity;
                // the port follows, unless it was set to something unusual
                setV({ ...v, security: s, port: Object.values(PORTS).includes(Number(v.port)) ? String(PORTS[s]) : v.port });
              }}
            >
              <option value="starttls">STARTTLS (587)</option>
              <option value="tls">SSL/TLS (465)</option>
              <option value="none">{t("None (25, local relay)")}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="mail-port">{t("Port")}</label>
            <input id="mail-port" className="input" inputMode="numeric" value={v.port} onChange={(e) => setV({ ...v, port: e.target.value.replace(/\D/g, "") })} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="mail-user">{t("Username")}</label>
          <input id="mail-user" className="input" value={v.user} onChange={(e) => setV({ ...v, user: e.target.value })} autoComplete="off" spellCheck={false} placeholder={t("Empty: no log-in")} />
        </div>
        <div className="field">
          <label htmlFor="mail-pass">{t("Password")}</label>
          <input id="mail-pass" className="input" type="password" value={v.pass} onChange={(e) => setV({ ...v, pass: e.target.value })} autoComplete="new-password" placeholder={settings?.hasPass ? t("•••••• (saved; leave empty to keep)") : ""} />
        </div>
        <div className="field">
          <label htmlFor="mail-from">{t("Sender address")}</label>
          <input id="mail-from" className="input" type="email" value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })} placeholder="noreply@example.com" autoComplete="off" spellCheck={false} />
        </div>
        <div className="field">
          <label htmlFor="mail-name">{t("Sender name")}</label>
          <input id="mail-name" className="input" value={v.fromName} onChange={(e) => setV({ ...v, fromName: e.target.value })} maxLength={60} placeholder={siteName} />
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {t(
          "Gmail: smtp.gmail.com, STARTTLS, your Gmail address as username and sender, and an app password (Google account → Security → App passwords). A relay on your own network: its address, no encryption, port 25, no username. Empty the server field to turn mail off.",
        )}
      </p>
      <SaveBar pending={pending} onSave={save} />

      {ready ? (
        <form
          className="input-group"
          onSubmit={(e) => {
            e.preventDefault();
            startTest(async () => {
              const r = await testMailAction(to);
              if (r.ok) toast(t("Sent to {email}. Look in its inbox (and the spam folder).", { email: r.data }));
              else toast(r.error, { kind: "err" });
              router.refresh();
            });
          }}
        >
          <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("Send a test mail to…")} aria-label={t("Send a test mail to…")} />
          <button type="submit" className={`btn ${testing ? "loading" : ""}`}>
            <Send size={15} /> {t("Send a test mail")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
