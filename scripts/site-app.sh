#!/bin/bash
# The Android app under a site's own name, for its server: built and signed (android/, with the key in
# keystore.properties), then copied to the server's data folder (apps/) as <name>-<version>.apk. The
# app on everyone's phone offers it as an update (and the site's Get the app links to it).
#   scripts/site-app.sh <name> <application id> <ssh host>:<data folder>/apps
#   e.g. scripts/site-app.sh Friends com.example.friends me@server:/srv/friends/data/apps
set -euo pipefail
[ $# -eq 3 ] || { sed -n '2,6p' "$0"; exit 1; }
name=$1 id=$2 dest=$3
cd "$(dirname "$0")/../android"
./gradlew -q assembleRelease -PappName="$name" -PappId="$id"
version=$(sed -n 's/^ *versionName = "\(.*\)"$/\1/p' app/build.gradle.kts)
file="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]')-$version.apk"
scp app/build/outputs/apk/release/app-release.apk "$dest/$file"
echo "$file is on the server: the app offers it as an update."
