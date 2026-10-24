/**
 * Where a built-in text shows up, for Admin → Texts: the source files it's written in
 * (src/i18n/places.json, made by scripts/text-places.mjs) turned into the names of pages and parts of
 * the site. English names, translated where they're shown. The first rule that matches wins.
 */

const RULES: [RegExp, string][] = [
  // the frame round every page
  [/^components\/shell\/Header/, "Top bar"],
  [/^components\/shell\/UserMenu/, "User menu (top right)"],
  [/^components\/shell\/Drawer/, "Menu (☰, phones)"],
  [/^components\/shell\/BottomNav/, "Bottom bar (phones)"],
  [/^components\/shell\/nav/, "Menus (section names)"],
  [/^components\/shell\/Footer/, "Footer"],
  [/^components\/shell\/Notification/, "Notifications (the bell)"],
  [/^components\/shell\/StatusDialog/, "Set a status"],
  [/^components\/shell\/FeedbackDialog/, "Send feedback"],
  [/^components\/shell\/OnlineButton/, "Who's here"],
  [/^components\/shell\/InstallButton/, "Get the app"],
  [/^components\/shell\/Announcement/, "Announcement bar"],
  [/^components\/shell\//, "Top bar"],
  [/^components\/app\/LanguageToggle/, "Language switch"],
  [/^components\/app\//, "Everywhere"],
  // front page and posts
  [/^components\/home\/PushPrompt/, "Front page: notifications prompt"],
  [/^components\/home\//, "Front page (side columns)"],
  [/^components\/feed\/Composer/, "Front page: write a post"],
  [/^components\/feed\/PostEditor/, "Writing or editing a post"],
  [/^components\/feed\/Feed/, "Front page feed"],
  [/^components\/feed\/PostCard/, "Posts"],
  [/^components\/feed\/EventCard/, "Events (in the feed and lists)"],
  [/^components\/feed\/PollCard/, "Polls (in the feed and lists)"],
  [/^components\/feed\/ThreadCard/, "Forum threads in the feed"],
  [/^components\/content\/Comments/, "Comments"],
  [/^components\/content\/ItemMenu/, "The ⋯ menu on posts"],
  [/^components\/content\/Reactions/, "Reactions"],
  [/^components\/content\/ReportDialog/, "Report something"],
  [/^components\/content\/Lightbox/, "Picture viewer"],
  [/^components\/content\//, "Posts"],
  [/^components\/polls\//, "Make or edit a poll"],
  // calendar, forum, groups
  [/^components\/events\/Calendar/, "Calendar"],
  [/^components\/events\/EventDetail/, "An event's page"],
  [/^components\/events\/EventForm/, "Plan or edit an event"],
  [/^components\/forum\/NewThreadForm/, "Forum: new thread"],
  [/^components\/forum\/ThreadView/, "Forum: a thread"],
  [/^components\/forum\//, "Forum"],
  [/^components\/groups\//, "Groups"],
  // chat and voice
  [/^components\/chat\/ChatRoom/, "Chat room"],
  [/^components\/chat\/ChatSidebar/, "Chat list"],
  [/^components\/chat\/Message/, "Chat messages"],
  [/^components\/chat\/NewChat/, "Chat: new chat or room"],
  [/^components\/chat\/RoomSettings/, "Chat: room settings"],
  [/^components\/chat\//, "Chat"],
  [/^components\/voice\//, "Voice chat"],
  // people, search, writing
  [/^components\/auth\/AuthShell/, "Log-in pages"],
  [/^components\/auth\//, "Log in, sign up, new password"],
  [/^components\/profile\/MemberGrid/, "Members page"],
  [/^components\/profile\//, "Profiles"],
  [/^components\/search\//, "Search"],
  [/^components\/editor\//, "Writing (the editor and its toolbar)"],
  [/^components\/ui\/EmojiPicker/, "Emoji picker"],
  [/^components\/ui\/Time/, "Dates and times"],
  [/^components\/ui\/PeoplePicker/, "Picking people"],
  [/^components\/ui\/ImagePick/, "Choosing a picture"],
  [/^components\/ui\//, "Everywhere"],
  // settings and admin
  [/^components\/settings\/ProfileForm/, "Settings → Profile"],
  [/^components\/settings\/AccountForm/, "Settings → Account"],
  [/^components\/settings\/NotifySettings/, "Settings → Notifications"],
  [/^components\/settings\/DisplaySettings/, "Settings → Display"],
  [/^components\/settings\/EmailSettings/, "Settings → Account"],
  [/^components\/settings\//, "Settings"],
  [/^components\/theme\/ThemeEditor/, "Settings → Theme: your own theme"],
  [/^components\/theme\//, "Settings → Theme"],
  [/^components\/admin\/Overview/, "Admin → Overview"],
  [/^components\/admin\/Members/, "Admin → Members"],
  [/^components\/admin\/Invites/, "Admin → Invites & sign-up"],
  [/^components\/admin\/Reports/, "Admin → Reports"],
  [/^components\/admin\/Feedback/, "Admin → Feedback"],
  [/^components\/admin\/GroupsRooms/, "Admin → Groups & chat rooms"],
  [/^components\/admin\/ForumCategories/, "Admin → Forum categories"],
  [/^components\/admin\/TextsEditor/, "Admin → Texts"],
  [/^components\/admin\/BackdropLibrary/, "Admin → Colours & background"],
  [/^components\/admin\/MailAdmin/, "Admin → Mail"],
  [/^components\/admin\/LookSettings/, "Admin → Name & texts, Colours, Features"],
  [/^components\/admin\/SystemSections/, "Admin → Notifications & voice, System"],
  [/^components\/admin\//, "Admin"],
  // pages
  [/^app\/admin\//, "Admin"],
  [/^app\/page\.tsx$/, "Front page"],
  [/^app\/news\//, "News"],
  [/^app\/posts\//, "A post's page"],
  [/^app\/polls\//, "Polls"],
  [/^app\/(calendar|events)\//, "Calendar and events"],
  [/^app\/cal\//, "Calendar feed (for phone calendars)"],
  [/^app\/forum\//, "Forum"],
  [/^app\/groups\//, "Groups"],
  [/^app\/chat\//, "Chat"],
  [/^app\/notifications\//, "Notifications page"],
  [/^app\/settings\//, "Settings"],
  [/^app\/u\//, "Profiles"],
  [/^app\/members\//, "Members page"],
  [/^app\/me\//, "My stuff"],
  [/^app\/saved\//, "Saved"],
  [/^app\/search\//, "Search"],
  [/^app\/login\//, "Log in"],
  [/^app\/forgot\//, "Forgot your password"],
  [/^app\/signup\//, "Sign up"],
  [/^app\/invite\//, "Invitation page"],
  [/^app\/reset\//, "Choose a new password"],
  [/^app\/setup\//, "Setup (first start)"],
  [/^app\/mail\//, "Mail links (confirm, unsubscribe)"],
  [/^app\/not-found/, "Page not found"],
  [/^app\/manifest/, "The app on the home screen"],
  [/^app\/api\/voice/, "Voice chat"],
  [/^app\/api\//, "Messages from the server"],
  // what the server says (errors, notifications, mails)
  [/^app\/actions\/admin/, "Admin (messages)"],
  [/^app\/actions\/chat/, "Chat (messages)"],
  [/^app\/actions\/(auth|language)/, "Log in, sign up (messages)"],
  [/^app\/actions\//, "Messages when you do something"],
  [/^lib\/textPlaces/, "Admin → Texts"],
  [/^lib\/types/, "Settings → Notifications"],
  [/^lib\/(palettes|theme|themes|fontChoices)\b/, "Settings → Theme"],
  [/^lib\/search/, "Search"],
  [/^lib\/accounts/, "Starter content (made once, at setup)"],
  [/^lib\/(mailTemplates|accountMail)/, "Mails"],
  [/^lib\/mail/, "Mails"],
  [/^lib\/notify|^lib\/birthdays/, "Notifications"],
  [/^lib\/chat/, "Chat (notifications and messages)"],
  [/^lib\/events/, "Events (notifications and messages)"],
  [/^lib\/(posts|comments|polls|reactions)/, "Posts and polls (notifications and messages)"],
  [/^lib\/forum/, "Forum (notifications and messages)"],
  [/^lib\/groups/, "Groups (notifications and messages)"],
  [/^lib\/(admin|reports|feedback)/, "Admin (messages)"],
  [/^lib\/(auth|users|profile)/, "Accounts (messages)"],
  [/^lib\//, "Messages from the server"],
];

/** Texts the code puts together while it runs ("audit: " + what was done), so no file has them whole. */
const BUILT: [RegExp, string][] = [
  [/^audit: /, "Admin → Notifications & voice, System"],
  [/^Pictures: /, "Admin → Notifications & voice, System"],
  [/^Now \{when\}/, "Events (notifications and messages)"],
];

/** The page or part of the site a source file belongs to (English; translate with t()). */
export function placeOf(file: string): string {
  return RULES.find(([re]) => re.test(file))?.[1] ?? "Elsewhere";
}

/** Where a text shows up: the places of the files it's written in (or, for a text put together, its kind). */
export function placesFor(key: string, files: string[]): string[] {
  if (!files.length) return BUILT.filter(([re]) => re.test(key)).map(([, label]) => label);
  return [...new Set(files.map(placeOf))];
}

/** Every place name, for the "Where" list. */
export const ALL_PLACES = [...new Set(RULES.map(([, label]) => label))];
