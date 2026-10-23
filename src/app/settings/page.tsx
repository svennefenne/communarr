import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/settings/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfileSettings() {
  const u = await requireUser();
  return (
    <ProfileForm
      p={{ name: u.name, username: u.username, pronouns: u.pronouns, bioHtml: u.bioHtml, location: u.location, website: u.website, birthday: u.birthday, accent: u.accent, avatar: u.avatar, banner: u.banner }}
    />
  );
}
