"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Globe, Lock, Search, Smile } from "lucide-react";
import type { UserSummary } from "@/lib/types";
import { useApp, useToast } from "@/components/app/AppProvider";
import { Modal } from "@/components/ui/ui";
import { Avatar } from "@/components/ui/Avatar";
import { EmojiPopover } from "@/components/ui/EmojiPicker";
import { loadMembers } from "@/components/editor/mention";
import { createRoomAction, dmAction } from "@/app/actions/chat";

/** Start a chat: a direct message with someone, or a new room (open to all, or private by invitation). */
export function NewChat({ onClose, initial = "dm" }: { onClose: () => void; initial?: "dm" | "room" }) {
  const { me, site } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"dm" | "room">(site.can.rooms ? initial : "dm");
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [emoji, setEmoji] = useState("");
  const [visibility, setVisibility] = useState<"open" | "private">("open");
  const [invite, setInvite] = useState<number[]>([]);
  const [picker, setPicker] = useState(false);
  const emojiBtn = useRef<HTMLButtonElement>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    loadMembers().then((l) => setPeople(l.filter((u) => u.id !== me?.id)));
  }, [me?.id]);
  const list = people.filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.username.toLowerCase().includes(q.toLowerCase()));
  const dm = (id: number) =>
    start(async () => {
      const r = await dmAction(id);
      if (r.ok) {
        onClose();
        router.push(`/chat/${r.data}`);
      } else toast(r.error, { kind: "err" });
    });
  const create = () =>
    start(async () => {
      const r = await createRoomAction({ name, topic, emoji, visibility, invite });
      if (r.ok) {
        onClose();
        router.push(`/chat/${r.data}`);
        router.refresh();
      } else toast(r.error, { kind: "err" });
    });
  return (
    <Modal title="New chat" onClose={onClose}>
      {site.can.rooms ? (
        <div className="pills" style={{ marginBottom: 14 }}>
          <button type="button" className={`pill ${tab === "dm" ? "active" : ""}`} onClick={() => setTab("dm")}>
            Message someone
          </button>
          <button type="button" className={`pill ${tab === "room" ? "active" : ""}`} onClick={() => setTab("room")}>
            New room
          </button>
        </div>
      ) : null}
      {tab === "dm" ? (
        <div className="stack">
          <div className="search-bar inset" style={{ borderRadius: 12, padding: "8px 12px" }}>
            <Search size={17} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Who do you want to talk to?" autoFocus style={{ fontSize: "1rem" }} />
          </div>
          <div className="list inset picker-list">
            {list.map((u) => (
              <button key={u.id} type="button" className="list-row" onClick={() => dm(u.id)} disabled={pending}>
                <Avatar user={u} size={34} presence />
                <span className="grow" style={{ minWidth: 0 }}>
                  <b className="ellipsis" style={{ display: "block" }}>
                    {u.name}
                  </b>
                  <span className="tiny muted ellipsis" style={{ display: "block" }}>
                    {u.statusText ? `${u.statusEmoji} ${u.statusText}` : `@${u.username}`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="input-group">
            <button ref={emojiBtn} type="button" className="icon-btn framed" style={{ width: 46, height: 46, fontSize: 22 }} onClick={() => setPicker((p) => !p)} aria-label="Room emoji">
              {emoji || <Smile size={20} />}
            </button>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Room name" maxLength={40} autoFocus />
          </div>
          {picker ? (
            <EmojiPopover
              anchor={emojiBtn.current}
              onPick={(e) => {
                setEmoji(e);
                setPicker(false);
              }}
              onClose={() => setPicker(false)}
            />
          ) : null}
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What's it for? (optional)" maxLength={200} />
          <div className="privacy-pick" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <button type="button" className={`privacy-opt ${visibility === "open" ? "on" : ""}`} onClick={() => setVisibility("open")}>
              <Globe size={20} />
              <b>Open</b>
              <span className="tiny muted">Everyone can see it and join.</span>
            </button>
            <button type="button" className={`privacy-opt ${visibility === "private" ? "on" : ""}`} onClick={() => setVisibility("private")}>
              <Lock size={20} />
              <b>Private</b>
              <span className="tiny muted">Only people you invite.</span>
            </button>
          </div>
          <span className="label">Invite people{invite.length ? ` · ${invite.length}` : ""}</span>
          <div className="list inset picker-list" style={{ maxHeight: 220 }}>
            {people.map((u) => (
              <label key={u.id} className={`list-row ${invite.includes(u.id) ? "unread" : ""}`} style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={invite.includes(u.id)} onChange={() => setInvite((x) => (x.includes(u.id) ? x.filter((y) => y !== u.id) : [...x, u.id]))} />
                <Avatar user={u} size={28} />
                <span className="grow ellipsis">{u.name}</span>
              </label>
            ))}
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={create} disabled={!name.trim()}>
              Make the room
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
