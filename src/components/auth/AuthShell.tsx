import { LanguageToggle } from "@/components/app/LanguageToggle";
import { BrandMark } from "@/components/shell/Header";
import { getSettings } from "@/lib/settings";

/**
 * A page that is only its window (log in, sign up): the logo (or the stripes), the name, the language
 * switch for whoever is here (the setup page has its own, for the site's language) and the form.
 */
export function AuthShell({ siteName, eyebrow, title, intro, toggle = true, children }: { siteName: string; eyebrow: string; title: string; intro?: React.ReactNode; toggle?: boolean; children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div data-bare-page hidden />
      <div className="panel auth-panel">
        <div className="auth-brand">
          <BrandMark logo={getSettings().logo || null} className="auth-mark" />
          <div className="grow">
            <div className="eyebrow">{eyebrow}</div>
            {/* (--n: its length, so a long name gets smaller instead of breaking in the middle) */}
            <div className="display auth-site" style={{ ["--n" as string]: Math.max(6, siteName.length) }}>
              {siteName}
            </div>
          </div>
          {toggle ? (
            <div className="auth-lang">
              <LanguageToggle short />
            </div>
          ) : null}
        </div>
        <h1 className="h2" style={{ marginTop: 6 }}>
          {title}
        </h1>
        {intro ? <div className="muted" style={{ marginTop: 6 }}>{intro}</div> : null}
        <div style={{ marginTop: 20 }}>{children}</div>
      </div>
    </div>
  );
}
