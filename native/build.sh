#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

MODE="${1:-debug}"
case "$MODE" in
  debug) CONFIG="Debug" ;;
  release) CONFIG="Release" ;;
  *)
    echo "usage: $0 [debug|release]" >&2
    exit 1
    ;;
esac

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen not found. Install it with: brew install xcodegen" >&2
  exit 1
fi

SIGNING_IDENTITY="${MANGABOOK_CODESIGN_IDENTITY:-}"
if [ -z "$SIGNING_IDENTITY" ]; then
  SIGNING_IDENTITY=$(security find-identity -v -p codesigning | awk '/"Developer ID Application:/ { print $2; exit }')
fi
if [ -z "$SIGNING_IDENTITY" ]; then
  echo "No Developer ID signing identity found. Set MANGABOOK_CODESIGN_IDENTITY to a code-signing certificate." >&2
  echo "For a temporary local build, set MANGABOOK_CODESIGN_IDENTITY=- (privacy grants may not survive rebuilds)." >&2
  exit 1
fi
if [ "$SIGNING_IDENTITY" = "-" ]; then
  echo "Warning: ad-hoc signing does not preserve a stable app identity across rebuilds." >&2
fi

(
  cd MangaBook
  xcodegen generate >/dev/null
)

xcodebuild \
  -project MangaBook/MangaBook.xcodeproj \
  -scheme MangaBook \
  -configuration "$CONFIG" \
  -derivedDataPath .build-xcode \
  CODE_SIGNING_ALLOWED=NO \
  build

APP_PATH="$(pwd)/.build-xcode/Build/Products/$CONFIG/MangaBook.app"
codesign --force --sign "$SIGNING_IDENTITY" --identifier com.kevin.mangabook --timestamp=none "$APP_PATH"
codesign --verify --deep --strict "$APP_PATH"

echo ""
echo "Built: $APP_PATH"
