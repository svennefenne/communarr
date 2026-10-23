"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { ImagePick } from "@/components/ui/ImagePick";
import { useConfirm } from "@/components/ui/ui";
import type { LibraryBackdrop } from "@/lib/theme";
import { saveSettingsAction } from "@/app/actions/admin";

/**
 * The backdrops admins upload: each a picture for computers and tablets (and maybe one for phones).
 * They join the built-in ones for the site's look and in everyone's theme editor. Saved straight away.
 */
export function BackdropLibrary({ library, onRemoved }: { library: LibraryBackdrop[]; onRemoved: (id: string) => void }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const { confirm, node } = useConfirm();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [desktop, setDesktop] = useState("");
  const [mobile, setMobile] = useState("");
  const store = (backdrops: LibraryBackdrop[], done: string, after?: () => void) =>
    start(async () => {
      const r = await saveSettingsAction({ backdrops });
      if (!r.ok) toast(r.error, { kind: "err" });
      else {
        toast(done);
        after?.();
        router.refresh();
      }
    });
  const add = () =>
    store([...library, { id: Math.random().toString(36).slice(2, 12), name: name.trim() || t("Backdrop {n}", { n: library.length + 1 }), desktop, mobile }], t("Added: everyone can pick it now."), () => {
      setName("");
      setDesktop("");
      setMobile("");
    });
  return (
    <div className="stack tight">
      <span className="label">{t("Backdrop library")}</span>
      <span className="small muted">{t("Upload your own backdrops. They show up next to the built-in ones above and in everyone's theme editor.")}</span>
      {library.length ? (
        <div className="backdrop-tiles">
          {library.map((b) => (
            <div key={b.id} className="backdrop-tile" style={{ backgroundImage: `url("${b.desktop || b.mobile}")` }}>
              <span>{b.name}</span>
              <button
                type="button"
                className="icon-btn backdrop-del"
                title={t("Remove {name}", { name: b.name })}
                aria-label={t("Remove {name}", { name: b.name })}
                disabled={pending}
                onClick={() =>
                  confirm(t("Remove {name} from the library? Anyone using it gets the stars instead.", { name: b.name }), t("Remove"), async () =>
                    store(library.filter((x) => x.id !== b.id), t("Removed."), () => onRemoved(b.id)),
                  )
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="panel panel-pad stack tight">
        <b>{t("Add a backdrop")}</b>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Name, e.g. Northern lights")} maxLength={40} aria-label={t("Name")} />
        <div className="grid-2">
          <ImagePick value={desktop || null} onChange={(u) => setDesktop(u ?? "")} kind="background" shape="wide" label={t("Computer and tablet")} />
          <ImagePick value={mobile || null} onChange={(u) => setMobile(u ?? "")} kind="background" shape="tall" label={t("Phone (optional)")} />
        </div>
        <button type="button" className={`btn btn-primary btn-sm ${pending ? "loading" : ""}`} style={{ alignSelf: "flex-start" }} disabled={pending || !(desktop || mobile)} onClick={add}>
          <Plus size={15} /> {t("Add to the library")}
        </button>
      </div>
      {node}
    </div>
  );
}
