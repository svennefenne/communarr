// The server's address: asked the first time (and from the tray's Change server…).
"use strict";

(async () => {
  const tx = await words(["example.com", "Connecting…"]);
  const info = await call("info");
  document.title = info.name;
  document.documentElement.lang = info.lang;
  const address = $("address");
  address.placeholder = tx["example.com"];
  address.value = info.server;
  address.select();
  $("back").hidden = !info.connected;
  $("back").onclick = () => call("back");
  $("form").onsubmit = async (e) => {
    e.preventDefault();
    const go = $("go");
    go.disabled = true;
    go.textContent = tx["Connecting…"];
    $("error").textContent = "";
    const r = await call("connect", address.value);
    if (r && r.error) {
      $("error").textContent = r.error;
      go.disabled = false;
      go.textContent = tx.Connect;
      address.focus();
    }
  };
})();
