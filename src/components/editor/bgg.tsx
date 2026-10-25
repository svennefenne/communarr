"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Extension, Node } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { Dices, LoaderCircle, Search } from "lucide-react";
import type { BggGame, BggMode } from "@/lib/types";
import { useT } from "@/components/app/AppProvider";
import { mentionOpen } from "./mentionState";
import { place } from "./mention";

/**
 * Board games from BoardGameGeek: "bgg:" and a few letters of a name suggest games (with the site's
 * BGG token), and the one picked goes in as a game: a link to its page on BGG with a card of its own.
 * Without a token the list offers a link to a search on BGG for what was typed.
 */

export const BGG = "https://boardgamegeek.com";
export const bggUrl = (id: string | null, name: string) => (id ? `${BGG}/boardgame/${id}` : `${BGG}/geeksearch.php?action=search&objecttype=boardgame&q=${encodeURIComponent(name)}`);

/** A game in the text: <a data-bgg="266192">Wingspan</a> (data-bgg="search" for a search on BGG) */
export const BggGameNode = Node.create({
  name: "bggGame",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => (/^\d{1,9}$/.test(el.getAttribute("data-bgg") ?? "") ? el.getAttribute("data-bgg") : null) },
      name: { default: "", parseHTML: (el) => (el.textContent ?? "").slice(0, 200) },
    };
  },
  // (before links: it's an <a> too)
  parseHTML() {
    return [{ tag: "a[data-bgg]", priority: 100 }];
  },
  renderHTML({ node }) {
    const { id, name } = node.attrs as { id: string | null; name: string };
    return ["a", { href: bggUrl(id, name), class: "bgg-game", "data-bgg": id ?? "search", target: "_blank", rel: "noopener noreferrer nofollow ugc" }, name];
  },
  renderText({ node }) {
    return node.attrs.name;
  },
});

/** what was typed after bgg: (the list looks it up itself) */
interface Typed {
  q: string;
}
/** what goes in: a game, or (id null) a search on BGG */
interface Pick {
  id: string | null;
  name: string;
}

interface ListHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

// what was found, while the page is open (BGG is asked as little as can be)
const found = new Map<string, BggGame[]>();

const BggList = forwardRef<ListHandle, SuggestionProps<Typed, Pick> & { mode: BggMode }>(function BggList(props, ref) {
  const t = useT();
  const q = props.query.trim();
  const key = q.toLowerCase();
  const full = props.mode === "full";
  const [games, setGames] = useState<BggGame[]>(() => found.get(key) ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  useEffect(() => {
    setSel(0);
    if (!full || q.length < 2) return;
    const kept = found.get(key);
    if (kept) {
      setGames(kept);
      setLoading(false);
      setError(null);
      return;
    }
    let live = true;
    setLoading(true);
    // a moment after typing stops
    const timer = setTimeout(async () => {
      try {
        const d = (await (await fetch(`/api/bgg/search?q=${encodeURIComponent(q)}`)).json()) as { games?: BggGame[]; error?: string };
        if (!live) return;
        if (!d.error) found.set(key, d.games ?? []);
        setGames(d.games ?? []);
        setError(d.error ?? null);
      } catch {
        if (live) setError("down");
      } finally {
        if (live) setLoading(false);
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, key, full]);
  const rows: Pick[] = [...(full ? games.map((g) => ({ id: String(g.id), name: g.name })) : []), { id: null, name: q }];
  const pick = (i: number) => {
    const r = rows[i];
    if (r && r.name) props.command(r);
  };
  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (e.key === "ArrowUp") {
        setSel((s) => (s + rows.length - 1) % rows.length);
        return true;
      }
      if (e.key === "ArrowDown") {
        setSel((s) => (s + 1) % rows.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        pick(sel);
        return true;
      }
      return false;
    },
  }));
  return (
    <div className="panel mention-list bgg-list" role="listbox" aria-label={t("Board games on BoardGameGeek")}>
      {full && loading && !games.length ? (
        <div className="bgg-note muted small">
          <LoaderCircle size={14} className="spin" /> {t("Looking on BoardGameGeek…")}
        </div>
      ) : null}
      {full
        ? games.map((g, i) => (
            <button key={g.id} type="button" role="option" aria-selected={i === sel} className={`menu-item bgg-item ${i === sel ? "sel" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}>
              {g.thumb ? (
                <img className="bgg-thumb" src={g.thumb} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="bgg-thumb">
                  <Dices size={16} />
                </span>
              )}
              <span className="ellipsis grow">{g.name}</span>
              {g.year ? <span className="muted small">{g.year}</span> : null}
            </button>
          ))
        : null}
      {full && error ? <div className="bgg-note muted small">{error === "token" ? t("BoardGameGeek didn't accept the site's token.") : t("BoardGameGeek isn't answering just now.")}</div> : null}
      {full && !loading && !error && !games.length ? <div className="bgg-note muted small">{t("No games by that name.")}</div> : null}
      <button type="button" role="option" aria-selected={sel === rows.length - 1} className={`menu-item bgg-item ${sel === rows.length - 1 ? "sel" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(rows.length - 1)}>
        <span className="bgg-thumb">
          <Search size={15} />
        </span>
        <span className="ellipsis grow">{t("Search BoardGameGeek for “{q}”", { q })}</span>
      </button>
      {full ? (
        <a className="bgg-powered" href={BGG} target="_blank" rel="noopener noreferrer" onMouseDown={(e) => e.preventDefault()}>
          {t("Powered by BGG")}
        </a>
      ) : null}
    </div>
  );
});

const key = new PluginKey("bggSuggest");

/** "bgg:" and a name: games to pick from (mode: the site's, Admin → Features & permissions). */
export const BggSuggest = Extension.create<{ mode: BggMode }>({
  name: "bggSuggest",
  addOptions() {
    return { mode: "search" };
  },
  addProseMirrorPlugins() {
    const mode = this.options.mode;
    return [
      Suggestion<Typed, Pick>({
        editor: this.editor,
        pluginKey: key,
        char: "bgg:",
        // (game names have spaces)
        allowSpaces: true,
        items: ({ query }) => (query.trim().length >= 2 && query.length <= 60 ? [{ q: query }] : []),
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [{ type: "bggGame", attrs: { id: props.id, name: props.name.trim() } }, { type: "text", text: " " }])
            .run();
        },
        render: () => {
          let renderer: ReactRenderer<ListHandle, SuggestionProps<Typed, Pick> & { mode: BggMode }> | null = null;
          let box: HTMLDivElement | null = null;
          let at: (() => DOMRect | null) | null | undefined;
          // the games come after the list opens: it grows, so it's placed again (above the text if it no longer fits below)
          let sizes: ResizeObserver | null = null;
          // Enter picks from the list only while it shows
          const showing = (props: SuggestionProps<Typed, Pick>) => {
            mentionOpen.current = props.items.length > 0;
            if (box) box.hidden = !props.items.length;
          };
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(BggList, { props: { ...props, mode }, editor: props.editor });
              box = document.createElement("div");
              box.className = "mention-pop";
              box.appendChild(renderer.element);
              document.body.appendChild(box);
              at = props.clientRect;
              sizes = new ResizeObserver(() => box && place(box, at?.()));
              sizes.observe(box);
              showing(props);
              requestAnimationFrame(() => box && place(box, at?.()));
            },
            onUpdate: (props) => {
              renderer?.updateProps({ ...props, mode });
              at = props.clientRect;
              showing(props);
              if (box) place(box, at?.());
            },
            onKeyDown: (props) => {
              if (!box || box.hidden) return false;
              if (props.event.key === "Escape") {
                box.hidden = true;
                mentionOpen.current = false;
                return true;
              }
              return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              mentionOpen.current = false;
              sizes?.disconnect();
              box?.remove();
              renderer?.destroy();
              box = null;
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
