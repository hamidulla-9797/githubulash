#!/bin/bash
# Bulut (Linux) sessiyasida Reel Studio'ni ishga tayyorlaydi: ~/VideoMontaj havolasi, Remotion, whisper-cli, Chromium.
# Mac'da ornatish.sh ishlatiladi — bu skript faqat Linux uchun.
[ "$(uname)" = "Linux" ] || exit 0
R="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
V="$R/VideoMontaj"
ln -sfn "$V" "$HOME/VideoMontaj"
mkdir -p "$V/ish" "$V/modellar"
if [ ! -d "$V/grafika/node_modules/@remotion" ]; then
  (cd "$V/grafika" && npm_config_cache="$HOME/.npm-kesh" npm ci --no-audit --no-fund --loglevel=error >/dev/null 2>&1)
fi
if ! command -v whisper-cli >/dev/null && [ ! -x "$HOME/whisper.cpp/build/bin/whisper-cli" ]; then
  (git clone -q --depth 1 https://github.com/ggml-org/whisper.cpp.git "$HOME/whisper.cpp" \
    && cd "$HOME/whisper.cpp" && cmake -B build -DCMAKE_BUILD_TYPE=Release >/dev/null \
    && cmake --build build -j8 --target whisper-cli >/dev/null) >/dev/null 2>&1 || true
fi
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  [ -x "$HOME/whisper.cpp/build/bin/whisper-cli" ] && echo "export MONTAJ_WHISPER=$HOME/whisper.cpp/build/bin/whisper-cli" >> "$CLAUDE_ENV_FILE"
  B=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -1)
  [ -n "$B" ] && echo "export MONTAJ_BROWSER=$B" >> "$CLAUDE_ENV_FILE"
fi
exit 0
