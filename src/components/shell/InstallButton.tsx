"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Modal } from "@/components/ui/ui";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function isStandalone() {
  return typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

export function isIos() {
  return typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
}

/** How to put the site on the home screen, for each kind of device. */
export function InstallHelp() {
  return (
    <div className="stack small">
      <p style={{ margin: 0 }}>Installed, the site opens like an app, full screen, and can send you notifications even when it&apos;s closed.</p>
      <div>
        <b>iPhone and iPad (Safari)</b>
        <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
          <li>Tap the Share button (the square with the arrow).</li>
          <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
          <li>Open it from the home screen and turn notifications on under Settings → Notifications.</li>
        </ol>
      </div>
      <div>
        <b>Android (Chrome)</b>
        <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
          <li>Tap the ⋮ menu.</li>
          <li>Choose <b>Install app</b> (or <b>Add to Home screen</b>).</li>
        </ol>
      </div>
      <div>
        <b>Computer (Chrome, Edge)</b>
        <p style={{ margin: "6px 0 0" }}>Click the install icon at the right end of the address bar.</p>
      </div>
      <p className="muted" style={{ margin: 0 }}>Notifications need the site to be opened over https://.</p>
    </div>
  );
}

/** "Get the app": the browser's own install prompt where there is one, the steps otherwise. */
export function InstallButton() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(true);
  useEffect(() => {
    setInstalled(isStandalone());
    const on = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  if (installed) return null;
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            setPrompt(null);
          } else setHelp(true);
        }}
      >
        <Smartphone size={13} /> Get the app
      </button>
      {help ? (
        <Modal title="Get the app" onClose={() => setHelp(false)}>
          <InstallHelp />
        </Modal>
      ) : null}
    </>
  );
}
