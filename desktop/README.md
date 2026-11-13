# Communarr for the computer

Your Communarr server's site in a window of its own, on Windows, macOS (Apple silicon) and Linux. Close
the window and it stays in the tray (the menu bar on a Mac), where its menu has:

- **Open Communarr**: the window.
- **Start when I log in**: at login it opens no window, only its tray icon.
- **Change server…**: another server's address.
- **Quit**

In the window it's the site as in a browser, but only the server's: links elsewhere open in the browser.
What's different from a browser:

- **Notifications** come while the app runs, also from the tray: the server sends them down the app's
  live stream (it has no web push). While its window is in front there are none (the site shows its own
  toasts), and while you're using the computer (not idle for 3 minutes, nor locked) they come here
  instead of to your phone. A click opens the window at their page. The tray icon gets a dot, and the
  app's icon a count (the Dock, Windows' taskbar, Linux docks that show them), while something is unread.
- **Sharing the screen** (Go live) asks in the app's own picker which screen or window, with no "is
  sharing" bar. On Windows the computer's sound can go along (all of it, the call's voices too: use
  headphones). On Linux with Wayland the desktop's own picker asks instead; for sound, pick a sound
  device such as a "Monitor of …" in Go live. On a Mac (macOS 15 and later) macOS's own picker asks.
- **Updates**: when the server has a newer version, the user menu offers *New version …* and *Update*
  (and *Check for updates*; the app's version is at the menu's end). It downloads the new version in the
  background, checks it against the digest the server gives, puts it in place of itself and starts again
  where it was, opening nothing. On Linux the AppImage file is replaced where it is; on Windows the
  installer runs silently; on a Mac the app in its folder is swapped. A copy that can't write over itself
  (run from source, or from a folder it may not change) opens the new version in the browser instead.
- Right-click for spelling suggestions, copy and paste, and links and images; Ctrl + / Ctrl − / Ctrl 0
  zoom (Cmd on a Mac).

The app's own words (its tray, its pages) are in the site's language, Swedish or English.

## Installing

*Get the app* on the site links to the file for each kind of computer: the server's own copy (below), or
Communarr's from the newest `desktop-v…` release on the
[releases page](https://github.com/svennefenne/communarr/releases). Communarr's asks for the server's
address the first time; a server's own copy goes straight there.

- **Windows**: run `communarr-desktop-windows-x64-setup.exe`. It installs for you (no administrator
  needed) with a Start menu and desktop entry, and it's uninstalled from Windows' list of apps. The
  installer isn't signed, so Windows may say it protected your PC: choose *More info → Run anyway*.
- **macOS** (Apple silicon): unzip `communarr-desktop-macos-arm64.zip` and move *Communarr* to
  Applications. The app isn't notarized: the first time, right-click it and choose *Open*, then *Open*
  again. macOS asks the first time the app uses the microphone, the camera or the screen.
- **Linux**: `communarr-desktop-linux-x86_64.AppImage` is the whole app in one file. Make it executable
  (in the file's properties, or `chmod +x`) and start it. It puts itself in the desktop's menus (and keeps
  them pointing at the file wherever it's moved); with AppImageLauncher it lets that do it. On GNOME,
  tray icons need the *AppIndicator and KStatusNotifierItem Support* extension.

## A server's own copy

The same app with a name of its own (in its window, tray, menus and installer), its own id (so it
installs beside Communarr) and the site's address, where it goes straight away:

```sh
scripts/site-desktop.sh Friends com.example.friends https://friends.example me@server:/srv/friends/data/apps
```

It makes `friends-desktop-<version>-linux-x86_64.AppImage`, `…-windows-x64-setup.exe` and
`…-macos-arm64.zip` (`desktop/scripts/site-copy.mjs`) and copies them to the server's data folder, under
`apps/`. The site serves them from its root to anyone (they're installed before logging in), *Get the
app* links to them, and the copies on everyone's computers offer them as updates. Run it on Linux with
Node.js, `unzip` and `zip`: Linux's and Windows' copies are built from the checkout (no Wine needed), and
the Mac's is made from Communarr's own build of the same version on GitHub, renamed and signed again ad
hoc with [rcodesign](https://github.com/indygreg/apple-platform-rs) (downloaded and checked against its
digest the first time). So run it after the Desktop app workflow has published that version; without
it, there's no Mac copy that time. Run it again whenever `desktop/`'s version changes.

## Development

```sh
cd desktop
npm ci
npm start                                  # build and run it (from source it can't update itself)
COMMUNARR_DATA=/tmp/communarr npm start    # with a data folder of its own
npm test                                   # its rules: addresses, site.json, updates' files, words
npx electron-builder --linux               # the AppImage, in release/
```

`npm start` against a server on this computer over plain http works for `localhost` and `127.0.0.1`
only (they're secure to a browser, so the microphone works); anywhere else the server must be HTTPS.

- `src/main.ts`: starting, the window's messages (`window.CommunarrApp`, the same bridge as the Android
  app's), the session's permissions (only the server's pages get the microphone, the camera, the screen
  and notifications), the app's own pages (`pages/`: the server's address, the server out of reach, the
  screen picker).
- `src/window.ts`: the window; `src/tray.ts`, `src/notify.ts`, `src/capture.ts`, `src/updater.ts`,
  `src/autostart.ts`, `src/linux.ts` (the desktop file and icon); `src/site.ts`: which app this is
  (`resources/site.json` for a server's copy) and its settings (`settings.json` in its data folder).
- The site knows the app by its user agent, `CommunarrDesktop/<version> (<name>; <computer>)`
  (`src/components/app/androidApp.ts`), and the server by its live stream (`src/lib/hub.ts`).

The workflow (`.github/workflows/desktop.yml`) builds it on each system, runs `--check` (the built app's
own test: its parts are there and its pages talk to it), installs, checks and uninstalls the Windows
installer, verifies the Mac's signature, and on `main` publishes the three files as the release
`desktop-v<version>` (from `package.json`; never marked latest, which is the Android app's). Raise the
version in `package.json` for an update to be offered.
