"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleAlert, Sparkles } from "lucide-react";
import type { Boot, Me, SiteInfo } from "@/lib/bootTypes";
import type { LiveState, NotificationItem } from "@/lib/types";
import { makeT, setClientLang, type T } from "@/lib/i18n";
import { setClock } from "@/lib/clock";

/**
 * Everything the pages share in the browser: who you are, the site's switches, unread counts,
 * the live stream (/api/live) with who's online, toasts, and the search overlay.
 */

type Handler = (data: unknown) => void;

interface Toast {
  id: number;
  text: string;
  kind: "info" | "err";
  href?: string;
}

interface Ctx {
  me: Me | null;
  site: SiteInfo;
  counts: Boot["counts"];
  setCounts: React.Dispatch<React.SetStateAction<Boot["counts"]>>;
  conn: number | null;
  presence: Map<number, LiveState>;
  on: (type: string, fn: Handler) => () => void;
  toast: (text: string, opts?: { kind?: "info" | "err"; href?: string }) => void;
  search: { open: boolean; query: string };
  openSearch: (query?: string) => void;
  closeSearch: () => void;
  /** tell the server which chat room this tab is showing (no unread count or ping for it) */
  setRoom: (room: number | null) => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
export const useMe = () => useApp().me;
export const useSite = () => useApp().site;
export const useToast = () => useApp().toast;
/** The site's language: t("Save"), t.n(n, "{n} reply", "{n} replies"), t.locale for dates. */
export const useT = (): T => {
  const { site } = useApp();
  return makeT(site.lang, site.texts);
};

/** Run `fn` for each live event of a type while the component is mounted. */
export function useLive(type: string, fn: Handler) {
  const { on } = useApp();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => on(type, (d) => ref.current(d)), [on, type]);
}

export function usePresence(userId: number): LiveState {
  return useApp().presence.get(userId) ?? "offline";
}

export function AppProvider({ boot, children }: { boot: Boot; children: React.ReactNode }) {
  // for the helpers outside components (clientT): the same for everyone, so safe to set here
  setClientLang(boot.site.lang, boot.site.texts);
  setClock(boot.site.clock);
  const [counts, setCounts] = useState(boot.counts);
  const [presence, setPresence] = useState<Map<number, LiveState>>(new Map());
  const [conn, setConn] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState({ open: false, query: "" });
  const handlers = useRef(new Map<string, Set<Handler>>());
  const router = useRouter();
  const pathname = usePathname();
  const meId = boot.me?.id ?? null;
  const roomRef = useRef<number | null>(null);
  const connRef = useRef<number | null>(null);

  // the server's fresh counts after a navigation
  useEffect(() => setCounts(boot.counts), [boot.counts]);

  const emit = useCallback((type: string, data: unknown) => {
    handlers.current.get(type)?.forEach((h) => {
      try {
        h(data);
      } catch (e) {
        console.error(e);
      }
    });
  }, []);

  const on = useCallback((type: string, fn: Handler) => {
    if (!handlers.current.has(type)) handlers.current.set(type, new Set());
    handlers.current.get(type)!.add(fn);
    return () => void handlers.current.get(type)?.delete(fn);
  }, []);

  const toast = useCallback((text: string, opts: { kind?: "info" | "err"; href?: string } = {}) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind: opts.kind ?? "info", href: opts.href }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.kind === "err" ? 6000 : 4200);
  }, []);

  const report = useCallback((visible: boolean, idle: boolean) => {
    if (!connRef.current) return;
    const body = JSON.stringify({ conn: connRef.current, visible, idle, room: roomRef.current });
    if (!visible && navigator.sendBeacon) navigator.sendBeacon("/api/live", new Blob([body], { type: "application/json" }));
    else void fetch("/api/live", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  }, []);

  const setRoom = useCallback(
    (room: number | null) => {
      roomRef.current = room;
      report(document.visibilityState === "visible", false);
    },
    [report],
  );

  // the live stream
  useEffect(() => {
    if (!meId) return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const connect = () => {
      es = new EventSource("/api/live");
      es.onmessage = (ev) => {
        let msg: { t: string; d: unknown };
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        const { t, d } = msg;
        if (t === "hello") {
          const h = d as { conn: number; presence: { id: number; state: LiveState }[]; counts?: Boot["counts"] };
          connRef.current = h.conn;
          setConn(h.conn);
          setPresence(new Map(h.presence.map((p) => [p.id, p.state])));
          if (h.counts) setCounts(h.counts);
          if (roomRef.current) report(document.visibilityState === "visible", false);
        } else if (t === "presence") {
          const p = d as { id: number; state: LiveState };
          setPresence((m) => {
            const n = new Map(m);
            if (p.state === "offline") n.delete(p.id);
            else n.set(p.id, p.state);
            return n;
          });
        } else if (t === "notify") {
          const n = d as { item: NotificationItem; unread: number };
          setCounts((c) => ({ ...c, notifications: n.unread }));
          if (document.visibilityState === "visible") toast(n.item.title, { href: n.item.url });
        } else if (t === "notifyCount") {
          setCounts((c) => ({ ...c, notifications: (d as { unread: number }).unread }));
        } else if (t === "unread") {
          const u = d as { room: number; n: number };
          setCounts((c) => {
            const rooms = { ...c.rooms };
            if (u.n) rooms[u.room] = u.n;
            else delete rooms[u.room];
            return { ...c, rooms, chat: Object.keys(rooms).length };
          });
        } else if (t === "refresh") {
          router.refresh();
        }
        emit(t, d);
      };
      es.onerror = () => {
        es?.close();
        connRef.current = null;
        setConn(null);
        if (!closed) retry = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      es?.close();
    };
  }, [meId, emit, router, toast, report]);

  // out of sight: tell the server at once (pushes go to the phone instead), idle after 3 minutes
  useEffect(() => {
    if (!meId) return;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const onVis = () => {
      clearTimeout(idleTimer);
      if (document.visibilityState === "visible") report(true, false);
      else {
        report(false, false);
        idleTimer = setTimeout(() => report(false, true), 3 * 60_000);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearTimeout(idleTimer);
    };
  }, [meId, report]);

  // the service worker (push notifications); a tapped notification can ask an open tab to go somewhere
  useEffect(() => {
    if (!meId || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string } | null;
      if (d?.type === "open" && d.url) router.push(new URL(d.url).pathname + new URL(d.url).search);
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [meId, router]);

  // the app icon's badge (installed on a phone or computer)
  useEffect(() => {
    const n = counts.notifications + counts.chat;
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (n && nav.setAppBadge) nav.setAppBadge(n).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [counts.notifications, counts.chat]);

  // "/" or Ctrl+K: search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (typing && el?.isContentEditable) return; // the editor's own Ctrl+K is a link
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        setSearch({ open: true, query: "" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => setSearch((s) => (s.open ? { ...s, open: false } : s)), [pathname]);

  const value = useMemo<Ctx>(
    () => ({
      me: boot.me,
      site: boot.site,
      counts,
      setCounts,
      conn,
      presence,
      on,
      toast,
      search,
      openSearch: (query = "") => setSearch({ open: true, query }),
      closeSearch: () => setSearch({ open: false, query: "" }),
      setRoom,
    }),
    [boot.me, boot.site, counts, conn, presence, on, toast, search, setRoom],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`panel toast ${t.kind === "err" ? "err" : ""}`}
            onClick={() => {
              setToasts((x) => x.filter((y) => y.id !== t.id));
              if (t.href) router.push(t.href);
            }}
          >
            <span className="toast-icon">{t.kind === "err" ? <CircleAlert size={18} /> : <Sparkles size={18} />}</span>
            <span className="grow">{t.text}</span>
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}
