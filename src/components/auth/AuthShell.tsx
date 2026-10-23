/** A page that is only its window (log in, sign up): the stripes, the name, and the form. */
export function AuthShell({ siteName, eyebrow, title, intro, children }: { siteName: string; eyebrow: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div data-bare-page hidden />
      <div className="panel auth-panel">
        <div className="auth-brand">
          <span className="brand-mark auth-mark" aria-hidden>
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <div className="display auth-site">{siteName}</div>
          </div>
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
