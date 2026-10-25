"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SiteSettings } from "@/lib/settings";
import { CATEGORY_LABEL, PALETTES, type PaletteCategory } from "@/lib/palettes";
import { BackdropPicker } from "@/components/theme/BackdropPicker";
import { BackdropLibrary } from "./BackdropLibrary";
import { useT, useToast } from "@/components/app/AppProvider";
import { LANGS, type Lang } from "@/lib/i18n";
import { ImagePick } from "@/components/ui/ImagePick";
import { Switch } from "@/components/ui/ui";
import { SchemeTile } from "@/components/theme/SchemeTile";
import { SaveBar } from "./Section";
import { saveSettingsAction } from "@/app/actions/admin";

function useSave() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return {
    pending,
    save: (patch: Partial<SiteSettings>, done?: string) =>
      start(async () => {
        const r = await saveSettingsAction(patch);
        if (!r.ok) toast(r.error, { kind: "err" });
        else {
          toast(done ?? t("Saved."));
          router.refresh();
        }
      }),
  };
}

export function IdentitySettings({ s }: { s: SiteSettings }) {
  const t = useT();
  const toast = useToast();
  const { save, pending } = useSave();
  const [v, setV] = useState({ siteName: s.siteName, logo: s.logo, tagline: s.tagline, welcome: s.welcome, footer: s.footer });
  const [switching, startSwitch] = useTransition();
  // the language and the clock: on their own (not with the texts below), and a full reload so every
  // page and menu switches over
  const saveNow = (patch: Partial<SiteSettings>) =>
    startSwitch(async () => {
      const r = await saveSettingsAction(patch);
      if (!r.ok) toast(r.error, { kind: "err" });
      else window.location.reload();
    });
  const setLanguage = (language: Lang) => saveNow({ language });
  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="site-language">{t("Site language")}</label>
        <select id="site-language" className="select" value={s.language} disabled={switching} onChange={(e) => setLanguage(e.target.value as Lang)} style={{ maxWidth: 260 }}>
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <span className="small muted">{t("The default for everyone who hasn't picked their own (Settings → Display, or the switch in their menu), for the log-in page and for what's saved for everyone, like chat notices. Changes straight away.")}</span>
      </div>
      {/* the clock: for everyone, whatever their language; saved straight away, like the language */}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="site-clock">{t("Time format")}</label>
          <select id="site-clock" className="select" value={s.timeFormat} disabled={switching} onChange={(e) => saveNow({ timeFormat: e.target.value as SiteSettings["timeFormat"] })}>
            <option value="24h">{t("24-hour (19:30)")}</option>
            <option value="12h">{t("12-hour (7:30 PM)")}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="site-week">{t("Weeks start on")}</label>
          <select id="site-week" className="select" value={s.weekStart} disabled={switching} onChange={(e) => saveNow({ weekStart: Number(e.target.value) as SiteSettings["weekStart"] })}>
            <option value={1}>{t("Monday")}</option>
            <option value={0}>{t("Sunday")}</option>
            <option value={6}>{t("Saturday")}</option>
          </select>
        </div>
      </div>
      <span className="small muted" style={{ marginTop: -6 }}>
        {t("For everyone: times in posts, chat and the calendar, and the first column of the calendar.")}
      </span>
      <div className="grid-2">
        <div className="field">
          <label>{t("The site's name")}</label>
          <input className="input" value={v.siteName} onChange={(e) => setV({ ...v, siteName: e.target.value })} maxLength={40} />
        </div>
        <div className="field">
          <label>{t("In a few words")}</label>
          <input className="input" value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} maxLength={200} />
        </div>
      </div>
      <div className="field">
        <span className="label">{t("Logo")}</span>
        <ImagePick value={v.logo || null} onChange={(u) => setV({ ...v, logo: u ?? "" })} kind="logo" shape="square" whole label={t("Your own logo instead of the stripes")} />
        <span className="small muted">{t("Shown next to the name in the top left and on the log-in page, as the browser tab's icon and as the app's icon on phones. A square picture with a see-through background works best. Without one, the stripes.")}</span>
      </div>
      <div className="field">
        <label>{t("Welcome on the log-in page")}</label>
        <input className="input" value={v.welcome} onChange={(e) => setV({ ...v, welcome: e.target.value })} maxLength={400} />
      </div>
      <div className="field">
        <label>{t("The line along the bottom")}</label>
        <input className="input" value={v.footer} onChange={(e) => setV({ ...v, footer: e.target.value })} maxLength={120} />
      </div>
      <SaveBar pending={pending} onSave={() => save(v)} />
    </div>
  );
}

export function LookSettings({ s }: { s: SiteSettings }) {
  const t = useT();
  const { save, pending } = useSave();
  const [scheme, setScheme] = useState(s.defaultScheme);
  const [mode, setMode] = useState(s.defaultMode);
  const [cat, setCat] = useState<PaletteCategory | "all">("all");
  const [allow, setAllow] = useState(s.allowCustomThemes);
  const [frame, setFrame] = useState(s.frame);
  const [glass, setGlass] = useState(s.glass);
  const [backdrop, setBackdrop] = useState(s.backdrop);
  const [bg, setBg] = useState(s.background);
  return (
    <div className="stack loose">
      <p className="small muted" style={{ margin: 0 }}>
        {t("What everyone sees until they pick their own (Settings → Theme), and what visitors see on the log-in page.")}
      </p>
      <div className="stack tight">
        <span className="label">{t("Default colour scheme")}</span>
        <div className="pills scroll">
          {(["all", "hooden", "builtin", "gaming", "community"] as const).map((c) => (
            <button key={c} type="button" className={`pill ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>
              {c === "all" ? t("All") : t(CATEGORY_LABEL[c])}
            </button>
          ))}
        </div>
        <div className="scheme-grid admin-schemes">
          {PALETTES.filter((p) => cat === "all" || p.category === cat).map((p) => (
            <SchemeTile key={p.slug} name={p.name} colors={mode === "light" ? p.light : p.dark} active={scheme === p.slug} onClick={() => setScheme(p.slug)} />
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span className="grow">
          <b>{t("Light or dark")}</b>
        </span>
        <div className="pills">
          {(
            [
              ["dark", t("Dark")],
              ["light", t("Light")],
              ["system", t("Follow the device")],
            ] as const
          ).map(([m, l]) => (
            <button key={m} type="button" className={`pill ${mode === m ? "active" : ""}`} onClick={() => setMode(m)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <span className="grow">
          <b>{t("Members can make their own themes")}</b>
          <span className="small muted">{t("Their colours, fonts and background pictures (only they see them).")}</span>
        </span>
        <Switch on={allow} onChange={setAllow} label={t("Custom themes")} />
      </div>
      <div className="setting-row">
        <span className="grow">
          <b>{t("Frame round the site")}</b>
          <span className="small muted">{t("Glass down the sides and along the bottom, on computers and tablets.")}</span>
        </span>
        <Switch on={frame} onChange={setFrame} label={t("Frame")} />
      </div>
      <label className="field">
        <span className="label">{t("Glass of the header and frame: {n}% solid", { n: glass })}</span>
        <input type="range" min={0} max={100} value={glass} onChange={(e) => setGlass(Number(e.target.value))} />
      </label>
      <div className="field">
        <span className="label">{t("Backdrop")}</span>
        <BackdropPicker value={backdrop} onChange={setBackdrop} library={s.backdrops} />
      </div>
      <BackdropLibrary library={s.backdrops} onRemoved={(id) => backdrop === `pic:${id}` && setBackdrop("orbits")} />
      <div className="stack tight">
        <span className="label">{t("Site background picture (instead of the backdrop)")}</span>
        <div className="grid-2">
          <ImagePick value={bg.desktop || null} onChange={(u) => setBg({ ...bg, desktop: u ?? "" })} kind="background" shape="wide" label={t("Computer and tablet")} />
          <ImagePick value={bg.mobile || null} onChange={(u) => setBg({ ...bg, mobile: u ?? "" })} kind="background" shape="tall" label={t("Phone (optional)")} />
        </div>
        {bg.desktop || bg.mobile ? (
          <div className="grid-2">
            <label className="field">
              <span className="label">{t("Darken it: {n}%", { n: bg.dim })}</span>
              <input type="range" min={0} max={90} value={bg.dim} onChange={(e) => setBg({ ...bg, dim: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="label">{t("Blur it: {n}px", { n: bg.blur })}</span>
              <input type="range" min={0} max={20} value={bg.blur} onChange={(e) => setBg({ ...bg, blur: Number(e.target.value) })} />
            </label>
          </div>
        ) : null}
      </div>
      <SaveBar pending={pending} onSave={() => save({ defaultScheme: scheme, defaultMode: mode, allowCustomThemes: allow, frame, glass, backdrop, background: bg }, t("Saved. Everyone using the default sees it now."))} />
    </div>
  );
}

const FEATURES: [keyof SiteSettings["features"], string, string][] = [
  ["chat", "Chat", "Rooms, direct messages"],
  ["voice", "Voice chat", "The headphones in every room"],
  ["forum", "Forum", "Categories and threads"],
  ["calendar", "Calendar", "Events, RSVPs, reminders"],
  ["polls", "Polls", ""],
  ["groups", "Groups", ""],
  ["news", "News", "Admin news on the front page"],
];

export function FeatureSettings({ s }: { s: SiteSettings }) {
  const t = useT();
  const { save, pending } = useSave();
  const [f, setF] = useState(s.features);
  const [can, setCan] = useState(s.canCreate);
  const [maxUp, setMaxUp] = useState(s.maxUploadMb);
  return (
    <div className="stack loose">
      <div>
        {FEATURES.map(([k, label, hint]) => (
          <div key={k} className="setting-row">
            <span className="grow">
              <b>{t(label)}</b>
              {hint ? <span className="small muted">{t(hint)}</span> : null}
            </span>
            <Switch on={f[k]} onChange={(v) => setF({ ...f, [k]: v })} label={t(label)} />
          </div>
        ))}
      </div>
      <div className="stack tight">
        <span className="label">{t("Who can start…")}</span>
        {(
          [
            ["groups", t("Groups")],
            ["rooms", t("Chat rooms")],
            ["events", t("Events")],
            ["polls", t("Polls")],
          ] as const
        ).map(([k, label]) => (
          <div key={k} className="setting-row">
            <span className="grow">{label}</span>
            <div className="pills">
              <button type="button" className={`pill ${can[k] === "members" ? "active" : ""}`} onClick={() => setCan({ ...can, [k]: "members" })}>
                {t("Everyone")}
              </button>
              <button type="button" className={`pill ${can[k] === "mods" ? "active" : ""}`} onClick={() => setCan({ ...can, [k]: "mods" })}>
                {t("Moderators")}
              </button>
            </div>
          </div>
        ))}
      </div>
      <label className="row">
        <span className="grow">{t("Biggest picture upload")}</span>
        <input type="number" className="input sm" style={{ width: 90 }} min={1} max={200} value={maxUp} onChange={(e) => setMaxUp(Number(e.target.value))} /> MB
      </label>
      <SaveBar pending={pending} onSave={() => save({ features: f, canCreate: can, maxUploadMb: maxUp })} />
    </div>
  );
}

export function AnnouncementSettings({ s }: { s: SiteSettings }) {
  const t = useT();
  const { save, pending } = useSave();
  const [a, setA] = useState(s.announcement);
  const [words, setWords] = useState(s.wordFilter.join("\n"));
  return (
    <div className="stack loose">
      <div className="stack tight">
        <div className="setting-row">
          <span className="grow">
            <b>{t("Announcement line")}</b>
            <span className="small muted">{t("Shown under the header on every page until someone closes it.")}</span>
          </span>
          <Switch on={a.on} onChange={(v) => setA({ ...a, on: v })} label={t("Announcement")} />
        </div>
        <textarea className="textarea" value={a.text} onChange={(e) => setA({ ...a, text: e.target.value })} maxLength={400} placeholder={t("Game night moved to Saturday!")} style={{ minHeight: 70 }} />
        <div className="pills">
          {(
            [
              ["info", t("Info")],
              ["warn", t("Important")],
              ["party", t("Party")],
            ] as const
          ).map(([st, l]) => (
            <button key={st} type="button" className={`pill ${a.style === st ? "active" : ""}`} onClick={() => setA({ ...a, style: st })}>
              {l}
            </button>
          ))}
        </div>
        <SaveBar pending={pending} onSave={() => save({ announcement: a })} />
      </div>
      <div className="stack tight">
        <b>{t("Word filter")}</b>
        <span className="small muted">{t("One word per line. In posts, comments and chat they're starred out (f***).")}</span>
        <textarea className="textarea" value={words} onChange={(e) => setWords(e.target.value)} style={{ minHeight: 90 }} />
        <SaveBar pending={pending} onSave={() => save({ wordFilter: words.split(/\n+/).map((w) => w.trim()).filter(Boolean) })} />
      </div>
    </div>
  );
}
