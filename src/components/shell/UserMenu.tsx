"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { Bookmark, Download, Languages, LogOut, MessageSquareText, Moon, Palette, RefreshCw, Settings, ShieldCheck, Smile, Sun, SunMoon, UserRound } from "lucide-react";
import { useApp, useT, useToast } from "@/components/app/AppProvider";
import { LanguageToggle } from "@/components/app/LanguageToggle";
import { Avatar } from "@/components/ui/Avatar";
import { Switch, useDropdown } from "@/components/ui/ui";
import { useTransitions } from "./Transitions";
import { StatusDialog } from "./StatusDialog";
import { FeedbackDialog } from "./FeedbackDialog";
import { logoutAction, setPrefsAction } from "@/app/actions/me";
import { setSoundsOn } from "@/components/app/sfx";
import { appInfo, appUpdate, tellApp, type AppInfo } from "@/components/app/androidApp";
import type { ThemePrefs } from "@/lib/types";

/** Dark, light or the device's choice. */
export function ModeSwitch({ mode }: { mode: ThemePrefs["mode"] }) {
  const router = useRouter();
  const t = useT();
  const [, start] = useTransition();
  const [cur, setCur] = useState(mode);
  const set = (m: ThemePrefs["mode"]) => {
    setCur(m);
    document.documentElement.classList.add("theme-fade");
    start(async () => {
      await setPrefsAction({ mode: m });
      router.refresh();
      setTimeout(() => document.documentElement.classList.remove("theme-fade"), 600);
    });
  };
  return (
    <div className="pills" role="radiogroup" aria-label={t("Light or dark")}>
      {(
        [
          ["dark", Moon, "Dark"],
          ["light", Sun, "Light"],
          ["system", SunMoon, "Auto"],
        ] as const
      ).map(([m, Icon, label]) => (
        <button key={m} type="button" role="radio" aria-checked={cur === m} className={`pill ${cur === m ? "active" : ""}`} onClick={() => set(m)} title={t(label)}>
          <Icon size={14} /> {t(label)}
        </button>
      ))}
    </div>
  );
}

export function UserMenu() {
  const { me, site } = useApp();
  const t = useT();
  const { open, setOpen, toggle, ref } = useDropdown();
  const [status, setStatus] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const { wipe, setWipe } = useTransitions();
  const [motion, setMotion] = useState(me?.theme.motion ?? true);
  const [sounds, setSounds] = useState(me?.theme.sounds ?? true);
  const router = useRouter();
  // in an app (Android's, the desktop's): a newer version of it on the server (a dot on the button, and
  // a row in the menu), or Check for updates; its version in small print at the end
  const [app, setApp] = useState<AppInfo | null>(null);
  const [update, setUpdate] = useState<{ version: string; url: string; sha256?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const toast = useToast();
  useEffect(() => {
    setApp(appInfo());
    setUpdate(appUpdate(site.apps));
  }, [site.apps]);
  const checkForUpdates = async () => {
    if (!app) return;
    setChecking(true);
    try {
      const r = await fetch(`/api/app/latest?name=${encodeURIComponent(app.name)}`);
      const d = (await r.json().catch(() => ({}))) as { apps?: Parameters<typeof appUpdate>[0]; error?: string };
      if (!r.ok || !d.apps) return toast(d.error || t("Couldn't check for updates."), { kind: "err" });
      const u = appUpdate(d.apps, app);
      // a newer one: its row in the menu, there and then
      if (u) setUpdate(u);
      else toast(t("You have the newest version of the app ({version}).", { version: app.version }));
    } catch {
      toast(t("Couldn't check for updates."), { kind: "err" });
    } finally {
      setChecking(false);
    }
  };
  // a phone's screen can be shorter than the menu: it ends above the bottom bar and scrolls itself
  // (--menu-top: where it starts), and the page behind it stays still while it's open
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!open || !el) return;
    el.style.setProperty("--menu-top", `${Math.round(el.getBoundingClientRect().top)}px`);
    if (!window.matchMedia("(max-width: 699px), (pointer: coarse)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!me) return null;
  // one switch for all of it: things that move, and the wipes between pages
  const toggleMotion = async (on: boolean) => {
    setMotion(on);
    setWipe(on);
    if (on) delete document.documentElement.dataset.motion;
    else document.documentElement.dataset.motion = "off";
    await setPrefsAction({ motion: on, wipes: on });
  };
  // the site's sounds (Admin → Sounds), not voice chat
  const toggleSounds = async (on: boolean) => {
    setSounds(on);
    setSoundsOn(on);
    await setPrefsAction({ sounds: on });
  };
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="user-btn" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label={t("Your menu")}>
        <Avatar user={me} size={30} presence />
        <span className="user-btn-name">{me.name}</span>
        {update ? <span className="dot user-btn-dot" aria-hidden /> : null}
      </button>
      {open ? (
        <div ref={menuRef} className="panel menu down right user-menu" role="menu" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          <button
            type="button"
            className="user-menu-head"
            onClick={() => {
              setOpen(false);
              setStatus(true);
            }}
          >
            <Avatar user={me} size={40} presence />
            <span className="grow" style={{ minWidth: 0, textAlign: "left" }}>
              <b className="ellipsis" style={{ display: "block" }}>
                {me.name}
              </b>
              <span className="small muted ellipsis" style={{ display: "block" }}>
                {me.statusEmoji || me.statusText ? `${me.statusEmoji} ${me.statusText}` : t("Set a status…")}
              </span>
            </span>
            <Smile size={18} className="muted" />
          </button>
          <div className="menu-sep" />
          <Link href={`/u/${encodeURIComponent(me.username)}`} className="menu-item" role="menuitem">
            <UserRound size={17} /> {t("Profile")}
          </Link>
          <Link href="/me" className="menu-item" role="menuitem">
            <UserRound size={17} /> {t("My stuff")}
          </Link>
          <Link href="/saved" className="menu-item" role="menuitem">
            <Bookmark size={17} /> {t("Saved")}
          </Link>
          <Link href="/settings/theme" className="menu-item" role="menuitem">
            <Palette size={17} /> {t("Theme & colours")}
          </Link>
          <Link href="/settings" className="menu-item" role="menuitem">
            <Settings size={17} /> {t("Settings")}
          </Link>
          {me.isMod ? (
            <Link href="/admin" className="menu-item" role="menuitem">
              <ShieldCheck size={17} /> {t("Admin")}
            </Link>
          ) : null}
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setFeedback(true);
            }}
          >
            <MessageSquareText size={17} /> {t("Send feedback")}
          </button>
          {update ? (
            <div className="menu-item app-update" style={{ cursor: "default" }}>
              <Download size={17} />
              <span className="grow">{t("New version {version}", { version: update.version })}</span>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={async () => {
                  setOpen(false);
                  // the desktop app checks its file against the server's SHA-256, worked out on the way
                  let u = update;
                  if (app?.kind === "desktop" && !u.sha256) {
                    const r = await fetch(`/api/app/latest?name=${encodeURIComponent(app.name)}`).catch(() => null);
                    const d = r?.ok ? ((await r.json()) as { apps: Parameters<typeof appUpdate>[0] }) : null;
                    const fresh = d ? appUpdate(d.apps, app) : null;
                    if (!fresh?.sha256) return toast(t("Couldn't check for updates."), { kind: "err" });
                    u = fresh;
                  }
                  // the app downloads it and puts it in (an older Android app without that: the browser)
                  if (!tellApp({ t: "update", url: u.url, version: u.version, sha256: u.sha256 })) window.location.href = u.url;
                }}
              >
                {t("Update")}
              </button>
            </div>
          ) : app ? (
            <button type="button" className="menu-item" role="menuitem" onClick={() => void checkForUpdates()} disabled={checking}>
              <RefreshCw size={17} className={checking ? "spin" : ""} /> {t("Check for updates")}
            </button>
          ) : null}
          <div className="menu-sep" />
          <div style={{ padding: "6px 8px" }}>
            <ModeSwitch mode={me.theme.mode} />
          </div>
          <div className="menu-item" style={{ cursor: "default" }}>
            <Languages size={17} />
            <span className="grow">{t("Language")}</span>
            <LanguageToggle short />
          </div>
          <div className="menu-item" style={{ cursor: "default" }}>
            <span className="grow">{t("Animations")}</span>
            <Switch on={motion && wipe} onChange={toggleMotion} label={t("Animations")} />
          </div>
          <div className="menu-item" style={{ cursor: "default" }}>
            <span className="grow">{t("Sounds")}</span>
            <Switch on={sounds} onChange={toggleSounds} label={t("Sounds")} />
          </div>
          <div className="menu-sep" />
          <form action={logoutAction}>
            <button type="submit" className="menu-item" role="menuitem" onClick={() => router.prefetch("/login")}>
              <LogOut size={17} /> {t("Log out")}
            </button>
          </form>
          {app ? (
            <>
              <div className="menu-sep" />
              <div className="menu-foot">
                {app.name} v{app.version}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {status ? <StatusDialog me={me} onClose={() => setStatus(false)} /> : null}
      {feedback ? <FeedbackDialog onClose={() => setFeedback(false)} /> : null}
    </div>
  );
}
