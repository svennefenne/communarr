#!/bin/bash
# The desktop app under a site's own name, for its server: made for Linux, Windows and macOS
# (desktop/scripts/site-copy.mjs: Linux and Windows built from this checkout, the Mac's made from
# Communarr's own build of the same version on GitHub, so run it once the Desktop app workflow has
# published that), then copied to the server's data folder (apps/) as
# <name>-desktop-<version>-<computer>.<ext>. The app on everyone's computer offers it as an update, and
# the site's Get the app links to it. Run on Linux, with Node.js, unzip and zip.
#   scripts/site-desktop.sh <name> <app id> <site address> <ssh host>:<data folder>/apps
#   e.g. scripts/site-desktop.sh Friends com.example.friends https://friends.example me@server:/srv/friends/data/apps
set -euo pipefail
[ $# -eq 4 ] || { sed -n '2,10p' "$0"; exit 1; }
name=$1 id=$2 site=$3 dest=$4
cd "$(dirname "$0")/../desktop"
[ -d node_modules ] || npm ci
npm run --silent build
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
status=0
node scripts/site-copy.mjs "$name" "$id" "$site" "$out" || status=$?
[ "$status" -eq 0 ] || [ "$status" -eq 2 ] || exit "$status"
scp "$out"/* "$dest/"
echo "On the server: $(cd "$out" && ls | tr '\n' ' ')"
echo "The app offers them as an update, and Get the app links to them."
[ "$status" -eq 0 ] || echo "(No Mac copy this time: see above.)"
