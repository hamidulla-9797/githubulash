#!/bin/bash
# Reel Studio (VideoMontaj) — yangi Mac'ga o'rnatish.
#   bash ornatish.sh
# Nima qiladi: dasturlar (brew) → ~/VideoMontaj → RubaiSTT modeli → Mixkit ovoz/musiqa → Remotion → Claude skilli → Montaj.app
# Qayta ishga tushirsa bo'ladi: bor narsani o'tkazib yuboradi, ~/VideoMontaj bo'lsa zaxira nusxa oladi.
set -euo pipefail

BU="$(cd "$(dirname "$0")" && pwd)"
MANZIL="$HOME/VideoMontaj"
MODEL_MD5="58e6b64919b2cfed69ba20c069eaab74"
qadam() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
xato()  { printf '\n\033[31m✗ %s\033[0m\n' "$1"; exit 1; }

qadam "1/8 Tizim tekshiruvi"
[ "$(uname)" = "Darwin" ] || xato "Faqat macOS uchun."
[ "$(uname -m)" = "arm64" ] || echo "  ⚠️  Intel Mac: ffmpeg-full yo'li boshqacha, oddiy (auto) rejimda subtitr chiqmasligi mumkin. Apple Silicon (M1+) tavsiya."
xcode-select -p >/dev/null 2>&1 || { xcode-select --install || true; xato "Xcode Command Line Tools o'rnatilmoqda. Tugagach skriptni qayta ishga tushiring."; }
command -v brew >/dev/null || xato "Homebrew yo'q. Avval o'rnating (https://brew.sh):
  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"
keyin skriptni qayta ishga tushiring."
echo "  ✓ macOS, Xcode CLT, Homebrew"

qadam "2/8 Dasturlar: ffmpeg, ffmpeg-full, whisper-cpp, node"
# Bor bo'lsa (brew'dan bo'lmasa ham, masalan nodejs.org o'rnatuvchisi) — tegilmaydi
bormi() {
  case "$1" in
    ffmpeg-full) [ -x "$(brew --prefix)/opt/ffmpeg-full/bin/ffmpeg" ] ;;
    whisper-cpp) command -v whisper-cli >/dev/null ;;
    *)           command -v "$1" >/dev/null ;;
  esac
}
for f in ffmpeg ffmpeg-full whisper-cpp node; do
  if bormi "$f"; then echo "  ✓ $f bor"; else brew install "$f"; fi
done
# ffmpeg-full o'rnatilganda x265 yangilanib oddiy ffmpeg buzilishi mumkin — tekshiramiz
ffmpeg -hide_banner -version >/dev/null 2>&1 || brew upgrade ffmpeg

qadam "3/8 Loyiha → $MANZIL"
if [ -d "$MANZIL" ]; then
  Z="$MANZIL.bak-$(date +%Y%m%d-%H%M%S)"
  echo "  ~/VideoMontaj bor edi → zaxira: $Z (ish/ papkangiz o'sha yerda)"
  mv "$MANZIL" "$Z"
fi
cp -R "$BU/VideoMontaj" "$MANZIL"
mkdir -p "$MANZIL/ish" "$MANZIL/modellar"
echo "  ✓ nusxalandi"

qadam "4/8 RubaiSTT modeli (o'zbekcha nutqni tanish, ~820 MB)"
M=""
for c in "$BU/ggml-rubaistt.bin" "$BU/../ggml-rubaistt.bin" "$HOME/Downloads/ggml-rubaistt.bin" "${Z:-/yoq}/modellar/ggml-rubaistt.bin"; do
  [ -f "$c" ] && { M="$c"; break; }
done
[ -n "$M" ] || xato "ggml-rubaistt.bin topilmadi. Uni shu papka yoniga yoki ~/Downloads ga qo'ying va qayta ishga tushiring."
cp -c "$M" "$MANZIL/modellar/ggml-rubaistt.bin" 2>/dev/null || cp "$M" "$MANZIL/modellar/ggml-rubaistt.bin"
[ "$(md5 -q "$MANZIL/modellar/ggml-rubaistt.bin")" = "$MODEL_MD5" ] && echo "  ✓ model joyida (MD5 to'g'ri)" \
  || echo "  ⚠️  model MD5 kutilganidan farq qiladi — fayl to'liq ko'chmagan bo'lishi mumkin"

qadam "5/8 Ovoz effektlari va musiqa (Mixkit, bepul litsenziya — to'g'ridan-to'g'ri mixkit.co dan)"
/usr/bin/python3 - "$MANZIL/assets" <<'PY'
import json, subprocess, sys, urllib.request
from pathlib import Path
A = Path(sys.argv[1])
def ol(url, fayl):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        fayl.write_bytes(r.read())
(A / "ovoz/asl").mkdir(parents=True, exist_ok=True)
for e in json.load(open(A / "ovoz/royxat.json"))["effektlar"]:
    asl, tayyor = A / "ovoz/asl" / e["fayl"], A / "ovoz" / e["fayl"]
    if tayyor.exists():
        continue
    ol(f"https://assets.mixkit.co/active_storage/sfx/{e['mixkit_id']}/{e['mixkit_id']}-preview.mp3", asl)
    # montajda hamma effekt bir xil balandlikda bo'lsin: −18 LUFS, 48 kHz
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(asl), "-af", "loudnorm=I=-18:TP=-1.5:LRA=11",
                    "-ar", "48000", "-b:a", "128k", str(tayyor)], check=True)
    print("  ✓", e["fayl"])
for t in json.load(open(A / "musiqa/royxat.json"))["treklar"]:
    f = A / "musiqa" / t["fayl"]
    if not f.exists():
        ol(f"https://assets.mixkit.co/music/{t['mixkit_id']}/{t['mixkit_id']}.mp3", f)
        print("  ✓", t["fayl"])
PY

qadam "6/8 Remotion (grafika) — bir necha daqiqa"
cd "$MANZIL/grafika"
npm_config_cache="$HOME/.npm-kesh" npm ci --no-audit --no-fund --loglevel=error
npx --yes remotion browser ensure >/dev/null
echo "  ✓ node_modules + brauzer"

qadam "7/8 Claude Code skilli (/montaj)"
mkdir -p "$HOME/.claude/skills"
if [ -d "$HOME/.claude/skills/montaj" ]; then mv "$HOME/.claude/skills/montaj" "$HOME/.claude/skills/montaj.bak-$(date +%Y%m%d-%H%M%S)"; fi
cp -R "$BU/skill/montaj" "$HOME/.claude/skills/montaj"
echo "  ✓ ~/.claude/skills/montaj"

qadam "8/8 Montaj.app (/Applications)"
if [ "${MONTAJ_ILOVASIZ:-}" = "1" ]; then echo "  (o'tkazib yuborildi)"; else bash "$MANZIL/app/build.sh"; fi

qadam "Tekshiruv"
cd "$MANZIL"
/usr/bin/python3 -c "import montaj as m; print('  whisper:', m.WHISPER, '✓' if m.WHISPER.exists() else '✗'); print('  model:  ', m.MODEL, '✓' if m.MODEL.exists() else '✗'); print('  ffmpeg: ', m.FFMPEG)"
FILTRLAR="$("$(/usr/bin/python3 -c 'import montaj as m; print(m.FFMPEG)')" -hide_banner -filters 2>/dev/null || true)"
grep -q " ass " <<<"$FILTRLAR" && echo "  ✓ ffmpeg'da subtitr (libass) bor" || echo "  ⚠️  ffmpeg'da libass yo'q — oddiy rejim subtitri ishlamaydi"
echo
echo "✅ Tayyor. Videoni Montaj.app ikonkasiga tashlang yoki Claude Code'da yozing: /montaj <video>"
echo "Batafsil: O'QING.md"
