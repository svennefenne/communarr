import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * The one SQLite database (DATA_DIR/hooden.db). Every timestamp is milliseconds since the epoch (UTC).
 * Migrations run in order on first use; each is applied once and recorded in meta.schema_version.
 */

// (turbopackIgnore: a folder of the running server's, nothing to bundle)
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ".data"));
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const MIGRATIONS: string[] = [
  /* 1: everything */ `
  create table if not exists meta (key text primary key, value text);
  create table settings (key text primary key, value text not null);

  create table users (
    id integer primary key,
    username text not null unique collate nocase,
    display_name text not null,
    password_hash text not null,
    role text not null default 'member',
    avatar text,
    banner text,
    bio_html text not null default '',
    pronouns text not null default '',
    location text not null default '',
    website text not null default '',
    birthday text,
    accent text,
    status_text text not null default '',
    status_emoji text not null default '',
    status_until integer,
    presence text not null default 'auto',
    theme_json text,
    notify_json text,
    suspended_until integer,
    banned integer not null default 0,
    ban_reason text,
    invited_by integer references users(id) on delete set null,
    created_at integer not null,
    last_seen integer
  );

  create table sessions (
    id text primary key,
    user_id integer not null references users(id) on delete cascade,
    created_at integer not null,
    last_used integer not null,
    expires_at integer not null,
    user_agent text not null default '',
    ip text not null default ''
  );
  create index sessions_user on sessions(user_id);

  create table invites (
    code text primary key,
    created_by integer references users(id) on delete set null,
    note text not null default '',
    max_uses integer,
    uses integer not null default 0,
    expires_at integer,
    role text not null default 'member',
    group_id integer,
    revoked integer not null default 0,
    created_at integer not null
  );
  create table invite_uses (code text not null, user_id integer not null references users(id) on delete cascade, at integer not null);

  create table resets (
    token text primary key,
    user_id integer not null references users(id) on delete cascade,
    created_at integer not null,
    expires_at integer not null,
    used integer not null default 0
  );

  create table uploads (
    id text primary key,
    user_id integer references users(id) on delete set null,
    kind text not null,
    path text not null,
    thumb text,
    mime text not null,
    size integer not null default 0,
    width integer,
    height integer,
    name text not null default '',
    created_at integer not null
  );
  create index uploads_user on uploads(user_id, created_at);

  create table groups (
    id integer primary key,
    slug text not null unique collate nocase,
    name text not null,
    tagline text not null default '',
    description_html text not null default '',
    avatar text,
    banner text,
    color text,
    privacy text not null default 'open',
    owner_id integer references users(id) on delete set null,
    room_id integer,
    created_at integer not null
  );
  create table group_members (
    group_id integer not null references groups(id) on delete cascade,
    user_id integer not null references users(id) on delete cascade,
    role text not null default 'member',
    joined_at integer not null,
    primary key (group_id, user_id)
  );
  create index group_members_user on group_members(user_id);
  create table group_requests (
    group_id integer not null references groups(id) on delete cascade,
    user_id integer not null references users(id) on delete cascade,
    kind text not null,
    by_id integer references users(id) on delete set null,
    created_at integer not null,
    primary key (group_id, user_id)
  );

  create table posts (
    id integer primary key,
    author_id integer not null references users(id) on delete cascade,
    kind text not null default 'post',
    title text not null default '',
    body_html text not null,
    body_text text not null,
    cover text,
    visibility text not null default 'members',
    group_id integer references groups(id) on delete cascade,
    pinned integer not null default 0,
    comments_locked integer not null default 0,
    created_at integer not null,
    edited_at integer
  );
  create index posts_created on posts(created_at);
  create index posts_author on posts(author_id, created_at);
  create index posts_group on posts(group_id, created_at);

  create table comments (
    id integer primary key,
    target_type text not null,
    target_id integer not null,
    author_id integer not null references users(id) on delete cascade,
    parent_id integer references comments(id) on delete cascade,
    body_html text not null,
    body_text text not null,
    created_at integer not null,
    edited_at integer
  );
  create index comments_target on comments(target_type, target_id, created_at);

  create table reactions (
    target_type text not null,
    target_id integer not null,
    user_id integer not null references users(id) on delete cascade,
    emoji text not null,
    created_at integer not null,
    primary key (target_type, target_id, user_id, emoji)
  );

  create table bookmarks (
    user_id integer not null references users(id) on delete cascade,
    target_type text not null,
    target_id integer not null,
    created_at integer not null,
    primary key (user_id, target_type, target_id)
  );

  create table forum_categories (
    id integer primary key,
    slug text not null unique collate nocase,
    name text not null,
    description text not null default '',
    color text,
    icon text not null default '',
    position integer not null default 0,
    locked integer not null default 0,
    group_id integer references groups(id) on delete cascade,
    created_at integer not null
  );
  create table forum_threads (
    id integer primary key,
    category_id integer not null references forum_categories(id) on delete cascade,
    author_id integer not null references users(id) on delete cascade,
    title text not null,
    body_html text not null,
    body_text text not null,
    pinned integer not null default 0,
    locked integer not null default 0,
    reply_count integer not null default 0,
    view_count integer not null default 0,
    last_post_at integer not null,
    last_post_by integer references users(id) on delete set null,
    created_at integer not null,
    edited_at integer
  );
  create index forum_threads_cat on forum_threads(category_id, last_post_at);
  create index forum_threads_last on forum_threads(last_post_at);
  create table forum_posts (
    id integer primary key,
    thread_id integer not null references forum_threads(id) on delete cascade,
    author_id integer not null references users(id) on delete cascade,
    body_html text not null,
    body_text text not null,
    created_at integer not null,
    edited_at integer
  );
  create index forum_posts_thread on forum_posts(thread_id, created_at);
  create table forum_subs (
    thread_id integer not null references forum_threads(id) on delete cascade,
    user_id integer not null references users(id) on delete cascade,
    primary key (thread_id, user_id)
  );
  create table forum_reads (
    thread_id integer not null references forum_threads(id) on delete cascade,
    user_id integer not null references users(id) on delete cascade,
    read_at integer not null,
    primary key (thread_id, user_id)
  );

  create table polls (
    id integer primary key,
    author_id integer not null references users(id) on delete cascade,
    question text not null,
    description_html text not null default '',
    description_text text not null default '',
    multiple integer not null default 0,
    max_choices integer,
    anonymous integer not null default 0,
    allow_change integer not null default 1,
    allow_add integer not null default 0,
    results text not null default 'always',
    closes_at integer,
    closed integer not null default 0,
    group_id integer references groups(id) on delete cascade,
    created_at integer not null,
    edited_at integer
  );
  create index polls_created on polls(created_at);
  create table poll_options (
    id integer primary key,
    poll_id integer not null references polls(id) on delete cascade,
    label text not null,
    position integer not null default 0,
    added_by integer references users(id) on delete set null
  );
  create table poll_votes (
    poll_id integer not null references polls(id) on delete cascade,
    option_id integer not null references poll_options(id) on delete cascade,
    user_id integer not null references users(id) on delete cascade,
    created_at integer not null,
    primary key (option_id, user_id)
  );
  create index poll_votes_poll on poll_votes(poll_id, user_id);

  create table events (
    id integer primary key,
    author_id integer not null references users(id) on delete cascade,
    title text not null,
    description_html text not null default '',
    description_text text not null default '',
    location text not null default '',
    start_at integer not null,
    end_at integer not null,
    all_day integer not null default 0,
    color text,
    cover text,
    group_id integer references groups(id) on delete cascade,
    repeat text not null default 'none',
    repeat_until integer,
    capacity integer,
    cancelled integer not null default 0,
    created_at integer not null,
    edited_at integer
  );
  create index events_start on events(start_at);
  create table event_rsvps (
    event_id integer not null references events(id) on delete cascade,
    user_id integer not null references users(id) on delete cascade,
    status text not null,
    updated_at integer not null,
    primary key (event_id, user_id)
  );
  create table event_reminders (
    event_id integer not null references events(id) on delete cascade,
    occurrence integer not null,
    kind text not null,
    primary key (event_id, occurrence, kind)
  );

  create table rooms (
    id integer primary key,
    name text not null,
    topic text not null default '',
    emoji text not null default '',
    kind text not null default 'room',
    visibility text not null default 'open',
    owner_id integer references users(id) on delete set null,
    group_id integer references groups(id) on delete cascade,
    last_message_at integer,
    archived integer not null default 0,
    created_at integer not null
  );
  create table room_members (
    room_id integer not null references rooms(id) on delete cascade,
    user_id integer not null references users(id) on delete cascade,
    role text not null default 'member',
    last_read_id integer not null default 0,
    notify text not null default 'all',
    joined_at integer not null,
    primary key (room_id, user_id)
  );
  create index room_members_user on room_members(user_id);
  create table room_invites (
    room_id integer not null references rooms(id) on delete cascade,
    user_id integer not null references users(id) on delete cascade,
    invited_by integer references users(id) on delete set null,
    created_at integer not null,
    primary key (room_id, user_id)
  );
  create table messages (
    id integer primary key,
    room_id integer not null references rooms(id) on delete cascade,
    author_id integer references users(id) on delete set null,
    kind text not null default 'text',
    body_html text not null,
    body_text text not null,
    reply_to integer,
    pinned integer not null default 0,
    deleted integer not null default 0,
    created_at integer not null,
    edited_at integer
  );
  create index messages_room on messages(room_id, id);

  create table notifications (
    id integer primary key,
    user_id integer not null references users(id) on delete cascade,
    kind text not null,
    actor_id integer references users(id) on delete set null,
    title text not null,
    body text not null default '',
    url text not null default '/',
    read_at integer,
    created_at integer not null
  );
  create index notifications_user on notifications(user_id, created_at);
  create table push_subs (
    id integer primary key,
    user_id integer not null references users(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    user_agent text not null default '',
    created_at integer not null,
    last_ok_at integer,
    fails integer not null default 0
  );

  create table themes (
    id integer primary key,
    user_id integer references users(id) on delete cascade,
    name text not null,
    data_json text not null,
    shared integer not null default 0,
    uses integer not null default 0,
    created_at integer not null,
    updated_at integer not null
  );

  create table reports (
    id integer primary key,
    reporter_id integer references users(id) on delete set null,
    target_type text not null,
    target_id integer not null,
    reason text not null,
    status text not null default 'open',
    resolved_by integer references users(id) on delete set null,
    resolved_at integer,
    note text not null default '',
    created_at integer not null
  );
  create table audit_log (
    id integer primary key,
    actor_id integer references users(id) on delete set null,
    action text not null,
    target text not null default '',
    detail text not null default '',
    created_at integer not null
  );
  create index audit_created on audit_log(created_at);

  create virtual table search_index using fts5(
    kind unindexed, ref unindexed, scope unindexed, author_id unindexed, created_at unindexed, url unindexed,
    title, body,
    tokenize = "unicode61 remove_diacritics 2"
  );
  `,
  /* 2: each member's own language (null: the site's) */ `
  alter table users add column lang text;
  `,
  /* 3: events only the one who planned them sees ("Only me") */ `
  alter table events add column private integer not null default 0;
  `,
  /* 4: feedback members send the admins (the user menu's "Send feedback") */ `
  create table feedback (
    id integer primary key,
    user_id integer references users(id) on delete set null,
    body text not null,
    page text not null default '',
    created_at integer not null,
    done_at integer,
    done_by integer references users(id) on delete set null
  );
  create index feedback_created on feedback(created_at);
  `,
  /* 5: mail. A member's address (only once it's confirmed), the key in the "stop these mails" link, and
        the links that confirm an address (the address waiting to be confirmed rides on its link) */ `
  alter table users add column email text;
  alter table users add column mail_token text;
  create unique index users_email on users(email);
  create unique index users_mail_token on users(mail_token);
  create table mail_tokens (
    token text primary key,
    user_id integer not null references users(id) on delete cascade,
    email text not null,
    created_at integer not null,
    expires_at integer not null,
    used_at integer
  );
  create index mail_tokens_user on mail_tokens(user_id);
  `,
  /* 6: an alias (what's shown; display_name is the alias, or else the username), the order an admin
        gives the chat rooms, and a custom repeat for events (repeat = 'custom', the rule as JSON) */ `
  alter table users add column alias text;
  update users set alias = display_name where display_name <> username;
  alter table rooms add column position integer;
  alter table events add column repeat_rule text;
  `,
];

function open(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "hooden.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  db.exec("create table if not exists meta (key text primary key, value text)");
  const row = db.prepare("select value from meta where key = 'schema_version'").get() as { value: string } | undefined;
  let version = row ? Number(row.value) : 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    db.transaction(() => {
      db.exec(sql);
      version += 1;
      db.prepare("insert into meta (key, value) values ('schema_version', ?) on conflict(key) do update set value = excluded.value").run(String(version));
    })();
  }
  return db;
}

// one connection per process, kept across hot reloads and across Next's separately bundled routes
const g = globalThis as typeof globalThis & { __hoodenDb?: Database.Database };

export function db(): Database.Database {
  if (!g.__hoodenDb) g.__hoodenDb = open();
  return g.__hoodenDb;
}

export const now = () => Date.now();

/** Run `fn` in a transaction. */
export function tx<T>(fn: () => T): T {
  return db().transaction(fn)();
}
