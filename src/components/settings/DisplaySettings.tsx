"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ThemePrefs } from "@/lib/types";
import { Switch } from "@/components/ui/ui";
import { useT } from "@/components/app/AppProvider";
import { ModeSwitch } from "@/components/shell/UserMenu";
import { LanguageSetting } from "@/components/app/LanguageToggle";
import type { Lang } from "@/lib/i18n";
import { useTransitions } from "@/components/shell/Transitions";
import { setSoundsOn } from "@/components/app/sfx";
import { setPrefsAction } from "@/app/actions/me";

export function DisplaySettings({ prefs, language }: { prefs: ThemePrefs; language: { own: Lang | null; site: Lang } }) {
  const t = useT();
  const router = useRouter();
  const { setWipe } = useTransitions();
  const [p, setP] = useState(prefs);
  const save = async (patch: Partial<ThemePrefs>) => {
    setP((x) => ({ ...x, ...patch }));
    await setPrefsAction(patch);
    router.refresh();
  };
  return (
    <>
      {/* (kept on this device, unless they mirror their devices: lib/look.ts) */}
      <section className="panel panel-pad">
        <h2 className="h2">{t("Look")}</h2>
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          {p.mirror ? t("The same on all your devices, the theme too.") : t("For this device: your phone and your computer can each look their own way, the theme too.")} <Link href="/settings/theme">{t("Theme")} →</Link>
        </p>
        <div className="setting-row">
          <div className="grow">
            <b>{t("Mirror my devices")}</b>
            <span className="small muted">{t("The same look on all of them: change it on one and the others follow.")}</span>
          </div>
          <Switch on={!!p.mirror} label={t("Mirror my devices")} onChange={(v) => void save({ mirror: v })} />
        </div>
        <div className="setting-row">
          <div className="grow">
            <b>{t("Light or dark")}</b>
            <span className="small muted">{t("Auto follows your device.")}</span>
          </div>
          <ModeSwitch mode={p.mode} />
        </div>
        <div className="setting-row">
          <div className="grow">
            <b>{t("Text size")}</b>
            <span className="small muted">{p.textSize}%</span>
          </div>
          <input
            type="range"
            min={85}
            max={130}
            step={5}
            value={p.textSize}
            style={{ maxWidth: 220 }}
            onChange={(e) => {
              const v = Number(e.target.value);
              setP((x) => ({ ...x, textSize: v }));
              document.documentElement.style.setProperty("--text-scale", String(v / 100));
            }}
            onPointerUp={() => save({ textSize: p.textSize })}
            onKeyUp={() => save({ textSize: p.textSize })}
            aria-label={t("Text size")}
          />
        </div>
        <div className="setting-row">
          <div className="grow">
            <b>{t("Compact")}</b>
            <span className="small muted">{t("Smaller text, tighter spacing, and cards that show less (shorter text, smaller pictures, no excerpts): more on the screen.")}</span>
          </div>
          <Switch
            on={p.density === "compact"}
            label={t("Compact")}
            onChange={(v) => {
              if (v) document.documentElement.dataset.density = "compact";
              else delete document.documentElement.dataset.density;
              void save({ density: v ? "compact" : "comfy" });
            }}
          />
        </div>
      </section>
      <section className="panel panel-pad">
        <h2 className="h2">{t("On all your devices")}</h2>
        <LanguageSetting own={language.own} site={language.site} />
        <div className="setting-row">
          <div className="grow">
            <b>{t("Animations")}</b>
            <span className="small muted">{t("Things lift and glide, and pages change with a wipe. Off: nothing moves.")}</span>
          </div>
          {/* one switch for all of it (the same as in the menu) */}
          <Switch
            on={p.motion && p.wipes}
            label={t("Animations")}
            onChange={(v) => {
              if (v) delete document.documentElement.dataset.motion;
              else document.documentElement.dataset.motion = "off";
              setWipe(v);
              void save({ motion: v, wipes: v });
            }}
          />
        </div>
        <div className="setting-row">
          <div className="grow">
            <b>{t("Sounds")}</b>
            <span className="small muted">
              {t("A sound when someone comes online, joins your voice chat, or posts, and when you mute or deafen yourself in a call. Voice chat itself isn't affected.")}
            </span>
          </div>
          <Switch
            on={p.sounds !== false}
            label={t("Sounds")}
            onChange={(v) => {
              setSoundsOn(v);
              void save({ sounds: v });
            }}
          />
        </div>
      </section>
    </>
  );
}
