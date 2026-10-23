import { EyeOff, Globe, Lock } from "lucide-react";
import type { Privacy } from "@/lib/groups";

export const PRIVACY: Record<Privacy, { icon: React.ComponentType<{ size?: number }>; label: string; text: string }> = {
  open: { icon: Globe, label: "Open", text: "Everyone can see what's inside and join." },
  closed: { icon: Lock, label: "Closed", text: "Everyone can find it, but joining needs a yes from the group's admins; only members see inside." },
  secret: { icon: EyeOff, label: "Secret", text: "Only members know it exists. People join by invitation." },
};
