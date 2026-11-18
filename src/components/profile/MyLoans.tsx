"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Handshake } from "lucide-react";
import type { GameLoan } from "@/lib/types";
import { useT, useToast } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Time } from "@/components/ui/Time";
import { loanAction } from "@/app/actions/games";

/**
 * On your own game shelf: the loans going on (lib/gameLoans.ts): askings to answer, what you've lent
 * out, and what you're borrowing or have asked for.
 */
export function MyLoans({ loans, meId }: { loans: GameLoan[]; meId: number }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (input: Parameters<typeof loanAction>[0]) => {
    setBusy(true);
    const r = await loanAction(input);
    setBusy(false);
    if (!r.ok) return toast(r.error, { kind: "err" });
    router.refresh();
  };
  const first = (name: string) => name.split(" ")[0];
  if (!loans.length) return null;
  return (
    <section className="panel panel-pad stack my-loans">
      <span className="eyebrow row" style={{ gap: 6 }}>
        <Handshake size={13} aria-hidden /> {t("Borrowing")}
      </span>
      <ul className="game-loans">
        {loans.map((l) => {
          const mine = l.owner.id === meId;
          const who = mine ? l.borrower : l.owner;
          return (
            <li key={l.id}>
              <Avatar user={who} size={22} />
              <span className="grow" style={{ minWidth: 0 }}>
                <b>{l.game}</b>
                {" · "}
                {mine
                  ? l.status === "asked"
                    ? t("{name} would like to borrow it", { name: first(who.name) })
                    : t("lent to {name}", { name: first(who.name) })
                  : l.status === "asked"
                    ? t("you've asked {name}", { name: first(who.name) })
                    : t("borrowed from {name}", { name: first(who.name) })}
                {l.status === "lent" && l.since ? (
                  <span className="muted">
                    {" · "}
                    <Time t={l.since} />
                  </span>
                ) : null}
              </span>
              {mine && l.status === "asked" ? (
                <>
                  <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => run({ answer: l.id, yes: true })}>
                    {t("Lend it")}
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => run({ answer: l.id, yes: false })}>
                    {t("Not now")}
                  </button>
                </>
              ) : l.status === "lent" ? (
                <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run({ returned: l.id })}>
                  {mine ? t("It's back") : t("I've given it back")}
                </button>
              ) : (
                <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => run({ cancel: l.id })}>
                  {t("Take it back")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
