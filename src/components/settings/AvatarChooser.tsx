"use client";

import { useState } from "react";
import { Check, Images } from "lucide-react";
import { useT } from "@/components/app/AppProvider";
import { Modal } from "@/components/ui/ui";
import type { AvatarPreset } from "@/lib/avatarPresets";

/** "Choose an avatar": the site's avatars (Admin → Avatars), round as they'll show, the one you have ticked. */
export function AvatarChooser({ presets, value, onPick }: { presets: AvatarPreset[]; value: string | null; onPick: (url: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!presets.length) return null;
  return (
    <>
      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setOpen(true)}>
        <Images size={13} /> {t("Choose an avatar")}
      </button>
      {open ? (
        <Modal title={t("Choose an avatar")} onClose={() => setOpen(false)} wide>
          <div className="avatar-grid pick" role="radiogroup" aria-label={t("Choose an avatar")}>
            {presets.map((a) => {
              const on = a.url === value;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`avatar-tile ${on ? "on" : ""}`}
                  onClick={() => {
                    onPick(a.url);
                    setOpen(false);
                  }}
                >
                  <img src={a.url} alt="" loading="lazy" decoding="async" />
                  {on ? (
                    <span className="avatar-on">
                      <Check size={14} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            {t("Pick one, then save your profile.")}
          </p>
        </Modal>
      ) : null}
    </>
  );
}
