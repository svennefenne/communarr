"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { useSite, useT } from "@/components/app/AppProvider";
import { inApp } from "@/components/app/androidApp";
import { Modal } from "@/components/ui/ui";

/** The Android app's download (GitHub builds it from android/), where the server has no copy of its own. */
const ANDROID_APK = "https://github.com/svennefenne/communarr/releases/latest/download/communarr-android.apk";

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

/** The desktop app's files, in this order. */
const DESKTOP: { platform: "linux-x86_64" | "windows-x64" | "macos-arm64"; name: string }[] = [
  { platform: "linux-x86_64", name: "Linux" },
  { platform: "windows-x64", name: "Windows" },
  { platform: "macos-arm64", name: "Mac" },
];

/**
 * "Download the app" (the user menu's, and the footer's): the desktop app for each kind of computer
 * (the server's own copy, else Communarr's), the Android app, and the site on an iPhone's home screen.
 */
export function GetAppDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const site = useSite();
  // (Communarr's own desktop app asks for the server's address the first time; a server's copy knows it)
  const generic = Object.values(site.desktopApps).some((u) => /\/communarr-desktop-|github\.com/.test(u));
  const list = { margin: "6px 0 0", paddingLeft: 20 };
  return (
    <Modal title={t("Download the app")} onClose={onClose}>
      <div className="stack small">
        <div>
          <b>{t("Desktop")}</b>
          <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none" }}>
            {DESKTOP.map((d) => (
              <li key={d.platform}>
                <a className="link" href={site.desktopApps[d.platform]}>
                  {d.name}
                </a>
              </li>
            ))}
          </ul>
          <p style={{ margin: "6px 0 0" }}>
            {generic ? `${t("The first time, it asks for this site's address: {address}", { address: typeof location === "undefined" ? "" : location.host })} ` : ""}
            {t("The apps aren't signed, so Windows may warn first (More info → Run anyway), and on a Mac you right-click the app and choose Open the first time. On Linux, make the file executable and start it.")}
          </p>
        </div>
        <div>
          <b>Android</b>
          <p style={{ margin: "6px 0 0" }}>
            <a className="link" href={site.androidApp ?? ANDROID_APK}>
              {t("download it")}
            </a>{" "}
            {t("and log in with this site's address, your username and password.")}
          </p>
        </div>
        <div>
          <b>
            {t("iPhone and iPad")} <i>{t("(Web app in Safari)")}</i>
          </b>
          <ol style={list}>
            <li>{t("Tap the Share button (the square with the arrow).")}</li>
            <li>
              {t("Choose")} <b>{t("Add to Home Screen")}</b>, {t("then")} <b>{t("Add")}</b>.
            </li>
            <li>{t("Open it from the home screen and turn notifications on under Settings → Notifications.")}</li>
          </ol>
        </div>
      </div>
    </Modal>
  );
}

/** Download the app in the footer, where the site isn't installed already (the user menu has it too). */
export function InstallButton() {
  const t = useT();
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(true);
  useEffect(() => setInstalled(isStandalone()), []);
  if (installed) return null;
  return (
    <>
      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setHelp(true)}>
        <Smartphone size={13} /> {t("Download the app")}
      </button>
      {help ? <GetAppDialog onClose={() => setHelp(false)} /> : null}
    </>
  );
}
