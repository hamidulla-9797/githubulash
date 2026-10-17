# githubulash — Reel Studio (AI video montajchi)

Bu repo — foydalanuvchining asosiy ish quroli: o'zbekcha «gapiruvchi bosh» videolaridan Instagram Reels yasash.
Video/montaj/reels/rolik bo'yicha har qanday so'rovda **`montaj` skillidan** (`.claude/skills/montaj/SKILL.md`) foydalan
va har montajdan oldin `VideoMontaj/QOIDALAR.md` ni o'qi. Har tuzatishni `python3 montaj.py qoida "..."` bilan qoidaga yoz.

- Dvigatel: `VideoMontaj/montaj.py` (Python stdlib + ffmpeg + whisper.cpp + Remotion `VideoMontaj/grafika/`).
- Foydalanuvchi qo'llanmasi: `O'QING.md`; Mac'ga o'rnatish: `ornatish.sh`.
- Bulut sessiyasi: `.claude/hooks/montaj_tayyorla.sh` (SessionStart) muhitni tayyorlaydi.
- Foydalanuvchi bilan o'zbek tilida gaplash.
