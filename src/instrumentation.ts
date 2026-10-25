/**
 * Runs once when the server starts: the database is opened (and migrated) straight away, and a
 * minute-by-minute clock sends event reminders, closes polls whose time is up and tidies old sessions.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as typeof globalThis & { __hdClock?: boolean };
  if (g.__hdClock) return;
  g.__hdClock = true;
  const { db } = await import("./lib/db");
  const { sendReminders } = await import("./lib/events");
  const { closeDuePolls } = await import("./lib/polls");
  const { birthdayPings } = await import("./lib/birthdays");
  db();
  let ticks = 0;
  const tick = () => {
    try {
      sendReminders();
      closeDuePolls();
      birthdayPings();
      // once an hour: sessions that ran out, old read notifications (keep 90 days)
      if (ticks++ % 60 === 0) {
        const now = Date.now();
        db().prepare("delete from sessions where expires_at < ?").run(now);
        db().prepare("delete from notifications where read_at is not null and created_at < ?").run(now - 90 * 86_400_000);
        db().prepare("delete from resets where expires_at < ?").run(now - 86_400_000);
        db().prepare("delete from mail_tokens where expires_at < ?").run(now - 30 * 86_400_000);
        // sign-ups that never clicked the link in their confirmation mail: gone after a week (the name is free again)
        db().prepare("delete from users where ban_reason in ('unconfirmed', 'unconfirmed pending') and banned = 0 and created_at < ?").run(now - 7 * 86_400_000);
      }
    } catch (e) {
      console.error("[clock]", e);
    }
  };
  setTimeout(tick, 5_000);
  setInterval(tick, 60_000).unref?.();
  console.log("[communarr] ready");
}
