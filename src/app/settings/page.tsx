import { requireUser } from "@/lib/auth";
import { shelfAccount } from "@/lib/bggShelf";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { ShelfSettings } from "@/components/settings/ShelfSettings";
import { avatarPresets } from "@/lib/avatarPresets";

export const dynamic = "force-dynamic";

export default async function ProfileSettings() {
  const u = await requireUser();
  return (
    <div className="stack loose">
      <ProfileForm
        p={{ name: u.name, username: u.username, pronouns: u.pronouns, bioHtml: u.bioHtml, location: u.location, website: u.website, birthday: u.birthday, accent: u.accent, ring: u.ring, avatar: u.avatar, banner: u.banner }}
        presets={avatarPresets(u.id)}
      />
      <ShelfSettings account={shelfAccount(u.id)} username={u.username} />
    </div>
  );
}
