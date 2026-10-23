"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginAction, resetAction, setupAction, signupAction, type FormState } from "@/app/actions/auth";
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

export function LoginForm({ next, canSignUp }: { next: string; canSignUp: boolean }) {
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
        {t("Forgot your password? Ask an admin for a reset link.")}
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

export function SignupForm({ code }: { code?: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(signupAction, {});
  if (state.ok) return <Messages state={state} />;
  return (
    <form action={action} className="stack">
      {code ? <input type="hidden" name="code" value={code} /> : null}
      <NewAccountFields />
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
