#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
./build.sh debug
open .build-xcode/Build/Products/Debug/MangaBook.app
