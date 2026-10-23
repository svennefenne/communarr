"use server";

import { revalidatePath } from "next/cache";
import { act } from "@/lib/act";
import { UserError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { answerRequest, cancelRequest, createGroup, deleteGroup, groupRow, inviteToGroup, joinGroup, leaveGroup, removeFromGroup, setGroupRole, updateGroup, type GroupRole, type Privacy } from "@/lib/groups";

interface GroupInput {
  name: string;
  tagline?: string;
  descriptionHtml?: string;
  privacy: Privacy;
  color?: string;
  avatar?: string | null;
  banner?: string | null;
  chat?: boolean;
}

export async function createGroupAction(input: GroupInput) {
  return act((u) => {
    const s = getSettings();
    if (!s.features.groups) throw new UserError("Groups are switched off.");
    if (s.canCreate.groups === "mods" && !u.isMod) throw new UserError("Only moderators can start groups.");
    const g = createGroup(u, input);
    revalidatePath("/groups");
    return g.slug;
  });
}

export async function updateGroupAction(id: number, input: Partial<GroupInput>) {
  return act((u) => {
    updateGroup(u, id, input);
    const g = groupRow(id)!;
    revalidatePath(`/groups/${g.slug}`, "layout");
    return g.slug;
  });
}

export async function deleteGroupAction(id: number) {
  return act((u) => {
    deleteGroup(u, id);
    revalidatePath("/groups");
    return true;
  });
}

export async function joinGroupAction(id: number) {
  return act((u) => {
    const r = joinGroup(u, id);
    revalidatePath(`/groups/${groupRow(id)?.slug}`, "layout");
    return r;
  });
}

export async function cancelRequestAction(id: number) {
  return act((u) => {
    cancelRequest(u, id);
    revalidatePath(`/groups/${groupRow(id)?.slug}`, "layout");
    return true;
  });
}

export async function leaveGroupAction(id: number) {
  return act((u) => {
    leaveGroup(u, id);
    revalidatePath(`/groups/${groupRow(id)?.slug}`, "layout");
    return true;
  });
}

export async function inviteToGroupAction(id: number, userIds: number[]) {
  return act((u) => inviteToGroup(u, id, userIds));
}

export async function answerRequestAction(id: number, userId: number, yes: boolean) {
  return act((u) => {
    answerRequest(u, id, userId, yes);
    revalidatePath(`/groups/${groupRow(id)?.slug}`, "layout");
    return true;
  });
}

export async function removeFromGroupAction(id: number, userId: number) {
  return act((u) => {
    removeFromGroup(u, id, userId);
    revalidatePath(`/groups/${groupRow(id)?.slug}`, "layout");
    return true;
  });
}

export async function setGroupRoleAction(id: number, userId: number, role: GroupRole) {
  return act((u) => {
    setGroupRole(u, id, userId, role);
    revalidatePath(`/groups/${groupRow(id)?.slug}`, "layout");
    return true;
  });
}
