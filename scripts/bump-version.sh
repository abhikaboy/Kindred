#!/usr/bin/env bash
# Bumps the iOS build number stored on EAS (eas.json uses appVersionSource: remote),
# and optionally sets the marketing version in every file that carries it.
#
# Usage: scripts/bump-version.sh [--version X.Y.Z] [--build N] [--skip-remote]
#   --version X.Y.Z  set the marketing version (app.json, package.json, Info.plist, Xcode project)
#   --build N        set the remote build number to N instead of remote + 1
#   --skip-remote    only update local version files
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/frontend"
VERSION=""
BUILD=""
SKIP_REMOTE=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        --build) BUILD="$2"; shift 2 ;;
        --skip-remote) SKIP_REMOTE=1; shift ;;
        -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

if [[ -n "$VERSION" ]]; then
    if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "Version must look like 1.2.3, got: $VERSION" >&2
        exit 1
    fi
    echo "Setting marketing version to $VERSION"
    python3 - "$FRONTEND" "$VERSION" <<'EOF'
import json, re, sys, pathlib
frontend, version = pathlib.Path(sys.argv[1]), sys.argv[2]

for name, keys in (("app.json", ("expo", "version")), ("package.json", ("version",))):
    path = frontend / name
    data = json.loads(path.read_text())
    target = data
    for key in keys[:-1]:
        target = target[key]
    target[keys[-1]] = version
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

# The main app's Info.plist hardcodes the string; extensions read $(MARKETING_VERSION).
plist = frontend / "ios/Kindred/Info.plist"
plist.write_text(re.sub(
    r"(<key>CFBundleShortVersionString</key>\s*<string>)[^<$]*(</string>)",
    rf"\g<1>{version}\g<2>", plist.read_text()))

pbx = frontend / "ios/Kindred.xcodeproj/project.pbxproj"
pbx.write_text(re.sub(r"MARKETING_VERSION = [^;]+;", f"MARKETING_VERSION = {version};", pbx.read_text()))
EOF
fi

if [[ "$SKIP_REMOTE" -eq 1 ]]; then
    echo "Skipping remote build number."
    exit 0
fi

command -v expect >/dev/null || { echo "expect is required to drive 'eas build:version:set'." >&2; exit 1; }

cd "$FRONTEND"
# EAS prints environment notices on stdout ahead of the JSON, so extract the object.
remote_build() {
    bunx eas-cli build:version:get -p ios --json 2>/dev/null |
        python3 -c 'import json,re,sys; print(json.loads(re.search(r"\{.*\}", sys.stdin.read(), re.S).group())["buildNumber"])'
}

CURRENT="$(remote_build)"
NEXT="${BUILD:-$((CURRENT + 1))}"
echo "Remote iOS build number: $CURRENT -> $NEXT"

# build:version:set has no value flag, so answer its prompt (clearing the prefilled default first).
expect <<EOF
set timeout 120
spawn bunx eas-cli build:version:set -p ios
expect {
    "What version would you like to set?" {
        send [string repeat "\177" 12]
        send "$NEXT\r"
        exp_continue
    }
    eof
}
EOF

UPDATED="$(remote_build)"
if [[ "$UPDATED" != "$NEXT" ]]; then
    echo "Remote build number is $UPDATED, expected $NEXT." >&2
    exit 1
fi
echo "Remote iOS build number is now $UPDATED."
