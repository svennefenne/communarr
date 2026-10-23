"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { useConfirm } from "@/components/ui/ui";
import { deleteGroupAction } from "@/app/actions/groups";

export function DeleteGroup({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { confirm, node } = useConfirm();
  return (
    <div className="panel panel-pad row between wrap danger-zone">
      <div>
        <b>{t("Delete the group")}</b>
        <div className="small muted">{t("Its posts, events, polls and chat go with it. This can't be undone.")}</div>
      </div>
      <button
        type="button"
        className="btn btn-danger"
        onClick={() =>
          confirm(t("Delete {name} and everything in it?", { name }), t("Delete the group"), async () => {
            const r = await deleteGroupAction(id);
            if (r.ok) router.push("/groups");
            else toast(r.error, { kind: "err" });
          })
        }
      >
        <Trash2 size={16} /> {t("Delete")}
      </button>
      {node}
    </div>
  );
}
