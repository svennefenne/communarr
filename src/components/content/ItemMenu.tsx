"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, Flag, Link2, Lock, LockOpen, Pencil, Pin, PinOff, Trash2, Ellipsis } from "lucide-react";
import { Dropdown } from "@/components/ui/ui";
import { useT, useToast } from "@/components/app/AppProvider";
import { ReportDialog } from "./ReportDialog";
import type { ReportTarget } from "@/lib/reports";

export interface MenuOptions {
  url?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  saved?: boolean;
  onSave?: () => void;
  pinned?: boolean;
  onPin?: () => void;
  locked?: boolean;
  onLock?: () => void;
  report?: { type: ReportTarget; id: number };
  extra?: React.ReactNode;
}

/** The "⋯" on a post, comment or message. */
export function ItemMenu(o: MenuOptions) {
  const [reporting, setReporting] = useState(false);
  const t = useT();
  const toast = useToast();
  return (
    <>
      <Dropdown label={t("More")} button={<Ellipsis size={18} />}>
        {o.onEdit ? (
          <button type="button" className="menu-item" data-close onClick={o.onEdit}>
            <Pencil size={16} /> {t("Edit")}
          </button>
        ) : null}
        {o.onSave ? (
          <button type="button" className="menu-item" data-close onClick={o.onSave}>
            {o.saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {t(o.saved ? "Saved" : "Save for later")}
          </button>
        ) : null}
        {o.url ? (
          <button
            type="button"
            className="menu-item"
            data-close
            onClick={() => {
              const full = new URL(o.url!, window.location.href).href;
              if (navigator.share && window.matchMedia("(pointer: coarse)").matches) void navigator.share({ url: full }).catch(() => {});
              else
                void navigator.clipboard?.writeText(full).then(
                  () => toast(t("Link copied.")),
                  () => toast(full),
                );
            }}
          >
            <Link2 size={16} /> {t("Copy link")}
          </button>
        ) : null}
        {o.onPin ? (
          <button type="button" className="menu-item" data-close onClick={o.onPin}>
            {o.pinned ? <PinOff size={16} /> : <Pin size={16} />} {t(o.pinned ? "Unpin" : "Pin to the top")}
          </button>
        ) : null}
        {o.onLock ? (
          <button type="button" className="menu-item" data-close onClick={o.onLock}>
            {o.locked ? <LockOpen size={16} /> : <Lock size={16} />} {t(o.locked ? "Open comments" : "Close comments")}
          </button>
        ) : null}
        {o.extra}
        {o.report ? (
          <button type="button" className="menu-item" data-close onClick={() => setReporting(true)}>
            <Flag size={16} /> {t("Report")}
          </button>
        ) : null}
        {o.onDelete ? (
          <>
            <div className="menu-sep" />
            <button type="button" className="menu-item danger" data-close onClick={o.onDelete}>
              <Trash2 size={16} /> {t("Delete")}
            </button>
          </>
        ) : null}
      </Dropdown>
      {reporting && o.report ? <ReportDialog type={o.report.type} id={o.report.id} onClose={() => setReporting(false)} /> : null}
    </>
  );
}
