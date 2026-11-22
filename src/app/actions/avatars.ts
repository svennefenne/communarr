"use server";

import { act } from "@/lib/act";
import { addAvatarPresets, avatarPresets, removeAvatarPreset } from "@/lib/avatarPresets";

export async function avatarPresetsAction() {
  return act(() => avatarPresets());
}

export async function addAvatarPresetsAction(urls: string[]) {
  return act((u) => addAvatarPresets(u, Array.isArray(urls) ? urls.slice(0, 200) : []));
}

export async function removeAvatarPresetAction(id: number) {
  return act((u) => removeAvatarPreset(u, Number(id)));
}
