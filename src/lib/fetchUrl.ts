import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import { UserError } from "./errors";

/**
 * Fetching a link someone gave us (a picture to use, a page to preview) without letting a link reach
 * the network the server sits in: only http(s) on the usual ports, and every address a name resolves to
 * must be a public one, checked as the connection is made (so a name can't answer one thing first and
 * another after). Redirects go through the same check; time and size are limited.
 */

const blocked = new net.BlockList();
const V4: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];
// (NAT64, 6to4 and Teredo count as not public: they can point anywhere. IPv4 written as IPv6,
// ::ffff:10.0.0.1, is held to the IPv4 rules by BlockList itself; a ::ffff:0:0/96 rule here would
// block every IPv4 address, as BlockList checks IPv4 against IPv6 rules that way too)
const V6: [string, number][] = [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 23], ["2001:db8::", 32], ["2002::", 16],
  ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
];
for (const [a, p] of V4) blocked.addSubnet(a, p, "ipv4");
for (const [a, p] of V6) blocked.addSubnet(a, p, "ipv6");

/** An address on the internet (not this machine, the home network, link-local, multicast, …). */
export function publicIp(ip: string): boolean {
  const fam = net.isIP(ip);
  return fam === 4 ? !blocked.check(ip, "ipv4") : fam === 6 ? !blocked.check(ip, "ipv6") : false;
}

// tests on a computer: "host:port"s in HOODEN_DEV_FETCH_ALLOW may be fetched (a local test server);
// never in production
const devAllow = new Set(process.env.NODE_ENV === "production" ? [] : (process.env.HOODEN_DEV_FETCH_ALLOW ?? "").split(",").map((s) => s.trim()).filter(Boolean));
const hostPort = (u: URL) => `${u.hostname}:${u.port || (u.protocol === "https:" ? "443" : "80")}`;

type LookupCb = (err: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void;
const BLOCKED = "HD_BLOCKED";

function guardedLookup(hostname: string, options: dns.LookupOptions, cb: LookupCb) {
  dns.lookup(hostname, { family: options.family, hints: options.hints, all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some((a) => !publicIp(a.address))) return cb(Object.assign(new Error("not a public address"), { code: BLOCKED }));
    if (options.all) cb(null, addrs);
    else cb(null, addrs[0].address, addrs[0].family);
  });
}

function checkUrl(input: string): URL {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new UserError("That doesn't look like a link.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new UserError("That doesn't look like a link.");
  if (u.username || u.password) throw new UserError("That address can't be used.");
  if (devAllow.has(hostPort(u))) return u;
  if (u.port && u.port !== "80" && u.port !== "443") throw new UserError("That address can't be used.");
  const literal = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(literal) && !publicIp(literal)) throw new UserError("That address can't be used.");
  return u;
}

export interface Fetched {
  /** where it ended up (after redirects) */
  url: URL;
  /** "text/html", "image/png", … */
  type: string;
  charset?: string;
  body: Buffer;
  /** cut off at the limit (text read only as far as needed) */
  truncated: boolean;
  /** its body wasn't wanted (read said null) */
  skipped: boolean;
}

export interface FetchOptions {
  accept: string;
  /** Accept-Language */
  lang?: string;
  timeoutMs?: number;
  /** how much of a reply of this type to read (truncate: keep the start of a bigger one), or null: none */
  read: (type: string) => { max: number; truncate?: boolean } | null;
}

export async function fetchPublic(input: string, o: FetchOptions): Promise<Fetched> {
  const deadline = Date.now() + (o.timeoutMs ?? 10_000);
  let url = checkUrl(input);
  try {
    for (let hop = 0; hop < 5; hop++) {
      const r = await once(url, o, deadline);
      if (!("redirect" in r)) return r;
      url = checkUrl(new URL(r.redirect, url).toString());
    }
  } catch (e) {
    if (e instanceof UserError) throw e;
    const code = (e as NodeJS.ErrnoException).code;
    if (code === BLOCKED) throw new UserError("That address can't be used.");
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") throw new UserError("We couldn't find that address.");
    throw new UserError("That link didn't work.");
  }
  throw new UserError("That link sends us round in circles.");
}

function once(url: URL, o: FetchOptions, deadline: number): Promise<Fetched | { redirect: string }> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const req = mod.request(url, {
      method: "GET",
      agent: false,
      lookup: devAllow.has(hostPort(url)) ? undefined : (guardedLookup as unknown as net.LookupFunction),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HoodenBot/1.0; +https://github.com/svennefenne/hooden)",
        Accept: o.accept,
        "Accept-Language": o.lang ?? "en",
        "Accept-Encoding": "gzip, deflate, br",
      },
    });
    const timer = setTimeout(() => settle(() => (req.destroy(), reject(new UserError("That link took too long to answer.")))), Math.max(1, deadline - Date.now()));
    req.on("error", (e) => settle(() => reject(e)));
    req.on("response", (res) => {
      // (cutting a reply short makes it report "aborted": nothing more to do then)
      res.on("error", (e) => settle(() => reject(e)));
      const status = res.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
        res.resume();
        return settle(() => (req.destroy(), resolve({ redirect: res.headers.location! })));
      }
      if (status < 200 || status >= 300) {
        res.resume();
        return settle(() => (req.destroy(), reject(new UserError("That link didn't work ({status}).", { status }))));
      }
      const ct = String(res.headers["content-type"] ?? "");
      const type = ct.split(";")[0].trim().toLowerCase();
      const charset = /charset=["']?([\w-]+)/i.exec(ct)?.[1];
      const want = o.read(type);
      if (!want) return settle(() => (req.destroy(), resolve({ url, type, charset, body: Buffer.alloc(0), truncated: false, skipped: true })));
      const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
      const stream: NodeJS.ReadableStream =
        enc === "gzip" || enc === "x-gzip" ? res.pipe(zlib.createGunzip()) : enc === "deflate" ? res.pipe(zlib.createInflate()) : enc === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
      const chunks: Buffer[] = [];
      let size = 0;
      const done = (truncated: boolean) => settle(() => (req.destroy(), resolve({ url, type, charset, body: Buffer.concat(chunks), truncated, skipped: false })));
      stream.on("data", (c: Buffer) => {
        if (settled) return;
        if (size + c.length > want.max) {
          if (!want.truncate) return settle(() => (req.destroy(), reject(new UserError("That's too big ({n} MB at most).", { n: Math.max(1, Math.round(want.max / 1048576)) }))));
          chunks.push(c.subarray(0, want.max - size));
          size = want.max;
          return done(true);
        }
        chunks.push(c);
        size += c.length;
      });
      stream.on("end", () => done(false));
      stream.on("error", (e: Error) => settle(() => reject(e)));
    });
    req.end();
  });
}
