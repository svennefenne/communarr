"use client";

import { useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { looking, useApp } from "./AppProvider";
import { onAppMessage } from "./androidApp";
import { seenAction, unreadUrlsAction } from "@/app/actions/notifications";

/**
 * Notifications go read by themselves once you've seen what they're about, as on Facebook or Discord:
 * the page they point at opened, or the post, comment, forum reply or chat message on screen for a moment
 * while the window is in front. Things mark themselves with useSeen(their address); the page knows its
 * unread notifications' addresses and tells the server only about those.
 */

/** on screen this long (ms) counts as seen */
const DWELL = 1000;

/** the unread notifications' addresses: as compared (decoded) → as stored */
let unread = new Map<string, string>();
/** watched things: their address */
const urls = new WeakMap<Element, string>();
/** watched things far enough in sight: since when */
const inSight = new Map<Element, number>();
let io: IntersectionObserver | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

const key = (url: string) => {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
};

function check() {
  clearTimeout(timer);
  if (!unread.size || !looking()) return;
  const t = Date.now();
  const hits = new Set<string>();
  const here = unread.get(key(location.pathname));
  if (here) hits.add(here);
  let next = Infinity;
  for (const [el, since] of inSight) {
    const url = unread.get(key(urls.get(el) ?? ""));
    if (!url) continue;
    if (t - since >= DWELL) hits.add(url);
    else next = Math.min(next, DWELL - (t - since));
  }
  if (next < Infinity) timer = setTimeout(check, next + 20);
  if (!hits.size) return;
  for (const u of hits) unread.delete(key(u));
  void seenAction([...hits]).catch(() => {});
}

function observer() {
  io ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const vh = e.rootBounds?.height || window.innerHeight;
        // most of it in sight, or (a long one) most of the screen
        const enough = e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= vh * 0.4);
        if (!enough) inSight.delete(e.target);
        else if (!inSight.has(e.target)) inSight.set(e.target, Date.now());
      }
      check();
    },
    { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
  );
  return io;
}

/** A ref for something a notification can point at (url: the notification's address for it). */
export function useSeen<T extends Element>(url: string | null | undefined) {
  return useCallback(
    (el: T | null) => {
      if (!el || !url) return;
      urls.set(el, url);
      observer().observe(el);
      return () => {
        io?.unobserve(el);
        inSight.delete(el);
      };
    },
    [url],
  );
}

/** Keeps the unread addresses fresh and marks what's seen (once on the page, for a signed-in member). */
export function SeenNotifications() {
  const { counts } = useApp();
  const pathname = usePathname();
  const n = counts.notifications;

  // (any change in the count: a new one, or some marked read elsewhere)
  useEffect(() => {
    if (!n) {
      unread = new Map();
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      unreadUrlsAction()
        .then((list) => {
          if (!live) return;
          unread = new Map(list.map((u) => [key(u), u]));
          check();
        })
        .catch(() => {});
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [n]);

  useEffect(() => check(), [pathname]);

  // back at the window (the desktop app's in front: it says so)
  useEffect(() => {
    const again = () => setTimeout(check, 50);
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    const stop = onAppMessage((m) => m.t === "window" && again());
    return () => {
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("focus", again);
      stop();
    };
  }, []);

  return null;
}
