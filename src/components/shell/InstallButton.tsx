"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { useSite, useT } from "@/components/app/AppProvider";
import { Modal } from "@/components/ui/ui";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** The Android app's download (GitHub builds it from android/), where the server has no copy of its own. */
const ANDROID_APK = "https://github.com/svennefenne/communarr/releases/latest/download/communarr-android.apk";

/** In the Android app (its web view says so in its user agent). */
export const inApp = () => typeof navigator !== "undefined" && navigator.userAgent.includes("CommunarrApp/");

export function isStandalone() {
  return typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true || inApp());
}

export function isIos() {
  return typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
}

/** How to put the site on the home screen, for each kind of device. */
export function InstallHelp() {
  const t = useT();
  const site = useSite();
  return (
    <div className="stack small">
      <p style={{ margin: 0 }}>{t("Installed, the site opens like an app, full screen, and can send you notifications even when it's closed.")}</p>
      <div>
        <b>{t("iPhone and iPad (Safari)")}</b>
        <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
          <li>{t("Tap the Share button (the square with the arrow).")}</li>
          <li>
            {t("Choose")} <b>{t("Add to Home Screen")}</b>, {t("then")} <b>{t("Add")}</b>.
          </li>
          <li>{t("Open it from the home screen and turn notifications on under Settings → Notifications.")}</li>
        </ol>
      </div>
      <div>
        <b>Android (Chrome)</b>
        <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
          <li>{t("Tap the ⋮ menu.")}</li>
          <li>
            {t("Choose")} <b>{t("Install app")}</b> ({t("or")} <b>{t("Add to Home screen")}</b>).
          </li>
        </ol>
        <p style={{ margin: "6px 0 0" }}>
          {t("Or the Android app:")}{" "}
          <a className="link" href={site.androidApp ?? ANDROID_APK}>
            {t("download it")}
          </a>{" "}
          {t("and log in with this site's address, your username and password.")}
        </p>
      </div>
      <div>
        <b>{t("Computer (Chrome, Edge)")}</b>
        <p style={{ margin: "6px 0 0" }}>{t("Click the install icon at the right end of the address bar.")}</p>
      </div>
      <p className="muted" style={{ margin: 0 }}>{t("Notifications need the site to be opened over https://.")}</p>
    </div>
  );
}

/** "Get the app": the steps for each kind of device (and the Android app), with the browser's own install first where it has one. */
export function InstallButton() {
  const t = useT();
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
        onClick={() => setHelp(true)}
      >
        <Smartphone size={13} /> {t("Get the app")}
      </button>
      {help ? (
        <Modal title={t("Get the app")} onClose={() => setHelp(false)}>
          {prompt ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginBottom: 14 }}
              onClick={async () => {
                await prompt.prompt();
                setPrompt(null);
                setHelp(false);
              }}
            >
              <Smartphone size={16} /> {t("Install it here")}
            </button>
          ) : null}
          <InstallHelp />
        </Modal>
      ) : null}
    </>
  );
}
