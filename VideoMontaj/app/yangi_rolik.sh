#!/bin/bash
# Yangi rolik papkasi: ~/Desktop/<nom> + script.md shabloni. Chiqish: papka yo'li.
NOM="${1:-rolik}"; P="$HOME/Desktop/$NOM"; i=2
while [ -e "$P" ]; do P="$HOME/Desktop/$NOM-$i"; i=$((i+1)); done
mkdir -p "$P"
cat > "$P/script.md" <<'MD'
# Muammo
Reelsingiz uchib ketdi, lekin *sotuv yo'q* 😩

# Sabab
Odamlar sizni tanimaydi, shuning uchun sotib olmaydi.

# Yechim
Har kuni stories orqali *progrev* qiling 🔥

# Natija
Bir oyda sotuvlar ikki barobar oshadi 🚀

# Harakat
Batafsil — profildagi havolada 👇
MD
cat > "$P/QANDAY.txt" <<'TXT'
KAMERASIZ ROLIK — qanday qilinadi

1) script.md — har "# Sarlavha" bitta kadr, ostidagi qator o'sha kadrda aytiladigan gap.
   *yulduzcha* ichidagi so'z urg'u rangida chiqadi. Emoji qo'yish mumkin (iPhone emoji).
   Qator qisqa bo'lsin: bitta fikr, ~3 soniya. Rolik 30–40 soniyadan oshmasin.
2) Ovoz: matnni o'zingiz o'qing (telefon diktofoni) yoki aistudio.google.com → Speech (bepul),
   faylni (wav/mp3/m4a) shu papkaga tashlang. Ovoz bo'lmasa ham rolik chiqadi (jim).
3) logo.png (shaffof fon) — ixtiyoriy, oxirgi kadrda va burchakda chiqadi.
4) Papkani Montaj ikonkasi ustiga tashlang → papka ichida rolik.mp4 paydo bo'ladi.

Kadrlar ovozdagi pauzalarga o'zi moslanadi. Matn va dizayn Instagram xavfsiz zonasida
(yuqori 250, past 450, o'ng 120 px) — layk tugmalari va izoh ostida qolmaydi.
Ovoz sekin tuyulsa: Claude'ga "1.2 barobar tezlashtir" deng (--tezlik 1.2).
TXT
open "$P"
echo "$P"
