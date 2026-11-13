// The server can't be reached: tries again every 15 seconds, and goes back to it once it answers.
"use strict";

(async () => {
  const tx = await words(["{server} can't be reached", "Trying again in {n} s…"]);
  const info = await call("info");
  document.title = info.name;
  document.documentElement.lang = info.lang;
  $("title").textContent = tx["{server} can't be reached"].replace("{server}", info.server);
  $("error").textContent = new URLSearchParams(location.search).get("error") || "";
  $("change").onclick = () => call("change-server");
  let left = 15;
  let trying = false;
  const tryNow = async () => {
    if (trying) return;
    trying = true;
    $("retry").disabled = true;
    if (await call("reachable")) return call("back");
    trying = false;
    $("retry").disabled = false;
    left = 15;
  };
  $("retry").onclick = tryNow;
  setInterval(() => {
    if (trying) return;
    left--;
    $("countdown").textContent = tx["Trying again in {n} s…"].replace("{n}", String(left));
    if (left <= 0) void tryNow();
  }, 1000);
})();
