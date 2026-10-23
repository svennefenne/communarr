"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Search, Share2, Shuffle, Trash2, Users } from "lucide-react";
import { CATEGORY_LABEL, PALETTES, type PaletteCategory } from "@/lib/palettes";
import { resolveTheme, type SiteLook } from "@/lib/theme";
import type { ThemeInfo } from "@/lib/themes";
import type { ThemePrefs } from "@/lib/types";
import { useT, useToast } from "@/components/app/AppProvider";
import { ModeSwitch } from "@/components/shell/UserMenu";
import { useConfirm } from "@/components/ui/ui";
import { endPreview, previewTheme } from "./preview";
import { SchemeTile } from "./SchemeTile";
import { setPrefsAction } from "@/app/actions/me";
import { deleteThemeAction, saveThemeAction } from "@/app/actions/settings";

function systemDark() {
  return typeof window === "undefined" || window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeSettings({ prefs, site, mine, shared, allowCustom }: { prefs: ThemePrefs; site: SiteLook; mine: ThemeInfo[]; shared: ThemeInfo[]; allowCustom: boolean }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [scheme, setScheme] = useState(prefs.scheme);
  const [custom, setCustom] = useState(prefs.custom);
  const [cat, setCat] = useState<PaletteCategory | "all">("all");
  const [q, setQ] = useState("");
  const [dark, setDark] = useState(prefs.mode !== "light");
  const { confirm, node } = useConfirm();
  useEffect(() => setDark(prefs.mode === "dark" || (prefs.mode === "system" && systemDark())), [prefs.mode]);

  const list = useMemo(() => PALETTES.filter((p) => (cat === "all" || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()))), [cat, q]);

  const applyScheme = async (slug: string) => {
    setScheme(slug);
    setCustom(null);
    previewTheme(resolveTheme(site, { scheme: slug, mode: prefs.mode, textSize: prefs.textSize }, null));
    await setPrefsAction({ scheme: slug, custom: null });
    endPreview(true);
    router.refresh();
  };
  const applyCustom = async (th: ThemeInfo) => {
    setCustom(th.id);
    previewTheme(resolveTheme(site, { scheme, mode: prefs.mode, textSize: prefs.textSize }, th.data));
    await setPrefsAction({ custom: th.id });
    endPreview(true);
    router.refresh();
    if (!th.mine) toast(t("Using {theme} by {name}.", { theme: th.name, name: th.owner?.name ?? t("someone") }));
  };

  return (
    <div className="stack loose">
      <section className="panel panel-pad row between wrap">
        <div>
          <h2 className="h2">{t("Light or dark")}</h2>
          <div className="small muted">{t("Every scheme has both. Auto follows your device.")}</div>
        </div>
        <ModeSwitch mode={prefs.mode} />
      </section>

      <section className="stack">
        <div className="row between wrap">
          <div>
            <span className="eyebrow">{t("Colour schemes · {n}", { n: PALETTES.length })}</span>
            <div className="small muted">{t("Tap one to use it. The whole site changes at once.")}</div>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => applyScheme(PALETTES[Math.floor(Math.random() * PALETTES.length)].slug)}>
            <Shuffle size={15} /> {t("Surprise me")}
          </button>
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="pills scroll">
            {(["all", "hooden", "builtin", "gaming", "community"] as const).map((c) => (
              <button key={c} type="button" className={`pill ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>
                {c === "all" ? t("All") : t(CATEGORY_LABEL[c])}
              </button>
            ))}
          </div>
          <div className="chat-search" style={{ margin: 0, flex: "1 1 200px", maxWidth: 320 }}>
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find a scheme")} aria-label={t("Find a scheme")} />
          </div>
        </div>
        <div className="scheme-grid">
          {list.map((p) => (
            <SchemeTile key={p.slug} name={p.name} colors={dark ? p.dark : p.light} active={!custom && scheme === p.slug} onClick={() => applyScheme(p.slug)} />
          ))}
        </div>
      </section>

      {allowCustom ? (
        <>
          <section className="stack">
            <div className="row between wrap">
              <div>
                <span className="eyebrow">{t("Your own themes")}</span>
                <div className="small muted">{t("Your colours, fonts, corners, glass, and your own background picture.")}</div>
              </div>
              <Link href="/settings/theme/new" className="btn btn-primary btn-sm">
                <Plus size={15} /> {t("Make a theme")}
              </Link>
            </div>
            {mine.length ? (
              <div className="scheme-grid big">
                {mine.map((th) => (
                  <div key={th.id} className="theme-card">
                    <SchemeTile name={th.name} colors={dark && th.data.modes !== "light" ? th.data.dark : th.data.light} active={custom === th.id} onClick={() => applyCustom(th)} sub={th.shared ? t("Shared · used by {n}", { n: th.uses }) : t("Only you")} />
                    <div className="row" style={{ gap: 2 }}>
                      <Link href={`/settings/theme/${th.id}`} className="icon-btn xs" aria-label={t("Edit")} title={t("Edit")}>
                        <Pencil size={14} />
                      </Link>
                      <button
                        type="button"
                        className="icon-btn xs"
                        title={th.shared ? t("Stop sharing") : t("Share with everyone")}
                        aria-label={t("Share")}
                        onClick={async () => {
                          const r = await saveThemeAction(th.id, th.name, th.data, !th.shared, false);
                          if (r.ok) {
                            toast(th.shared ? t("Not shared any more.") : t("Shared: others can use it now."));
                            router.refresh();
                          }
                        }}
                      >
                        <Share2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn xs"
                        title={t("Delete")}
                        aria-label={t("Delete")}
                        onClick={() =>
                          confirm(t("Delete the theme {name}?", { name: th.name }), t("Delete"), async () => {
                            await deleteThemeAction(th.id);
                            router.refresh();
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel panel-pad small muted">{t("You haven't made one yet. Start from any scheme and change what you like.")}</div>
            )}
          </section>
          {shared.filter((th) => !th.mine).length ? (
            <section className="stack">
              <span className="eyebrow row" style={{ gap: 6 }}>
                <Users size={13} /> {t("Shared by others")}
              </span>
              <div className="scheme-grid big">
                {shared
                  .filter((th) => !th.mine)
                  .map((th) => (
                    <div key={th.id} className="theme-card">
                      <SchemeTile
                        name={th.name}
                        colors={dark && th.data.modes !== "light" ? th.data.dark : th.data.light}
                        active={custom === th.id}
                        onClick={() => applyCustom(th)}
                        sub={t("by {name} · {n} using it", { name: th.owner?.name ?? t("someone"), n: th.uses })}
                      />
                      <Link href={`/settings/theme/new?from=${th.id}`} className="icon-btn xs" title={t("Make a copy to change")} aria-label={t("Copy")}>
                        <Copy size={14} />
                      </Link>
                    </div>
                  ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
      {node}
    </div>
  );
}
