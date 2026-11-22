"use client";

import { useT } from "@/components/app/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { RINGS, RING_NAMES, type RingKey } from "@/lib/rings";
import type { UserSummary } from "@/lib/types";

/**
 * The ring around your picture: each choice shown on your own picture, as it will look. The one
 * chosen is marked by its tile, not by a ring around it (a ring outside a picture is how the chat
 * shows someone talking).
 */
export function RingPicker({ user, value, onChange }: { user: Pick<UserSummary, "id" | "name" | "avatar" | "accent">; value: string | null; onChange: (ring: string | null) => void }) {
  const t = useT();
  const keys = [null, ...(Object.keys(RINGS) as RingKey[])];
  return (
    <div className="ring-picker" role="radiogroup" aria-label={t("Ring around your picture")}>
      {keys.map((k) => {
        const name = k ? t(RING_NAMES[k]) : t("No ring");
        const on = (value ?? null) === k;
        return (
          <button key={k ?? "none"} type="button" role="radio" aria-checked={on} className={`ring-opt ${on ? "on" : ""}`} title={name} aria-label={name} onClick={() => onChange(k)}>
            <Avatar user={{ ...user, ring: k }} size={40} />
          </button>
        );
      })}
    </div>
  );
}
