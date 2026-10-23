import "server-only";
import { UserError } from "./errors";
import { db, now, tx } from "./db";
import { notify } from "./notify";
import { reactionsFor, clearReactions } from "./reactions";
import { cleanHtml, cleanLine } from "./sanitize";
import { indexItem, unindex } from "./search";
import { canPostInGroup, canReadGroup, groupFilter, groupRow, groupScope, memberIdsOf } from "./groups";
import { GHOST, summaries, userByName, type User } from "./users";
import { broadcast } from "./hub";
import { commentCounts, groupRefs } from "./posts";
import type { PollView } from "./contentTypes";

export interface PollRow {
  id: number;
  author_id: number;
  question: string;
  description_html: string;
  description_text: string;
  multiple: number;
  max_choices: number | null;
  anonymous: number;
  allow_change: number;
  allow_add: number;
  results: "always" | "after_vote" | "after_close";
  closes_at: number | null;
  closed: number;
  group_id: number | null;
  created_at: number;
  edited_at: number | null;
}

export class PollError extends UserError {}

export function pollRow(id: number): PollRow | null {
  return (db().prepare("select * from polls where id = ?").get(id) as PollRow | undefined) ?? null;
}

export function canSeePoll(u: User, p: PollRow) {
  if (!p.group_id) return true;
  const g = groupRow(p.group_id);
  return !!g && canReadGroup(u, g);
}

/** Close polls whose time is up, and tell the people who voted. */
export function closeDuePolls() {
  const due = db().prepare("select * from polls where closed = 0 and closes_at is not null and closes_at <= ?").all(now()) as PollRow[];
  for (const p of due) {
    db().prepare("update polls set closed = 1 where id = ?").run(p.id);
    const voters = (db().prepare("select distinct user_id from poll_votes where poll_id = ?").all(p.id) as { user_id: number }[]).map((r) => r.user_id);
    notify([...voters, p.author_id], { kind: "poll", title: `The poll is closed: ${p.question}`, body: "See how it ended.", url: `/polls/${p.id}` });
  }
}

export function toPollViews(u: User, rows: PollRow[]): PollView[] {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const authors = summaries(rows.map((r) => r.author_id));
  const groups = groupRefs(rows.map((r) => r.group_id));
  const reacts = reactionsFor("poll", ids, u.id);
  const counts = commentCounts("poll", ids);
  const q = ids.map(() => "?").join(",");
  const options = db().prepare(`select * from poll_options where poll_id in (${q}) order by position, id`).all(...ids) as { id: number; poll_id: number; label: string }[];
  const votes = db().prepare(`select poll_id, option_id, user_id from poll_votes where poll_id in (${q}) order by created_at`).all(...ids) as { poll_id: number; option_id: number; user_id: number }[];
  const people = summaries(votes.map((v) => v.user_id));
  return rows.map((r) => {
    const closed = !!r.closed || (r.closes_at != null && r.closes_at <= now());
    const pv = votes.filter((v) => v.poll_id === r.id);
    const voted = pv.some((v) => v.user_id === u.id);
    const isAuthor = r.author_id === u.id;
    const show = r.results === "always" || isAuthor || closed || (r.results === "after_vote" && voted);
    return {
      id: r.id,
      question: r.question,
      html: r.description_html,
      author: authors.get(r.author_id) ?? GHOST,
      group: r.group_id ? groups.get(r.group_id) ?? null : null,
      multiple: !!r.multiple,
      maxChoices: r.max_choices,
      anonymous: !!r.anonymous,
      allowChange: !!r.allow_change,
      allowAdd: !!r.allow_add,
      results: r.results,
      closesAt: r.closes_at,
      closed,
      createdAt: r.created_at,
      totalVoters: new Set(pv.map((v) => v.user_id)).size,
      voted,
      showResults: show,
      comments: counts.get(r.id) ?? 0,
      reactions: reacts.get(r.id) ?? [],
      canEdit: isAuthor || u.isMod,
      options: options
        .filter((o) => o.poll_id === r.id)
        .map((o) => {
          const ov = pv.filter((v) => v.option_id === o.id);
          return {
            id: o.id,
            label: o.label,
            votes: show ? ov.length : 0,
            mine: ov.some((v) => v.user_id === u.id),
            voters: show && !r.anonymous ? ov.map((v) => people.get(v.user_id)!).filter(Boolean) : [],
          };
        }),
    };
  });
}

export function getPoll(u: User, id: number): PollView | null {
  closeDuePolls();
  const p = pollRow(id);
  if (!p || !canSeePoll(u, p)) return null;
  return toPollViews(u, [p])[0];
}

export function listPolls(u: User, o: { state?: "open" | "closed" | "all"; groupId?: number; authorId?: number; before?: number; limit?: number } = {}): PollView[] {
  closeDuePolls();
  const gf = groupFilter(u);
  const where = [gf.sql];
  const params: unknown[] = [...gf.params];
  if (o.state === "open") where.push("closed = 0");
  if (o.state === "closed") where.push("closed = 1");
  if (o.groupId) {
    where.push("group_id = ?");
    params.push(o.groupId);
  }
  if (o.authorId) {
    where.push("author_id = ?");
    params.push(o.authorId);
  }
  if (o.before) {
    where.push("created_at < ?");
    params.push(o.before);
  }
  const rows = db().prepare(`select * from polls where ${where.join(" and ")} order by closed, created_at desc limit ?`).all(...params, o.limit ?? 30) as PollRow[];
  return toPollViews(u, rows);
}

export interface PollInput {
  question: string;
  html?: string;
  options: string[];
  multiple?: boolean;
  maxChoices?: number | null;
  anonymous?: boolean;
  allowChange?: boolean;
  allowAdd?: boolean;
  results?: "always" | "after_vote" | "after_close";
  closesAt?: number | null;
  groupId?: number | null;
}

function cleanOptions(list: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of list) {
    const l = cleanLine(o, 120);
    if (l && !seen.has(l.toLowerCase())) {
      seen.add(l.toLowerCase());
      out.push(l);
    }
  }
  return out.slice(0, 30);
}

export function createPoll(u: User, o: PollInput): number {
  const question = cleanLine(o.question, 200);
  if (!question) throw new PollError("Ask a question.");
  const options = cleanOptions(o.options);
  if (options.length < 2) throw new PollError("Give at least two choices.");
  let groupId: number | null = null;
  if (o.groupId) {
    const g = groupRow(o.groupId);
    if (!g || !canPostInGroup(u, g)) throw new PollError("You can only start polls in groups you're in.");
    groupId = g.id;
  }
  const c = cleanHtml(o.html || "");
  const closesAt = o.closesAt && o.closesAt > now() ? o.closesAt : null;
  const results = o.results && ["always", "after_vote", "after_close"].includes(o.results) ? o.results : "always";
  const multiple = !!o.multiple;
  const max = multiple && o.maxChoices && o.maxChoices > 1 ? Math.min(o.maxChoices, options.length) : null;
  const id = tx(() => {
    const t = now();
    const id = Number(
      db()
        .prepare("insert into polls (author_id, question, description_html, description_text, multiple, max_choices, anonymous, allow_change, allow_add, results, closes_at, group_id, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(u.id, question, c.html, c.text, multiple ? 1 : 0, max, o.anonymous ? 1 : 0, o.allowChange === false ? 0 : 1, o.allowAdd ? 1 : 0, results, closesAt, groupId, t).lastInsertRowid,
    );
    options.forEach((l, i) => db().prepare("insert into poll_options (poll_id, label, position) values (?, ?, ?)").run(id, l, i));
    indexItem("poll", id, groupScope(groupId), u.id, t, question, `${options.join(" · ")} ${c.text}`);
    return id;
  });
  const url = `/polls/${id}`;
  const mentioned = c.mentions.map((n) => userByName(n)?.id).filter((x): x is number => !!x);
  if (mentioned.length) notify(mentioned, { kind: "mention", actorId: u.id, title: `${u.name} mentioned you in a poll`, body: question, url });
  if (groupId) notify(memberIdsOf(groupId).filter((x) => !mentioned.includes(x)), { kind: "group", actorId: u.id, title: `New poll in ${groupRow(groupId)!.name}: ${question}`, url });
  broadcast("feed", { type: "poll", id, by: u.id, group: groupId });
  return id;
}

export function updatePoll(u: User, id: number, o: Partial<PollInput> & { options?: string[] }) {
  const p = pollRow(id);
  if (!p) throw new PollError("That poll is gone.");
  if (p.author_id !== u.id && !u.isMod) throw new PollError("Only the one who asked can change the poll.");
  const question = o.question !== undefined ? cleanLine(o.question, 200) || p.question : p.question;
  const c = o.html !== undefined ? cleanHtml(o.html) : null;
  const closesAt = o.closesAt === undefined ? p.closes_at : o.closesAt;
  tx(() => {
    db()
      .prepare("update polls set question = ?, description_html = ?, description_text = ?, closes_at = ?, closed = ?, anonymous = ?, allow_change = ?, allow_add = ?, results = ?, edited_at = ? where id = ?")
      .run(
        question,
        c ? c.html : p.description_html,
        c ? c.text : p.description_text,
        closesAt,
        closesAt && closesAt > now() ? 0 : p.closed,
        // a poll can become anonymous, never the other way round (people voted thinking it was)
        o.anonymous === true ? 1 : p.anonymous,
        o.allowChange === undefined ? p.allow_change : o.allowChange ? 1 : 0,
        o.allowAdd === undefined ? p.allow_add : o.allowAdd ? 1 : 0,
        o.results && ["always", "after_vote", "after_close"].includes(o.results) ? o.results : p.results,
        now(),
        id,
      );
    if (o.options) {
      // keep options people voted for; add new ones; drop unvoted ones that were removed
      const existing = db().prepare("select id, label from poll_options where poll_id = ?").all(id) as { id: number; label: string }[];
      const wanted = cleanOptions(o.options);
      if (wanted.length < 2) throw new PollError("Give at least two choices.");
      wanted.forEach((label, i) => {
        const ex = existing.find((e) => e.label.toLowerCase() === label.toLowerCase());
        if (ex) db().prepare("update poll_options set position = ?, label = ? where id = ?").run(i, label, ex.id);
        else db().prepare("insert into poll_options (poll_id, label, position) values (?, ?, ?)").run(id, label, i);
      });
      for (const e of existing) {
        if (wanted.some((w) => w.toLowerCase() === e.label.toLowerCase())) continue;
        const votes = (db().prepare("select count(*) n from poll_votes where option_id = ?").get(e.id) as { n: number }).n;
        if (!votes) db().prepare("delete from poll_options where id = ?").run(e.id);
      }
    }
  });
  const opts = (db().prepare("select label from poll_options where poll_id = ?").all(id) as { label: string }[]).map((r) => r.label);
  indexItem("poll", id, groupScope(p.group_id), p.author_id, p.created_at, question, `${opts.join(" · ")} ${c ? c.text : p.description_text}`);
}

export function vote(u: User, id: number, optionIds: number[]) {
  const p = pollRow(id);
  if (!p || !canSeePoll(u, p)) throw new PollError("That poll is gone.");
  if (p.closed || (p.closes_at && p.closes_at <= now())) throw new PollError("The poll is closed.");
  const valid = new Set((db().prepare("select id from poll_options where poll_id = ?").all(id) as { id: number }[]).map((r) => r.id));
  const picked = [...new Set(optionIds)].filter((o) => valid.has(o));
  if (!p.multiple && picked.length > 1) throw new PollError("Pick one.");
  if (p.max_choices && picked.length > p.max_choices) throw new PollError(`Pick at most ${p.max_choices}.`);
  const had = db().prepare("select 1 from poll_votes where poll_id = ? and user_id = ?").get(id, u.id);
  if (had && !p.allow_change) throw new PollError("You've voted, and this poll doesn't allow changing it.");
  tx(() => {
    db().prepare("delete from poll_votes where poll_id = ? and user_id = ?").run(id, u.id);
    const t = now();
    for (const o of picked) db().prepare("insert into poll_votes (poll_id, option_id, user_id, created_at) values (?, ?, ?, ?)").run(id, o, u.id, t);
  });
  broadcast("poll", { id });
}

export function addOption(u: User, id: number, label: string) {
  const p = pollRow(id);
  if (!p || !canSeePoll(u, p)) throw new PollError("That poll is gone.");
  if (!p.allow_add && p.author_id !== u.id) throw new PollError("This poll doesn't take new choices.");
  if (p.closed) throw new PollError("The poll is closed.");
  const l = cleanLine(label, 120);
  if (!l) throw new PollError("Write the choice.");
  const exists = db().prepare("select 1 from poll_options where poll_id = ? and lower(label) = lower(?)").get(id, l);
  if (exists) throw new PollError("That choice is already there.");
  const n = (db().prepare("select count(*) n from poll_options where poll_id = ?").get(id) as { n: number }).n;
  if (n >= 30) throw new PollError("That's enough choices.");
  db().prepare("insert into poll_options (poll_id, label, position, added_by) values (?, ?, ?, ?)").run(id, l, n, u.id);
  broadcast("poll", { id });
}

export function closePoll(u: User, id: number, closed: boolean) {
  const p = pollRow(id);
  if (!p) return;
  if (p.author_id !== u.id && !u.isMod) throw new PollError("Only the one who asked can close the poll.");
  db().prepare("update polls set closed = ?, closes_at = case when ? = 0 and closes_at <= ? then null else closes_at end where id = ?").run(closed ? 1 : 0, closed ? 1 : 0, now(), id);
  if (closed) {
    const voters = (db().prepare("select distinct user_id from poll_votes where poll_id = ?").all(id) as { user_id: number }[]).map((r) => r.user_id);
    notify(voters, { kind: "poll", actorId: u.id, title: `The poll is closed: ${p.question}`, body: "See how it ended.", url: `/polls/${id}` });
  }
  broadcast("poll", { id });
}

export function deletePoll(u: User, id: number) {
  const p = pollRow(id);
  if (!p) return;
  if (p.author_id !== u.id && !u.isMod) throw new PollError("Only the one who asked can delete the poll.");
  db().prepare("delete from polls where id = ?").run(id);
  db().prepare("delete from comments where target_type = 'poll' and target_id = ?").run(id);
  db().prepare("delete from bookmarks where target_type = 'poll' and target_id = ?").run(id);
  clearReactions("poll", id);
  unindex("poll", id);
}
