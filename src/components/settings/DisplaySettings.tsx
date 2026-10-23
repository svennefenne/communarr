"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ThemePrefs } from "@/lib/types";
import { Switch } from "@/components/ui/ui";
import { ModeSwitch } from "@/components/shell/UserMenu";
import { useTransitions } from "@/components/shell/Transitions";
import { setPrefsAction } from "@/app/actions/me";

export function DisplaySettings({ prefs }: { prefs: ThemePrefs }) {
  const router = useRouter();
  const { setWipe } = useTransitions();
  const [p, setP] = useState(prefs);
  const save = async (patch: Partial<ThemePrefs>) => {
    setP((x) => ({ ...x, ...patch }));
    await setPrefsAction(patch);
    router.refresh();
  };
  return (
    <div className="panel panel-pad">
      <div className="setting-row">
        <div className="grow">
          <b>Light or dark</b>
          <span className="small muted">Auto follows your device.</span>
        </div>
        <ModeSwitch mode={p.mode} />
      </div>
      <div className="setting-row">
        <div className="grow">
          <b>Text size</b>
          <span className="small muted">{p.textSize}%</span>
        </div>
        <input
          type="range"
          min={85}
          max={130}
          step={5}
          value={p.textSize}
          style={{ maxWidth: 220 }}
          onChange={(e) => {
            const v = Number(e.target.value);
            setP((x) => ({ ...x, textSize: v }));
            document.documentElement.style.setProperty("--text-scale", String(v / 100));
          }}
          onPointerUp={() => save({ textSize: p.textSize })}
          onKeyUp={() => save({ textSize: p.textSize })}
          aria-label="Text size"
        />
      </div>
      <div className="setting-row">
        <div className="grow">
          <b>Compact</b>
          <span className="small muted">Smaller text in posts and lists, more on the screen.</span>
        </div>
        <Switch
          on={p.density === "compact"}
          label="Compact"
          onChange={(v) => {
            if (v) document.documentElement.dataset.density = "compact";
            else delete document.documentElement.dataset.density;
            void save({ density: v ? "compact" : "comfy" });
          }}
        />
      </div>
      <div className="setting-row">
        <div className="grow">
          <b>Animations</b>
          <span className="small muted">Things lift and glide. Off: nothing moves.</span>
        </div>
        <Switch
          on={p.motion}
          label="Animations"
          onChange={(v) => {
            if (v) delete document.documentElement.dataset.motion;
            else document.documentElement.dataset.motion = "off";
            void save({ motion: v });
          }}
        />
      </div>
      <div className="setting-row">
        <div className="grow">
          <b>Page wipes</b>
          <span className="small muted">Scene-change wipes between pages, like in the old films.</span>
        </div>
        <Switch
          on={p.wipes && p.motion}
          disabled={!p.motion}
          label="Page wipes"
          onChange={(v) => {
            setWipe(v);
            void save({ wipes: v });
          }}
        />
      </div>
    </div>
  );
}
