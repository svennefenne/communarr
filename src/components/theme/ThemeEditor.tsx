"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Moon, RotateCcw, Save, Shuffle, Sun } from "lucide-react";
import { COLOR_KEYS, COLOR_LABEL, PALETTES, fullColors, isHex, type ColorKey, type Colors } from "@/lib/palettes";
import { BACKDROPS, resolveTheme, themeFromScheme, type SiteLook, type ThemeData } from "@/lib/theme";
import { DISPLAY_FONTS, UI_FONTS } from "@/lib/fontChoices";
import { useToast } from "@/components/app/AppProvider";
import { ImagePick } from "@/components/ui/ImagePick";
import { Switch } from "@/components/ui/ui";
import { endPreview, previewTheme } from "./preview";
import { saveThemeAction } from "@/app/actions/settings";

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="panel panel-pad stack">
      <div>
        <h2 className="h2" style={{ fontSize: "1.05rem" }}>
          {title}
        </h2>
        {hint ? <div className="small muted">{hint}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ColorRow({ k, value, onChange }: { k: ColorKey; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="color-row">
      <input type="color" className="swatch-input" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="grow small">{COLOR_LABEL[k]}</span>
      <input
        className="input sm mono"
        style={{ width: 96 }}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (isHex(e.target.value)) onChange(e.target.value.toLowerCase());
        }}
        maxLength={7}
        aria-label={`${COLOR_LABEL[k]} as hex`}
      />
    </label>
  );
}

/** Build a theme: colours for dark and light, fonts, corners, glass, frame, backdrop and a picture. The site previews it as you go. */
export function ThemeEditor({ id, initial, name: initialName, shared: initialShared, site, textSize }: { id: number | null; initial: ThemeData; name: string; shared: boolean; site: SiteLook; textSize: number }) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<ThemeData>(initial);
  const [name, setName] = useState(initialName);
  const [shared, setShared] = useState(initialShared);
  const [variant, setVariant] = useState<"dark" | "light">(initial.modes === "light" ? "light" : "dark");
  const [pending, start] = useTransition();
  const kept = useRef(false);

  const set = <K extends keyof ThemeData>(k: K, v: ThemeData[K]) => setData((d) => ({ ...d, [k]: v }));
  const setColor = (k: ColorKey, v: string) => setData((d) => ({ ...d, [variant]: { ...d[variant], [k]: v } }));
  const colors = fullColors(data[variant]);

  // the whole site shows the theme as it's being made (the version being edited)
  useEffect(() => {
    previewTheme(resolveTheme(site, { scheme: data.base, mode: variant, textSize }, { ...data, modes: "both" }));
  }, [data, variant, site, textSize]);
  useEffect(() => () => endPreview(kept.current), []);

  const base = (slug: string) => {
    const t = themeFromScheme(slug);
    setData((d) => ({ ...d, base: slug, dark: t.dark, light: t.light }));
  };
  const save = (use: boolean) =>
    start(async () => {
      const r = await saveThemeAction(id, name, data, shared, use);
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return;
      }
      kept.current = use;
      toast(use ? "Saved, and you're using it." : "Saved.");
      router.push("/settings/theme");
      router.refresh();
    });
  const schemes = useMemo(() => PALETTES.map((p) => ({ slug: p.slug, name: p.name })), []);

  return (
    <div className="theme-editor">
      <div className="stack">
        <Section title="Name and starting point">
          <div className="grid-2">
            <div className="field">
              <label htmlFor="te-name">Name</label>
              <input id="te-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="My theme" />
            </div>
            <div className="field">
              <label htmlFor="te-base">Start from a scheme</label>
              <div className="input-group">
                <select id="te-base" className="select" value={data.base} onChange={(e) => base(e.target.value)}>
                  {schemes.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="icon-btn framed" title="A random one" aria-label="A random scheme" onClick={() => base(schemes[Math.floor(Math.random() * schemes.length)].slug)}>
                  <Shuffle size={16} />
                </button>
              </div>
            </div>
          </div>
          <div className="field">
            <span className="label">Versions</span>
            <div className="pills">
              {(
                [
                  ["both", "Dark and light"],
                  ["dark", "Dark only"],
                  ["light", "Light only"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  className={`pill ${data.modes === m ? "active" : ""}`}
                  onClick={() => {
                    set("modes", m);
                    if (m !== "both") setVariant(m);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Colours" hint={data.modes === "both" ? "Each version has its own colours. Pick which one you're changing:" : undefined}>
          {data.modes === "both" ? (
            <div className="pills">
              <button type="button" className={`pill ${variant === "dark" ? "active" : ""}`} onClick={() => setVariant("dark")}>
                <Moon size={14} /> Dark
              </button>
              <button type="button" className={`pill ${variant === "light" ? "active" : ""}`} onClick={() => setVariant("light")}>
                <Sun size={14} /> Light
              </button>
            </div>
          ) : null}
          <div className="color-grid">
            {COLOR_KEYS.map((k) => (
              <ColorRow key={k} k={k} value={(colors as Required<Colors>)[k] as string} onChange={(v) => setColor(k, v)} />
            ))}
          </div>
          <div className="row wrap">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setData((d) => ({ ...d, [variant]: { ...themeFromScheme(d.base)[variant] } }))}>
              <RotateCcw size={14} /> Back to the scheme&apos;s colours
            </button>
            {data.modes === "both" ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const other = variant === "dark" ? "light" : "dark";
                  setData((d) => ({ ...d, [other]: { ...d[other], primary: d[variant].primary, secondary: d[variant].secondary, tertiary: d[variant].tertiary } }));
                  toast(`The accents are copied to the ${other} version.`);
                }}
              >
                Use these accents in the {variant === "dark" ? "light" : "dark"} version too
              </button>
            ) : null}
          </div>
        </Section>

        <Section title="Background picture" hint="Your own picture behind everything. A phone can have its own (tall) one.">
          <div className="grid-2">
            <ImagePick value={data.background.desktop || null} onChange={(u) => set("background", { ...data.background, desktop: u ?? "" })} kind="background" shape="wide" label="Computer and tablet" />
            <ImagePick value={data.background.mobile || null} onChange={(u) => set("background", { ...data.background, mobile: u ?? "" })} kind="background" shape="tall" label="Phone (optional)" />
          </div>
          {data.background.desktop || data.background.mobile ? (
            <div className="grid-2">
              <label className="field">
                <span className="label">Darken it: {data.background.dim}%</span>
                <input type="range" min={0} max={90} value={data.background.dim} onChange={(e) => set("background", { ...data.background, dim: Number(e.target.value) })} />
              </label>
              <label className="field">
                <span className="label">Blur it: {data.background.blur}px</span>
                <input type="range" min={0} max={20} value={data.background.blur} onChange={(e) => set("background", { ...data.background, blur: Number(e.target.value) })} />
              </label>
              <div className="field">
                <span className="label">Fit</span>
                <div className="pills">
                  {(
                    [
                      ["cover", "Fill"],
                      ["contain", "Whole picture"],
                      ["tile", "Tiles"],
                    ] as const
                  ).map(([v, label]) => (
                    <button key={v} type="button" className={`pill ${data.background.size === v ? "active" : ""}`} onClick={() => set("background", { ...data.background, size: v })}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </Section>

        <Section title="Backdrop" hint="Drawn behind the pages when there's no picture.">
          <div className="pills">
            {BACKDROPS.map((b) => (
              <button key={b.id} type="button" className={`pill ${data.backdrop === b.id ? "active" : ""}`} onClick={() => set("backdrop", b.id)}>
                {b.label}
              </button>
            ))}
          </div>
          <div className="setting-row">
            <span className="grow">
              <b>Film grain</b>
            </span>
            <Switch on={data.grain} onChange={(v) => set("grain", v)} label="Film grain" />
          </div>
        </Section>

        <Section title="Fonts">
          <div className="field">
            <span className="label">Titles and tabs</span>
            <div className="font-pick">
              {DISPLAY_FONTS.map((f) => (
                <button key={f.id} type="button" className={`font-opt ${data.display === f.id ? "on" : ""}`} onClick={() => set("display", f.id)} style={{ fontFamily: f.css, fontStretch: f.wide ? "125%" : undefined }}>
                  <span className="font-sample">Hooden</span>
                  <span className="tiny muted" style={{ fontFamily: "var(--font-ui)" }}>
                    {f.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label">Everything else</span>
            <div className="font-pick">
              {UI_FONTS.map((f) => (
                <button key={f.id} type="button" className={`font-opt ${data.ui === f.id ? "on" : ""}`} onClick={() => set("ui", f.id)} style={{ fontFamily: f.css }}>
                  <span style={{ fontSize: "1rem" }}>The quick brown fox</span>
                  <span className="tiny muted">{f.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Shape and glass">
          <label className="field">
            <span className="label">Rounded corners: {data.radius}px</span>
            <input type="range" min={0} max={28} value={data.radius} onChange={(e) => set("radius", Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="label">Glass (header and frame): {data.glass}% solid</span>
            <input type="range" min={0} max={100} value={data.glass} onChange={(e) => set("glass", Number(e.target.value))} />
          </label>
          <div className="setting-row">
            <span className="grow">
              <b>Frame round the site</b>
              <span className="small muted">The glass edge down the sides and along the bottom (computers and tablets).</span>
            </span>
            <Switch on={data.frame} onChange={(v) => set("frame", v)} label="Frame" />
          </div>
        </Section>
      </div>

      <aside className="theme-editor-side">
        <div className="panel panel-pad stack theme-sample stripe-top">
          <span className="eyebrow">Preview</span>
          <h3 className="display" style={{ fontSize: "1.6rem" }}>
            Game night
          </h3>
          <p className="small dim" style={{ margin: 0 }}>
            The whole site is showing your theme. Have a look around this page, then save.
          </p>
          <div className="row wrap">
            <span className="btn btn-primary btn-sm">Going</span>
            <span className="btn btn-secondary btn-sm">Maybe</span>
            <span className="btn btn-sm">Can&apos;t</span>
          </div>
          <div className="pills">
            <span className="pill active">All</span>
            <span className="pill">Mine</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="badge accent">New</span>
            <span className="badge hot">News</span>
            <span className="badge teal">Voice</span>
            <span className="pill ok soft">Done</span>
          </div>
          <input className="input sm" placeholder="Write something…" readOnly />
        </div>
        <div className="panel panel-pad stack">
          <label className="check">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Share it: others can use it too
          </label>
          <button type="button" className={`btn btn-primary btn-block ${pending ? "loading" : ""}`} onClick={() => save(true)}>
            <Save size={16} /> Save and use it
          </button>
          <button type="button" className="btn btn-block" onClick={() => save(false)} disabled={pending}>
            Just save
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => router.push("/settings/theme")}>
            Cancel
          </button>
        </div>
      </aside>
    </div>
  );
}
