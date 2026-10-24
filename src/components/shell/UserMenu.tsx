"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bookmark, Languages, LogOut, MessageSquareText, Moon, Palette, Settings, ShieldCheck, Smile, Sun, SunMoon, UserRound } from "lucide-react";
import { useApp, useT } from "@/components/app/AppProvider";
import { LanguageToggle } from "@/components/app/LanguageToggle";
import { Avatar } from "@/components/ui/Avatar";
import { Switch, useDropdown } from "@/components/ui/ui";
import { useTransitions } from "./Transitions";
import { StatusDialog } from "./StatusDialog";
import { FeedbackDialog } from "./FeedbackDialog";
import { logoutAction, setPrefsAction } from "@/app/actions/me";
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
  const { me } = useApp();
  const t = useT();
  const { open, setOpen, toggle, ref } = useDropdown();
  const [status, setStatus] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const { wipe, setWipe } = useTransitions();
  const [motion, setMotion] = useState(me?.theme.motion ?? true);
  const router = useRouter();
  if (!me) return null;
  const toggleMotion = async (on: boolean) => {
    setMotion(on);
    if (on) delete document.documentElement.dataset.motion;
    else document.documentElement.dataset.motion = "off";
    await setPrefsAction({ motion: on });
  };
  const toggleWipes = async (on: boolean) => {
    setWipe(on);
    await setPrefsAction({ wipes: on });
  };
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="user-btn" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label={t("Your menu")}>
        <Avatar user={me} size={30} presence />
        <span className="user-btn-name">{me.name}</span>
      </button>
      {open ? (
        <div className="panel menu down right user-menu" role="menu" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
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
            <Switch on={motion} onChange={toggleMotion} label={t("Animations")} />
          </div>
          <div className="menu-item" style={{ cursor: "default" }}>
            <span className="grow">{t("Page wipes")}</span>
            <Switch on={wipe && motion} onChange={toggleWipes} label={t("Page wipes")} disabled={!motion} />
          </div>
          <div className="menu-sep" />
          <form action={logoutAction}>
            <button type="submit" className="menu-item" role="menuitem" onClick={() => router.prefetch("/login")}>
              <LogOut size={17} /> {t("Log out")}
            </button>
          </form>
        </div>
      ) : null}
      {status ? <StatusDialog me={me} onClose={() => setStatus(false)} /> : null}
      {feedback ? <FeedbackDialog onClose={() => setFeedback(false)} /> : null}
    </div>
  );
}
