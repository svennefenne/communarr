"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { forgotAction, loginAction, resetAction, resubscribeAction, setupAction, signupAction, unsubscribeAction, type FormState } from "@/app/actions/auth";
import { useT } from "@/components/app/AppProvider";

function Password({ name, label, autoComplete }: { name: string; label: string; autoComplete: string }) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div style={{ position: "relative" }}>
        <input id={name} name={name} type={show ? "text" : "password"} className="input" required minLength={name === "password" && autoComplete === "current-password" ? 1 : 8} autoComplete={autoComplete} style={{ paddingRight: 48 }} />
        <button type="button" className="icon-btn sm" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }} onClick={() => setShow((s) => !s)} aria-label={show ? t("Hide password") : t("Show password")}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function Messages({ state }: { state: FormState }) {
  return (
    <>
      {state.error ? <div className="form-error">{state.error}</div> : null}
      {state.ok ? <div className="form-ok">{state.ok}</div> : null}
    </>
  );
}

export function LoginForm({ next, canSignUp, mail }: { next: string; canSignUp: boolean; mail: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="username">{t("Username")}</label>
        <input id="username" name="username" className="input" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus />
      </div>
      <Password name="password" label={t("Password")} autoComplete="current-password" />
      <Messages state={state} />
      <button type="submit" className={`btn btn-primary btn-block ${pending ? "loading" : ""}`}>
        {t("Log in")}
      </button>
      <p className="small muted" style={{ margin: 0, textAlign: "center" }}>
        {mail ? (
          <Link href="/forgot" className="link">
            {t("Forgot your password or username?")}
          </Link>
        ) : (
          t("Forgot your password? Ask an admin for a reset link.")
        )}
        {canSignUp ? (
          <>
            <br />
            {t("New here?")}{" "}
            <Link href="/signup" className="link">
              {t("Make an account")}
            </Link>
          </>
        ) : null}
      </p>
    </form>
  );
}

function NewAccountFields() {
  const t = useT();
  return (
    <>
      <div className="field">
        <label htmlFor="name">{t("Your name")}</label>
        <input id="name" name="name" className="input" required maxLength={40} autoComplete="name" placeholder={t("What your friends call you")} />
      </div>
      <div className="field">
        <label htmlFor="username">{t("Username")}</label>
        <input id="username" name="username" className="input" required pattern="[A-Za-z0-9_.\-]{2,24}" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <span className="hint">{t("For logging in and @mentions: letters, numbers, dots, dashes, underscores.")}</span>
      </div>
      <Password name="password" label={t("Password")} autoComplete="new-password" />
      <Password name="password2" label={t("Password again")} autoComplete="new-password" />
    </>
  );
}

export function SetupForm() {
  const t = useT();
  const [state, action, pending] = useActionState(setupAction, {});
  return (
    <form action={action} className="stack">
      <div className="field">
        <label htmlFor="siteName">{t("The site's name")}</label>
        <input id="siteName" name="siteName" className="input" defaultValue="Hooden" maxLength={40} />
      </div>
      <NewAccountFields />
      <Messages state={state} />
      <button type="submit" className={`btn btn-primary btn-block ${pending ? "loading" : ""}`}>
        {t("Create the admin account")}
      </button>
    </form>
  );
}

export function SignupForm({ code, mail }: { code?: string; mail: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(signupAction, {});
  if (state.ok) return <Messages state={state} />;
  return (
    <form action={action} className="stack">
      {code ? <input type="hidden" name="code" value={code} /> : null}
      <NewAccountFields />
      {/* with mail, the account opens when the link mailed here is clicked */}
      {mail ? (
        <div className="field">
          <label htmlFor="email">{t("Email address")}</label>
          <input id="email" name="email" type="email" className="input" required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} />
          <span className="hint">{t("We'll send a link to it: your account opens when you click it. Also for a new password if you forget yours. Nobody else sees it.")}</span>
        </div>
      ) : null}
      <Messages state={state} />
      <button type="submit" className={`btn btn-primary btn-block ${pending ? "loading" : ""}`}>
        {t("Join")}
      </button>
      <p className="small muted" style={{ margin: 0, textAlign: "center" }}>
        {t("Already have an account?")}{" "}
        <Link href="/login" className="link">
          {t("Log in")}
        </Link>
      </p>
    </form>
  );
}

/** Forgot your password or username: a mail with both (the username, and a link for a new password). */
export function ForgotForm() {
  const t = useT();
  const [state, action, pending] = useActionState(forgotAction, {});
  if (state.ok)
    return (
      <div className="stack">
        <Messages state={state} />
        <Link href="/login" className="btn btn-block">
          {t("Back to log in")}
        </Link>
      </div>
    );
  return (
    <form action={action} className="stack">
      <div className="field">
        <label htmlFor="who">{t("Username or email address")}</label>
        <input id="who" name="who" className="input" required maxLength={254} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus />
      </div>
      <Messages state={state} />
      <button type="submit" className={`btn btn-primary btn-block ${pending ? "loading" : ""}`}>
        {t("Send the mail")}
      </button>
      <p className="small muted" style={{ margin: 0, textAlign: "center" }}>
        <Link href="/login" className="link">
          {t("Remembered it? Log in")}
        </Link>
      </p>
    </form>
  );
}

/** The "stop notification mails" link: one button, and the way back. */
export function UnsubscribeForm({ token, on }: { token: string; on: boolean }) {
  const t = useT();
  const [off, offAction, offPending] = useActionState(unsubscribeAction, {});
  const [back, backAction, backPending] = useActionState(resubscribeAction, {});
  const isOn = back.ok ? true : off.ok ? false : on;
  return (
    <div className="stack">
      <Messages state={isOn ? back : off} />
      {isOn ? (
        <form action={offAction}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={`btn btn-primary btn-block ${offPending ? "loading" : ""}`}>
            {t("Stop all notification mails")}
          </button>
        </form>
      ) : (
        <form action={backAction} className="stack">
          {!off.ok ? <p className="small muted" style={{ margin: 0 }}>{t("They're off: no notification mails go to this address. Mails about your account (a forgotten password) still come.")}</p> : null}
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={`btn btn-block ${backPending ? "loading" : ""}`}>
            {t("Turn notification mails back on")}
          </button>
        </form>
      )}
    </div>
  );
}

export function ResetForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(resetAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="token" value={token} />
      <Password name="password" label={t("New password")} autoComplete="new-password" />
      <Password name="password2" label={t("New password again")} autoComplete="new-password" />
      <Messages state={state} />
      <button type="submit" className={`btn btn-primary btn-block ${pending ? "loading" : ""}`}>
        {t("Set the password")}
      </button>
    </form>
  );
}
