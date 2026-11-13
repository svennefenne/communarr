import { contextBridge, ipcRenderer } from "electron";

/**
 * The page's side of the app.
 *
 * On the server's pages: window.CommunarrApp, the same as in the Android app (the site's androidApp.ts
 * talks to both): postMessage(json) to the app, "message" events ({data: json}) back. The main process
 * listens to the server's own pages only.
 *
 * On the app's own pages (connect, offline, picker): window.desktop.call(name, …args), their few calls.
 */
if (location.protocol === "file:") {
  contextBridge.exposeInMainWorld("desktop", {
    call: (name: string, ...args: unknown[]) => ipcRenderer.invoke("local", name, ...args),
  });
} else {
  const toPage: ((data: string) => void)[] = [];
  ipcRenderer.on("to-page", (_e, data: string) => {
    for (const f of toPage) f(data);
  });
  // (made in the page's own world, so that the page's listeners stay the same functions it removes later)
  contextBridge.executeInMainWorld({
    func: (post: (m: string) => void, listen: (f: (data: string) => void) => void) => {
      type L = (e: { data: string }) => void;
      const listeners = new Set<L>();
      listen((data) => {
        for (const l of [...listeners]) {
          try {
            l({ data });
          } catch (e) {
            console.error(e);
          }
        }
      });
      Object.defineProperty(window, "CommunarrApp", {
        value: Object.freeze({
          postMessage: (m: string) => post(String(m)),
          addEventListener: (type: string, l: L) => {
            if (type === "message" && typeof l === "function") listeners.add(l);
          },
          removeEventListener: (_type: string, l: L) => {
            listeners.delete(l);
          },
        }),
      });
    },
    args: [(m: string) => ipcRenderer.send("from-page", m), (f: (data: string) => void) => void toPage.push(f)],
  });
}
