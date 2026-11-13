// Which screen or window to share (capture.ts): their pictures, renewed every few seconds.
"use strict";

let chosen = null;
let first = true;

function card(s) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "src" + (s.id === chosen ? " on" : "");
  b.dataset.id = s.id;
  const thumb = document.createElement("span");
  thumb.className = "thumb";
  if (s.thumb) {
    const img = document.createElement("img");
    img.src = s.thumb;
    img.alt = "";
    thumb.append(img);
  }
  const name = document.createElement("span");
  name.className = "name";
  if (s.icon) {
    const icon = document.createElement("img");
    icon.src = s.icon;
    icon.alt = "";
    name.append(icon);
  }
  const text = document.createElement("span");
  text.textContent = s.name;
  name.append(text);
  b.title = s.name;
  b.append(thumb, name);
  b.onclick = () => choose(s.id);
  b.ondblclick = () => {
    choose(s.id);
    share();
  };
  return b;
}

function choose(id) {
  chosen = id;
  for (const el of document.querySelectorAll(".src")) el.classList.toggle("on", el.dataset.id === id);
  $("share").disabled = !id;
}

function share() {
  if (chosen) void call("choose", chosen, $("audio").checked);
}

async function load() {
  const { sources, audio } = await call("sources");
  const focused = document.activeElement?.dataset?.id;
  if (!sources.some((s) => s.id === chosen)) chosen = null;
  $("screens").replaceChildren(...sources.filter((s) => s.kind === "screen").map(card));
  $("windows").replaceChildren(...sources.filter((s) => s.kind === "window").map(card));
  $("none").hidden = sources.some((s) => s.kind === "window");
  $("sound").hidden = !audio;
  if (focused) document.querySelector(`.src[data-id="${CSS.escape(focused)}"]`)?.focus();
  if (first) {
    first = false;
    // (one screen: it's the one)
    const screens = sources.filter((s) => s.kind === "screen");
    if (screens.length === 1) choose(screens[0].id);
    else choose(chosen);
    document.querySelector(".src")?.focus();
  }
}

(async () => {
  const tx = await words();
  document.title = tx["Share your screen"];
  $("cancel").onclick = () => call("choose", null);
  $("share").onclick = share;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") void call("choose", null);
  });
  await load();
  setInterval(load, 3000);
})();
