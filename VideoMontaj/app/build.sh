#!/bin/bash
# Montaj.app ni qayta yig'adi va /Applications ga o'rnatadi
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist/Montaj.app && mkdir -p dist
osacompile -o dist/Montaj.app app/Montaj.applescript
# ikonka (app/ikonka.png — Remotion "Ikonka" kompozitsiyasidan)
IS=$(mktemp -d)/ikonka.iconset; mkdir -p "$IS"
for s in 16 32 128 256 512; do
  sips -z $s $s app/ikonka.png --out "$IS/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) app/ikonka.png --out "$IS/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$IS" -o dist/Montaj.app/Contents/Resources/applet.icns
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier uz.fayzullaxon.montaj" dist/Montaj.app/Contents/Info.plist 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string uz.fayzullaxon.montaj" dist/Montaj.app/Contents/Info.plist
codesign -f -s - dist/Montaj.app
rm -rf /Applications/Montaj.app && cp -R dist/Montaj.app /Applications/
touch /Applications/Montaj.app
# Montaj Holati (jonli progress)
rm -rf "dist/Montaj Holati.app" && osacompile -o "dist/Montaj Holati.app" app/Holat.applescript
cp dist/Montaj.app/Contents/Resources/applet.icns "dist/Montaj Holati.app/Contents/Resources/applet.icns"
codesign -f -s - "dist/Montaj Holati.app"
rm -rf "/Applications/Montaj Holati.app" && cp -R "dist/Montaj Holati.app" /Applications/
echo "✅ /Applications/Montaj.app + Montaj Holati.app"
