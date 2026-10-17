#!/bin/bash
# Montaj.app chaqiradi: montaj_ishga.sh <format> <subtitr> <stiker> <uslub> <rejim: reel|oddiy> <til> <video yoki papka>...
FMT="$1"; SUB="$2"; STK="$3"; USL="$4"; REJIM="$5"; TIL="$6"; shift 6
cd "$HOME/VideoMontaj" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
clear
echo "🎬 MONTAJ — ${#} ta video (rejim: $REJIM, format: $FMT, uslub: $USL, til: $TIL)"
echo "   Oynani yopmang, tugagach tayyor fayl Finder'da ochiladi."
echo
OK=(); XATO=()
N=$#; I=0
open -a "Montaj Holati" 2>/dev/null   # jonli progress oynasi
for v in "$@"; do
  I=$((I+1)); export MONTAJ_NAVBAT="$I/$N"
  echo "━━━━━━━━ [$I/$N] $(basename "$v")"
  if [ -d "$v" ]; then
    # ssenariy papkasi → kamerasiz rolik
    if /usr/bin/python3 montaj.py rolik "$v" --format "$FMT" --uslub "$USL"; then
      OK+=("${v%/}/rolik.mp4")
    else
      XATO+=("$(basename "$v")")
    fi
  elif [ "$REJIM" = "reel" ]; then
    if /usr/bin/python3 montaj.py reel "$v" --format "$FMT" --uslub "$USL" --til "$TIL"; then
      OK+=("${v%.*}_reel.mp4")
    else
      XATO+=("$(basename "$v")")
    fi
  elif /usr/bin/python3 montaj.py auto "$v" --format "$FMT" --subtitr "$SUB" --stiker "$STK" --uslub "$USL" --til "$TIL"; then
    OK+=("${v%.*}_montaj.mp4")
  else
    XATO+=("$(basename "$v")")
  fi
  echo
done
[ ${#OK[@]} -gt 0 ] && open -R "${OK[@]:0:1}"
afplay /System/Library/Sounds/Glass.aiff 2>/dev/null &
echo "✅ Tayyor: ${#OK[@]} ta"; for f in "${OK[@]}"; do echo "   $f"; done
[ ${#XATO[@]} -gt 0 ] && echo "❌ Xato: ${XATO[*]}"
osascript -e "display notification \"Tayyor: ${#OK[@]} ta, xato: ${#XATO[@]} ta\" with title \"Montaj\"" 2>/dev/null
