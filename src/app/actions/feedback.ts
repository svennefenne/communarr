"use server";

import { revalidatePath } from "next/cache";
import { act } from "@/lib/act";
import { sendFeedback } from "@/lib/feedback";

/** The user menu's "Send feedback": to the admins (Admin → Feedback). */
export async function sendFeedbackAction(text: string, page: string) {
  return act((u) => {
    sendFeedback(u, String(text ?? ""), String(page ?? ""));
    revalidatePath("/admin");
    return true;
  });
}
