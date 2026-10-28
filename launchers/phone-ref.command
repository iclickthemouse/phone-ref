#!/bin/bash
# Double-click to start phone-ref. Keep this window open; close it (or press Ctrl+C) to stop.
cd "$(dirname "$0")" || exit 1
xattr -dr com.apple.quarantine . 2>/dev/null   # files downloaded from the internet are blocked until this is cleared
if [ "$(uname -m)" = "arm64" ]; then BIN=./phone-ref-mac-arm64; else BIN=./phone-ref-mac-intel; fi
chmod +x "$BIN" 2>/dev/null
exec "$BIN" "$@"
