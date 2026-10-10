#!/usr/bin/env bash
# DEV ONLY. Puts the Kindred app in the simulator back into a "fresh guest install"
# state for the onboarding v2 flow, without reinstalling.
#
# What it does (booted iOS simulator only):
#   1. Terminates the app.
#   2. Backs up, then edits the app's AsyncStorage manifest:
#      removes "hasEverSignedIn" and sets "guestInstall" to "true".
#   3. Relaunches the app.
#
# It does NOT clear the Keychain (auth tokens survive reinstalls and this script).
# For a full reset use: xcrun simctl erase <device>  (the simulator must be shut down).
# Per-user onboarding flags can also be cleared in the app: kindred:///dev-onboarding.
#
# Usage: scripts/onboarding-dev-reset.sh
# Env:   KINDRED_BUNDLE_ID  override the bundle id (default com.kindred.kindredtsl,
#                           the id in frontend/ios/Kindred.xcodeproj)
set -euo pipefail

BUNDLE_ID="${KINDRED_BUNDLE_ID:-com.kindred.kindredtsl}"
BACKUP_DIR="$HOME/Library/Caches/kindred-onboarding-dev"

fail() { echo "onboarding-dev-reset: $*" >&2; exit 1; }

xcrun simctl list devices booted | grep -q "(Booted)" || fail "no booted simulator"

xcrun simctl terminate booted "$BUNDLE_ID" 2>/dev/null || true

DATA_DIR="$(xcrun simctl get_app_container booted "$BUNDLE_ID" data 2>/dev/null)" \
    || fail "app $BUNDLE_ID is not installed on the booted simulator"
[ -d "$DATA_DIR" ] || fail "data container not found: $DATA_DIR"

MANIFESTS="$(find "$DATA_DIR/Library/Application Support" -path '*/RCTAsyncLocalStorage_V1/manifest.json' 2>/dev/null || true)"
COUNT="$(printf '%s' "$MANIFESTS" | grep -c . || true)"
[ "$COUNT" -eq 1 ] || fail "expected 1 AsyncStorage manifest, found $COUNT: ${MANIFESTS:-none}"
MANIFEST="$MANIFESTS"

mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/manifest-$(date +%Y%m%d-%H%M%S).json"
cp "$MANIFEST" "$BACKUP"
echo "Backed up manifest to $BACKUP"

# Args: manifest path. Python runs isolated (-I) and only touches that file.
python3 -I -c '
import json, os, sys
path = sys.argv[1]
with open(path) as f:
    data = json.load(f)
if not isinstance(data, dict):
    sys.exit("manifest is not a JSON object")
data.pop("hasEverSignedIn", None)
data["guestInstall"] = "true"
tmp = path + ".tmp"
with open(tmp, "w") as f:
    json.dump(data, f)
os.replace(tmp, path)
with open(path) as f:
    check = json.load(f)
assert "hasEverSignedIn" not in check and check.get("guestInstall") == "true", "verification failed"
' "$MANIFEST" || fail "failed to edit manifest (backup kept at $BACKUP)"
echo "Edited manifest: removed hasEverSignedIn, set guestInstall=true"

xcrun simctl launch booted "$BUNDLE_ID" >/dev/null
echo "Relaunched $BUNDLE_ID"
