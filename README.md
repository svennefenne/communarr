# Communarr

A closed community space for friends to hang around, chat, discuss, plan and more. Self-hosted in one
Docker container, made for a headless Intel NUC or an Unraid server, and just as much at home on a phone
as on a big screen. It wears the retro sci-fi poster look of Deck Force (wide display type, mono eyebrows,
glass header, a frame round the site, film grain and scene-change wipes), in any of 98 colour schemes,
or in a theme you make yourself.

## What's in it

- **Front page**: what everyone's up to in one feed (posts, news, new forum threads, polls and events)
  with filters, a composer right at the top, the latest news as a poster, and on the side what's
  coming up, your chats (with unread counts and who's talking), who's here now, polls waiting for your
  vote, forum activity and your groups. A pill appears when others post something new.
- **Writing** everywhere (posts, news, comments, forum, chat, events, polls, group and profile texts) uses
  the same editor: paragraph styles, 12 fonts, sizes, **bold**, *italic*, underline, strikethrough,
  text colour and highlight, alignment, bulleted, numbered and check lists, quotes, code, tables,
  dividers, YouTube videos, sub/superscript, emoji, @mentions, links (button, `Ctrl+K`, or just paste a
  link; select words and paste a link over them), and pictures by button, drag-and-drop or paste,
  resized by dragging a corner and set left, centre or right. Select text for a quick formatting bubble.
  Drafts are kept on the device until you post. Full screen on a phone. Markdown shortcuts work too.
  Links get preview cards under the text (the page's title, text and picture, or the picture itself),
  and resting the pointer on a link shows a quick look at it with where it really goes.
- **The site's own emoji**, Discord style: members add a picture with a name (a GIF stays animated) from
  the emoji picker; write it `:name:` (after `:` and two letters a list suggests them, and the emoji's
  own names like `:thumbs_up:`), use it in anything written and as a reaction. A chat message of only
  emoji shows them big. Admin → Emoji lists them; whether everyone or only moderators can add them is
  under Features & permissions. Adding one can also be a pick from Google's 611 animated
  [Noto Emoji](https://googlefonts.github.io/noto-emoji-animation/) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
  credited where they're listed): the site keeps its own small copy. An admin can switch that off
  under Features & permissions.
- **Posts and news**: for everyone, a group, or only you; reactions, threaded comments, pinning, closing
  comments, saving for later, reporting. News (admins and moderators) gets a headline, a cover picture
  and a notification for everyone.
- **Forum**: categories (some for moderators only, some for a group), threads with quoting, reactions,
  following, unread markers, pinning, locking and moving, and each member's post count.
- **Chat**: open rooms anyone can join and private rooms you're invited to, direct messages, group rooms,
  replies, edits, deletes, pins, reactions, typing, "seen" marks, @mentions, pictures, per-room
  notification settings, owners and admins per room, archiving. **Every room has a voice channel**: press
  the headphones to talk (WebRTC, mute, deafen, who's talking glows), and the call stays up while you
  move around the site. Per device: push to talk (your own key), input sensitivity with a live level meter,
  and noise suppression (the browser's own, or strong: RNNoise, open source, in the browser).
- **Sounds**: Admin → Sounds picks a sound and volume for someone coming online, joining or leaving your
  voice chat, muting, unmuting, deafening and undeafening yourself in a call, and new posts, chat messages,
  events and polls (built-in tones, or upload your own); everyone can turn them off in their menu.
- **Calendar**: month (dots on a phone), week and list views, events with time, place, colour, cover,
  capacity and repeats (every day, week, month or year, or custom: every few days, weeks or months, on chosen weekdays, the first Friday, until a date or so many times), for everyone, a group or only you, RSVPs (going, maybe, can't), comments, reminders a day and an hour before,
  change and cancel notices, `.ics` downloads, and a private calendar feed for your phone's calendar app.
- **Polls**: single or multiple choice (with a limit), anonymous or not, changeable votes, choices
  members can add, results always / after voting / after closing, closing times, live results.
- **Groups**: open, closed (ask to join) or secret (invitation only), with their own posts, events,
  polls, forum categories and chat room, members with owner and admin roles, requests and invitations.
- **Members**: profiles with picture, banner, pronouns, bio, status (emoji, words and when it clears),
  online/away/busy/invisible, birthday (everyone gets a reminder), activity and groups; a members
  directory; "My stuff" with everything you made (also your "only me" posts) and your saved things.
- **Themes**: 98 colour schemes (Communarr's own plus the 97 Muzix uses), each in light and dark, or follow
  the device; and your own themes: every colour, the display and text fonts, corners, glass, the frame,
  the backdrop, film grain, and your own background picture (with a separate one for phones), with a
  live preview of the whole site. Themes can be shared, and others can use or copy them.
- **Notifications**: a bell with everything (mentions, replies, invitations, reminders, news, forum
  replies, group activity, reactions) and **push notifications on phones, tablets and computers**, even
  with the site closed; per kind, per device, quiet hours, and the unread count on the app icon. Installs
  as an app on the home screen.
- **Search** everything you're allowed to see, as you type (`/` or `Ctrl+K`), with a full results page.
- **English or Swedish** (svenska), for each person: SV | EN in the menu (and on the log-in page), or
  Settings → Display. The site's own language (picked on the setup page from the browser's language,
  changed under Admin → Name & texts) is the default. Pages, notifications, messages and dates follow it,
  and the emoji picker searches Swedish names. Translations live in `src/i18n/<language>/`: English text
  is the key, so a missing one just shows the English. Admins can reword any text under Admin → Texts.
- **Who's here**: the number of people online (you included) by the bell; open it for who they are
  (on a phone it's in the menu, ☰, with search).
- **Send feedback** from the user menu: ideas, wishes and bugs go to the admins (Admin → Feedback).
- **Admin**: a status board with a 30-day activity chart; members (roles, suspensions, closed accounts,
  password reset links, setting passwords, adding members, approving sign-ups); invite links (uses,
  expiry, role, a group to join) and sign-up modes; reports; feedback; groups and chat rooms; announcement line and
  word filter; forum categories; the site's name, language and texts, and **any built-in text in your
  own words** (per language); the default scheme, light/dark, background picture, frame, glass and
  backdrop, and a **library of uploaded backdrops** everyone can pick; switching features off and choosing who may start things; push
  keys and voice servers; time zone; storage, clean-up, search rebuild, database backup and the audit
  log. Moderators see the parts that are theirs.

## Phones and HTTPS

Phones only allow **push notifications and voice chat over HTTPS**, so put the site behind HTTPS (both
setups below show how). On an **iPhone or iPad**, open the site in Safari, tap Share → *Add to Home
Screen*, open it from the home screen and turn notifications on (Settings → Notifications on the site).
On Android, Chrome offers *Install app*. The site asks on the front page once per device.

## Install on the NUC (Docker Compose)

The image is built by GitHub Actions and published as `ghcr.io/svennefenne/communarr:latest` on every
push to `main` (and `:<version>` for `v*` tags). It's `linux/amd64`, which is what the NUC7i5BNK runs.

```sh
sudo mkdir -p /opt/communarr && sudo chown $USER: /opt/communarr && cd /opt/communarr
curl -LO https://raw.githubusercontent.com/svennefenne/communarr/main/docker-compose.yml
curl -LO https://raw.githubusercontent.com/svennefenne/communarr/main/.env.example && cp .env.example .env
mkdir -p deploy && curl -Lo deploy/Caddyfile https://raw.githubusercontent.com/svennefenne/communarr/main/deploy/Caddyfile
nano .env                      # time zone, PUID/PGID (run `id`), …
docker compose up -d           # http://<nuc>:3000
```

Then add HTTPS with one of the optional profiles in [`docker-compose.yml`](docker-compose.yml):

| Profile | What it does | You need |
| --- | --- | --- |
| `--profile https` | Caddy in front, with a certificate it renews itself | a domain pointing at your home IP, ports 80 and 443 forwarded to the NUC |
| `--profile tunnel` | a Cloudflare Tunnel: HTTPS without opening any ports | a domain on Cloudflare and a tunnel token (Zero Trust → Networks → Tunnels; public hostname → `http://communarr:3000`) |
| `--profile turn` | coturn, so voice works for phones on mobile data | ports 3478 (UDP/TCP) and 49160–49200 (UDP) forwarded, and the `VOICE_TURN_*` values in `.env`, including the NUC's LAN address (`VOICE_TURN_LAN_IP`) |

For example `docker compose --profile tunnel --profile turn up -d`, or put `COMPOSE_PROFILES=tunnel,turn`
in `.env` and just run `docker compose up -d`. Set `PUBLIC_URL` to the HTTPS address so invite links
and calendar feeds use it. Behind a Cloudflare Tunnel, `VOICE_TURN_URL` needs a DNS-only (grey cloud)
name or your public IP, since TURN can't go through the tunnel.

**Updating:** `docker compose pull && docker compose up -d`. **Backups:** everything lives in the
data folder (`./data` by default): the database, uploaded pictures and backups. Admin → System also
downloads a consistent copy of the database.

## Install on Unraid

1. **Docker → Add Container → Template repositories**: add `https://github.com/svennefenne/communarr`
   and save; then pick **Communarr** from the template list. (Or copy [`unraid/communarr.xml`](unraid/communarr.xml)
   to `/boot/config/plugins/dockerMan/templates-user/`.)
2. Check the values: the port (`3000`), **Appdata** → `/mnt/user/appdata/communarr`, your time zone,
   and **Public URL** once it's behind HTTPS. It runs as `99:100` (nobody:users), Unraid's default.
3. Apply, then open `http://<unraid>:3000`.

For HTTPS use what you already have: SWAG, Nginx Proxy Manager (turn on *Websockets Support*; the live
updates are a stream, so keep buffering off) or the Cloudflare Tunnel container, pointing at
`http://<unraid>:3000`. A TURN server for voice can be set in the template (advanced view) or under
Admin → Notifications & voice. The **Appdata Backup** plugin covers the data.

With the **Compose Manager** plugin you can also use `docker-compose.yml` as is: set
`COMMUNARR_DATA=/mnt/user/appdata/communarr`, `PUID=99`, `PGID=100` in its `.env`.

If the image ever needs a login to pull (GitHub makes new packages private until you change it):
GitHub → your profile → Packages → communarr → Package settings → *Change visibility* → Public.

## Set up when it was called Hooden?

The project used to be called Hooden. A site set up back then carries on as it is: it keeps its name,
texts and colour scheme (they're saved in its database), its database file (`hooden.db`), everyone's
log-ins, installed apps, push notifications and calendar feeds.

- **The image** is now `ghcr.io/svennefenne/communarr`. The old `ghcr.io/svennefenne/hooden` stopped
  getting updates on 25 October 2026 (it stays at that version): change the `image:` line in your
  `docker-compose.yml` to the new name, then `docker compose pull && docker compose up -d`.
- **Your `.env`** keeps working: `HOODEN_DATA`, `HOODEN_PORT` and `HOODEN_DOMAIN` are read when the
  `COMMUNARR_` ones aren't set.
- **If you swap in the new `docker-compose.yml`** instead of editing yours, the service is now called
  `communarr`: point a Cloudflare Tunnel's public hostname at `http://communarr:3000`, and note the
  containers are named `communarr`, `communarr-tunnel` and so on.

## First start

Open the site and you're asked to **name the site** (the name in the top left corner, the browser tab and
the app on phones), then to make the **admin** account. The site starts with forum categories, a Lounge
and a Gaming chat room and a welcome news post. Admin → Name & texts changes the name later and takes
**your own logo** instead of the stripes. After that the site is invite-only: **Admin → Invites & sign-up** makes invite links (for one person or several, for a while
or forever, optionally into a group or as moderators). You can also open a sign-up page (optionally with
approval), or add members yourself with a made-up password.

## Mail

With a mail server (Admin → Mail, or the `SMTP_*` variables below; the Admin page wins) the site can:

- **verify sign-ups**: signing up (invite link or open sign-up) needs an email address, and the account
  opens when the link mailed to it is clicked (48 hours; logging in before that sends a new one). With
  approval turned on, it then waits for an admin as usual. Admins see these sign-ups under Admin →
  Members (*Unconfirmed*) and can let them in without the mail; ones never confirmed are removed after
  a week. Without mail, sign-ups get straight in as before.
- **confirm an address**: members already in add theirs under Settings → Account, and a link confirms it
  (48 hours). Nobody else sees it.
- **reset a forgotten password**: *Forgot your password or username?* on the log-in page mails the
  username and a link for a new password (an hour, once). Admins can also mail one from Admin → Members.
- **send notifications by mail**: a third switch per kind under Settings → Notifications (on to begin
  with for direct messages, @mentions, invitations and news). Only while you're not on the site, at
  most one per conversation in half an hour, with a one-click *stop all notification mails* link.

Admin → Mail has a test mail and shows the last mail that didn't go. Without mail, forgotten passwords
are a link an admin makes under Admin → Members → *Password reset link*. Gmail works (an app password,
STARTTLS); so does a relay on your own network (no encryption, port 25).

## Settings (environment)

| Variable | Default | What |
| --- | --- | --- |
| `PUBLIC_URL` | (guessed) | The address people use, e.g. `https://communarr.example.com` (invite links, calendar feeds) |
| `TZ` | `Europe/Stockholm` | Time zone for reminders, birthdays and calendar files (also Admin → Notifications & voice) |
| `PUID` / `PGID` | `99` / `100` | Who owns the files in `/data` (compose file: `1000`/`1000`) |
| `UMASK` | `002` | File permissions for new files |
| `VOICE_TURN_URL`, `VOICE_TURN_USER`, `VOICE_TURN_PASS` | | A TURN server for voice chat (also Admin → Notifications & voice) |
| `TRUSTED_IP_HEADER` | | The header your proxy puts the visitor's address in, e.g. `cf-connecting-ip` behind a Cloudflare Tunnel (used to slow down password guessing; otherwise the last `X-Forwarded-For` hop) |
| `PUSH_HOSTS` | | Extra push-service hosts to accept, comma-separated (Google, Mozilla, Apple and Microsoft are built in) |
| `SMTP_HOST`, `SMTP_PORT` | | The mail server (see [Mail](#mail); Admin → Mail takes over when set there) |
| `SMTP_SECURE` | `starttls` | `starttls` (587), `tls` (465) or `none` (a relay on your own network, 25) |
| `SMTP_USER`, `SMTP_PASS` | | The mail server's log-in (empty: none) |
| `SMTP_FROM`, `SMTP_FROM_NAME` | | The sender's address (e.g. `noreply@example.com`) and name (the site's name if empty) |
| `PORT` | `3000` | The port inside the container |
| `DATA_DIR` | `/data` | Where everything is kept |

Everything else is on the Admin page.

## Keyboard

| Key | Does |
| --- | --- |
| `Q` / `E` | Previous / next section |
| `/` or `Ctrl+K` | Search |
| `Enter` in chat | Send (`Shift+Enter`: new line; on phones the send button sends) |
| `Ctrl+Enter` | Post / send from any editor |
| `Ctrl+K` in an editor | Add a link |

## Development

```sh
npm install
npm run dev                         # http://localhost:3000, data in ./.data
COMMUNARR_DEV_SEED=1 npm run dev    # then: curl -X POST localhost:3000/api/dev/seed   (demo friends and content)
npx tsc --noEmit && npx eslint src && npm run build
docker build -t communarr .
```

Next.js 16 (App Router, server actions) with React 19, SQLite through better-sqlite3 (one file, with
full-text search), Tiptap 3 for the editor, sharp for pictures, web-push for notifications; live updates
over Server-Sent Events and voice over WebRTC, all in the one Node process. `node scripts/icons.mjs`
redraws the app icons; `node scripts/emoji.mjs` rebuilds the emoji list and `node scripts/noto-emoji.mjs`
the list of Google's animated emoji.

## Credits

See [THIRD_PARTY.md](THIRD_PARTY.md).
