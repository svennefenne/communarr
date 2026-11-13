// The app's rules that need no window: servers' addresses, a server's own copy's site.json, versions,
// which files an update may be and where its download may lead, and the app's own words.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FILE_END, newer, origin, parseSite, PLATFORM, slug, trusted, updateFile } from "../dist/site.js";
import { setLang, t, texts } from "../dist/text.js";

test("a server's address: https, or http on this computer only", () => {
  assert.equal(origin("example.com"), "https://example.com");
  assert.equal(origin(" https://example.com/some/page?x=1 "), "https://example.com");
  assert.equal(origin("example.com:8443"), "https://example.com:8443");
  assert.equal(origin("http://localhost:3000"), "http://localhost:3000");
  assert.equal(origin("http://127.0.0.1:3000/x"), "http://127.0.0.1:3000");
  assert.equal(origin("http://example.com"), null);
  assert.equal(origin("http://10.9.77.14:3000"), null);
  assert.equal(origin("https://user:pass@example.com"), null);
  assert.equal(origin("ftp://example.com"), null);
  assert.equal(origin("not a url at all"), null);
});

test("a server's own copy: its name, id and server, or nothing", () => {
  assert.deepEqual(parseSite('{"name":"Friends","id":"com.example.friends","server":"friends.example"}'), { name: "Friends", id: "com.example.friends", server: "https://friends.example" });
  assert.deepEqual(parseSite('{"name":"Vänner 2","id":"se.example.vanner"}'), { name: "Vänner 2", id: "se.example.vanner", server: null });
  assert.equal(parseSite('{"name":"","id":"com.example.x"}'), null);
  assert.equal(parseSite('{"name":"X","id":"nodots"}'), null);
  assert.equal(parseSite('{"name":"../../etc","id":"com.example.x"}'), null);
  assert.equal(parseSite("not json"), null);
  assert.deepEqual(parseSite('{"name":"X","id":"com.example.x","server":"http://example.com"}'), { name: "X", id: "com.example.x", server: null });
});

test("names in files, and versions", () => {
  assert.equal(slug("Communarr"), "communarr");
  assert.equal(slug("Vänner & co"), "v-nner-co");
  assert.equal(newer("0.2.0", "0.1.9"), true);
  assert.equal(newer("0.1.10", "0.1.9"), true);
  assert.equal(newer("0.1.0", "0.1"), false);
  assert.equal(newer("0.1.0", "0.1.0"), false);
});

test("an update: a desktop file for this computer, on the server", () => {
  const s = "https://friends.example";
  const end = FILE_END[PLATFORM];
  assert.equal(updateFile(`/friends-desktop-0.2.0-${end}`, s)?.toString(), `${s}/friends-desktop-0.2.0-${end}`);
  assert.equal(updateFile(`${s}/communarr-desktop-1.10.3-${end}`, s)?.pathname, `/communarr-desktop-1.10.3-${end}`);
  assert.equal(updateFile(`https://elsewhere.example/friends-desktop-0.2.0-${end}`, s), null);
  assert.equal(updateFile(`/friends-desktop-0.2.0-${end}?x=1`, s), null);
  assert.equal(updateFile("/friends-0.2.0.apk", s), null);
  assert.equal(updateFile(`/../friends-desktop-0.2.0-${end}`, s)?.pathname, `/friends-desktop-0.2.0-${end}`);
  for (const other of Object.values(FILE_END).filter((e) => e !== end)) assert.equal(updateFile(`/friends-desktop-0.2.0-${other}`, s), null);
});

test("where a download may lead: the server, the app's release on GitHub, GitHub's files", () => {
  const s = "https://friends.example";
  const ok = (u) => trusted(new URL(u), s);
  assert.equal(ok(`${s}/communarr-desktop-0.2.0-linux-x86_64.AppImage`), true);
  assert.equal(ok("https://github.com/svennefenne/communarr/releases/download/desktop-v0.2.0/communarr-desktop-linux-x86_64.AppImage"), true);
  assert.equal(ok("https://release-assets.githubusercontent.com/github-production-release-asset/1/2?sig=x"), true);
  assert.equal(ok("https://github.com/someone/else/releases/download/desktop-v0.2.0/communarr-desktop-linux-x86_64.AppImage"), false);
  assert.equal(ok("https://github.com/svennefenne/communarr/releases/download/android-v0.2.0/communarr-android.apk"), false);
  assert.equal(ok("http://objects.githubusercontent.com/x"), false);
  assert.equal(ok("https://evil.example/communarr-desktop-0.2.0-linux-x86_64.AppImage"), false);
});

test("the app's words: Swedish or English, placeholders filled in", () => {
  setLang("sv-SE");
  assert.equal(t("Open {name}", { name: "Vänner" }), "Öppna Vänner");
  assert.deepEqual(texts(["Connect", "Cancel"]), { Connect: "Anslut", Cancel: "Avbryt" });
  setLang("en-GB");
  assert.equal(t("Open {name}", { name: "Friends" }), "Open Friends");
  assert.equal(t("Not a known text"), "Not a known text");
});
