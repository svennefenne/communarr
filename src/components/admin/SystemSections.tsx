"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, Download, Hash, Lock, Plus, RefreshCw, Send, Sparkles, Trash2, Wrench } from "lucide-react";
import type { SiteSettings, IceServer } from "@/lib/settings";
import { useToast } from "@/components/app/AppProvider";
import { Time } from "@/components/ui/Time";
import { useConfirm } from "@/components/ui/ui";
import { bytes } from "./Overview";
import { SaveBar } from "./Section";
import { archiveRoomAdminAction, cleanupAction, deleteGroupAdminAction, deleteRoomAdminAction, reindexAction, rotateVapidAction, saveSettingsAction, testPushAction, vacuumAction } from "@/app/actions/admin";

export interface AdminGroup {
  id: number;
  slug: string;
  name: string;
  privacy: string;
  members: number;
  owner: string | null;
  createdAt: number;
}
export interface AdminRoom {
  id: number;
  name: string;
  emoji: string;
  kind: string;
  visibility: string;
  members: number;
  messages: number;
  lastMessageAt: number | null;
  archived: boolean;
}

export function GroupsRooms({ groups, rooms }: { groups: AdminGroup[]; rooms: AdminRoom[] }) {
  const toast = useToast();
  const router = useRouter();
  const { confirm, node } = useConfirm();
  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p;
    if (!r.ok) toast(r.error ?? "That didn't work.", { kind: "err" });
    router.refresh();
  };
  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="stack tight">
        <span className="label">Groups · {groups.length}</span>
        <div className="list inset">
          {groups.map((g) => (
            <div key={g.id} className="list-row">
              <span className="grow" style={{ minWidth: 0 }}>
                <Link href={`/groups/${g.slug}`} className="strong">
                  {g.name}
                </Link>
                <span className="tiny muted" style={{ display: "block" }}>
                  {g.privacy} · {g.members} members · by {g.owner ?? "—"}
                </span>
              </span>
              <button type="button" className="icon-btn xs" aria-label="Delete" onClick={() => confirm(`Delete the group ${g.name} with everything in it?`, "Delete", () => run(deleteGroupAdminAction(g.id)))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {!groups.length ? <div className="panel-body small muted" style={{ paddingTop: 12 }}>No groups.</div> : null}
        </div>
      </div>
      <div className="stack tight">
        <span className="label">Chat rooms · {rooms.length}</span>
        <div className="list inset">
          {rooms.map((r) => (
            <div key={r.id} className="list-row">
              <span className="room-icon" style={{ width: 28, height: 28, fontSize: 14 }}>
                {r.emoji || (r.visibility === "private" ? <Lock size={13} /> : <Hash size={14} />)}
              </span>
              <span className="grow" style={{ minWidth: 0 }}>
                <Link href={`/chat/${r.id}`} className="strong">
                  {r.name}
                </Link>{" "}
                {r.archived ? <span className="badge">archived</span> : null}
                <span className="tiny muted" style={{ display: "block" }}>
                  {r.kind === "group" ? "group room" : r.visibility} · {r.members} members · {r.messages} messages
                  {r.lastMessageAt ? <> · last <Time t={r.lastMessageAt} /></> : null}
                </span>
              </span>
              <button type="button" className="icon-btn xs" aria-label={r.archived ? "Unarchive" : "Archive"} title={r.archived ? "Unarchive" : "Archive"} onClick={() => run(archiveRoomAdminAction(r.id, !r.archived))}>
                <Archive size={14} />
              </button>
              <button type="button" className="icon-btn xs" aria-label="Delete" onClick={() => confirm(`Delete ${r.name} and all its messages?`, "Delete", () => run(deleteRoomAdminAction(r.id)))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <span className="tiny muted">Direct messages aren&apos;t listed: they&apos;re private.</span>
      </div>
      {node}
    </div>
  );
}

export function NotifyVoice({ s, vapid, devices, timezones }: { s: SiteSettings; vapid: string; devices: number; timezones: string[] }) {
  const toast = useToast();
  const router = useRouter();
  const [contact, setContact] = useState(s.pushContact);
  const [ice, setIce] = useState<IceServer[]>(s.voice.ice);
  const [max, setMax] = useState(s.voice.max);
  const [tz, setTz] = useState(s.timezone);
  const [pending, start] = useTransition();
  const { confirm, node } = useConfirm();
  const save = (patch: Partial<SiteSettings>) =>
    start(async () => {
      const r = await saveSettingsAction(patch);
      if (!r.ok) toast(r.error, { kind: "err" });
      else {
        toast("Saved.");
        router.refresh();
      }
    });
  return (
    <div className="stack loose">
      <div className="stack tight">
        <b>Push notifications</b>
        <span className="small muted">
          {devices} {devices === 1 ? "device" : "devices"} signed up. Phones need the site on https://, and iPhones need it added to the home screen.
        </span>
        <div className="field">
          <label>Contact the push services can reach (mailto: or https:)</label>
          <input className="input sm" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="mailto:you@example.com" />
        </div>
        <div className="row wrap">
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              const r = await testPushAction();
              if (r.ok) toast(r.data.sent ? `Sent to ${r.data.sent} of your devices.` : "You have no devices signed up (Settings → Notifications).");
            }}
          >
            <Send size={14} /> Send me a test
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => confirm("Make new push keys? Every device has to turn notifications on again.", "New keys", async () => {
            await rotateVapidAction();
            router.refresh();
          })}>
            <RefreshCw size={14} /> New keys
          </button>
        </div>
        <details className="tiny muted">
          <summary style={{ cursor: "pointer" }}>Public key</summary>
          <code style={{ wordBreak: "break-all" }}>{vapid}</code>
        </details>
        <SaveBar pending={pending} onSave={() => save({ pushContact: contact.trim() })} />
      </div>
      <div className="stack tight">
        <b>Voice chat</b>
        <span className="small muted">Calls go directly between people. STUN finds the way through home routers; a TURN server relays calls that can&apos;t (phones on mobile data often need one, e.g. coturn).</span>
        {ice.map((x, i) => (
          <div key={i} className="input-group">
            <input className="input sm mono" value={x.urls} onChange={(e) => setIce(ice.map((y, j) => (j === i ? { ...y, urls: e.target.value } : y)))} placeholder="stun:host:3478 or turn:host:3478" />
            {x.urls.startsWith("turn") ? (
              <>
                <input className="input sm" style={{ maxWidth: 140 }} value={x.username ?? ""} onChange={(e) => setIce(ice.map((y, j) => (j === i ? { ...y, username: e.target.value } : y)))} placeholder="username" />
                <input className="input sm" style={{ maxWidth: 140 }} type="password" value={x.credential ?? ""} onChange={(e) => setIce(ice.map((y, j) => (j === i ? { ...y, credential: e.target.value } : y)))} placeholder="password" />
              </>
            ) : null}
            <button type="button" className="icon-btn sm" onClick={() => setIce(ice.filter((_, j) => j !== i))} aria-label="Remove">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setIce([...ice, { urls: "turn:" }])}>
          <Plus size={14} /> Add a server
        </button>
        <label className="row small">
          <span className="grow">Most people in one call</span>
          <input type="number" className="input sm" style={{ width: 80 }} min={2} max={25} value={max} onChange={(e) => setMax(Number(e.target.value))} />
        </label>
        <SaveBar pending={pending} onSave={() => save({ voice: { ice, max } })} />
      </div>
      <div className="stack tight">
        <b>Time zone</b>
        <span className="small muted">For reminders, birthdays and the calendar files. (Everyone sees times in their own device&apos;s time zone.)</span>
        <select className="select" value={tz} onChange={(e) => setTz(e.target.value)}>
          {timezones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <SaveBar pending={pending} onSave={() => save({ timezone: tz })} />
      </div>
      {node}
    </div>
  );
}

export interface SystemInfo {
  version: string;
  node: string;
  uptime: number;
  rss: number;
  heap: number;
  dataDir: string;
  uploadDir: string;
  publicUrl: string;
  tz: string;
}

export function SystemSection({ sys, storage, audit }: { sys: SystemInfo; storage: { db: number; uploads: number; byKind: { kind: string; n: number; bytes: number }[] }; audit: { id: number; who: string; action: string; target: string; detail: string; at: number }[] }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const job = async (name: string, fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, done: (d: unknown) => string) => {
    setBusy(name);
    const r = await fn();
    setBusy("");
    if (r.ok) toast(done(r.data));
    else toast(r.error ?? "That didn't work.", { kind: "err" });
    router.refresh();
  };
  const h = Math.floor(sys.uptime / 3600);
  return (
    <div className="stack loose">
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack tight">
          <b>Storage</b>
          <div className="list inset small">
            <div className="list-row">
              <span className="grow">Database</span>
              <b>{bytes(storage.db)}</b>
            </div>
            {storage.byKind.map((k) => (
              <div key={k.kind} className="list-row">
                <span className="grow">
                  Pictures: {k.kind} ({k.n})
                </span>
                <b>{bytes(k.bytes)}</b>
              </div>
            ))}
            <div className="list-row">
              <span className="grow">
                <b>Everything</b>
              </span>
              <b>{bytes(storage.db + storage.uploads)}</b>
            </div>
          </div>
        </div>
        <div className="stack tight">
          <b>Upkeep</b>
          <button type="button" className={`btn btn-sm ${busy === "clean" ? "loading" : ""}`} onClick={() => job("clean", cleanupAction, (d) => {
            const x = d as { removed: number; bytes: number };
            return `Removed ${x.removed} unused pictures (${bytes(x.bytes)}).`;
          })}>
            <Sparkles size={14} /> Remove pictures nothing uses
          </button>
          <button type="button" className={`btn btn-sm ${busy === "vac" ? "loading" : ""}`} onClick={() => job("vac", vacuumAction, () => "The database is tidied up.")}>
            <Wrench size={14} /> Tidy up the database
          </button>
          <button type="button" className={`btn btn-sm ${busy === "re" ? "loading" : ""}`} onClick={() => job("re", reindexAction, (d) => `Search rebuilt: ${d} things indexed.`)}>
            <RefreshCw size={14} /> Rebuild the search
          </button>
          <a className="btn btn-primary btn-sm" href="/api/admin/backup" download>
            <Download size={14} /> Download a backup of the database
          </a>
          <span className="tiny muted">The pictures are in {sys.uploadDir}: back up the whole data folder (on Unraid: the appdata share) to keep everything.</span>
        </div>
      </div>
      <div className="stack tight">
        <b>What admins did</b>
        <div className="list inset audit">
          {audit.map((a) => (
            <div key={a.id} className="list-row tiny">
              <span className="grow">
                <b>{a.who}</b> {a.action} {a.target ? <span className="dim">{a.target}</span> : null} {a.detail ? <span className="muted">· {a.detail}</span> : null}
              </span>
              <Time t={a.at} />
            </div>
          ))}
          {!audit.length ? <div className="panel-body small muted" style={{ paddingTop: 12 }}>Nothing yet.</div> : null}
        </div>
      </div>
      <div className="small muted mono admin-sys">
        Hooden {sys.version} · Node {sys.node} · up {h}h {Math.floor((sys.uptime % 3600) / 60)}m · memory {bytes(sys.rss)} · data {sys.dataDir} · time zone {sys.tz}
        {sys.publicUrl ? ` · ${sys.publicUrl}` : " · PUBLIC_URL not set"}
      </div>
    </div>
  );
}
