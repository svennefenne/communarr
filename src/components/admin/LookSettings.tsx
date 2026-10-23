"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SiteSettings } from "@/lib/settings";
import { CATEGORY_LABEL, PALETTES, type PaletteCategory } from "@/lib/palettes";
import { BACKDROPS } from "@/lib/theme";
import { useToast } from "@/components/app/AppProvider";
import { ImagePick } from "@/components/ui/ImagePick";
import { Switch } from "@/components/ui/ui";
import { SchemeTile } from "@/components/theme/SchemeTile";
import { SaveBar } from "./Section";
import { saveSettingsAction } from "@/app/actions/admin";

function useSave() {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return {
    pending,
    save: (patch: Partial<SiteSettings>, done = "Saved.") =>
      start(async () => {
        const r = await saveSettingsAction(patch);
        if (!r.ok) toast(r.error, { kind: "err" });
        else {
          toast(done);
          router.refresh();
        }
      }),
  };
}

export function IdentitySettings({ s }: { s: SiteSettings }) {
  const { save, pending } = useSave();
  const [v, setV] = useState({ siteName: s.siteName, tagline: s.tagline, welcome: s.welcome, footer: s.footer });
  return (
    <div className="stack">
      <div className="grid-2">
        <div className="field">
          <label>The site&apos;s name</label>
          <input className="input" value={v.siteName} onChange={(e) => setV({ ...v, siteName: e.target.value })} maxLength={40} />
        </div>
        <div className="field">
          <label>In a few words</label>
          <input className="input" value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} maxLength={200} />
        </div>
      </div>
      <div className="field">
        <label>Welcome on the log-in page</label>
        <input className="input" value={v.welcome} onChange={(e) => setV({ ...v, welcome: e.target.value })} maxLength={400} />
      </div>
      <div className="field">
        <label>The line along the bottom</label>
        <input className="input" value={v.footer} onChange={(e) => setV({ ...v, footer: e.target.value })} maxLength={120} />
      </div>
      <SaveBar pending={pending} onSave={() => save(v)} />
    </div>
  );
}

export function LookSettings({ s }: { s: SiteSettings }) {
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
        What everyone sees until they pick their own (Settings → Theme), and what visitors see on the log-in page.
      </p>
      <div className="stack tight">
        <span className="label">Default colour scheme</span>
        <div className="pills scroll">
          {(["all", "hooden", "builtin", "gaming", "community"] as const).map((c) => (
            <button key={c} type="button" className={`pill ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>
              {c === "all" ? "All" : CATEGORY_LABEL[c]}
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
          <b>Light or dark</b>
        </span>
        <div className="pills">
          {(
            [
              ["dark", "Dark"],
              ["light", "Light"],
              ["system", "Follow the device"],
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
          <b>Members can make their own themes</b>
          <span className="small muted">Their colours, fonts and background pictures (only they see them).</span>
        </span>
        <Switch on={allow} onChange={setAllow} label="Custom themes" />
      </div>
      <div className="setting-row">
        <span className="grow">
          <b>Frame round the site</b>
          <span className="small muted">Glass down the sides and along the bottom, on computers and tablets.</span>
        </span>
        <Switch on={frame} onChange={setFrame} label="Frame" />
      </div>
      <label className="field">
        <span className="label">Glass of the header and frame: {glass}% solid</span>
        <input type="range" min={0} max={100} value={glass} onChange={(e) => setGlass(Number(e.target.value))} />
      </label>
      <div className="field">
        <span className="label">Backdrop</span>
        <div className="pills">
          {BACKDROPS.map((b) => (
            <button key={b.id} type="button" className={`pill ${backdrop === b.id ? "active" : ""}`} onClick={() => setBackdrop(b.id)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <div className="stack tight">
        <span className="label">Site background picture (instead of the backdrop)</span>
        <div className="grid-2">
          <ImagePick value={bg.desktop || null} onChange={(u) => setBg({ ...bg, desktop: u ?? "" })} kind="background" shape="wide" label="Computer and tablet" />
          <ImagePick value={bg.mobile || null} onChange={(u) => setBg({ ...bg, mobile: u ?? "" })} kind="background" shape="tall" label="Phone (optional)" />
        </div>
        {bg.desktop || bg.mobile ? (
          <div className="grid-2">
            <label className="field">
              <span className="label">Darken it: {bg.dim}%</span>
              <input type="range" min={0} max={90} value={bg.dim} onChange={(e) => setBg({ ...bg, dim: Number(e.target.value) })} />
            </label>
            <label className="field">
              <span className="label">Blur it: {bg.blur}px</span>
              <input type="range" min={0} max={20} value={bg.blur} onChange={(e) => setBg({ ...bg, blur: Number(e.target.value) })} />
            </label>
          </div>
        ) : null}
      </div>
      <SaveBar pending={pending} onSave={() => save({ defaultScheme: scheme, defaultMode: mode, allowCustomThemes: allow, frame, glass, backdrop, background: bg }, "Saved. Everyone using the default sees it now.")} />
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
              <b>{label}</b>
              {hint ? <span className="small muted">{hint}</span> : null}
            </span>
            <Switch on={f[k]} onChange={(v) => setF({ ...f, [k]: v })} label={label} />
          </div>
        ))}
      </div>
      <div className="stack tight">
        <span className="label">Who can start…</span>
        {(
          [
            ["groups", "Groups"],
            ["rooms", "Chat rooms"],
            ["events", "Events"],
            ["polls", "Polls"],
          ] as const
        ).map(([k, label]) => (
          <div key={k} className="setting-row">
            <span className="grow">{label}</span>
            <div className="pills">
              <button type="button" className={`pill ${can[k] === "members" ? "active" : ""}`} onClick={() => setCan({ ...can, [k]: "members" })}>
                Everyone
              </button>
              <button type="button" className={`pill ${can[k] === "mods" ? "active" : ""}`} onClick={() => setCan({ ...can, [k]: "mods" })}>
                Moderators
              </button>
            </div>
          </div>
        ))}
      </div>
      <label className="row">
        <span className="grow">Biggest picture upload</span>
        <input type="number" className="input sm" style={{ width: 90 }} min={1} max={200} value={maxUp} onChange={(e) => setMaxUp(Number(e.target.value))} /> MB
      </label>
      <SaveBar pending={pending} onSave={() => save({ features: f, canCreate: can, maxUploadMb: maxUp })} />
    </div>
  );
}

export function AnnouncementSettings({ s }: { s: SiteSettings }) {
  const { save, pending } = useSave();
  const [a, setA] = useState(s.announcement);
  const [words, setWords] = useState(s.wordFilter.join("\n"));
  return (
    <div className="stack loose">
      <div className="stack tight">
        <div className="setting-row">
          <span className="grow">
            <b>Announcement line</b>
            <span className="small muted">Shown under the header on every page until someone closes it.</span>
          </span>
          <Switch on={a.on} onChange={(v) => setA({ ...a, on: v })} label="Announcement" />
        </div>
        <textarea className="textarea" value={a.text} onChange={(e) => setA({ ...a, text: e.target.value })} maxLength={400} placeholder="Game night moved to Saturday!" style={{ minHeight: 70 }} />
        <div className="pills">
          {(
            [
              ["info", "Info"],
              ["warn", "Important"],
              ["party", "Party"],
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
        <b>Word filter</b>
        <span className="small muted">One word per line. In posts, comments and chat they&apos;re starred out (f***).</span>
        <textarea className="textarea" value={words} onChange={(e) => setWords(e.target.value)} style={{ minHeight: 90 }} />
        <SaveBar pending={pending} onSave={() => save({ wordFilter: words.split(/\n+/).map((w) => w.trim()).filter(Boolean) })} />
      </div>
    </div>
  );
}
