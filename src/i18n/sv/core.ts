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
