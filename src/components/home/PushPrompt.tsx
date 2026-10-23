"use client";

import { useEffect, useState } from "react";
import { BellRing, Smartphone, X } from "lucide-react";
import { enablePush, pushState, type PushState } from "@/components/app/push";
import { Modal } from "@/components/ui/ui";
import { InstallHelp } from "@/components/shell/InstallButton";
import { useToast } from "@/components/app/AppProvider";

const KEY = "hd.pushPrompt";

/** Once per device: "Get notified here?" (and on an iPhone, how to install the app first). */
export function PushPrompt() {
  const [state, setState] = useState<PushState | null>(null);
  const [hidden, setHidden] = useState(true);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(KEY) === "no");
    } catch {
      setHidden(false);
    }
    pushState().then(setState);
  }, []);
  if (hidden || !state || (state !== "off" && state !== "needs-install")) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "no");
    } catch {
      /* private mode */
    }
  };
  return (
    <div className="panel push-prompt">
      <span className="kind-icon event">{state === "needs-install" ? <Smartphone size={20} /> : <BellRing size={20} />}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <b>{state === "needs-install" ? "Get notifications on your iPhone" : "Get notified on this device?"}</b>
        <div className="small muted">{state === "needs-install" ? "Add the site to your home screen first, then open it from there." : "Messages, mentions, invites and reminders, even with the site closed."}</div>
      </div>
      {state === "needs-install" ? (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setHelp(true)}>
          Show me how
        </button>
      ) : (
        <button
          type="button"
          className={`btn btn-primary btn-sm ${busy ? "loading" : ""}`}
          onClick={async () => {
            setBusy(true);
            const s = await enablePush().catch(() => "off" as PushState);
            setBusy(false);
            setState(s);
            if (s === "on") toast("Notifications are on for this device.");
            else if (s === "denied") toast("The browser said no. You can allow notifications in the site settings.", { kind: "err" });
          }}
        >
          Turn on
        </button>
      )}
      <button type="button" className="icon-btn sm" onClick={dismiss} aria-label="Not now">
        <X size={16} />
      </button>
      {help ? (
        <Modal title="Add to your home screen" onClose={() => setHelp(false)}>
          <InstallHelp />
        </Modal>
      ) : null}
    </div>
  );
}
