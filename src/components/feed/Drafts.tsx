"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { DraftKind, DraftSummary } from "@/lib/types";
import { useT } from "@/components/app/AppProvider";
import { Time } from "@/components/ui/Time";
import { draftsAction } from "@/app/actions/content";

/**
 * Saved drafts (lib/drafts.ts), shared by the composer (posts) and a new thread's form (forum threads):
 * a member's drafts of a kind, and their list, to open one or delete it.
 */

/** Their drafts of a kind (null until they're in), and a way to fetch them again. */
export function useDrafts(kind: DraftKind) {
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const reload = useCallback(async () => {
    const r = await draftsAction(kind);
    if (r.ok) setDrafts(r.data);
  }, [kind]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { drafts, reload };
}

/** The list: each draft's start, where it was going and when it was saved; `current` is the one that's open. */
export function DraftList({ drafts, current, where, onOpen, onDelete }: { drafts: DraftSummary[]; current: number | null; where: (d: DraftSummary) => string; onOpen: (id: number) => void; onDelete: (id: number) => void }) {
  const t = useT();
  return (
    <div className="composer-drafts" role="region" aria-label={t("Drafts")}>
      {drafts.length ? (
        drafts.map((d) => (
          <div key={d.id} className={`composer-draft ${d.id === current ? "on" : ""}`}>
            <button type="button" className="composer-draft-open" onClick={() => onOpen(d.id)} title={t("Open the draft")}>
              <b className="ellipsis">{d.preview || t("(no text)")}</b>
              <span className="tiny muted">
                {where(d)} · <Time t={d.updatedAt} />
              </span>
            </button>
            <button type="button" className="icon-btn sm" onClick={() => onDelete(d.id)} aria-label={t("Delete the draft")} title={t("Delete the draft")}>
              <Trash2 size={16} />
            </button>
          </div>
        ))
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          {t("No drafts.")}
        </p>
      )}
    </div>
  );
}
