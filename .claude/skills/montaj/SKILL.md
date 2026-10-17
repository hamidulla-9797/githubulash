---
name: montaj
description: Video montaj (o'zbekcha, offline) — REEL STUDIO (Remotion): jimlik/dubl kesish, so'zma-so'z subtitr, kutubxonadagi stikerlar va logolar gap ma'nosiga qarab, hook, katta so'z, zoom, b-roll, Instagram xavfsiz zonasi; QOIDALAR.md orqali har tuzatishdan o'rganadi. Kamerasiz rolik (ssenariy + ovoz → Reels) ham. Foydalanuvchi "/montaj <video>" desa, video tashlab "montaj qil"/"reels qil" desa, montajni tuzatishni so'rasa yoki matndan rolik yasashni so'rasa ishlatiladi.
---

# Reel Studio — AI montajchi (~/VideoMontaj)

## 0. Har safar avval
1. `~/VideoMontaj/QOIDALAR.md` ni o'qi — brendbuk va oldingi tuzatishlardan o'rganilgan qoidalar. Ularga so'zsiz amal qil.
2. `assets/stikerlar/royxat.json` va `assets/logolar/royxat.json` — mavjud stiker/logolar va ularning ma'nosi.
3. Uslub kerak bo'lsa `assets/uslub-namunalar/README.md` (14 ta rasm namunasi; "05 dagidek" deyilsa rasmni ko'r).
4. Noaniq bo'lsa (format, til, qaysi dubl, logo yo'q) — taxmin qilma, qisqa so'ra.

## 1. Kamerali video → Reels (asosiy yo'l)
```bash
cd ~/VideoMontaj
python3 montaj.py tahlil "<video>" [--til uz|en|ru]        # transkript + jimliklar → ish/<nom>/
```
- `ish/<nom>/transkript.txt` ni o'qi (ASL vaqt). Yomon/takror dublarni `reja.json` → `olib_tashlash: [[boshi, oxiri, "sabab"]]`
  (odatda oxirgi to'liq dubl qoladi). Jimliklar avtomatik.
```bash
python3 montaj.py kadrlar "<video>" [--til ..] [--uslub ..]  # kesadi (toza.mp4, keshlanadi) + avto sahna + tekshiruv kadrlari
```
- Endi `ish/<nom>/toza_transkript.txt` (YANGI vaqt, har so'z `so'z@soniya`) asosida `ish/<nom>/sahna.json` ni yoz, `"_avto": false`:
```json
{"_avto": false,
 "hook": {"kichik": "Kichik qator", "matn": "ULKAN FIKR", "boshi": 0, "oxiri": 1.6, "glow": true},
 "elementlar": [
  {"tur": "stiker", "fayl": "stikerlar/miya.png", "boshi": 1.6, "oxiri": 3.0, "joy": "yuqori-o'ng", "olcham": 0.28},
  {"tur": "stiker", "emoji": "🔥", "boshi": 4, "oxiri": 5.8, "joy": "yuqori-chap"},
  {"tur": "logo", "fayl": "logolar/x.png", "boshi": 6, "oxiri": 7.5, "joy": "yuqori-markaz"},
  {"tur": "katta_soz", "matn": "OKAY!", "boshi": 8, "oxiri": 9, "glow": false},
  {"tur": "zoom", "boshi": 1.5, "oxiri": 2.7, "kuch": 1.12},
  {"tur": "broll", "fayl": "/to'liq/yo'l/ekran.mp4", "boshi": 3, "oxiri": 5, "joy": "toliq|tepa|karta", "boshlash": 2, "sarlavha": "tepa uchun lenta"},
  {"tur": "vinyetka", "boshi": 5.8, "oxiri": 7},
  {"tur": "orqa_matn", "matn": "HI", "boshi": 1, "oxiri": 2.5},
  {"tur": "egri_matn", "matn": "BOSH ATROFIDA YOY", "boshi": 3, "oxiri": 4.8, "nur": true},
  {"tur": "avatarlar", "fayllar": ["/yo'l/a.png", "stikerlar/b.png"], "matn": "EDITOR", "boshi": 5, "oxiri": 6.5},
  {"tur": "pufak", "qatorlar": ["narxi", "qancha?"], "avatar": "/yo'l/yuz.png", "boshi": 7, "oxiri": 9},
  {"tur": "raqamlar", "qatorlar": ["1", "2", "3"], "boshi": 3, "oxiri": 4.5},
  {"tur": "otish", "boshi": 6.4, "oxiri": 6.75},
  {"tur": "telefon", "boshi": 8, "oxiri": 14, "almash": 10.5, "yomon": ["tiqilgan qator"], "yaxshi": ["Maksimum", "2 ta gap ✌️"], "yorliq_yomon": "❌ ESKICHA", "yorliq_yaxshi": "✅ ZOOMERCHA"},
  {"tur": "raqam", "qiymat": 3000, "dan": 0, "old": "$", "qosh": "+", "izoh": "oyiga", "boshi": 2, "oxiri": 4},
  {"tur": "solishtir", "chap": "$500", "chap_izoh": "siz", "ong": "$2 000", "ong_izoh": "men", "boshi": 3, "oxiri": 8},
  {"tur": "royxat", "sarlavha": "Kursda:", "qatorlar": ["Kontent marketing", "..."], "boshi": 8, "oxiri": 13},
  {"tur": "generator", "markaz": "1 TUGMA", "chiqish": ["Reels", "Stories", "Telegram", "YouTube"], "boshi": 1, "bosish": 2.4, "oxiri": 9},
  {"tur": "cta", "sarlavha": "KURS NOMI", "izoh": "Oktyabr · Onlayn + Offlayn", "tugma": "Ro'yxatdan o'tish", "boshi": 17, "oxiri": 22}
 ]}
```
  - `orqa_matn` — ODAM ORQASIDA ulkan matn (namuna 13), `egri_matn` — bosh atrofida yoy + to'q sariq nur (05): dvigatel Apple Vision bilan
    odamni ajratadi (`odam.webm`, keshlanadi). `avatarlar` (12), `pufak` (03, bu paytda subtitr yashirinadi).
  - Yuzga qarab joylashuv avtomatik (`yuz.json`): hook/katta so'z/pufakcha yuzga sig'masa yuz ostiga, stiker yuzdan qochadi. Baribir still'da tekshir.
  - Stiker — aytilgan SO'Z ustida, ma'nosiga qarab; kutubxonada yo'q bo'lsa emoji. `fon: "doira"` — qora ikonlar uchun. ≥ 1.2 s to'liq ko'rinsin.
  - **Motion — o'rtalarni bo'sh qoldirma**: har qoida/maslahatga vizual misol (`telefon` — yomon→❌→yaxshi→✅ stories namunasi,
    `raqamlar` — "uchta/beshta" aytilganda kartochkalar, `otish` — hook→asosiy qism kesish joyida chaqnash).
  - Hook/katta so'z ovozni takrorlamaydi — fikrni kuchaytiradi. Bir vaqtda ≤ 2 grafik element.
  - Subtitrda so'z xatosi bo'lsa (masalan "rush"→"rot") — `ish/<nom>/subtitr.json` dagi `t` ni tuzat.
- Yana `kadrlar` → 3–4 still (`ish/<nom>/kadr_*.jpg`) ni **Read bilan ko'r**: matn yuzda emasmi, kesilmaganmi, xavfsiz zonadami, o'qiladimi.
  Xato bo'lsa — tuzat va `montaj.py qoida "..."` bilan qoidaga yoz. Keyin:
```bash
python3 montaj.py reel "<video>" [--til ..] [--uslub ..] [--musiqa P]   # → <video>_reel.mp4
```
- Tayyor videodan 2–3 kadrni ko'rib chiq (`ffmpeg -ss T -i out.mp4 -frames:v 1 -vf scale=200:-1 x.jpg`), keyin topshir.
- Jonli ko'rish: `python3 montaj.py studio "<video>"` → http://localhost:3000/Reel (fonda ishga tushir).

## 1b. Xom yozuv tayyorgarligi (target/reklama syomkalari)
- Kamera yonboshlab yozgan bo'lsa (odam 90° yotgan) — avval `ffmpeg -vf "transpose=1,scale=1080:1920"` bilan `<nom>_tik.mp4` ishchi nusxa.
- Montajchiga ko'rsatmalar bo'lsa ("bu birinchi hook", "ikkita hookka moslab bering", "oxirida yakunini qo'shasiz") — ularga amal qil:
  bir nechta hook + umumiy yakun → har hook alohida video (hardlink `<nom>_vN.mp4` + `ish/` nusxasi + o'z `reja.json`).
- **Chegaralar**: so'z vaqtlari uzluksiz nutqda ~1 s adashadi. Chegarani energiya grafigi (10 ms, `energiya.json`) va qisqa bo'lakni
  qayta tanitib top; `olib_tashlash` elementiga 4-qiymat `"aniq"` ber (snap surmaydi). Oxirgi to'liq dubl qoladi.
- **`ish/<nom>/matn.txt`** — tekshirilgan to'g'ri matn: subtitr matni shundan, vaqti kesilgan videoni mayda bo'laklab tanishdan olinadi.
- Kino rang (`GRADE_KINO`) toza video bosqichida avtomatik; o'chirish `MONTAJ_GRADE=yoq`.
- Ko'p variantning tekshiruv kadrlarini bitta `render.mjs` job'ida chiqar (bundle bir marta).

## 1c. Ibora-yozuvli uslub (subtitrsiz reklama)
- So'zma-so'z subtitr o'rniga har muhim gapga katta ibora plashkasi. Sahnada `"subtitr_yoq": true`,
  `"musiqa": "<assets/musiqa nom>"`, `"musiqa_boshi": 4`, `"ovozlar": false` (effektsiz). O'z brendingiz uchun
  `assets/uslublar/<nom>.json` yarating (`asosiy.json` dan nusxa: `urgu` rangi, `handle`, `musiqa`, `subtitr_yoq`) va `--uslub <nom>`.
- Elementlar: `{"tur":"yozuv","matn":"KATTA IBORA","kichik":"kichik izoh","fon":"urgu|oq|qora|yoq","joy":"orta|tepa|past"}`,
  `{"tur":"tanishtiruv","tepa":"1-qator|2-qator","pastki":"@sizning_akkaunt"}`, `{"tur":"hisoblar","qatorlar":[{"qiymat":3000,"old":"$","qosh":"+","izoh":"oyiga"}]}`,
  `{"tur":"oq_qora","ramka":true}`.
- Ovoz effektlari avtomatik (elementlardan), musiqa pasaytirilib nutq ostida. Faqat litsenziyali manbalar (Mixkit); yangi trek/effekt → `royxat.json`.

## 2. Tuzatishlar — ASOSIY SIR
Foydalanuvchi "matn ko'p", "stiker kesildi", "hook yuzni yopdi" desa:
1. Faqat o'sha joyni tuzat (sahna.json / subtitr.json / kerak bo'lsa Reel.tsx). Butunini qayta rejalashtirma.
2. **Doim** `python3 montaj.py qoida "<nima xato bo'ldi va endi qanday>"` — keyingi videoda takrorlanmasin.
3. "Qayta render qilma" desa — faqat faylni o'zgartir, render qilma.
4. Yangi stiker/logo bersa — `assets/stikerlar/` yoki `assets/logolar/` ga ko'chir va `royxat.json` ga teglar bilan qo'sh.

## 2b. Uzun videodan bir nechta Reels
1. `python3 montaj.py tahlil "<uzun video>"` → `ish/<nom>/transkript.txt` ni o'qi.
2. Eng kuchli 20–60 s bo'laklarni tanla (aniq natija, qiziq maslahat, raqam, hissiy gap; boshi kuchli hook bilan boshlansin,
   gap o'rtasidan kesma). `ish/<nom>/kesimlar.json`: `[{"nom": "1-mavzu", "boshi": 79.4, "oxiri": 115.3, "sabab": "..."}]`.
3. `python3 montaj.py kesimlar "<uzun video>" [--oddiy]` → `<video>_kesimlar/` papkasida har biri alohida `_reel.mp4`.
4. Har kesimga alohida sahna kerak bo'lsa — kesim fayli bo'yicha 1-bo'limdagi tartib (kadrlar → sahna.json → reel).
- Gorizontal video (ekran yozuvi, Zoom) 9:16 da avtomatik "fit": o'rtada to'liq, orqasi xira nusxa (markazdan kesilmaydi).

## 2c. Namuna (reference) Reels bo'yicha
`python3 montaj.py namuna "<namuna.mp4>"` → `ish/namuna_<nom>/`: `varaq_XX.jpg` (har 0.5 s kadr, vaqt yozuvi bilan), `sahna_XX.jpg`
(har kesish), `namuna.json` (kesishlar, kadr uzunligi, soniyalik harakat), `transkript.txt`. Varaqlarni Read bilan ko'r va
tahlil yoz: tempo (o'rtacha kadr), zoom/o'tishlar qachon, grafika turlari va joyi, matn uslubi, rang. Keyin **harakat tili va tempini
saqla, vizual uslubni foydalanuvchi brendiga moslab** foydalanuvchi videosiga sahna yoz. Yoqsa — `uslub-namunalar/` ga qo'sh.

## 3. Oddiy (tez) montaj
`python3 montaj.py auto "<video>" [--format ..] [--subtitr ha|yoq] [--stiker ha|yoq]` — ffmpeg subtitr, Remotion'siz, tez.
Uzun videolar (10+ daq) uchun shu tezroq.

## 4. Kamerasiz rolik (ssenariydan)
Papka: `script.md` (har `# Sarlavha` = kadr, ostida aytiladigan gap, `*urg'u*`, emoji) + ovoz + `logo.png`.
`python3 montaj.py rolik <papka> [--uslub ..] [--tezlik 1.2]` → `<papka>/rolik.mp4`. Kadrlar ovoz pauzalariga moslanadi.
Umumiy reklama gaplaridan qoch, aniq gap va raqamlar yoz.

## Muhim
- Uslub: `--uslub asosiy` (yoki o'zingiz yaratgan) (`assets/uslublar/*.json`); Instagram xavfsiz zonasi dvigatelda.
- Hammasi offline: RubaiSTT (whisper.cpp), FFmpeg (`ffmpeg-full`), Remotion (`grafika/`).
- Ovozsiz videoni montaj qilib bo'lmaydi. Uzun ishlar — `run_in_background`.
- Foydalanuvchida **Montaj.app** bor: Reel Studio / Oddiy / Yangi rolik (ssenariy papkasi).

## Bulut (Linux) sessiyasi
- Loyiha shu repoda: `VideoMontaj/` (`~/VideoMontaj` — unga havola). SessionStart hook (`.claude/hooks/montaj_tayyorla.sh`)
  Remotion'ni, `whisper-cli` ni o'rnatadi va `MONTAJ_WHISPER`, `MONTAJ_BROWSER` (tayyor Chromium headless_shell) ni beradi.
  Hook ishlamagan bo'lsa — uni qo'lda ishga tushir.
- Apple Vision yo'q: `orqa_matn`/`egri_matn` (odam ajratish) va avto yuz joylashuvi ishlamaydi — reel yuzsiz chiqadi,
  shuning uchun matn yuzga tushmaganini kadrlardan albatta ko'zda tekshir. Montaj.app / Holat ilovasi faqat Mac uchun.
- RubaiSTT modeli (`modellar/ggml-rubaistt.bin`, ~820 MB) repoda yo'q — foydalanuvchi yuklamaguncha `tahlil`/`reel`/`auto`
  ishlamaydi; `rolik` (ssenariy + ovoz) modelsiz ishlaydi. Mixkit ovoz/musiqa tarmoq ruxsat bersa yuklanadi, bo'lmasa effektsiz.
- Videolar va natija: foydalanuvchi yuklagan faylni ishlat, natijani u ocha oladigan joyga (repo papkasi yoki scratchpad) yoz va yubor.
