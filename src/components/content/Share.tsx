"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Forward, Link2, Search, Share2, X } from "lucide-react";
import type { SearchKind } from "@/lib/search";
import type { RoomInfo } from "@/lib/chatTypes";
import type { UserSummary } from "@/lib/types";
import { useCompact, useMe, useSite, useT, useToast } from "@/components/app/AppProvider";
import { Modal } from "@/components/ui/ui";
import { Avatar } from "@/components/ui/Avatar";
import { loadMembers } from "@/components/editor/mention";
import { KIND_ICON } from "@/components/search/SearchResults";
import { RoomIcon } from "@/components/chat/ChatSidebar";
import { roomsAction, shareAction } from "@/app/actions/chat";

export interface Shared {
  /** where it is on the site (/posts/12) */
  url: string;
  /** what it's called, for the top of the dialog */
  title: string;
  kind: SearchKind;
}

/** "Share" under a post, a poll, a list…: in compact just the icon (`words`: always the word too). */
export function ShareButton({ className = "btn btn-ghost btn-sm", words = false, ...it }: Shared & { className?: string; words?: boolean }) {
  const t = useT();
  const compact = useCompact() && !words;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog" {...(compact ? { "aria-label": t("Share"), title: t("Share") } : {})}>
        <Forward size={16} /> {compact ? null : t("Share")}
      </button>
      {open ? <ShareDialog {...it} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Someone to send it to: a room (or a group's), or a person (in your DM with them, started if need be). */
type To = { key: string; name: string; sub: string; room?: RoomInfo; user?: UserSummary };

/**
 * Share something on the site: send it to rooms and people in the chat (with a few words, if you
 * like), copy its link, or hand it to the phone's own sharing.
 */
export function ShareDialog({ url, title, kind, onClose }: Shared & { onClose: () => void }) {
  const t = useT();
  const me = useMe();
  const toast = useToast();
  const chat = useSite().features.chat;
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [people, setPeople] = useState<UserSummary[] | null>(null);
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(typeof navigator.share === "function");
    if (!chat) return;
    void roomsAction().then((r) => setRooms(r.ok ? r.data.mine : []));
    void loadMembers().then((l) => setPeople(l.filter((u) => u.id !== me?.id)));
  }, [chat, me?.id]);
  const full = () => new URL(url, window.location.href).href;

  // your rooms in the chat list's order; then people, the ones you've talked with lately first
  const all = useMemo<To[]>(() => {
    if (!rooms || !people) return [];
    const dms = new Map(rooms.filter((r) => r.kind === "dm" && r.other).map((r) => [r.other!.id, r]));
    const ppl = [...people].sort((a, b) => (dms.get(b.id)?.lastMessageAt ?? 0) - (dms.get(a.id)?.lastMessageAt ?? 0) || a.name.localeCompare(b.name, t.locale));
    return [
      ...rooms.filter((r) => r.kind !== "dm").map((r) => ({ key: `r${r.id}`, name: r.name, sub: r.topic || t.n(r.memberCount, "{n} member", "{n} members"), room: r })),
      ...ppl.map((u) => ({ key: `u${u.id}`, name: u.name, sub: `@${u.username}`, user: u })),
    ];
  }, [rooms, people, t]);
  const needle = q.trim().toLowerCase();
  const list = all.filter((x) => !needle || x.name.toLowerCase().includes(needle) || x.sub.toLowerCase().includes(needle));
  const chosen = all.filter((x) => picked.includes(x.key));
  const toggle = (key: string) => setPicked((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  const Icon = KIND_ICON[kind];

  const send = () =>
    start(async () => {
      const ids = (c: string) => picked.filter((k) => k[0] === c).map((k) => Number(k.slice(1)));
      const r = await shareAction({ url, note, rooms: ids("r"), people: ids("u") });
      if (!r.ok) return toast(r.error, { kind: "err" });
      toast(chosen.length === 1 ? t("Sent to {name}.", { name: chosen[0].name }) : t("Sent to {n} chats.", { n: r.data }));
      onClose();
    });

  return (
    <Modal
      title={t("Share")}
      onClose={onClose}
      footer={
        chat ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t("Cancel")}
            </button>
            <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} disabled={!picked.length || pending} onClick={send}>
              {t("Send")}
              {picked.length ? ` (${picked.length})` : ""}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="stack">
        <div className="share-what">
          <span className="hit-icon">
            <Icon size={16} />
          </span>
          <b className="grow ellipsis">{title}</b>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() =>
              void navigator.clipboard?.writeText(full()).then(
                () => toast(t("Link copied.")),
                () => toast(full()),
              )
            }
          >
            <Link2 size={15} /> {t("Copy link")}
          </button>
          {native ? (
            <button type="button" className="btn btn-sm" onClick={() => void navigator.share({ title, url: full() }).catch(() => {})}>
              <Share2 size={15} /> {t("Share via…")}
            </button>
          ) : null}
        </div>
        {chat ? (
          <>
            <span className="eyebrow" style={{ marginTop: 4 }}>
              {t("Send in the chat")}
            </span>
            {chosen.length ? (
              <div className="chip-row" style={{ flexWrap: "wrap" }}>
                {chosen.map((x) => (
                  <button key={x.key} type="button" className="pill soft" onClick={() => toggle(x.key)} aria-label={t("Take away {name}", { name: x.name })}>
                    {x.user ? <Avatar user={x.user} size={18} /> : <RoomIcon r={x.room!} size={18} />} {x.name} <X size={12} />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="search-bar inset" style={{ borderRadius: 12, padding: "8px 12px" }}>
              <Search size={17} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find a room or a person")} aria-label={t("Find a room or a person")} style={{ fontSize: "1rem" }} />
            </div>
            <div className="list inset picker-list share-list">
              {!rooms || !people ? <div className="panel-body small muted" style={{ paddingTop: 12 }}>{t("Loading…")}</div> : null}
              {rooms && people && !list.length ? <div className="panel-body small muted" style={{ paddingTop: 12 }}>{t("No room or person by that name.")}</div> : null}
              {list.map((x) => {
                const on = picked.includes(x.key);
                return (
                  <button key={x.key} type="button" className={`list-row ${on ? "unread" : ""}`} onClick={() => toggle(x.key)} aria-pressed={on}>
                    {x.user ? <Avatar user={x.user} size={32} presence /> : <RoomIcon r={x.room!} size={32} />}
                    <span className="grow" style={{ minWidth: 0 }}>
                      <b className="ellipsis" style={{ display: "block" }}>
                        {x.name}
                      </b>
                      <span className="tiny muted ellipsis" style={{ display: "block" }}>
                        {x.sub}
                      </span>
                    </span>
                    <span className={`pick-box ${on ? "on" : ""}`}>{on ? <Check size={14} strokeWidth={3} /> : null}</span>
                  </button>
                );
              })}
            </div>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Say something about it (if you like)")} aria-label={t("Say something about it (if you like)")} maxLength={2000} />
          </>
        ) : null}
      </div>
    </Modal>
  );
}
