// The app's own pages: their calls to the app (preload.ts), and their words in its language.
"use strict";

const call = (name, ...args) => window.desktop.call(name, ...args);
const $ = (id) => document.getElementById(id);

/** The words of the elements with data-t, and `more`, in the app's language. */
async function words(more = []) {
  const els = [...document.querySelectorAll("[data-t]")];
  const tx = await call("texts", [...new Set([...els.map((e) => e.dataset.t), ...more])]);
  for (const el of els) el.textContent = tx[el.dataset.t];
  return tx;
}
