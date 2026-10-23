"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { PRIVACY } from "./privacy";
import { useT, useToast } from "@/components/app/AppProvider";
import { RichEditor, type EditorHandle } from "@/components/editor/Editor";
import { ImagePick } from "@/components/ui/ImagePick";
import type { GroupInfo, Privacy } from "@/lib/groups";
import { createGroupAction, updateGroupAction } from "@/app/actions/groups";

const COLORS = ["#2f7088", "#d65a2b", "#e2a634", "#4f8f50", "#9c5bb5", "#d4689a", "#5b7bd6", "#c8412f", "#2fa39a", "#6b7280"];


export function GroupForm({ group }: { group?: GroupInfo }) {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const ed = useRef<EditorHandle>(null);
  const [name, setName] = useState(group?.name ?? "");
  const [tagline, setTagline] = useState(group?.tagline ?? "");
  const [privacy, setPrivacy] = useState<Privacy>(group?.privacy ?? "open");
  const [color, setColor] = useState(group?.color ?? COLORS[0]);
  const [avatar, setAvatar] = useState(group?.avatar ?? null);
  const [banner, setBanner] = useState(group?.banner ?? null);
  const [chat, setChat] = useState(true);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const input = { name, tagline, descriptionHtml: ed.current?.getHTML() ?? "", privacy, color, avatar, banner, chat };
      const r = group ? await updateGroupAction(group.id, input) : await createGroupAction(input);
      if (!r.ok) {
        toast(r.error, { kind: "err" });
        return;
      }
      toast(group ? t("Saved.") : t("Your group is ready!"));
      router.push(`/groups/${r.data}`);
      router.refresh();
    });
  return (
    <div className="stack loose">
      <div className="grid-2">
        <div className="field">
          <label htmlFor="gf-name">{t("Name")}</label>
          <input id="gf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder={t("The Board Gamers")} autoFocus={!group} />
        </div>
        <div className="field">
          <label htmlFor="gf-tag">{t("In a few words")}</label>
          <input id="gf-tag" className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} placeholder={t("Dice, cards and snacks every other Friday")} />
        </div>
      </div>
      <div className="field">
        <span className="label">{t("Who can get in")}</span>
        <div className="privacy-pick">
          {(Object.keys(PRIVACY) as Privacy[]).map((p) => {
            const P = PRIVACY[p];
            const Icon = P.icon;
            return (
              <button key={p} type="button" className={`privacy-opt ${privacy === p ? "on" : ""}`} onClick={() => setPrivacy(p)} aria-pressed={privacy === p}>
                <Icon size={20} />
                <b>{t(P.label)}</b>
                <span className="tiny muted">{t(P.text)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid-2">
        <ImagePick value={avatar} onChange={setAvatar} kind="avatar" shape="square" label={t("Group picture")} />
        <ImagePick value={banner} onChange={setBanner} kind="banner" shape="wide" label={t("Banner across the top")} />
      </div>
      <div className="field">
        <span className="label">{t("Colour")}</span>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} type="button" className={`swatch ${color === c ? "on" : ""}`} style={{ background: c, width: 32, height: 32 }} onClick={() => setColor(c)} aria-label={c} />
          ))}
          <input type="color" className="swatch-input" value={color} onChange={(e) => setColor(e.target.value)} aria-label={t("Any colour")} />
        </div>
      </div>
      <div className="field">
        <span className="label">{t("About the group")}</span>
        <RichEditor ref={ed} initial={group?.descriptionHtml} placeholder={t("What's it for? Any house rules?")} minHeight={120} />
      </div>
      {!group ? (
        <label className="check">
          <input type="checkbox" checked={chat} onChange={(e) => setChat(e.target.checked)} /> {t("Give the group its own chat room (with voice)")}
        </label>
      ) : null}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          {t("Cancel")}
        </button>
        <button type="button" className={`btn btn-primary ${pending ? "loading" : ""}`} onClick={submit}>
          <Send size={16} /> {group ? t("Save") : t("Start the group")}
        </button>
      </div>
    </div>
  );
}
