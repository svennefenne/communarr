"use client";

import { useEffect, useRef, useState } from "react";
import { Expand, Maximize2, MicOff, Minimize2, MonitorUp, PictureInPicture2, Video, Volume2, VolumeX, X } from "lucide-react";
import { useApp, useT, useToast } from "@/components/app/AppProvider";
import { useMembers } from "@/components/app/useMembers";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/ui";
import { useVoice } from "./VoiceProvider";
import { QUALITIES, useStream, type StreamPrefs, type StreamQuality, type Watching } from "./StreamProvider";

const VOLUME_KEY = "hd_stream_volume";

/** A webcam in the panel: whose, and the picture (yours: mirrored, as in a mirror). */
type Tile = { conn: number; userId: number; stream: MediaStream; me: boolean };

/**
 * The call's video, over the page while you move around the site (small, large, or the whole screen):
 * the stream you watch, and the webcams that are on (a grid, or a row under the stream).
 */
export function StreamPlayer() {
  const s = useStream();
  const v = useVoice();
  const { conn, me } = useApp();
  const peers = v.room != null ? (v.channels[v.room] ?? []) : [];
  const tiles: Tile[] = [
    ...(v.camera && me ? [{ conn: conn ?? 0, userId: me.id, stream: v.camera, me: true }] : []),
    ...peers.filter((p) => p.camera && p.conn !== conn && v.cameras[p.conn]).map((p) => ({ conn: p.conn, userId: p.userId, stream: v.cameras[p.conn], me: false })),
  ];
  const cams = s.camsHidden ? [] : tiles;
  return s.watching || cams.length ? <Panel w={s.watching} tiles={cams} /> : null;
}

function Panel({ w, tiles }: { w: Watching | null; tiles: Tile[] }) {
  const s = useStream();
  const v = useVoice();
  const t = useT();
  const people = useMembers();
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [big, setBig] = useState(false);
  const [full, setFull] = useState(false);
  const user = w ? people.get(w.userId) : undefined;

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const fullscreen = () => (document.fullscreenElement ? void document.exitFullscreen() : void box.current?.requestFullscreen().catch(() => {}));
  const pip = !!w && typeof document !== "undefined" && document.pictureInPictureEnabled;
  const name = user?.name ?? t("Someone");
  const label = w ? (w.self ? t("Your stream") : t("{name}'s stream", { name })) : t("Video");
  // the cross: stop watching the stream (the webcams stay), or put the webcams away
  const close = w ? s.unwatch : () => s.setCamsHidden(true);
  const closeLabel = w ? (w.self ? t("Close") : t("Stop watching")) : t("Hide the video");
  return (
    <div ref={box} className={`panel stream-player ${big ? "big" : ""} ${full ? "full" : ""}`} role="region" aria-label={label}>
      <div className="sp-head">
        {w ? (
          <>
            {user ? <Avatar user={user} size={22} /> : null}
            <b className="ellipsis grow">{w.self ? t("Your stream") : name}</b>
            <span className="live-tag">{t("LIVE")}</span>
            {w.relayed ? (
              <span className="pill soft sp-relay" title={t("They couldn't be reached directly: it comes through the site's server, at a lower quality.")}>
                {t("Via the server")}
              </span>
            ) : null}
          </>
        ) : (
          <>
            <Video size={16} className="muted" />
            <b className="ellipsis grow">{v.roomName}</b>
          </>
        )}
        {pip ? (
          <button type="button" className="icon-btn sm" onClick={() => void video.current?.requestPictureInPicture().catch(() => {})} aria-label={t("Picture in picture")} title={t("Picture in picture")}>
            <PictureInPicture2 size={16} />
          </button>
        ) : null}
        <button type="button" className="icon-btn sm sp-size" onClick={() => setBig((b) => !b)} aria-pressed={big} aria-label={big ? t("Smaller") : t("Larger")} title={big ? t("Smaller") : t("Larger")}>
          {big ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button type="button" className="icon-btn sm" onClick={fullscreen} aria-label={full ? t("Leave full screen") : t("Full screen")} title={full ? t("Leave full screen") : t("Full screen")}>
          <Expand size={16} />
        </button>
        <button type="button" className="icon-btn sm sp-close" onClick={close} aria-label={closeLabel} title={closeLabel}>
          <X size={16} />
        </button>
      </div>
      {w ? <Screen w={w} video={video} onFull={fullscreen} /> : null}
      {tiles.length ? (
        <div className={`sp-cams ${w ? "strip" : ""}`} style={{ "--cols": tiles.length < 2 ? 1 : tiles.length <= 4 ? 2 : tiles.length <= 9 ? 3 : 4 } as React.CSSProperties}>
          {tiles.map((tile) => (
            <CamTile key={tile.conn} tile={tile} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The stream itself, with its own volume (and its sound only while you hear the call). */
function Screen({ w, video, onFull }: { w: Watching; video: React.RefObject<HTMLVideoElement | null>; onFull: () => void }) {
  const v = useVoice();
  const t = useT();
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const sound = !w.self && !!(v.room != null && v.channels[v.room]?.find((p) => p.conn === w.conn)?.live?.audio);

  useEffect(() => {
    try {
      const n = Number(localStorage.getItem(VOLUME_KEY));
      if (localStorage.getItem(VOLUME_KEY) != null && n >= 0 && n <= 1) setVolume(n);
    } catch {
      /* the default */
    }
  }, []);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.srcObject = w.stream;
    // a browser that won't play sound by itself yet: the picture without it, and the button to turn it on
    if (w.stream)
      void el.play().catch(() => {
        el.muted = true;
        setMuted(true);
        void el.play().catch(() => {});
      });
  }, [w.stream, video]);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.volume = volume;
    // (your own: never its sound, or you'd hear it twice)
    el.muted = w.self || muted || v.deafened;
  }, [volume, muted, w.self, v.deafened, video]);

  const setVol = (n: number) => {
    setVolume(n);
    setMuted(n === 0);
    try {
      localStorage.setItem(VOLUME_KEY, String(n));
    } catch {
      /* not kept */
    }
  };

  return (
    <div className="sp-screen" onDoubleClick={onFull}>
      <video ref={video} autoPlay playsInline muted />
      {w.state === "connecting" ? <div className="sp-note">{t("Connecting…")}</div> : null}
      {w.state === "failed" ? <div className="sp-note err-text">{w.error || t("Couldn't reach them.")}</div> : null}
      {sound ? (
        <div className="sp-sound">
          <button type="button" className="icon-btn sm" onClick={() => setVol(muted || volume === 0 ? volume || 1 : 0)} aria-label={muted ? t("Sound on") : t("Sound off")} title={muted ? t("Sound on") : t("Sound off")}>
            {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(e) => setVol(Number(e.target.value))} aria-label={t("The stream's volume")} />
        </div>
      ) : null}
    </div>
  );
}

/** One webcam: the picture, whose it is (muted or not), and a ring while they talk. */
function CamTile({ tile }: { tile: Tile }) {
  const v = useVoice();
  const t = useT();
  const people = useMembers();
  const ref = useRef<HTMLVideoElement>(null);
  const user = people.get(tile.userId);
  const peer = v.room != null ? v.channels[v.room]?.find((p) => p.conn === tile.conn) : undefined;
  const talking = v.speaking.has(tile.me ? "me" : tile.conn);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = tile.stream;
    void el.play().catch(() => {});
  }, [tile.stream]);
  return (
    <div className={`cam-tile ${talking ? "talking" : ""}`}>
      <video ref={ref} autoPlay playsInline muted className={tile.me ? "mirror" : ""} />
      <span className="cam-name">
        {(tile.me ? v.muted : peer?.muted) ? <MicOff size={11} /> : null}
        <span className="ellipsis">
          {user?.name ?? t("Someone")}
          {tile.me ? ` ${t("(you)")}` : ""}
        </span>
      </span>
    </div>
  );
}

/** Uploading: what each viewer takes from you, in Mbit/s (one decimal). */
const mbit = (q: StreamQuality) => (QUALITIES[q].bitrate / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 });

/**
 * Going live: how good (the more, the more you send each viewer), made for motion or for text, and
 * the sound: what's shared (where the browser can), none, or a sound device. Then the browser's own
 * picker for the screen, a window or a tab.
 */
export function GoLiveDialog({ onClose }: { onClose: () => void }) {
  const s = useStream();
  const t = useT();
  const toast = useToast();
  const [p, setP] = useState<StreamPrefs>(s.prefs);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [os, setOs] = useState<"linux" | "firefox" | "other">("other");
  useEffect(() => {
    const ua = navigator.userAgent;
    setOs(/Firefox\//.test(ua) ? "firefox" : /Linux/.test(ua) && !/Android/.test(ua) ? "linux" : "other");
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((l) => setDevices(l.filter((d) => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications")))
      .catch(() => {});
  }, []);
  // a device that's gone: the shared sound
  const audio = p.audio === "share" || p.audio === "none" || devices.some((d) => d.deviceId === p.audio) || !devices.length ? p.audio : "share";

  const start = async () => {
    setBusy(true);
    try {
      await s.goLive({ ...p, audio });
      onClose();
    } catch (e) {
      // (the picker closed without choosing: nothing to say)
      const err = e as Error;
      if (err.name !== "NotAllowedError" && err.name !== "AbortError") toast(err.message || t("Sharing didn't start."), { kind: "err" });
      setBusy(false);
    }
  };

  const qualities: StreamQuality[] = ["720p30", "1080p30", "1080p60"];
  return (
    <Modal
      title={t("Share your screen")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className={`btn btn-primary ${busy ? "loading" : ""}`} disabled={busy} onClick={() => void start()}>
            <MonitorUp size={16} /> {t("Choose what to share")}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <span className="label">{t("Quality")}</span>
          <div className="pills" role="group" aria-label={t("Quality")}>
            {qualities.map((q) => (
              <button key={q} type="button" className={`pill ${p.quality === q ? "active" : ""}`} aria-pressed={p.quality === q} onClick={() => setP({ ...p, quality: q })}>
                {QUALITIES[q].height}p · {QUALITIES[q].fps}
              </button>
            ))}
          </div>
          <span className="small muted">{t("It goes straight from you to each one watching: about {n} Mbit/s of your upload for each.", { n: mbit(p.quality) })}</span>
        </div>
        <div className="field">
          <span className="label">{t("Best for")}</span>
          <div className="pills" role="group" aria-label={t("Best for")}>
            <button type="button" className={`pill ${p.hint === "motion" ? "active" : ""}`} aria-pressed={p.hint === "motion"} onClick={() => setP({ ...p, hint: "motion" })}>
              {t("Motion (games, films)")}
            </button>
            <button type="button" className={`pill ${p.hint === "detail" ? "active" : ""}`} aria-pressed={p.hint === "detail"} onClick={() => setP({ ...p, hint: "detail" })}>
              {t("Text and detail")}
            </button>
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="stream-audio">
            {t("Sound")}
          </label>
          <select id="stream-audio" className="select" value={audio} onChange={(e) => setP({ ...p, audio: e.target.value })} style={{ maxWidth: 420 }}>
            <option value="share">{t("The sound of what you share")}</option>
            <option value="none">{t("No sound")}</option>
            {devices.length ? (
              <optgroup label={t("From a sound device")}>
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || t("Sound device {n}", { n: i + 1 })}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          <span className="small muted">
            {os === "linux"
              ? t("On Linux the browser can't take the sound of an app or the whole screen (only of a tab). Pick a sound device instead, e.g. a “Monitor of …” for what the computer plays.")
              : os === "firefox"
                ? t("Firefox can't take the sound of what you share: pick a sound device, or share from Chrome or Edge.")
                : t("Choose a window to share its sound, or the whole screen for everything the computer plays.")}
          </span>
        </div>
      </div>
    </Modal>
  );
}
