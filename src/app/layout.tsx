import type { Metadata, Viewport } from "next";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/content.css";
import "./styles/editor.css";
import "./styles/feed.css";
import "./styles/pages.css";
import "./styles/chat.css";
import "./styles/admin.css";
import { fontVariables } from "@/lib/fonts";
import { getUser } from "@/lib/auth";
import { boot } from "@/lib/boot";
import { requestLang } from "@/lib/t";
import { getSettings } from "@/lib/settings";
import { siteIcons } from "@/lib/siteIcons";
import { themeColor, themeCss } from "@/lib/theme";
import { themeForUser } from "@/lib/themes";
import { AppProvider } from "@/components/app/AppProvider";
import { EmojiProvider } from "@/components/emoji/Emojis";
import { Backdrop } from "@/components/shell/Backdrop";
import { Header } from "@/components/shell/Header";
import { Footer } from "@/components/shell/Footer";
import { BottomNav } from "@/components/shell/BottomNav";
import { Announcement } from "@/components/shell/Announcement";
import { TransitionsProvider } from "@/components/shell/Transitions";
import { VoiceProvider } from "@/components/voice/VoiceProvider";
import { VoiceDock } from "@/components/voice/VoiceDock";
import { SiteSounds } from "@/components/app/SiteSounds";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { Lightbox } from "@/components/content/Lightbox";

export async function generateMetadata(): Promise<Metadata> {
  const s = getSettings();
  const ic = siteIcons();
  return {
    title: { default: s.siteName, template: `%s · ${s.siteName}` },
    description: s.tagline,
    applicationName: s.siteName,
    // the stripes, or the admin's logo (Admin → Name & texts)
    icons: { icon: [...(ic.svg ? [{ url: ic.svg, type: "image/svg+xml" }] : []), { url: ic.icon192, sizes: "192x192", type: "image/png" }], apple: { url: ic.apple, sizes: "180x180" } },
    // added to an iPhone's home screen it opens like an app (and can get push notifications)
    appleWebApp: { capable: true, title: s.siteName, statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const user = await getUser();
  const c = themeColor(themeForUser(user));
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    interactiveWidget: "resizes-content",
    themeColor: [
      { media: "(prefers-color-scheme: dark)", color: c.dark },
      { media: "(prefers-color-scheme: light)", color: c.light },
    ],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const theme = themeForUser(user);
  const b = boot(user, await requestLang());
  return (
    <html
      lang={b.site.lang}
      className={fontVariables}
      data-mode={theme.mode}
      data-frame={theme.frame ? "on" : undefined}
      data-backdrop={theme.backdrop}
      data-motion={user && !user.theme.motion ? "off" : undefined}
      data-density={user?.theme.density === "compact" ? "compact" : undefined}
      suppressHydrationWarning
    >
      <head>
        <style id="theme-css" dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />
      </head>
      <body>
        <Backdrop />
        <div className="site-frame" aria-hidden>
          <i className="sf-l" />
          <i className="sf-r" />
          <i className="sf-b" />
          <i className="sf-c sf-tl" />
          <i className="sf-c sf-tr" />
          <i className="sf-c sf-bl" />
          <i className="sf-c sf-br" />
          <i className="sf-edge" />
        </div>
        <AppProvider boot={b}>
          <EmojiProvider initial={b.site.emojis}>
            <TransitionsProvider initial={user ? user.theme.wipes && user.theme.motion : true}>
              <VoiceProvider>
                <Header />
                <Announcement />
                <main id="main">{children}</main>
                <Footer />
                <BottomNav />
                <VoiceDock />
                {user ? <SiteSounds /> : null}
                <SearchOverlay />
                <Lightbox />
              </VoiceProvider>
            </TransitionsProvider>
          </EmojiProvider>
        </AppProvider>
      </body>
    </html>
  );
}
