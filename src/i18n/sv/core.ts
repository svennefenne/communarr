/** Swedish: the language itself, times, the setup page and what a new site starts with. */
const sv: Record<string, string> = {
  // times (components/ui/Time.tsx)
  "in a moment": "om en stund",
  "just now": "nyss",
  "in {n} min": "om {n} min",
  "{n} min ago": "för {n} min sedan",
  "in {n} hour": "om {n} timme",
  "in {n} hours": "om {n} timmar",
  "{n} hour ago": "för {n} timme sedan",
  "{n} hours ago": "för {n} timmar sedan",
  tomorrow: "i morgon",
  yesterday: "i går",
  "in {n} days": "om {n} dagar",
  "{n} days ago": "för {n} dagar sedan",

  // the language: each person's own (menu, Settings → Display, log-in pages) and the site's (Admin)
  Language: "Språk",
  "Menus, pages, notifications and dates. Only for you.": "Menyer, sidor, notiser och datum. Bara för dig.",
  "Same as the site ({name})": "Samma som sajten ({name})",
  "Site language": "Sajtens språk",
  "The default for everyone who hasn't picked their own (Settings → Display, or the switch in their menu), for the log-in page and for what's saved for everyone, like chat notices. Changes straight away.":
    "Standard för alla som inte har valt eget (Inställningar → Visning, eller knappen i menyn), för inloggningssidan och för sådant som sparas för alla, som chattnotiser. Ändras direkt.",

  // Admin → Texts (components/admin/TextsEditor.tsx)
  Texts: "Texter",
  "Any text on the site, in your own words": "Vilken text som helst på sajten, med dina egna ord",
  "Write your own wording for any text on the site, in Swedish, English or both. Leave a field empty for the built-in text. Keep the {placeholders}: {name} is where a name goes.":
    "Skriv egna formuleringar för vilken text som helst på sajten, på svenska, engelska eller båda. Lämna ett fält tomt för den inbyggda texten. Behåll {platshållarna}: {name} är där ett namn hamnar.",
  "What members and admins made themselves is changed where it lives: a chat room's name in its settings, forum categories above, a group's name in the group.":
    "Sådant som medlemmar och admins har skapat själva ändras där det finns: ett chattrums namn i rummets inställningar, forumkategorier här ovanför, en grupps namn i gruppen.",
  "Find a text, e.g. Hej or Good morning": "Hitta en text, t.ex. Hej eller God morgon",
  "Find a text": "Hitta en text",
  "All texts": "Alla texter",
  Changed: "Ändrade",
  "You haven't changed any texts yet.": "Du har inte ändrat några texter än.",
  "No text matches that.": "Ingen text matchar det.",
  "your own": "egen",
  "Back to the built-in text": "Tillbaka till den inbyggda texten",
  "Back to the built-in text.": "Tillbaka till den inbyggda texten.",
  "Nothing fills in {list} here. This text has: {have}": "Inget fyller i {list} här. Den här texten har: {have}",
  "Leaves out {list}": "Utelämnar {list}",
  "There's no such text.": "Den texten finns inte.",

  // feedback (components/shell/FeedbackDialog.tsx, components/admin/Feedback.tsx, lib/feedback.ts)
  "Send feedback": "Skicka feedback",
  "Ideas, wishes, something that doesn't work? Tell the admins.": "Idéer, önskemål, något som inte funkar? Berätta för admins.",
  "What's on your mind?": "Vad tänker du på?",
  "Your feedback": "Din feedback",
  "Include the page I'm on": "Ta med sidan jag är på",
  "Only admins see feedback, with your name.": "Bara admins ser feedback, med ditt namn.",
  "Thanks! The admins will read it.": "Tack! Admins läser det.",
  "That's a lot of feedback in one go. Try again in a while.": "Det var mycket feedback på en gång. Försök igen om en stund.",
  "{name} sent feedback": "{name} skickade feedback",
  Feedback: "Feedback",
  "What members sent from their menu": "Det medlemmarna skickat från sin meny",
  "No feedback yet": "Ingen feedback än",
  "When someone uses “Send feedback” in their menu, it lands here.": "När någon använder ”Skicka feedback” i sin meny hamnar det här.",
  "handled by {name}": "hanterad av {name}",
  Handled: "Hanterad",
  "Open again": "Öppna igen",
  "Mark as handled": "Markera som hanterad",
  "Delete this feedback?": "Ta bort den här feedbacken?",

  // an event only you see (components/events/EventForm.tsx)
  "Only you see it, in your calendar. Nobody is invited or told.": "Bara du ser det, i din kalender. Ingen bjuds in eller får veta.",

  // the backdrop library (components/admin/BackdropLibrary.tsx)
  "Backdrop library": "Egna bakgrundsmotiv",
  "Upload your own backdrops. They show up next to the built-in ones above and in everyone's theme editor.":
    "Ladda upp egna bakgrundsmotiv. De dyker upp bredvid de inbyggda här ovanför och i allas temaredigerare.",
  "Backdrop {n}": "Motiv {n}",
  "Added: everyone can pick it now.": "Tillagt: alla kan välja det nu.",
  "Remove {name}": "Ta bort {name}",
  "Remove {name} from the library? Anyone using it gets the stars instead.": "Ta bort {name}? Alla som använder det får stjärnorna i stället.",
  "Removed.": "Borttaget.",
  "Add a backdrop": "Lägg till ett bakgrundsmotiv",
  "Name, e.g. Northern lights": "Namn, t.ex. Norrsken",
  "Add to the library": "Lägg till",

  // who's here, by the bell (components/shell/OnlineButton.tsx)
  "{n} person here now": "{n} person här nu",
  "{n} people here now": "{n} personer här nu",
  "Here now": "Här nu",
  you: "du",
  "All members": "Alla medlemmar",

  // the same in Swedish (listed so Admin → Texts can find and change them)
  Admin: "Admin",
  ADMIN: "ADMIN",
  Mod: "Mod",
  Moderator: "Moderator",
  Online: "Online",
  Status: "Status",
  Emoji: "Emoji",
  Auto: "Auto",
  Info: "Info",
  Normal: "Normal",
  Community: "Community",
  "System & backup": "System & backup",
  Communarr: "Communarr",

  // errors
  "Something went wrong. Try again.": "Något gick fel. Försök igen.",
  "Not here": "Inte här",
  "This page doesn't exist (any more)": "Den här sidan finns inte (längre)",
  "It may have been deleted, or the link is wrong.": "Den kan ha tagits bort, eller så är länken fel.",
  "Back to the front page": "Tillbaka till förstasidan",

  // setup
  "Set up": "Kom igång",
  "First start": "Första starten",
  "Make yourself the admin": "Gör dig själv till admin",
  "This account runs the place: it invites friends, sets the look and keeps things tidy. You can make others admins later.":
    "Det här kontot sköter stället: bjuder in vänner, bestämmer utseendet och håller ordning. Du kan göra andra till admins senare.",

  // what a new site starts with (lib/accounts.ts seedSite)
  General: "Allmänt",
  "Anything and everything.": "Allt möjligt.",
  "Plans & meetups": "Planer & träffar",
  "Trips, game nights, dinners: let's make it happen.": "Resor, spelkvällar, middagar: nu blir det av.",
  "Games, films & music": "Spel, film & musik",
  "What you're playing, watching and listening to.": "Vad du spelar, tittar på och lyssnar på.",
  "Off-topic": "Off topic",
  "Memes, links and the rest.": "Memes, länkar och allt annat.",
  "About the site": "Om sajten",
  "Ideas, wishes and bugs for this place.": "Idéer, önskemål och buggar för det här stället.",
  Lounge: "Vardagsrummet",
  "Hang out, say hi, talk about whatever.": "Häng, säg hej, prata om vad som helst.",
  Gaming: "Gaming",
  "Who's up for a game?": "Vem är sugen på att lira?",
  "{name} is open.": "{name} är öppet.",
  "Welcome to {site}": "Välkommen till {site}",
  "<p>This is <strong>{site}</strong>: our own place to hang around, chat, plan and argue about films. A few things to try:</p><ul><li><p>Write a post right here on the front page (pictures and links welcome).</p></li><li><p>Jump into the <strong>{lounge}</strong> under Chat, and press the headphones to talk.</p></li><li><p>Plan something in the <strong>Calendar</strong>, ask something in <strong>Polls</strong>, start a thread in the <strong>Forum</strong>.</p></li><li><p>Make the place yours under <strong>Theme</strong>: 98 colour schemes, or build your own with your own background.</p></li></ul><p>On your phone? Add the site to your home screen and turn on notifications under Settings.</p>":
    "<p>Det här är <strong>{site}</strong>: vårt eget ställe att hänga, chatta, planera och bråka om filmer på. Några saker att testa:</p><ul><li><p>Skriv ett inlägg här på förstasidan (bilder och länkar är välkomna).</p></li><li><p>Hoppa in i <strong>{lounge}</strong> under Chatt och tryck på hörlurarna för att prata.</p></li><li><p>Planera något i <strong>Kalendern</strong>, fråga något i <strong>Omröstningar</strong>, starta en tråd i <strong>Forumet</strong>.</p></li><li><p>Gör stället till ditt under <strong>Tema</strong>: 98 färgscheman, eller bygg ett eget med din egen bakgrund.</p></li></ul><p>På mobilen? Lägg till sajten på hemskärmen och slå på notiser under Inställningar.</p>",
};

export default sv;
