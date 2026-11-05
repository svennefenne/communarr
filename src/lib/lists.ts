import "server-only";
import crypto from "node:crypto";
import { UserError } from "./errors";
import { db, now, tx } from "./db";
import { notify } from "./notify";
import { cleanHtml, cleanLine } from "./sanitize";
import { indexItem, unindex } from "./search";
import { canPostInGroup, canReadGroup, groupFilter, groupRow, groupScope, memberIdsOf } from "./groups";
import { GHOST, summaries, type User } from "./users";
import { broadcast } from "./hub";
import { commentCounts, groupRefs } from "./posts";
import { clearReactions, reactionsFor } from "./reactions";
import { audit } from "./auth";
import type { ListCard, ListCell, ListColumn, ListColumnType, ListRowView, ListView } from "./contentTypes";
import type { UserSummary } from "./types";

/**
 * Lists (Lists): a table of the author's own making. Its columns each hold one kind of thing (text,
 * a number, a checkbox, a member, a date, a time, a choice) and its rows are filled in by the author
 * or by everyone who sees it. A row is whose it is: the member in its first member column, or else
 * the first to fill it in; with "own rows" on, only they (and the author, and moderators) change it.
 * A list is for everyone, a group, or only its author. Every change goes out live ("list").
 */

export interface ListRow {
  id: number;
  author_id: number;
  title: string;
  description_html: string;
  description_text: string;
  columns_json: string;
  group_id: number | null;
  private: number;
  fill: "members" | "owner";
  add_rows: number;
  own_rows: number;
  auto_rows: number;
  show_all: number;
  created_at: number;
  edited_at: number | null;
  updated_at: number;
}

interface RowRow {
  id: number;
  list_id: number;
  position: number;
  cells_json: string;
  filled_by: number | null;
  updated_by: number | null;
  updated_at: number | null;
}

export class ListError extends UserError {}

export const COLUMN_TYPES: ListColumnType[] = ["text", "number", "check", "member", "date", "time", "choice"];
export const MAX_COLUMNS = 12;
export const MAX_ROWS = 200;
const MAX_CHOICES = 20;

export function listRow(id: number): ListRow | null {
  return (db().prepare("select * from lists where id = ?").get(id) as ListRow | undefined) ?? null;
}

export function canSeeList(u: User, l: ListRow): boolean {
  if (l.private) return l.author_id === u.id;
  if (!l.group_id) return true;
  const g = groupRow(l.group_id);
  return !!g && canReadGroup(u, g);
}

/** its author (and moderators): the columns, rows and settings */
const owns = (u: User, l: ListRow) => l.author_id === u.id || u.isMod;
export const canFill = (u: User, l: ListRow) => canSeeList(u, l) && (owns(u, l) || l.fill === "members");
// (automatic rows: whoever fills it in adds rows, with Tab in the last cell)
const canAddRows = (u: User, l: ListRow) => owns(u, l) || (canFill(u, l) && (!!l.add_rows || !!l.auto_rows));

export function columnsOf(l: Pick<ListRow, "columns_json">): ListColumn[] {
  try {
    const v = JSON.parse(l.columns_json);
    return Array.isArray(v) ? (v as ListColumn[]) : [];
  } catch {
    return [];
  }
}

function cellsOf(r: Pick<RowRow, "cells_json">): Record<string, ListCell> {
  try {
    const v = JSON.parse(r.cells_json);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** whose row it is: the member in its first member column, or else the first to fill it in */
function ownerOf(cols: ListColumn[], cells: Record<string, ListCell>, filledBy: number | null): number | null {
  const who = cols.find((c) => c.type === "member" && typeof cells[c.id] === "number");
  return who ? (cells[who.id] as number) : filledBy;
}

function canEditRow(u: User, l: ListRow, cols: ListColumn[], r: RowRow): boolean {
  if (owns(u, l)) return true;
  if (!canFill(u, l)) return false;
  if (!l.own_rows) return true;
  const who = ownerOf(cols, cellsOf(r), r.filled_by);
  return who == null || who === u.id;
}

const newId = () => crypto.randomBytes(6).toString("hex");

// notifications about a row or a list: one to each person in ten minutes, so changing several cells
// (or the list's columns, one save after another) makes one
const told = new Map<string, number>();
function firstIn10Minutes(key: string): boolean {
  const t = Date.now();
  if ((told.get(key) ?? 0) > t - 10 * 60_000) return false;
  if (told.size > 5000) for (const [k, at] of told) if (at < t - 10 * 60_000) told.delete(k);
  told.set(key, t);
  return true;
}

/** Tell a row's member (the one it's for) that someone else changed, emptied or took it away. */
function tellRowsMember(u: User, l: ListRow, who: number | null, rowId: number, title: string) {
  // (per what happened: changed, then emptied, are two)
  if (!who || who === u.id || !firstIn10Minutes(`row:${who}:${rowId}:${title}`)) return;
  notify([who], { kind: "listRow", actorId: u.id, title, vars: { name: u.name, title: l.title }, url: `/lists/${l.id}`, tag: `list-${l.id}` });
}

function cleanChoices(list: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of Array.isArray(list) ? list : []) {
    const l = cleanLine(o, 60);
    if (l && !seen.has(l.toLowerCase())) {
      seen.add(l.toLowerCase());
      out.push(l);
    }
  }
  return out.slice(0, MAX_CHOICES);
}

/** Columns as given: each with a name and a kind; ids kept for the ones it had, new ones for the rest. */
function cleanColumns(input: unknown, before: ListColumn[] = []): ListColumn[] {
  const out: ListColumn[] = [];
  const seen = new Set<string>();
  for (const c of (Array.isArray(input) ? input : []).slice(0, MAX_COLUMNS) as Partial<ListColumn>[]) {
    const name = cleanLine(c?.name, 60);
    if (!name) throw new ListError("Give every column a name.");
    const type = COLUMN_TYPES.includes(c?.type as ListColumnType) ? (c!.type as ListColumnType) : "text";
    const id = typeof c?.id === "string" && !seen.has(c.id) && before.some((b) => b.id === c.id) ? c.id : newId();
    seen.add(id);
    const col: ListColumn = { id, name, type };
    if (type === "choice") {
      col.options = cleanChoices(c?.options);
      if (!col.options.length) throw new ListError("Give “{name}” its choices.", { name });
    }
    out.push(col);
  }
  if (!out.length) throw new ListError("A list needs at least one column.");
  return out;
}

/** A cell's value as its column holds it, or null (empty). */
function cleanCell(col: ListColumn, v: unknown): ListCell | null {
  if (v === null || v === undefined || v === "" || v === false) return null;
  switch (col.type) {
    case "text":
      return cleanLine(v, 300) || null;
    case "number": {
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      return Number.isFinite(n) && Math.abs(n) < 1e12 ? Math.round(n * 10_000) / 10_000 : null;
    }
    case "check":
      return v === true ? true : null;
    case "member": {
      const id = Number(v);
      return Number.isInteger(id) && db().prepare("select 1 from users where id = ? and banned = 0").get(id) ? id : null;
    }
    case "date": {
      const s = String(v);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
      const d = new Date(`${s}T12:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
    }
    case "time": {
      const m = /^(\d{2}):(\d{2})$/.exec(String(v));
      return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? String(v) : null;
    }
    case "choice": {
      const s = String(v);
      return col.options?.includes(s) ? s : null;
    }
  }
}

/** What a row still holds once its columns have changed (gone, another kind, other choices). */
function fitCells(cols: ListColumn[], cells: Record<string, ListCell>): Record<string, ListCell> {
  const out: Record<string, ListCell> = {};
  for (const c of cols) {
    if (!(c.id in cells)) continue;
    const v = cleanCell(c, cells[c.id]);
    if (v !== null) out[c.id] = v;
  }
  return out;
}

const filled = (cells: Record<string, ListCell>) => Object.keys(cells).length > 0;

/** Automatic rows: an empty row stays last, for whoever fills it in next (up to MAX_ROWS). */
function keepEmptyLast(l: Pick<ListRow, "id" | "auto_rows">) {
  if (!l.auto_rows) return;
  const last = db().prepare("select position, cells_json from list_rows where list_id = ? order by position desc, id desc limit 1").get(l.id) as Pick<RowRow, "position" | "cells_json"> | undefined;
  if (last && !filled(cellsOf(last))) return;
  if ((db().prepare("select count(*) n from list_rows where list_id = ?").get(l.id) as { n: number }).n >= MAX_ROWS) return;
  db().prepare("insert into list_rows (list_id, position) values (?, ?)").run(l.id, (last?.position ?? -1) + 1);
}

function rowsOf(listId: number): RowRow[] {
  return db().prepare("select * from list_rows where list_id = ? order by position, id").all(listId) as RowRow[];
}

/** Who finds a list in search: its group, everyone, or (only me) its author. */
function scopeOf(l: Pick<ListRow, "group_id" | "private" | "author_id">) {
  return l.private ? `u:${l.author_id}` : groupScope(l.group_id);
}

/** In search: its title, what it's about, its columns and what's been written in it. */
function reindex(id: number) {
  const l = listRow(id);
  if (!l) return;
  const cols = columnsOf(l);
  const words = rowsOf(id).flatMap((r) => {
    const cells = cellsOf(r);
    return cols.filter((c) => c.type === "text" || c.type === "choice").map((c) => cells[c.id]).filter((v): v is string => typeof v === "string");
  });
  indexItem("list", id, scopeOf(l), l.author_id, l.created_at, l.title, [l.description_text, cols.map((c) => c.name).join(" · "), words.join(" · ")].join(" ").slice(0, 20_000));
}

export function toListCards(u: User, rows: ListRow[]): ListCard[] {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const authors = summaries(rows.map((r) => r.author_id));
  const groups = groupRefs(rows.map((r) => r.group_id));
  const comments = commentCounts("list", ids);
  const reacts = reactionsFor("list", ids, u.id);
  const counts = new Map(
    (
      db()
        .prepare(`select list_id, count(*) n, sum(filled_by is not null) filled, sum(filled_by = ?) mine from list_rows where list_id in (${ids.map(() => "?").join(",")}) group by list_id`)
        .all(u.id, ...ids) as { list_id: number; n: number; filled: number; mine: number }[]
    ).map((c) => [c.list_id, c]),
  );
  return rows.map((r) => {
    const c = counts.get(r.id);
    return {
      id: r.id,
      title: r.title,
      text: r.description_text.slice(0, 300),
      author: authors.get(r.author_id) ?? GHOST,
      group: r.group_id ? (groups.get(r.group_id) ?? null) : null,
      private: !!r.private,
      columns: columnsOf(r),
      rows: c?.n ?? 0,
      autoRows: !!r.auto_rows,
      showAll: !!r.show_all,
      filled: c?.filled ?? 0,
      mine: c?.mine ?? 0,
      canFill: canFill(u, r),
      comments: comments.get(r.id) ?? 0,
      reactions: reacts.get(r.id) ?? [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

function rowView(u: User, l: ListRow, cols: ListColumn[], r: RowRow, people: Map<number, UserSummary>): ListRowView {
  const cells = cellsOf(r);
  const who = ownerOf(cols, cells, r.filled_by);
  return { id: r.id, cells, filledBy: who != null ? (people.get(who) ?? null) : null, canEdit: canEditRow(u, l, cols, r) };
}

export function getList(u: User, id: number): ListView | null {
  const l = listRow(id);
  if (!l || !canSeeList(u, l)) return null;
  const cols = columnsOf(l);
  const rows = rowsOf(id);
  const ids = new Set<number>();
  for (const r of rows) {
    const cells = cellsOf(r);
    if (r.filled_by) ids.add(r.filled_by);
    for (const c of cols) if (c.type === "member" && typeof cells[c.id] === "number") ids.add(cells[c.id] as number);
  }
  const people = summaries(ids);
  return {
    ...toListCards(u, [l])[0],
    html: l.description_html,
    fill: l.fill,
    addRows: !!l.add_rows,
    ownRows: !!l.own_rows,
    rowList: rows.map((r) => rowView(u, l, cols, r, people)),
    people: Object.fromEntries(people),
    canEdit: owns(u, l),
    canAddRows: canAddRows(u, l),
  };
}

/** The lists someone can see, the latest changed first; mine: their own; todo: ones they can fill in and haven't. */
export function listLists(u: User, o: { tab?: "all" | "mine" | "todo"; groupId?: number; limit?: number } = {}): ListCard[] {
  const gf = groupFilter(u);
  const where = [gf.sql, "(private = 0 or author_id = ?)"];
  const params: unknown[] = [...gf.params, u.id];
  if (o.tab === "mine") {
    where.push("author_id = ?");
    params.push(u.id);
  }
  if (o.groupId) {
    where.push("group_id = ?");
    params.push(o.groupId);
  }
  const rows = db()
    .prepare(`select * from lists where ${where.join(" and ")} order by updated_at desc limit ?`)
    .all(...params, o.limit ?? 60) as ListRow[];
  const cards = toListCards(u, rows);
  return o.tab === "todo" ? cards.filter((c) => c.canFill && !c.mine && c.author.id !== u.id) : cards;
}

export interface ListInput {
  title: string;
  html?: string;
  columns: Partial<ListColumn>[];
  /** how many rows it has (to begin with; when changed, empty rows are added or taken away at the end) */
  rows?: number;
  /** automatic rows: it starts with one empty row, and an empty row stays last as it's filled in (rows is left alone) */
  autoRows?: boolean;
  /** shown whole on its card in Lists */
  showAll?: boolean;
  groupId?: number | null;
  private?: boolean;
  fill?: "members" | "owner";
  addRows?: boolean;
  ownRows?: boolean;
}

export function createList(u: User, o: ListInput): number {
  const title = cleanLine(o.title, 120);
  if (!title) throw new ListError("Give the list a title.");
  const cols = cleanColumns(o.columns);
  let groupId: number | null = null;
  if (o.groupId) {
    const g = groupRow(o.groupId);
    if (!g || !canPostInGroup(u, g)) throw new ListError("You can only make lists in groups you're in.");
    groupId = g.id;
  }
  const priv = !groupId && !!o.private;
  const c = cleanHtml(o.html || "");
  const auto = !!o.autoRows;
  const n = auto ? 1 : Math.max(1, Math.min(MAX_ROWS, Math.round(Number(o.rows) || 10)));
  const t = now();
  const id = tx(() => {
    const id = Number(
      db()
        .prepare(
          "insert into lists (author_id, title, description_html, description_text, columns_json, group_id, private, fill, add_rows, own_rows, auto_rows, show_all, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(u.id, title, c.html, c.text, JSON.stringify(cols), groupId, priv ? 1 : 0, o.fill === "owner" ? "owner" : "members", o.addRows === false ? 0 : 1, o.ownRows === false ? 0 : 1, auto ? 1 : 0, o.showAll ? 1 : 0, t, t).lastInsertRowid,
    );
    const add = db().prepare("insert into list_rows (list_id, position) values (?, ?)");
    for (let i = 0; i < n; i++) add.run(id, i);
    return id;
  });
  reindex(id);
  const url = `/lists/${id}`;
  if (groupId) notify(memberIdsOf(groupId), { kind: "group", actorId: u.id, title: "New list in {group}: {title}", vars: { group: groupRow(groupId)!.name, title }, url });
  // one everyone sees: everyone hears (a group's list is the group's news, above)
  else if (!priv) {
    const all = (db().prepare("select id from users where banned = 0").all() as { id: number }[]).map((r) => r.id);
    notify(all, { kind: "listNew", actorId: u.id, title: "{name} made a list: {title}", vars: { name: u.name, title }, url, tag: `list-${id}` });
  }
  if (!priv) broadcast("feed", { type: "list", id, by: u.id, group: groupId });
  return id;
}

export function updateList(u: User, id: number, o: Partial<ListInput>) {
  const l = listRow(id);
  if (!l) throw new ListError("That list is gone.");
  if (!owns(u, l)) throw new ListError("Only the one who made the list can change it.");
  const title = o.title !== undefined ? cleanLine(o.title, 120) || l.title : l.title;
  const c = o.html !== undefined ? cleanHtml(o.html) : null;
  const cols = o.columns ? cleanColumns(o.columns, columnsOf(l)) : columnsOf(l);
  const priv = l.group_id ? 0 : o.private === undefined ? l.private : o.private ? 1 : 0;
  const auto = o.autoRows === undefined ? l.auto_rows : o.autoRows ? 1 : 0;
  // who's on it (a row of theirs), to hear that it changed
  const was = columnsOf(l);
  const on = new Set(rowsOf(id).flatMap((r) => ownerOf(was, cellsOf(r), r.filled_by) ?? []).filter((who) => who !== u.id && who !== l.author_id));
  tx(() => {
    db()
      .prepare("update lists set title = ?, description_html = ?, description_text = ?, columns_json = ?, private = ?, fill = ?, add_rows = ?, own_rows = ?, auto_rows = ?, show_all = ?, edited_at = ?, updated_at = ? where id = ?")
      .run(
        title,
        c ? c.html : l.description_html,
        c ? c.text : l.description_text,
        JSON.stringify(cols),
        priv,
        o.fill === undefined ? l.fill : o.fill === "owner" ? "owner" : "members",
        o.addRows === undefined ? l.add_rows : o.addRows ? 1 : 0,
        o.ownRows === undefined ? l.own_rows : o.ownRows ? 1 : 0,
        auto,
        o.showAll === undefined ? l.show_all : o.showAll ? 1 : 0,
        now(),
        now(),
        id,
      );
    // what's written stays where its column still is (and still fits it)
    const rows = rowsOf(id);
    for (const r of rows) {
      const cells = fitCells(cols, cellsOf(r));
      if (JSON.stringify(cells) !== r.cells_json) db().prepare("update list_rows set cells_json = ?, filled_by = ? where id = ?").run(JSON.stringify(cells), filled(cells) ? r.filled_by : null, r.id);
    }
    // more rows: empty ones at the end; fewer: empty ones from the end (filled ones stay)
    if (o.rows !== undefined && !auto) {
      const want = Math.max(1, Math.min(MAX_ROWS, Math.round(Number(o.rows) || rows.length)));
      if (want > rows.length) {
        const last = rows.length ? rows[rows.length - 1].position : -1;
        const add = db().prepare("insert into list_rows (list_id, position) values (?, ?)");
        for (let i = 1; i <= want - rows.length; i++) add.run(id, last + i);
      } else if (want < rows.length) {
        let extra = rows.length - want;
        for (const r of [...rowsOf(id)].reverse()) {
          if (!extra) break;
          if (filled(cellsOf(r))) continue;
          db().prepare("delete from list_rows where id = ?").run(r.id);
          extra--;
        }
      }
    }
    keepEmptyLast({ ...l, auto_rows: auto });
  });
  if (l.author_id !== u.id) audit(u.id, "list changed", `#${id}`, title);
  // (not when only its author sees it now)
  const tell = priv ? [] : [...on].filter((who) => firstIn10Minutes(`list:${who}:${id}`));
  if (tell.length) notify(tell, { kind: "listEdit", actorId: u.id, title: "{name} changed the list “{title}”", vars: { name: u.name, title }, url: `/lists/${id}`, tag: `list-${id}` });
  reindex(id);
  // comments follow the list ("only me": only its author finds them in search)
  db()
    .prepare("update search_index set scope = ? where kind = 'comment' and ref in (select id from comments where target_type = 'list' and target_id = ?)")
    .run(scopeOf({ group_id: l.group_id, private: priv, author_id: l.author_id }), id);
  broadcast("list", { id });
}

function rowOf(l: ListRow, rowId: number): RowRow {
  const r = db().prepare("select * from list_rows where id = ? and list_id = ?").get(rowId, l.id) as RowRow | undefined;
  if (!r) throw new ListError("That row is gone.");
  return r;
}

function seen(u: User, id: number): ListRow {
  const l = listRow(id);
  if (!l || !canSeeList(u, l)) throw new ListError("That list is gone.");
  return l;
}

/** Fill in (or empty) one cell. Returns the row as it is now. */
export function setCell(u: User, id: number, rowId: number, colId: string, value: unknown): ListRowView {
  const l = seen(u, id);
  if (!canFill(u, l)) throw new ListError("Only the one who made this list fills it in.");
  const cols = columnsOf(l);
  const col = cols.find((c) => c.id === colId);
  if (!col) throw new ListError("That column is gone.");
  const v = cleanCell(col, value);
  let was: { who: number | null; filled: boolean } = { who: null, filled: false };
  const row = tx(() => {
    const r = rowOf(l, rowId);
    if (!canEditRow(u, l, cols, r)) throw new ListError("Someone else filled in that row.");
    const cells = cellsOf(r);
    was = { who: ownerOf(cols, cells, r.filled_by), filled: filled(cells) };
    if (v === null) delete cells[col.id];
    else cells[col.id] = v;
    const has = filled(cells);
    const t = now();
    db().prepare("update list_rows set cells_json = ?, filled_by = ?, updated_by = ?, updated_at = ? where id = ?").run(JSON.stringify(cells), has ? (r.filled_by ?? u.id) : null, u.id, t, r.id);
    db().prepare("update lists set updated_at = ? where id = ?").run(t, id);
    keepEmptyLast(l);
    return rowOf(l, rowId);
  });
  reindex(id);
  broadcast("list", { id });
  const cells = cellsOf(row);
  const who = ownerOf(cols, cells, row.filled_by);
  // an empty row filled in: its author hears (once a row); someone's own row changed by another: they hear
  if (!was.filled && filled(cells)) notify([l.author_id], { kind: "listFill", actorId: u.id, title: "{name} filled in a row in “{title}”", vars: { name: u.name, title: l.title }, url: `/lists/${id}`, tag: `list-${id}` });
  else if (was.filled) tellRowsMember(u, l, was.who, rowId, "{name} changed your row in “{title}”");
  return rowView(u, l, cols, row, summaries(who ? [who] : []));
}

/** Empty a row (its own filler, or the author). */
export function clearRow(u: User, id: number, rowId: number) {
  const l = seen(u, id);
  const r = rowOf(l, rowId);
  if (!canEditRow(u, l, columnsOf(l), r)) throw new ListError("Someone else filled in that row.");
  db().prepare("update list_rows set cells_json = '{}', filled_by = null, updated_by = ?, updated_at = ? where id = ?").run(u.id, now(), r.id);
  db().prepare("update lists set updated_at = ? where id = ?").run(now(), id);
  reindex(id);
  broadcast("list", { id });
  if (filled(cellsOf(r))) tellRowsMember(u, l, ownerOf(columnsOf(l), cellsOf(r), r.filled_by), r.id, "{name} emptied your row in “{title}”");
}

/**
 * Empty the whole list (the author, or a moderator): with automatic rows back to one empty row, with a
 * fixed number of rows those rows, emptied. (No one hears about their row: it's the list starting over.)
 */
export function clearList(u: User, id: number) {
  const l = seen(u, id);
  if (!owns(u, l)) throw new ListError("Only the one who made the list can clear it.");
  const t = now();
  tx(() => {
    if (l.auto_rows) {
      db().prepare("delete from list_rows where list_id = ?").run(id);
      keepEmptyLast(l);
    } else db().prepare("update list_rows set cells_json = '{}', filled_by = null, updated_by = ?, updated_at = ? where list_id = ?").run(u.id, t, id);
    db().prepare("update lists set updated_at = ? where id = ?").run(t, id);
  });
  reindex(id);
  broadcast("list", { id });
  if (l.author_id !== u.id) audit(u.id, "list cleared", `#${id}`, l.title);
}

/** Add a row at the end. after: Tab in that row's last cell, so the row after it if there is one already. */
export function addRow(u: User, id: number, after?: number): number {
  const l = seen(u, id);
  if (!canAddRows(u, l)) throw new ListError("Only the one who made this list adds rows.");
  if (after) {
    const r = rowOf(l, after);
    const next = db().prepare("select id from list_rows where list_id = ? and (position > ? or (position = ? and id > ?)) order by position, id limit 1").get(id, r.position, r.position, r.id) as { id: number } | undefined;
    if (next) return next.id;
  }
  const { n, last } = db().prepare("select count(*) n, coalesce(max(position), -1) last from list_rows where list_id = ?").get(id) as { n: number; last: number };
  if (n >= MAX_ROWS) throw new ListError("A list has at most {n} rows.", { n: MAX_ROWS });
  const rowId = Number(db().prepare("insert into list_rows (list_id, position) values (?, ?)").run(id, last + 1).lastInsertRowid);
  db().prepare("update lists set updated_at = ? where id = ?").run(now(), id);
  broadcast("list", { id });
  return rowId;
}

/** Take a row away (the author). */
export function removeRow(u: User, id: number, rowId: number) {
  const l = seen(u, id);
  if (!owns(u, l)) throw new ListError("Only the one who made the list can take rows away.");
  const r = rowOf(l, rowId);
  if ((db().prepare("select count(*) n from list_rows where list_id = ?").get(id) as { n: number }).n <= 1) throw new ListError("A list needs at least one row.");
  db().prepare("delete from list_rows where id = ?").run(r.id);
  keepEmptyLast(l);
  db().prepare("update lists set updated_at = ? where id = ?").run(now(), id);
  reindex(id);
  broadcast("list", { id });
  if (filled(cellsOf(r))) tellRowsMember(u, l, ownerOf(columnsOf(l), cellsOf(r), r.filled_by), r.id, "{name} removed your row from “{title}”");
}

/** Move a row up or down (the author). */
export function moveRow(u: User, id: number, rowId: number, by: -1 | 1) {
  const l = seen(u, id);
  if (!owns(u, l)) throw new ListError("Only the one who made the list can move rows.");
  const rows = rowsOf(id);
  const i = rows.findIndex((r) => r.id === rowId);
  const j = i + by;
  if (i < 0 || j < 0 || j >= rows.length) return;
  tx(() => {
    // (positions made tidy: 0, 1, 2, … with the two swapped)
    const order = rows.map((r) => r.id);
    [order[i], order[j]] = [order[j], order[i]];
    const put = db().prepare("update list_rows set position = ? where id = ?");
    order.forEach((rid, k) => put.run(k, rid));
    keepEmptyLast(l);
  });
  broadcast("list", { id });
}

export function deleteList(u: User, id: number) {
  const l = listRow(id);
  if (!l) return;
  if (!owns(u, l)) throw new ListError("Only the one who made the list can delete it.");
  for (const c of db().prepare("select id from comments where target_type = 'list' and target_id = ?").all(id) as { id: number }[]) {
    clearReactions("comment", c.id);
    unindex("comment", c.id);
  }
  db().prepare("delete from comments where target_type = 'list' and target_id = ?").run(id);
  db().prepare("delete from lists where id = ?").run(id);
  db().prepare("delete from bookmarks where target_type = 'list' and target_id = ?").run(id);
  clearReactions("list", id);
  unindex("list", id);
  if (l.author_id !== u.id) audit(u.id, "list deleted", `#${id}`, l.title);
  broadcast("list", { id, gone: true });
}
