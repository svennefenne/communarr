"use server";

import { revalidatePath } from "next/cache";
import { act } from "@/lib/act";
import { sendFeedback } from "@/lib/feedback";

/** The user menu's "Send feedback": to the admins (Admin → Feedback). */
export async function sendFeedbackAction(text: string, page: string, images: { url: string }[] = []) {
  return act((u) => {
    sendFeedback(u, String(text ?? ""), String(page ?? ""), images);
    revalidatePath("/admin");
    return true;
  });
}
