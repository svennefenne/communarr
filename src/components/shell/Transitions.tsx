"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Page wipes (from Deck Force): a link inside the site reveals the next page over the old one with
 * a hard-edged wipe, like the scene changes in A New Hope (View Transitions API). Off in the user
 * menu, with Animations off, or with the system's reduced motion. data-no-wipe on a link skips it.
 */

interface Ctx {
  wipe: boolean;
  setWipe: (on: boolean) => void;
  jump: (href: string) => void;
}
const TransitionsCtx = createContext<Ctx>({ wipe: true, setWipe: () => {}, jump: () => {} });
export const useTransitions = () => useContext(TransitionsCtx);

const WIPES = ["right", "left", "down", "up", "diag", "clock", "iris"] as const;

const norm = (u: string) => u.replace(/\/$/, "") || "/";
const here = () => norm(window.location.pathname + window.location.search);

type VTDoc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> } };

function motionOk() {
  return document.documentElement.dataset.motion !== "off" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TransitionsProvider({ initial, children }: { initial: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [wipe, setWipeState] = useState(initial);
  const wipeRef = useRef(initial);
  const busy = useRef(false);
  const last = useRef("");

  useEffect(() => {
    wipeRef.current = initial;
    setWipeState(initial);
  }, [initial]);

  const setWipe = useCallback((on: boolean) => {
    wipeRef.current = on;
    setWipeState(on);
  }, []);

  const arrive = (from: string, target: string) =>
    new Promise<void>((resolve) => {
      const t0 = performance.now();
      let changed = false;
      const mo = new MutationObserver(() => (changed = true));
      mo.observe(document.getElementById("main") || document.body, { childList: true, subtree: true });
      const tick = () => {
        const now = here();
        const el = performance.now() - t0;
        if (((now !== from || now === norm(target)) && (changed || el > 600)) || el > 3500) {
          mo.disconnect();
          resolve();
        } else setTimeout(tick, 25);
      };
      tick();
    });

  const jump = useCallback(
    (href: string) => {
      const url = new URL(href, window.location.href);
      const target = url.pathname + url.search + url.hash;
      const doc = document as VTDoc;
      if (!wipeRef.current || busy.current || !doc.startViewTransition || !motionOk()) {
        router.push(target);
        return;
      }
      let kind: string = WIPES[Math.floor(Math.random() * WIPES.length)];
      if (kind === last.current) kind = WIPES[(WIPES.indexOf(kind as (typeof WIPES)[number]) + 1) % WIPES.length];
      last.current = kind;
      const root = document.documentElement;
      root.dataset.wipe = kind;
      busy.current = true;
      const from = here();
      const end = () => {
        delete root.dataset.wipe;
        busy.current = false;
      };
      try {
        const vt = doc.startViewTransition(async () => {
          router.push(target);
          await arrive(from, url.pathname + url.search);
          await new Promise((r) => setTimeout(r, 30));
        });
        vt.finished.finally(end);
      } catch {
        end();
        router.push(target);
      }
    },
    [router],
  );

  // internal links: capture phase, before next/link's own handler
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download") || a.dataset.noWipe !== undefined || a.closest("[contenteditable=true]")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) return;
      if (norm(url.pathname + url.search) === here()) return;
      if (!wipeRef.current || !motionOk()) return; // next/link does it as usual
      e.preventDefault();
      jump(url.href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [jump]);

  return <TransitionsCtx.Provider value={{ wipe, setWipe, jump }}>{children}</TransitionsCtx.Provider>;
}
