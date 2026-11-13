"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BellRing, CalendarPlus, Monitor, RefreshCw, Send, Smartphone } from "lucide-react";
import { NOTIFY_KINDS, type NotifyKind, type NotifyPrefs } from "@/lib/types";
import { useT, useToast } from "@/components/app/AppProvider";
import { disablePush, enablePush, pushState, testPush, type PushState } from "@/components/app/push";
import { Switch } from "@/components/ui/ui";
import { Time } from "@/components/ui/Time";
import { TimeField } from "@/components/ui/DateTime";
import { InstallHelp } from "@/components/shell/InstallButton";
import { askApp, inApp, inDesktopApp, tellApp } from "@/components/app/androidApp";
import { notifyPrefsAction, resetCalendarFeedAction } from "@/app/actions/settings";

const STATE_TEXT: Record<PushState, string> = {
  on: "Notifications are on for this device.",
  off: "Notifications are off for this device.",
  denied: "The browser has blocked notifications for this site. Allow them in the site settings (the icon left of the address), then come back.",
  insecure: "Notifications need the site opened over https:// (ask your admin to put it behind HTTPS).",
  "needs-install": "On an iPhone or iPad, add the site to your home screen first, then open it from there and turn notifications on.",
  unsupported: "This browser can't show notifications from websites.",
};

/** What the Android app says about its notifications on this phone. */
interface AppPushStatus {
  /** Android's permission for the app's notifications */
  permission: "granted" | "denied" | "ask";
  /** the admin has set up Firebase on this server */
  configured: boolean;
  /** this phone is signed up (its token is on the server) */
  ready: boolean;
  /** why it couldn't sign up, the last time it tried */
  error?: string;
}

export function NotifySettings({
  prefs,
  devices,
  phones,
  feed,
  mail,
}: {
  prefs: NotifyPrefs;
  devices: { id: number; ua: string; createdAt: number; lastOk: number | null }[];
  phones: { id: number; app: string; createdAt: number; lastOk: number | null }[];
  feed: { mine: string; all: string };
  mail: { ready: boolean; email: string | null };
}) {
  const t = useT();
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [p, setP] = useState(prefs);
  const [busy, setBusy] = useState(false);
  const [feedUrl, setFeedUrl] = useState(feed);
  // in the Android app: its own notifications (Firebase), not the browser's
  const [app, setApp] = useState<AppPushStatus | "none" | null>(null);
  // in the desktop app: its own notifications (down the live stream), when the computer can show them
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    if (inDesktopApp()) void askApp<{ supported?: boolean }>({ t: "push-status" }).then((s) => setDesktop(s?.supported !== false));
    else if (inApp()) void askApp<AppPushStatus>({ t: "push-status" }).then((s) => setApp(s ?? "none"));
    else pushState().then(setState);
    // the browser's own time zone, for quiet hours
    void notifyPrefsAction({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
  }, []);
  const save = async (patch: Parameters<typeof notifyPrefsAction>[0]) => {
    const r = await notifyPrefsAction(patch);
    if (r.ok) setP(r.data);
    else toast(r.error, { kind: "err" });
  };
  return (
    <div className="stack loose">
      {desktop !== null ? (
        <DesktopPushSection supported={desktop} devices={<Devices devices={devices} phones={phones} />} />
      ) : app ? (
        <AppPushSection status={app} onChange={setApp} devices={<Devices devices={devices} phones={phones} />} />
      ) : (
        <section className="panel panel-pad stack">
          <div className="row">
            <span className="kind-icon event">
              <BellRing size={20} />
            </span>
            <div className="grow">
              <h2 className="h2">{t("This device")}</h2>
              <div className="small muted">{state ? t(STATE_TEXT[state]) : t("Checking…")}</div>
            </div>
          </div>
          {state === "needs-install" ? <InstallHelp /> : null}
          <div className="row wrap">
            {state === "off" ? (
              <button
                type="button"
                className={`btn btn-primary ${busy ? "loading" : ""}`}
                onClick={async () => {
                  setBusy(true);
                  const r = await enablePush();
                  setBusy(false);
                  setState(r.state);
                  if (r.state === "on") toast(t("Notifications are on for this device."));
                  else if (r.state === "denied") toast(t("The browser said no. You can allow notifications in the site settings."), { kind: "err" });
                  else if (r.why === "dismissed") toast(t("The browser's question closed without an answer. Try again and choose Allow."));
                  else toast(t("Couldn't turn on notifications here: {error}", { error: r.error ?? "?" }), { kind: "err" });
                }}
              >
                <BellRing size={16} /> {t("Turn on notifications here")}
              </button>
            ) : null}
            {state === "on" ? (
              <>
                <TestButton />
                <button type="button" className="btn btn-ghost" onClick={async () => setState(await disablePush())}>
                  {t("Turn off here")}
                </button>
              </>
            ) : null}
          </div>
          <Devices devices={devices} phones={phones} />
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2 className="h2">{t("What to tell you about")}</h2>
        </div>
        <div className="panel-body">
          <div className={`notify-grid ${mail.ready ? "with-mail" : ""}`}>
            <span />
            <span className="label">{t("In the bell")}</span>
            <span className="label">{t("On my devices")}</span>
            {mail.ready ? <span className="label">{t("By mail")}</span> : null}
            {(Object.keys(NOTIFY_KINDS) as NotifyKind[]).map((k) => (
              <div key={k} className="notify-row">
                <span>{t(NOTIFY_KINDS[k])}</span>
                <Switch on={p[k].app} label={t("{kind} in the bell", { kind: t(NOTIFY_KINDS[k]) })} onChange={(v) => save({ [k]: { app: v } })} />
                <Switch on={p[k].push} label={t("{kind} on my devices", { kind: t(NOTIFY_KINDS[k]) })} onChange={(v) => save({ [k]: { push: v } })} />
                {mail.ready ? <Switch on={p[k].mail} label={t("{kind} by mail", { kind: t(NOTIFY_KINDS[k]) })} onChange={(v) => save({ [k]: { mail: v } })} /> : null}
              </div>
            ))}
          </div>
          <p className="hint">{t("Chat messages don't go in the bell (the chat counts them); choose per room in the room's ⋯ menu whether you hear about every message, only @mentions, or nothing.")}</p>
          {mail.ready ? (
            <p className="hint">
              {mail.email ? t("Mails go to {email}, only while you're not on the site, and at most one per conversation in half an hour.", { email: mail.email }) : t("Mails need a confirmed email address:")}{" "}
              {!mail.email ? (
                <Link href="/settings/account" className="link">
                  {t("add one under Settings → Account")}
                </Link>
              ) : null}
            </p>
          ) : null}
        </div>
      </section>

      <section className="panel panel-pad stack">
        <h2 className="h2">{t("Quiet hours")}</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {t("No notifications on your devices between these times (they still land in the bell).")}
        </p>
        <div className="row wrap">
          <label className="row small">
            {t("From")} <TimeField small step={15} value={p.quietFrom} onChange={(v) => save({ quietFrom: v })} label={t("From")} />
          </label>
          <label className="row small">
            {t("to")} <TimeField small step={15} value={p.quietTo} onChange={(v) => save({ quietTo: v })} label={t("to")} />
          </label>
          {p.quietFrom ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => save({ quietFrom: "", quietTo: "" })}>
              {t("No quiet hours")}
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel panel-pad stack">
        <h2 className="h2">{t("Calendar in your calendar app")}</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {t("Subscribe and the events show up in your phone's or computer's calendar, kept up to date.")}
        </p>
        <div className="row wrap">
          <a className="btn btn-primary btn-sm" href={feedUrl.mine.replace(/^https?:/, "webcal:")}>
            <CalendarPlus size={15} /> {t("What I'm going to")}
          </a>
          <a className="btn btn-sm" href={feedUrl.all.replace(/^https?:/, "webcal:")}>
            <CalendarPlus size={15} /> {t("Everything")}
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title={t("Make new addresses (the old ones stop working)")}
            onClick={async () => {
              const r = await resetCalendarFeedAction();
              if (r.ok) {
                const base = feedUrl.mine.replace(/\/cal\/.*$/, "");
                setFeedUrl({ mine: `${base}/cal/${r.data}.ics`, all: `${base}/cal/${r.data}.ics?all=1` });
                toast(t("New calendar addresses made: subscribe again."));
              }
            }}
          >
            <RefreshCw size={15} /> {t("New addresses")}
          </button>
        </div>
      </section>
    </div>
  );
}

/** "Send a test": to all of my devices (browsers and phones with the app). */
function TestButton() {
  const t = useT();
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={async () => {
        const r = await testPush();
        toast(r.sent ? t.n(r.sent, "Sent a test to {n} device.", "Sent a test to {n} devices.") : t("Nothing sent: no devices answered."));
      }}
    >
      <Send size={16} /> {t("Send a test")}
    </button>
  );
}

/** My devices that get notifications: browsers, and phones with the Android app. */
function Devices({ devices, phones }: { devices: { id: number; ua: string; createdAt: number; lastOk: number | null }[]; phones: { id: number; app: string; createdAt: number; lastOk: number | null }[] }) {
  const t = useT();
  if (!devices.length && !phones.length) return null;
  const when = (createdAt: number, lastOk: number | null) => (
    <span className="tiny muted">
      {t("added")} <Time t={createdAt} mode="date" />
      {lastOk ? <> · {t("last notified")} <Time t={lastOk} /></> : null}
    </span>
  );
  return (
    <div className="list inset">
      {phones.map((d) => (
        <div key={`app-${d.id}`} className="list-row">
          <Smartphone size={18} className="muted" />
          <span className="grow small" style={{ minWidth: 0 }}>
            <span className="ellipsis" style={{ display: "block" }}>
              {t("The Android app")}
            </span>
            {when(d.createdAt, d.lastOk)}
          </span>
        </div>
      ))}
      {devices.map((d) => (
        <div key={d.id} className="list-row">
          {/iPhone|Android|Mobile|iPad/.test(d.ua) ? <Smartphone size={18} className="muted" /> : <Monitor size={18} className="muted" />}
          <span className="grow small" style={{ minWidth: 0 }}>
            <span className="ellipsis" style={{ display: "block" }}>
              {d.ua.replace(/\(.*?\)/g, "").split(" ").filter((x) => /Chrome|Firefox|Safari|Edg|Mobile/.test(x)).slice(0, 2).join(" ") || t("A device")}
            </span>
            {when(d.createdAt, d.lastOk)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * This phone, in the Android app: its notifications come through the app (Firebase), so whether
 * Android lets the app show them, and whether the server has the app's notifications set up.
 */
/** The desktop app: it shows the site's notifications itself while it runs, in the tray too. */
function DesktopPushSection({ supported, devices }: { supported: boolean; devices: React.ReactNode }) {
  const t = useT();
  return (
    <section className="panel panel-pad stack">
      <div className="row">
        <span className="kind-icon event">
          <Monitor size={20} />
        </span>
        <div className="grow">
          <h2 className="h2">{t("This computer")}</h2>
          <div className="small muted">
            {supported
              ? t("The app shows notifications while it runs, in the tray too. While you're using this computer they come here, not to your phone.")
              : t("This computer can't show the app's notifications.")}
          </div>
        </div>
      </div>
      {supported ? (
        <div className="row wrap">
          <TestButton />
        </div>
      ) : null}
      {devices}
    </section>
  );
}

function AppPushSection({ status, onChange, devices }: { status: AppPushStatus | "none"; onChange: (s: AppPushStatus | "none") => void; devices: React.ReactNode }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  // (an app without its bridge answers nothing)
  const s: AppPushStatus = status === "none" ? { permission: "ask", configured: false, ready: false } : status;
  const text =
    status === "none"
      ? t("This version of the app can't show notifications: update it.")
      : !s.configured
        ? t("Notifications in the app aren't set up on this site yet (an admin does that under Admin → Notifications & voice).")
        : s.permission === "denied"
          ? t("Android has blocked the app's notifications. Allow them in the app's settings.")
          : s.permission === "ask"
            ? t("Notifications are off for this phone.")
            : s.ready
              ? t("Notifications are on for this phone.")
              : s.error
                ? t("Couldn't sign this phone up: {error}", { error: s.error })
                : t("Signing this phone up…");
  return (
    <section className="panel panel-pad stack">
      <div className="row">
        <span className="kind-icon event">
          <BellRing size={20} />
        </span>
        <div className="grow">
          <h2 className="h2">{t("This phone")}</h2>
          <div className="small muted">{text}</div>
        </div>
      </div>
      {status !== "none" && s.configured ? (
        <div className="row wrap">
          {s.permission === "ask" || (s.permission === "granted" && !s.ready && s.error) ? (
            <button
              type="button"
              className={`btn btn-primary ${busy ? "loading" : ""}`}
              onClick={async () => {
                setBusy(true);
                // (the app answers with where notifications stand now, once Android has asked)
                const r = await askApp<AppPushStatus>({ t: "push-on" }, 60_000, "push-status");
                setBusy(false);
                if (r) onChange(r);
              }}
            >
              <BellRing size={16} /> {s.permission === "ask" ? t("Turn on notifications here") : t("Try again")}
            </button>
          ) : null}
          {s.permission === "denied" ? (
            <button type="button" className="btn btn-primary" onClick={() => tellApp({ t: "push-settings" })}>
              {t("Open the app's settings")}
            </button>
          ) : null}
          {s.permission === "granted" && s.ready ? <TestButton /> : null}
        </div>
      ) : null}
      {devices}
    </section>
  );
}
