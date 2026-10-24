"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogOut, Monitor, Smartphone } from "lucide-react";
import { useT, useToast } from "@/components/app/AppProvider";
import { clientT } from "@/lib/i18n";
import { Time } from "@/components/ui/Time";
import { Modal } from "@/components/ui/ui";
import { changePasswordAction, changeUsernameAction, deleteAccountAction, endSessionAction, setAliasAction } from "@/app/actions/settings";

function device(ua: string) {
  const t = clientT();
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : t("A device");
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : t("a browser");
  return { label: t("{browser} on {os}", { browser, os }), phone: /iPhone|Android|Mobile/.test(ua) };
}

export function AccountForm({ username, alias, sessions, current, email }: { username: string; alias: string | null; sessions: { id: string; createdAt: number; lastUsed: number; ua: string; ip: string }[]; current: string | null; email?: React.ReactNode }) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [aka, setAka] = useState(alias ?? "");
  const [name, setName] = useState(username);
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [list, setList] = useState(sessions);
  const [del, setDel] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="stack loose">
      {/* the name everyone sees: empty shows the username */}
      <section className="panel panel-pad stack">
        <h2 className="h2">{t("Alias")}</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {t("The name everyone sees when you post, chat or plan something. Leave it empty and your username ({username}) shows instead.", { username })}
        </p>
        <form
          className="input-group"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await setAliasAction(aka);
              if (r.ok) {
                setAka(r.data ?? "");
                toast(r.data ? t("Everyone sees you as {name} now.", { name: r.data }) : t("No alias: everyone sees your username."));
                router.refresh();
              } else toast(r.error, { kind: "err" });
            });
          }}
        >
          <input className="input" value={aka} onChange={(e) => setAka(e.target.value)} maxLength={40} placeholder={username} aria-label={t("Alias")} />
          <button type="submit" className="btn" disabled={aka.trim() === (alias ?? "")}>
            {t("Save")}
          </button>
        </form>
      </section>
      <section className="panel panel-pad stack">
        <h2 className="h2">{t("Username")}</h2>
        <p className="small muted" style={{ margin: 0 }}>
          {t("For logging in and @mentions. Your profile's address changes with it.")}
        </p>
        <div className="input-group">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoCapitalize="none" spellCheck={false} />
          <button
            type="button"
            className="btn"
            disabled={name === username}
            onClick={() =>
              start(async () => {
                const r = await changeUsernameAction(name);
                if (r.ok) {
                  toast(t("Username changed."));
                  router.refresh();
                } else toast(r.error, { kind: "err" });
              })
            }
          >
            {t("Change")}
          </button>
        </div>
      </section>
      {/* (your email address, under your names) */}
      {email}
      <section className="panel panel-pad stack">
        <h2 className="h2">{t("Password")}</h2>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw !== pw2) {
              toast(t("The two new passwords aren't the same."), { kind: "err" });
              return;
            }
            start(async () => {
              const r = await changePasswordAction(cur, pw);
              if (r.ok) {
                toast(t("Password changed. Other devices have been logged out."));
                setCur("");
                setPw("");
                setPw2("");
                router.refresh();
              } else toast(r.error, { kind: "err" });
            });
          }}
        >
          <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
          <div className="field">
            <label htmlFor="ac-cur">{t("Current password")}</label>
            <input id="ac-cur" type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="ac-new">{t("New password")}</label>
              <input id="ac-new" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} required />
            </div>
            <div className="field">
              <label htmlFor="ac-new2">{t("New password again")}</label>
              <input id="ac-new2" type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" minLength={8} required />
            </div>
          </div>
          <button type="submit" className={`btn btn-primary ${pending ? "loading" : ""}`} style={{ alignSelf: "flex-start" }}>
            {t("Change password")}
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2 className="h2">{t("Where you're logged in")}</h2>
        </div>
        <div className="list">
          {list.map((s) => {
            const d = device(s.ua);
            return (
              <div key={s.id} className="list-row">
                {d.phone ? <Smartphone size={20} className="muted" /> : <Monitor size={20} className="muted" />}
                <span className="grow" style={{ minWidth: 0 }}>
                  <b>{d.label}</b> {s.id === current ? <span className="badge accent">{t("This one")}</span> : null}
                  <span className="tiny muted" style={{ display: "block" }}>
                    {t("Last used")} <Time t={s.lastUsed} />
                    {s.ip ? ` · ${s.ip}` : ""} · {t("since")} <Time t={s.createdAt} mode="date" />
                  </span>
                </span>
                {s.id !== current ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      await endSessionAction(s.id);
                      setList((l) => l.filter((x) => x.id !== s.id));
                    }}
                  >
                    <LogOut size={15} /> {t("Log out")}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel panel-pad row between wrap danger-zone">
        <div>
          <b>{t("Close your account")}</b>
          <div className="small muted">{t("Your posts, messages and everything else you made are deleted with it.")}</div>
        </div>
        <button type="button" className="btn btn-danger" onClick={() => setDel(true)}>
          {t("Close account")}
        </button>
      </section>
      {del ? (
        <Modal
          title={t("Close your account?")}
          onClose={() => setDel(false)}
          footer={
            <button
              type="button"
              className="btn btn-danger"
              onClick={() =>
                start(async () => {
                  const r = await deleteAccountAction(confirmName);
                  if (r && !r.ok) toast(r.error, { kind: "err" });
                })
              }
            >
              {t("Close it for good")}
            </button>
          }
        >
          <p style={{ marginTop: 0 }}>{t("This can't be undone. Type your username to confirm.")}</p>
          <input className="input" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={username} autoCapitalize="none" />
        </Modal>
      ) : null}
    </div>
  );
}
