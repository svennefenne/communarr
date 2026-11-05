"use server";

import { revalidatePath } from "next/cache";
import { act } from "@/lib/act";
import { UserError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { addRow, clearList, clearRow, createList, deleteList, getList, moveRow, removeRow, setCell, updateList, type ListInput } from "@/lib/lists";

/** Lists (when the site has them: Admin → Features & permissions) */
function on() {
  if (!getSettings().features.lists) throw new UserError("Lists are switched off.");
}

export async function createListAction(input: ListInput) {
  return act((u) => {
    on();
    if (getSettings().canCreate.lists === "mods" && !u.isMod) throw new UserError("Only moderators can make lists.");
    const id = createList(u, input);
    revalidatePath("/lists");
    return id;
  });
}

export async function updateListAction(id: number, input: Partial<ListInput>) {
  return act((u) => {
    on();
    updateList(u, Number(id), input);
    revalidatePath(`/lists/${id}`);
    return true;
  });
}

export async function deleteListAction(id: number) {
  return act((u) => {
    on();
    deleteList(u, Number(id));
    revalidatePath("/lists");
    return true;
  });
}

/** A list as it is now (after a live change). */
export async function listAction(id: number) {
  return act((u) => {
    on();
    return getList(u, Number(id));
  });
}

export async function setCellAction(id: number, rowId: number, colId: string, value: unknown) {
  return act((u) => {
    on();
    return setCell(u, Number(id), Number(rowId), String(colId), value);
  });
}

export async function addRowAction(id: number, after?: number) {
  return act((u) => {
    on();
    return addRow(u, Number(id), after ? Number(after) : undefined);
  });
}

export async function clearRowAction(id: number, rowId: number) {
  return act((u) => {
    on();
    clearRow(u, Number(id), Number(rowId));
    return true;
  });
}

export async function clearListAction(id: number) {
  return act((u) => {
    on();
    clearList(u, Number(id));
    return true;
  });
}

export async function removeRowAction(id: number, rowId: number) {
  return act((u) => {
    on();
    removeRow(u, Number(id), Number(rowId));
    return true;
  });
}

export async function moveRowAction(id: number, rowId: number, by: -1 | 1) {
  return act((u) => {
    on();
    moveRow(u, Number(id), Number(rowId), by === -1 ? -1 : 1);
    return true;
  });
}
