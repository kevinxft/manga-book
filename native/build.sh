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

echo ""
echo "Built: $(pwd)/.build-xcode/Build/Products/$CONFIG/MangaBook.app"
