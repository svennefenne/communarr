import "server-only";
import type { T } from "./i18n";
import type { Mail } from "./mail";

/**
 * The mails Hooden sends, in the site's look: dark, the six stripes of the logo across the top, one
 * big button. Plain HTML tables with inline styles (what mail programs understand), and a text
 * version for the ones that show no HTML. Written in the reader's language.
 */

const STRIPES = ["#efe3c8", "#e2a634", "#cc4a30", "#4f8f50", "#2f74a0", "#2d2833"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Layout {
  to: string;
  subject: string;
  site: string;
  origin: string;
  heading: string;
  /** paragraphs, already HTML (escape what goes in) */
  lines: string[];
  /** a quote from the site (a message, a comment): plain text */
  quote?: string;
  button: { label: string; href: string };
  /** small print under the button, already HTML */
  after: string[];
  /** why you get it and how to stop it (notification mails) */
  footer?: { text: string; links: { label: string; href: string }[] };
  headers?: Record<string, string>;
  t: T;
}

function layout(o: Layout): Mail {
  const { t } = o;
  const stripes = STRIPES.map((c) => `<td width="16.66%" style="background:${c};height:6px;font-size:0;line-height:0">&nbsp;</td>`).join("");
  const para = (s: string, color = "#efe3c8", size = 16) => `<p style="margin:0 0 14px;color:${color};font-size:${size}px;line-height:1.5">${s}</p>`;
  const quote = o.quote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td style="border-left:3px solid #d65a2b;background:#121b23;border-radius:0 8px 8px 0;padding:12px 14px;color:#c9bda3;font-size:15px;line-height:1.5;white-space:pre-wrap">${esc(o.quote)}</td></tr></table>`
    : "";
  const footer = o.footer
    ? `<tr><td colspan="6" style="padding:0 30px 20px;color:#66707a;font-size:12px;line-height:1.6">${esc(o.footer.text)}<br>${o.footer.links.map((l) => `<a href="${esc(l.href)}" style="color:#8f9aa1">${esc(l.label)}</a>`).join(" &nbsp;·&nbsp; ")}</td></tr>`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${esc(o.subject)}</title></head>
<body style="margin:0;padding:0;background:#070b10">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070b10"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0c1218;border:1px solid #22323e;border-radius:14px;overflow:hidden;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
<tr>${stripes}</tr>
<tr><td colspan="6" style="padding:28px 30px 8px">
<div style="font-family:'Courier New',monospace;font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#e2a634;margin-bottom:6px">${esc(o.site)}</div>
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#fff6e6;font-weight:800;letter-spacing:.3px">${esc(o.heading)}</h1>
${o.lines.map((l) => para(l)).join("\n")}
${quote}
</td></tr>
<tr><td colspan="6" style="padding:6px 30px 22px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#d65a2b">
<a href="${esc(o.button.href)}" style="display:inline-block;padding:13px 24px;font-size:16px;font-weight:700;color:#fff6e6;text-decoration:none;border-radius:10px">${esc(o.button.label)}</a>
</td></tr></table>
</td></tr>
<tr><td colspan="6" style="padding:0 30px 22px">
${para(esc(t("Or copy this link into your browser:")), "#8f9aa1", 13)}
<p style="margin:0 0 14px;font-family:'Courier New',monospace;font-size:12px;line-height:1.5;word-break:break-all"><a href="${esc(o.button.href)}" style="color:#4d9ab4">${esc(o.button.href)}</a></p>
${o.after.map((l) => para(l, "#8f9aa1", 13)).join("\n")}
</td></tr>
${footer}
<tr><td colspan="6" style="padding:14px 30px;border-top:1px solid #18242e;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#66707a">
<a href="${esc(o.origin)}" style="color:#66707a;text-decoration:none">${esc(o.site)} · ${esc(o.origin.replace(/^https?:\/\//, ""))}</a>
</td></tr>
</table></td></tr></table></body></html>`;
  const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const text = [
    o.heading,
    "",
    ...o.lines.map(strip),
    ...(o.quote ? ["", ...o.quote.split("\n").map((l) => `> ${l}`)] : []),
    "",
    `${o.button.label}: ${o.button.href}`,
    "",
    ...o.after.map(strip),
    ...(o.footer ? ["", o.footer.text, ...o.footer.links.map((l) => `${l.label}: ${l.href}`)] : []),
    "",
    "-- ",
    `${o.site} · ${o.origin}`,
  ].join("\n");
  // (one line in the header, whatever went into the title)
  return { to: o.to, subject: o.subject.replace(/\s+/g, " ").trim().slice(0, 200), html, text, headers: o.headers };
}

/** A name in bold inside a translated sentence: "{name}" is filled in after escaping the rest. */
const withBold = (sentence: string, name: string) => esc(sentence).replace("\u0000", `<b style="color:#fff6e6">${esc(name)}</b>`);

interface Base {
  to: string;
  site: string;
  origin: string;
}

/** Confirm an address you added to your account (or changed to); signup: the welcome for a new account that opens with the link. */
export function confirmMail(t: T, o: Base & { name: string; username: string; link: string; hours: number; signup?: boolean }): Mail {
  if (o.signup)
    return layout({
      ...o,
      t,
      subject: t("Welcome to {site}: confirm your address", { site: o.site }),
      heading: t("Welcome, {name}!", { name: o.name }),
      lines: [
        withBold(t("Your account {username} on {site} is almost ready.", { username: "\u0000", site: o.site }), o.username),
        esc(t("Confirm your email address and it opens: then log in with your username and password.")),
      ],
      button: { label: t("Confirm and open my account"), href: o.link },
      after: [esc(t("The link works for {n} hours. Logging in before you've clicked it sends a new one.", { n: o.hours })), esc(t("Didn't sign up? Then you can ignore this mail: the account is removed after a week."))],
    });
  return layout({
    ...o,
    t,
    subject: t("Confirm your email address for {site}", { site: o.site }),
    heading: t("Is this your address, {name}?", { name: o.name }),
    lines: [
      withBold(t("You (or someone who knows your password) asked to use this address for the account {username} on {site}.", { username: "\u0000", site: o.site }), o.username),
      esc(t("Confirm it, and you can get a new password by mail if you ever forget yours, and the notifications you choose.")),
    ],
    button: { label: t("Confirm the address"), href: o.link },
    after: [esc(t("The link works for {n} hours.", { n: o.hours })), esc(t("Didn't ask for this? Then you can ignore this mail."))],
  });
}

/** Forgot your password (or your username): here's the username and a link for a new password. */
export function recoveryMail(t: T, o: Base & { name: string; username: string; link: string }): Mail {
  return layout({
    ...o,
    t,
    subject: t("A new password for {site}", { site: o.site }),
    heading: t("Back into {site}", { site: o.site }),
    lines: [withBold(t("Hi {name}! Your username is {username}.", { name: o.name, username: "\u0000" }), o.username), esc(t("Click the button to choose a new password."))],
    button: { label: t("Choose a new password"), href: o.link },
    after: [esc(t("The link works for {n} hour and only once.", { n: 1 })), esc(t("Didn't ask for this? Then you can ignore this mail: your password stays as it is."))],
  });
}

/** Admin → Mail: does it arrive? */
export function testMail(t: T, o: Base): Mail {
  return layout({
    ...o,
    t,
    subject: t("Test mail from {site}", { site: o.site }),
    heading: t("Mail works"),
    lines: [esc(t("This is the test mail from Admin → Mail. If you can read it, members will get their password and notification mails."))],
    button: { label: t("Open {site}", { site: o.site }), href: o.origin },
    after: [],
  });
}

/** A notification, by mail (the bell's title and text, a button to it, and how to stop these). */
export function notificationMail(
  t: T,
  o: Base & { title: string; body: string; link: string; kind: string; settings: string; unsubscribe: string; oneClick: string },
): Mail {
  return layout({
    ...o,
    t,
    subject: o.title,
    heading: o.title,
    lines: [],
    quote: o.body || undefined,
    button: { label: t("Open it on {site}", { site: o.site }), href: o.link },
    after: [],
    footer: {
      text: t("You get this because you chose “{kind}” by mail, and you weren't on {site} just then.", { kind: o.kind, site: o.site }),
      links: [
        { label: t("Choose which mails you get"), href: o.settings },
        { label: t("Stop all notification mails"), href: o.unsubscribe },
      ],
    },
    // a mail program's own "Unsubscribe" button POSTs to oneClick (RFC 8058); the link in the mail opens the page
    headers: { "List-Unsubscribe": `<${o.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
}
