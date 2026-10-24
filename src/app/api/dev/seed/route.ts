import sharp from "sharp";
import { db } from "@/lib/db";
import { createUser } from "@/lib/accounts";
import { userByName, type User } from "@/lib/users";
import { createPost } from "@/lib/posts";
import { addComment } from "@/lib/comments";
import { toggleReaction } from "@/lib/reactions";
import { createThread, reply } from "@/lib/forum";
import { createPoll, vote } from "@/lib/polls";
import { createEvent, rsvp } from "@/lib/events";
import { createGroup, joinGroup } from "@/lib/groups";
import { createRoom, dmRoom, joinRoom, sendMessage } from "@/lib/chat";
import { saveUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * POST /api/dev/seed: fills an empty site with friends and things to look at, for trying Hooden out.
 * Only with HOODEN_DEV_SEED=1 in the environment; never on a real site.
 */
export async function POST() {
  if (process.env.HOODEN_DEV_SEED !== "1") return new Response("Not here", { status: 404 });
  if (db().prepare("select count(*) n from users").get() && (db().prepare("select count(*) n from users").get() as { n: number }).n > 1) return Response.json({ ok: false, why: "already seeded" });
  const people: [string, string][] = [
    ["anna", "Anna Lind"],
    ["bjorn", "Björn Ek"],
    ["cleo", "Cleo Park"],
    ["dani", "Dani Ortiz"],
    ["erik", "Erik Berg"],
    ["fia", "Fia Holm"],
  ];
  for (const [u, n] of people) await createUser({ username: u, alias: n, password: "testpass123" });
  const U = (n: string) => userByName(n) as User;
  const [me, anna, bjorn, cleo, dani, erik, fia] = ["fenne", "anna", "bjorn", "cleo", "dani", "erik", "fia"].map(U);
  const statuses: [User, string, string][] = [
    [anna, "🎮", "Up for a game tonight"],
    [bjorn, "🏖️", "On holiday till Monday"],
    [cleo, "🎧", "Headphones on"],
  ];
  for (const [u, e, t] of statuses) db().prepare("update users set status_emoji = ?, status_text = ? where id = ?").run(e, t, u.id);

  const pic = async (u: User, colors: [string, string], label: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs><rect width="1200" height="700" fill="url(#g)"/><circle cx="900" cy="420" r="210" fill="#ffffff" opacity=".18"/><text x="80" y="600" font-family="sans-serif" font-size="96" font-weight="800" fill="#fff" opacity=".9">${label}</text></svg>`;
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    return saveUpload(u.id, buf, "image", `${label}.png`);
  };

  const gamers = createGroup(anna, { name: "Board Gamers", tagline: "Dice, cards and snacks every other Friday", privacy: "open", color: "#d65a2b", descriptionHtml: "<p>Everything board games: what to play next, who brings what, and the eternal <strong>Catan</strong> debate.</p>" });
  const climb = createGroup(dani, { name: "Climbing Crew", tagline: "Bouldering on Tuesdays", privacy: "closed", color: "#4f8f50" });
  createGroup(cleo, { name: "Book Club", tagline: "One book a month, honest opinions", privacy: "secret", color: "#9c5bb5" });
  for (const u of [me, bjorn, cleo, erik]) joinGroup(u, gamers.id);
  db().prepare("insert or ignore into group_members (group_id, user_id, role, joined_at) values (?, ?, 'member', ?)").run(climb.id, fia.id, Date.now());

  const p1 = await pic(bjorn, ["#e2a634", "#d65a2b"], "Sunset at the lake");
  const post1 = createPost(bjorn, {
    html: `<p>Back from the lake house 🌅 What a weekend. <strong>Thanks</strong> to everyone who came!</p><img src="${p1.url}" alt="Sunset at the lake"><p>Next time we bring <em>two</em> grills. @anna you owe me a rematch at kubb.</p>`.replace("@anna", '<span data-type="mention" class="mention" data-id="anna" data-label="Anna Lind">@Anna Lind</span>'),
  });
  addComment(anna, "post", post1, "<p>Rematch accepted. Bring your A game 😤</p>");
  addComment(cleo, "post", post1, "<p>That light! Who took this?</p>");
  for (const [u, e] of [[anna, "❤️"], [cleo, "🔥"], [erik, "❤️"], [me, "😂"]] as [User, string][]) toggleReaction(u.id, "post", post1, e);
  createPost(cleo, { title: "Film night picks", html: '<p>For Saturday, my shortlist:</p><ol><li><p><strong>Arrival</strong>: still the best one</p></li><li><p><span style="color: #e2533a">Mad Max: Fury Road</span> for the loud crowd</p></li><li><p>Something <span style="font-family: var(--ff-caveat), cursive; font-size: 24px">cosy</span> if it rains</p></li></ol><blockquote><p>The best films are the ones you argue about after.</p></blockquote>' });
  createPost(erik, { html: '<p>Anyone know a good bike shop in town? My gears sound like a blender. <a href="https://www.openstreetmap.org" target="_blank">Map of the ones I found</a></p>' });
  createPost(anna, { groupId: gamers.id, html: "<p>Game night idea: we try <strong>Wingspan</strong> this time. I'll teach it! 🐦</p>" });

  const general = db().prepare("select id from forum_categories where slug = 'general'").get() as { id: number };
  const plans = db().prepare("select id from forum_categories where slug = 'plans'").get() as { id: number };
  const t1 = createThread(dani, { categoryId: plans.id, title: "Summer trip 2027: where to?", html: "<p>Let's start early this time. Ideas so far:</p><ul><li><p>Lofoten (hiking, midnight sun)</p></li><li><p>Barcelona (beach, food)</p></li><li><p>A cabin somewhere with no wifi</p></li></ul><p>Dates: sometime in <strong>July</strong>?</p>" });
  reply(erik, t1, "<p>Lofoten gets my vote. I'll bring the camera.</p>");
  reply(fia, t1, "<p>Barcelona! I need sun, not more mountains 😅</p>");
  reply(me, t1, "<p>Why not both? Fly to Barcelona, ferry to… okay no.</p>");
  const t2 = createThread(bjorn, { categoryId: general.id, title: "Best pizza place?", html: "<p>Settle it once and for all.</p>" });
  reply(cleo, t2, "<p>The little one by the station. Not up for debate.</p>");

  const poll = createPoll(dani, { question: "Summer trip: where do we go?", options: ["Lofoten", "Barcelona", "Cabin, no wifi", "Stay home and nap"], multiple: false, closesAt: Date.now() + 5 * 86_400_000, html: "<p>Vote and say why in the comments!</p>" });
  const opts = db().prepare("select id from poll_options where poll_id = ? order by position").all(poll) as { id: number }[];
  vote(erik, poll, [opts[0].id]);
  vote(fia, poll, [opts[1].id]);
  vote(anna, poll, [opts[0].id]);
  vote(bjorn, poll, [opts[2].id]);
  const poll2 = createPoll(anna, { question: "Snacks for game night?", options: ["Chips", "Popcorn", "Candy", "Fruit (lol)"], multiple: true, allowAdd: true, groupId: gamers.id });
  const o2 = db().prepare("select id from poll_options where poll_id = ? order by position").all(poll2) as { id: number }[];
  vote(cleo, poll2, [o2[0].id, o2[2].id]);

  const day = (n: number, h: number, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const p2 = await pic(anna, ["#2f7088", "#13283a"], "Game night");
  const ev1 = createEvent(anna, { title: "Game night: Wingspan", startAt: day(2, 19), endAt: day(2, 23), location: "Anna's place", color: "#d65a2b", cover: p2.url, groupId: gamers.id, html: "<p>Bring snacks. Doors at 19, first game at 19:30.</p>", capacity: 8 });
  rsvp(me, ev1, "going");
  rsvp(bjorn, ev1, "maybe");
  rsvp(erik, ev1, "going");
  const ev2 = createEvent(dani, { title: "Bouldering", startAt: day(4, 18), endAt: day(4, 20), location: "The climbing hall", color: "#4f8f50", repeat: "weekly", html: "<p>Every week. Shoes to rent at the desk.</p>" });
  rsvp(fia, ev2, "going");
  createEvent(cleo, { title: "Film night", startAt: day(6, 20), endAt: day(6, 23, 30), location: "Cleo's", color: "#9c5bb5" });
  createEvent(fia, { title: "Fia's birthday 🎂", startAt: day(11, 0), endAt: day(11, 23, 59), allDay: true, color: "#e2a634", location: "The park by the river" });

  // the first room setup made (named in the site's language)
  const lounge = db().prepare("select id from rooms where kind = 'room' order by id limit 1").get() as { id: number };
  for (const u of [anna, bjorn, cleo, dani, erik, fia]) joinRoom(u, lounge.id);
  sendMessage(anna, lounge.id, "<p>Morning all ☕</p>");
  sendMessage(erik, lounge.id, "<p>Morning! Who's in for lunch at 12?</p>");
  sendMessage(cleo, lounge.id, "<p>Me! The usual place?</p>");
  const m = sendMessage(bjorn, lounge.id, "<p>Can't today, on the road 🚗 Save me a seat next week.</p>");
  toggleReaction(anna.id, "message", m.id, "👍");
  sendMessage(me, lounge.id, '<p>Lunch it is. <strong>12:00</strong>, I\'ll book a table for 4.</p>');
  const priv = createRoom(dani, { name: "Trip planning", topic: "Summer 2027 logistics", emoji: "🧳", visibility: "private", invite: [erik.id, fia.id, me.id] });
  joinRoom(erik, priv);
  sendMessage(dani, priv, "<p>Made a room so we don't spam the Lounge. Spreadsheet coming.</p>");
  const dm = dmRoom(anna, me.id);
  sendMessage(anna, dm, "<p>Hey! Can you bring your copy of Wingspan on Friday? Mine is missing the eggs 🥚</p>");
  return Response.json({ ok: true });
}
