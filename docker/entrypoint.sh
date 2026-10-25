#!/bin/sh
# Run Communarr as PUID:PGID (Unraid: 99:100 = nobody:users; most Linux machines: 1000:1000)
# so the files it writes in /data get the owner you expect.
set -e
PUID=${PUID:-99}
PGID=${PGID:-100}
umask "${UMASK:-002}"
if [ "$(id -u)" = "0" ]; then
  if ! getent group "$PGID" >/dev/null; then groupadd -g "$PGID" communarr; fi
  if ! getent passwd "$PUID" >/dev/null; then useradd -u "$PUID" -g "$PGID" -d /data -M -s /usr/sbin/nologin communarr; fi
  mkdir -p /data/cache/next /data/uploads
  chown "$PUID:$PGID" /data /data/cache /data/cache/next /data/uploads
  # only what isn't theirs yet (a big uploads folder isn't walked on every start)
  find /data -maxdepth 2 ! -user "$PUID" -exec chown -R "$PUID:$PGID" {} + 2>/dev/null || true
  exec gosu "$PUID:$PGID" "$@"
fi
mkdir -p /data/cache/next /data/uploads 2>/dev/null || true
exec "$@"
