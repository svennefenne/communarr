"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Moon, RotateCcw, Save, Shuffle, Sun } from "lucide-react";
import { COLOR_KEYS, COLOR_LABEL, PALETTES, fullColors, isHex, type ColorKey, type Colors } from "@/lib/palettes";
import { resolveTheme, themeFromScheme, type SiteLook, type ThemeData } from "@/lib/theme";
import { BackdropPicker } from "./BackdropPicker";
import { DISPLAY_FONTS, UI_FONTS } from "@/lib/fontChoices";
import { useT, useToast } from "@/components/app/AppProvider";
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
  const t = useT();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="color-row">
      <input type="color" className="swatch-input" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="grow small">{t(COLOR_LABEL[k])}</span>
      <input
        className="input sm mono"
        style={{ width: 96 }}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (isHex(e.target.value)) onChange(e.target.value.toLowerCase());
        }}
        maxLength={7}
        aria-label={t("{color} as hex", { color: t(COLOR_LABEL[k]) })}
      />
    </label>
  );
}

/** Build a theme: colours for dark and light, fonts, corners, glass, frame, backdrop and a picture. The site previews it as you go. */
export function ThemeEditor({ id, initial, name: initialName, shared: initialShared, site, textSize }: { id: number | null; initial: ThemeData; name: string; shared: boolean; site: SiteLook; textSize: number }) {
  const t = useT();
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
    const th = themeFromScheme(slug);
    setData((d) => ({ ...d, base: slug, dark: th.dark, light: th.light }));
  };
  const save = (use: boolean) =>
    start(async () => {
      const r = await saveThemeAction(id, name, data, shared, use);
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return;
      }
      kept.current = use;
      toast(use ? t("Saved, and you're using it.") : t("Saved."));
      router.push("/settings/theme");
      router.refresh();
    });
  const schemes = useMemo(() => PALETTES.map((p) => ({ slug: p.slug, name: p.name })), []);

  return (
    <div className="theme-editor">
      <div className="stack">
        <Section title={t("Name and starting point")}>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="te-name">{t("Name")}</label>
              <input id="te-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={t("My theme")} />
            </div>
            <div className="field">
              <label htmlFor="te-base">{t("Start from a scheme")}</label>
              <div className="input-group">
                <select id="te-base" className="select" value={data.base} onChange={(e) => base(e.target.value)}>
                  {schemes.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="icon-btn framed" title={t("A random one")} aria-label={t("A random scheme")} onClick={() => base(schemes[Math.floor(Math.random() * schemes.length)].slug)}>
                  <Shuffle size={16} />
                </button>
              </div>
            </div>
          </div>
          <div className="field">
            <span className="label">{t("Versions")}</span>
            <div className="pills">
              {(
                [
                  ["both", t("Dark and light")],
                  ["dark", t("Dark only")],
                  ["light", t("Light only")],
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

        <Section title={t("Colours")} hint={data.modes === "both" ? t("Each version has its own colours. Pick which one you're changing:") : undefined}>
          {data.modes === "both" ? (
            <div className="pills">
              <button type="button" className={`pill ${variant === "dark" ? "active" : ""}`} onClick={() => setVariant("dark")}>
                <Moon size={14} /> {t("Dark")}
              </button>
              <button type="button" className={`pill ${variant === "light" ? "active" : ""}`} onClick={() => setVariant("light")}>
                <Sun size={14} /> {t("Light")}
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
              <RotateCcw size={14} /> {t("Back to the scheme's colours")}
            </button>
            {data.modes === "both" ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const other = variant === "dark" ? "light" : "dark";
                  setData((d) => ({ ...d, [other]: { ...d[other], primary: d[variant].primary, secondary: d[variant].secondary, tertiary: d[variant].tertiary } }));
                  toast(other === "light" ? t("The accents are copied to the light version.") : t("The accents are copied to the dark version."));
                }}
              >
                {variant === "dark" ? t("Use these accents in the light version too") : t("Use these accents in the dark version too")}
              </button>
            ) : null}
          </div>
        </Section>

        <Section title={t("Background picture")} hint={t("Your own picture behind everything. A phone can have its own (tall) one.")}>
          <div className="grid-2">
            <ImagePick value={data.background.desktop || null} onChange={(u) => set("background", { ...data.background, desktop: u ?? "" })} kind="background" shape="wide" label={t("Computer and tablet")} />
            <ImagePick value={data.background.mobile || null} onChange={(u) => set("background", { ...data.background, mobile: u ?? "" })} kind="background" shape="tall" label={t("Phone (optional)")} />
          </div>
          {data.background.desktop || data.background.mobile ? (
            <div className="grid-2">
              <label className="field">
                <span className="label">{t("Darken it: {n}%", { n: data.background.dim })}</span>
                <input type="range" min={0} max={90} value={data.background.dim} onChange={(e) => set("background", { ...data.background, dim: Number(e.target.value) })} />
              </label>
              <label className="field">
                <span className="label">{t("Blur it: {n}px", { n: data.background.blur })}</span>
                <input type="range" min={0} max={20} value={data.background.blur} onChange={(e) => set("background", { ...data.background, blur: Number(e.target.value) })} />
              </label>
              <div className="field">
                <span className="label">{t("Fit")}</span>
                <div className="pills">
                  {(
                    [
                      ["cover", t("Fill")],
                      ["contain", t("Whole picture")],
                      ["tile", t("Tiles")],
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

        <Section title={t("Backdrop")} hint={t("Drawn behind the pages when there's no picture.")}>
          <BackdropPicker value={data.backdrop} onChange={(b) => set("backdrop", b)} library={site.backdrops ?? []} />
          <div className="setting-row">
            <span className="grow">
              <b>{t("Film grain")}</b>
            </span>
            <Switch on={data.grain} onChange={(v) => set("grain", v)} label={t("Film grain")} />
          </div>
        </Section>

        <Section title={t("Fonts")}>
          <div className="field">
            <span className="label">{t("Titles and tabs")}</span>
            <div className="font-pick">
              {DISPLAY_FONTS.map((f) => (
                <button key={f.id} type="button" className={`font-opt ${data.display === f.id ? "on" : ""}`} onClick={() => set("display", f.id)} style={{ fontFamily: f.css, fontStretch: f.wide ? "125%" : undefined }}>
                  <span className="font-sample">Hooden</span>
                  <span className="tiny muted" style={{ fontFamily: "var(--font-ui)" }}>
                    {t(f.label)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="label">{t("Everything else")}</span>
            <div className="font-pick">
              {UI_FONTS.map((f) => (
                <button key={f.id} type="button" className={`font-opt ${data.ui === f.id ? "on" : ""}`} onClick={() => set("ui", f.id)} style={{ fontFamily: f.css }}>
                  <span style={{ fontSize: "1rem" }}>{t("The quick brown fox")}</span>
                  <span className="tiny muted">{t(f.label)}</span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title={t("Shape and glass")}>
          <label className="field">
            <span className="label">{t("Rounded corners: {n}px", { n: data.radius })}</span>
            <input type="range" min={0} max={28} value={data.radius} onChange={(e) => set("radius", Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="label">{t("Glass (header and frame): {n}% solid", { n: data.glass })}</span>
            <input type="range" min={0} max={100} value={data.glass} onChange={(e) => set("glass", Number(e.target.value))} />
          </label>
          <div className="setting-row">
            <span className="grow">
              <b>{t("Frame round the site")}</b>
              <span className="small muted">{t("The glass edge down the sides and along the bottom (computers and tablets).")}</span>
            </span>
            <Switch on={data.frame} onChange={(v) => set("frame", v)} label={t("Frame")} />
          </div>
        </Section>
      </div>

      <aside className="theme-editor-side">
        <div className="panel panel-pad stack theme-sample stripe-top">
          <span className="eyebrow">{t("Preview")}</span>
          <h3 className="display" style={{ fontSize: "1.6rem" }}>
            {t("Game night")}
          </h3>
          <p className="small dim" style={{ margin: 0 }}>
            {t("The whole site is showing your theme. Have a look around this page, then save.")}
          </p>
          <div className="row wrap">
            <span className="btn btn-primary btn-sm">{t("Going")}</span>
            <span className="btn btn-secondary btn-sm">{t("Maybe")}</span>
            <span className="btn btn-sm">{t("Can't")}</span>
          </div>
          <div className="pills">
            <span className="pill active">{t("All")}</span>
            <span className="pill">{t("Mine")}</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="badge accent">{t("New")}</span>
            <span className="badge hot">{t("News")}</span>
            <span className="badge teal">{t("Voice")}</span>
            <span className="pill ok soft">{t("Done")}</span>
          </div>
          <input className="input sm" placeholder={t("Write something…")} readOnly />
        </div>
        <div className="panel panel-pad stack">
          <label className="check">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> {t("Share it: others can use it too")}
          </label>
          <button type="button" className={`btn btn-primary btn-block ${pending ? "loading" : ""}`} onClick={() => save(true)}>
            <Save size={16} /> {t("Save and use it")}
          </button>
          <button type="button" className="btn btn-block" onClick={() => save(false)} disabled={pending}>
            {t("Just save")}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => router.push("/settings/theme")}>
            {t("Cancel")}
          </button>
        </div>
      </aside>
    </div>
  );
}
