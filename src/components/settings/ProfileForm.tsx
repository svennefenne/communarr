"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ExternalLink, Save, Smile } from "lucide-react";
import { useApp, useT, useToast } from "@/components/app/AppProvider";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";
import { ImagePick } from "@/components/ui/ImagePick";
import { Avatar } from "@/components/ui/Avatar";
import { StatusDialog } from "@/components/shell/StatusDialog";
import { updateProfileAction } from "@/app/actions/settings";

const ACCENTS = ["#d65a2b", "#e2a634", "#2f7088", "#4d9ab4", "#3f8a4c", "#c8412f", "#9c5bb5", "#d4689a", "#5b7bd6", "#2fa39a"];

export interface ProfileData {
  name: string;
  username: string;
  pronouns: string;
  bioHtml: string;
  location: string;
  website: string;
  birthday: string | null;
  accent: string;
  avatar: string | null;
  banner: string | null;
}

export function ProfileForm({ p }: { p: ProfileData }) {
  const { me } = useApp();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const ed = useRef<EditorHandle>(null);
  const [name, setName] = useState(p.name);
  const [pronouns, setPronouns] = useState(p.pronouns);
  const [location, setLocation] = useState(p.location);
  const [website, setWebsite] = useState(p.website);
  const [bday, setBday] = useState(p.birthday ?? "");
  const [accent, setAccent] = useState(p.accent);
  const [avatar, setAvatar] = useState(p.avatar);
  const [banner, setBanner] = useState(p.banner);
  const [status, setStatus] = useState(false);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await updateProfileAction({ name, pronouns, location, website, birthday: bday || null, accent, avatar, banner, bioHtml: ed.current?.getHTML() ?? "" });
      if (!r.ok) toast(r.error, { kind: "err" });
      else {
        toast(t("Profile saved."));
        router.refresh();
      }
    });
  const [mm, dd] = bday ? bday.split("-") : ["", ""];
  return (
    <div className="stack loose">
      <div className="panel panel-pad row wrap" style={{ gap: 16 }}>
        <Avatar user={{ id: me?.id ?? 0, name, avatar, accent }} size={64} />
        <div className="grow" style={{ minWidth: 0 }}>
          <b className="h3">{name}</b>
          <div className="small muted">
            {me?.statusEmoji || me?.statusText ? `${me.statusEmoji} ${me.statusText}` : t("No status")} ·{" "}
            <button type="button" className="link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" }} onClick={() => setStatus(true)}>
              <Smile size={13} style={{ verticalAlign: -2 }} /> {t("set status")}
            </button>
          </div>
        </div>
        <Link href={`/u/${encodeURIComponent(p.username)}`} className="btn btn-sm">
          <ExternalLink size={15} /> {t("See your profile")}
        </Link>
      </div>
      <div className="panel panel-pad stack loose">
        <div className="grid-2">
          <ImagePick value={avatar} onChange={setAvatar} kind="avatar" shape="round" label={t("Profile picture")} />
          <ImagePick value={banner} onChange={setBanner} kind="banner" shape="wide" label={t("Banner on your profile")} />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="pf-name">{t("Name")}</label>
            <input id="pf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="pf-pro">{t("Pronouns (optional)")}</label>
            <input id="pf-pro" className="input" value={pronouns} onChange={(e) => setPronouns(e.target.value)} maxLength={30} placeholder={t("she/her, they/them…")} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="pf-loc">{t("Where you are")}</label>
            <input id="pf-loc" className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="pf-web">{t("Website")}</label>
            <input id="pf-web" className="input" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={200} inputMode="url" placeholder="https://…" />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <span className="label">{t("Birthday (day and month: friends get a reminder on the day)")}</span>
            <div className="input-group">
              <select className="select" value={dd} onChange={(e) => setBday(e.target.value && mm ? `${mm}-${e.target.value}` : e.target.value ? `01-${e.target.value}` : "")} aria-label={t("Day")}>
                <option value="">{t("Day")}</option>
                {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
                  <option key={d} value={d}>
                    {Number(d)}
                  </option>
                ))}
              </select>
              <select className="select" value={mm} onChange={(e) => setBday(e.target.value ? `${e.target.value}-${dd || "01"}` : "")} aria-label={t("Month")}>
                <option value="">{t("Month")}</option>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, Number(m) - 1, 1).toLocaleDateString(t.locale, { month: "long" })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <span className="label">{t("Your colour (name in chat, picture background)")}</span>
            <div className="swatches">
              {ACCENTS.map((c) => (
                <button key={c} type="button" className={`swatch ${accent === c ? "on" : ""}`} style={{ background: c, width: 30, height: 30 }} onClick={() => setAccent(c)} aria-label={c} />
              ))}
              <input type="color" className="swatch-input" value={accent} onChange={(e) => setAccent(e.target.value)} aria-label={t("Any colour")} />
            </div>
          </div>
        </div>
        <div className="field">
          <span className="label">{t("About you")}</span>
          <RichEditor ref={ed} initial={p.bioHtml} placeholder={t("A few words about yourself: what you're into, what you're playing, your favourite film…")} minHeight={140} />
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={save}>
            <Save size={16} /> {t("Save")}
          </button>
        </div>
      </div>
      {status && me ? <StatusDialog me={me} onClose={() => setStatus(false)} /> : null}
    </div>
  );
}
