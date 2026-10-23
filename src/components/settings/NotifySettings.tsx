"use client";

import { useEffect, useState } from "react";
import { BellRing, CalendarPlus, Monitor, RefreshCw, Send, Smartphone } from "lucide-react";
import { NOTIFY_KINDS, type NotifyKind, type NotifyPrefs } from "@/lib/types";
import { useToast } from "@/components/app/AppProvider";
import { disablePush, enablePush, pushState, testPush, type PushState } from "@/components/app/push";
import { Switch } from "@/components/ui/ui";
import { Time } from "@/components/ui/Time";
import { InstallHelp } from "@/components/shell/InstallButton";
import { notifyPrefsAction, resetCalendarFeedAction } from "@/app/actions/settings";

const STATE_TEXT: Record<PushState, string> = {
  on: "Notifications are on for this device.",
  off: "Notifications are off for this device.",
  denied: "The browser has blocked notifications for this site. Allow them in the site settings (the icon left of the address), then come back.",
  insecure: "Notifications need the site opened over https:// (ask your admin to put it behind HTTPS).",
  "needs-install": "On an iPhone or iPad, add the site to your home screen first, then open it from there and turn notifications on.",
  unsupported: "This browser can't show notifications from websites.",
};

export function NotifySettings({ prefs, devices, feed }: { prefs: NotifyPrefs; devices: { id: number; ua: string; createdAt: number; lastOk: number | null }[]; feed: { mine: string; all: string } }) {
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [p, setP] = useState(prefs);
  const [busy, setBusy] = useState(false);
  const [feedUrl, setFeedUrl] = useState(feed);
  useEffect(() => {
    pushState().then(setState);
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
      <section className="panel panel-pad stack">
        <div className="row">
          <span className="kind-icon event">
            <BellRing size={20} />
          </span>
          <div className="grow">
            <h2 className="h2">This device</h2>
            <div className="small muted">{state ? STATE_TEXT[state] : "Checking…"}</div>
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
                const s = await enablePush().catch(() => "off" as PushState);
                setBusy(false);
                setState(s);
                if (s === "on") toast("Notifications are on for this device.");
              }}
            >
              <BellRing size={16} /> Turn on notifications here
            </button>
          ) : null}
          {state === "on" ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  const r = await testPush();
                  toast(r.sent ? `Sent a test to ${r.sent} ${r.sent === 1 ? "device" : "devices"}.` : "Nothing sent: no devices answered.");
                }}
              >
                <Send size={16} /> Send a test
              </button>
              <button type="button" className="btn btn-ghost" onClick={async () => setState(await disablePush())}>
                Turn off here
              </button>
            </>
          ) : null}
        </div>
        {devices.length ? (
          <div className="list inset">
            {devices.map((d) => (
              <div key={d.id} className="list-row">
                {/iPhone|Android|Mobile|iPad/.test(d.ua) ? <Smartphone size={18} className="muted" /> : <Monitor size={18} className="muted" />}
                <span className="grow small" style={{ minWidth: 0 }}>
                  <span className="ellipsis" style={{ display: "block" }}>
                    {d.ua.replace(/\(.*?\)/g, "").split(" ").filter((x) => /Chrome|Firefox|Safari|Edg|Mobile/.test(x)).slice(0, 2).join(" ") || "A device"}
                  </span>
                  <span className="tiny muted">
                    added <Time t={d.createdAt} mode="date" />
                    {d.lastOk ? <> · last notified <Time t={d.lastOk} /></> : null}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="h2">What to tell you about</h2>
        </div>
        <div className="panel-body">
          <div className="notify-grid">
            <span />
            <span className="label">In the bell</span>
            <span className="label">On my devices</span>
            {(Object.keys(NOTIFY_KINDS) as NotifyKind[]).map((k) => (
              <div key={k} className="notify-row">
                <span>{NOTIFY_KINDS[k]}</span>
                <Switch on={p[k].app} label={`${NOTIFY_KINDS[k]} in the bell`} onChange={(v) => save({ [k]: { app: v } })} />
                <Switch on={p[k].push} label={`${NOTIFY_KINDS[k]} on my devices`} onChange={(v) => save({ [k]: { push: v } })} />
              </div>
            ))}
          </div>
          <p className="hint">Chat messages don&apos;t go in the bell (the chat counts them); choose per room in the room&apos;s ⋯ menu whether you hear about every message, only @mentions, or nothing.</p>
        </div>
      </section>

      <section className="panel panel-pad stack">
        <h2 className="h2">Quiet hours</h2>
        <p className="small muted" style={{ margin: 0 }}>
          No notifications on your devices between these times (they still land in the bell).
        </p>
        <div className="row wrap">
          <label className="row small">
            From <input type="time" className="input sm" style={{ width: 130 }} value={p.quietFrom} onChange={(e) => save({ quietFrom: e.target.value })} />
          </label>
          <label className="row small">
            to <input type="time" className="input sm" style={{ width: 130 }} value={p.quietTo} onChange={(e) => save({ quietTo: e.target.value })} />
          </label>
          {p.quietFrom ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => save({ quietFrom: "", quietTo: "" })}>
              No quiet hours
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel panel-pad stack">
        <h2 className="h2">Calendar in your calendar app</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Subscribe and the events show up in your phone&apos;s or computer&apos;s calendar, kept up to date.
        </p>
        <div className="row wrap">
          <a className="btn btn-primary btn-sm" href={feedUrl.mine.replace(/^https?:/, "webcal:")}>
            <CalendarPlus size={15} /> What I&apos;m going to
          </a>
          <a className="btn btn-sm" href={feedUrl.all.replace(/^https?:/, "webcal:")}>
            <CalendarPlus size={15} /> Everything
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="Make new addresses (the old ones stop working)"
            onClick={async () => {
              const r = await resetCalendarFeedAction();
              if (r.ok) {
                const base = feedUrl.mine.replace(/\/cal\/.*$/, "");
                setFeedUrl({ mine: `${base}/cal/${r.data}.ics`, all: `${base}/cal/${r.data}.ics?all=1` });
                toast("New calendar addresses made: subscribe again.");
              }
            }}
          >
            <RefreshCw size={15} /> New addresses
          </button>
        </div>
      </section>
    </div>
  );
}
