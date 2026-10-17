# Reel Studio — AI video montajchi (o'zbekcha, offline)

«Gapiruvchi bosh» videolaridan (Reels, dars, reklama) tayyor Instagram Reels yasaydi:
jimlik va xato dublarni kesadi, so'zma-so'z subtitr, stiker, logo, hook, zoom, b-roll, motion-grafika,
ovoz effektlari va fon musiqasi qo'shadi. Nutqni tanish to'liq offline (RubaiSTT modeli) — video internetga chiqmaydi.

Ikki rejim:
- **Claude bilan (asosiy)** — Claude Code'da `/montaj <video>`: Claude transkriptni o'qiydi, qaysi dublni kesish,
  qayerga qanday grafika qo'yishni o'zi rejalaydi, kadrlarni ko'rib tekshiradi, keyin render qiladi.
  Siz «stiker katta», «hook yuzni yopdi» desangiz tuzatadi va qoidaga yozib qo'yadi — keyingi videoda takrorlamaydi.
- **Tez (Claude'siz)** — `Montaj.app` ikonkasiga videoni tashlaysiz: jimlik kesiladi, subtitr va avto-stikerlar qo'yiladi.

---

## 1. Nima kerak
| | |
|---|---|
| Kompyuter | Mac, Apple Silicon (M1 va yangi). Intel'da ham ishlaydi, lekin oddiy rejim subtitri chiqmasligi mumkin |
| Joy | ~3 GB (model 0.8 GB + Remotion 1.2 GB + dasturlar) |
| Dasturlar | Homebrew (https://brew.sh) — qolganini `ornatish.sh` o'zi o'rnatadi: ffmpeg, ffmpeg-full, whisper-cpp, node, Xcode CLT |
| Claude rejimi uchun | Claude Code (https://claude.com/claude-code) — obuna bilan |

## 2. O'rnatish (bir marta, ~10 daqiqa)
Sizga ikkita fayl beriladi:
1. `Montaj-toplam.zip` — dastur, kutubxona, skill, qo'llanma
2. `ggml-rubaistt.bin` — o'zbekcha nutqni tanish modeli (~820 MB, Apache-2.0 litsenziya)

```bash
# ikkalasi ~/Downloads da bo'lsa:
cd ~/Downloads && unzip Montaj-toplam.zip
bash ~/Downloads/Montaj-toplam/ornatish.sh
```
Skript qiladi: dasturlarni o'rnatadi → `~/VideoMontaj` ga ko'chiradi → modelni joyiga qo'yadi →
16 ta ovoz effekti va 6 ta musiqani mixkit.co dan yuklab oladi → Remotion'ni o'rnatadi →
`/montaj` skillini `~/.claude/skills/montaj` ga qo'yadi → `/Applications/Montaj.app` ni yig'adi → oxirida tekshiradi.
Qayta ishga tushirsa bo'ladi (eski `~/VideoMontaj` zaxiraga ko'chadi).

> Birinchi «odam ajratish» effekti (`orqa_matn`, `egri_matn`) ishlaganda Apple Vision vositasi bir marta kompilyatsiya bo'ladi — bu normal.

## 3. Ishlatish

### A. Claude Code bilan (eng yaxshi natija)
Terminal: `claude` → yozing:
```
/montaj ~/Desktop/video.mp4
```
yoki shunchaki «shu videoni reels qil» va videoni tashlang. Claude:
1. `tahlil` — transkript, jimliklar (`ish/<nom>/transkript.txt`)
2. yomon/takror dublarni belgilaydi (`reja.json`) → `kadrlar` — kesilgan video + tekshiruv kadrlari
3. `sahna.json` yozadi — hook, stiker, zoom, motion elementlar (5-bo'lim)
4. kadrlarni ko'rib tekshiradi → `reel` → natija asl video yonida `<nom>_reel.mp4`

Tuzatish: «3-soniyadagi stikerni olib tashla», «hook kichikroq», «qayta render qilma, faqat faylni o'zgartir».
Har tuzatish `QOIDALAR.md` ga yoziladi — montajchi vaqt o'tib sizning didingizni o'rganadi.

### B. Montaj.app (tez, Claude'siz)
- Videoni ikonkaga tashlang → format (9:16 / 1:1 / 16:9 / asl), subtitr, stiker, uslub so'raladi → natija video yonida `<nom>_montaj.mp4`.
- «Reel Studio» varianti Remotion grafikasi bilan (sekinroq), «Oddiy» — ffmpeg bilan tez (uzun videolar uchun).
- Papka tashlasangiz (yoki ilovani video'siz ochib «Yangi rolik») — kamerasiz rolik rejimi (4-bo'lim).
- `Montaj Holati.app` — render jarayonini jonli ko'rsatadi.

### C. Terminal buyruqlari
```bash
cd ~/VideoMontaj
python3 montaj.py <buyruq> "<video>" [parametrlar]
```
| Buyruq | Nima qiladi |
|---|---|
| `tahlil` | transkript + jimliklar → `ish/<nom>/` (hech narsa render qilinmaydi) |
| `kadrlar` | kesadi (`toza.mp4`, keshlanadi), avto sahna, tekshiruv kadrlari `kadr_*.jpg` |
| `reel` | Remotion bilan to'liq Reels → `<video>_reel.mp4` |
| `studio` | Remotion Studio: http://localhost:3000/Reel — jonli ko'rish/sozlash |
| `auto` | tez oddiy montaj (ffmpeg subtitr, Remotion'siz) → `<video>_montaj.mp4` |
| `kesimlar` | uzun videodan bir nechta Reels (`ish/<nom>/kesimlar.json` bo'yicha) → `<video>_kesimlar/` |
| `namuna` | boshqa birovning Reels'ini tahlil: tempo, kesishlar, har 0.5 s kadr → `ish/namuna_<nom>/` |
| `rolik` | kamerasiz rolik: `<papka>` ichida `script.md` + ovoz + logo → `rolik.mp4` |
| `qoida "..."` | `QOIDALAR.md` ga yangi o'rganilgan qoida qo'shadi |

| Parametr | Qiymat |
|---|---|
| `--til` | `uz` (standart) · `en` · `ru` · `auto` |
| `--uslub` | `asosiy` yoki o'zingiz yaratgan (`assets/uslublar/<nom>.json`) |
| `--format` | `asl` · `9:16` · `1:1` · `16:9` (auto rejim) |
| `--subtitr` | `ha` / `yoq` |
| `--stiker` | `ha` / `yoq` (auto rejimda so'z bo'yicha emoji) |
| `--logo` | fayl yo'li / `yoq` (`assets/logo.png` bo'lsa avtomatik) |
| `--musiqa` | `assets/musiqa` dagi nom yoki fayl / `yoq` |
| `--tezlik` | masalan `1.2` (tovush o'zgarmaydi) |
| `--chiqish` | natija fayli yo'li |
| `--oddiy` | `kesimlar` da grafikasiz tez variant |

Kino rang (grading) avtomatik; o'chirish: `MONTAJ_GRADE=yoq python3 montaj.py ...`

## 4. Kamerasiz rolik (ssenariy + ovoz → Reels)
Papka yarating: `script.md` + ovoz fayli (mp3/m4a/wav) + ixtiyoriy `logo.png`. Namuna: `~/VideoMontaj/namuna/rolik-namuna/script.md`.
```markdown
# Tanish holat
Reelsingiz *uchib* ketdi 🚀
```
Har `# Sarlavha` — bitta kadr, ostida aytiladigan gap, `*urg'u*` ajratiladi, emoji chiqadi. Kadrlar ovozdagi pauzalarga avtomatik moslanadi.
`python3 montaj.py rolik ~/Desktop/rolikim [--tezlik 1.2]`

## 5. Sahna elementlari (`ish/<nom>/sahna.json`, `"_avto": false` — qo'lda yozilgan, qayta yozilmaydi)
Claude buni o'zi yozadi; qo'lda ham tahrirlash mumkin. Vaqtlar — kesilgan videodagi soniya (`toza_transkript.txt` da `so'z@soniya`).

| `tur` | Ko'rinishi |
|---|---|
| `hook` (alohida kalit) | boshidagi katta sarlavha: `kichik` + `matn`, `glow` |
| `katta_soz` | tepada ulkan bitta so'z («OKAY!») |
| `stiker` | kutubxonadagi PNG (`fayl`) yoki `emoji`; `joy`, `olcham`, qora ikon uchun `fon: "doira"` |
| `logo` | brend logosi (`assets/logolar/`) |
| `zoom` | punch-in, `kuch` 1.08–1.15 |
| `broll` | boshqa video: `joy` `toliq` / `tepa` (split-ekran) / `karta` |
| `vinyetka` | qorong'i chetlar |
| `orqa_matn` | ODAM ORQASIDA ulkan matn (Apple Vision odamni ajratadi) |
| `egri_matn` | bosh atrofida yoy matn + nur |
| `avatarlar` | bir-birini yopgan doira rasmlar + so'z |
| `pufak` | chat pufakchalari (bu paytda subtitr yashirinadi) |
| `raqamlar` | 1-2-3 kartochkalar |
| `otish` | oq chaqnash o'tishi |
| `telefon` | stories misoli: yomon matn → ❌ → yaxshi matn → ✅ |
| `raqam` | sanab chiqadigan raqam ($3000+ oyiga) |
| `solishtir` | ikki narx/natija yonma-yon ($500 → $2 000) |
| `royxat` | ✓ belgili ro'yxat kartochkasi |
| `generator` | tugma bosiladi → chiplar chiqadi |
| `cta` | yakuniy kartochka, pulsli tugma |
| `yozuv` | katta ibora plashkasi + kichik izoh (subtitrsiz reklama uslubi) |
| `tanishtiruv` | oq ekran, video ramkada, ostida @akkaunt |
| `hisoblar` | tepada kichik hisoblagichlar |
| `oq_qora` | oq-qora + REC ramka (og'riq nuqtasi hooki) |

To'liq JSON namunalari: `~/.claude/skills/montaj/SKILL.md`. Ekranda bir vaqtda ≤ 2 grafik element; hech narsa yuzni yopmaydi
(yuz avtomatik topiladi); Instagram xavfsiz zonasi (tepa 250, past 450, o'ng 120 px) hisobga olinadi.

## 6. O'zingizga moslash
- **Brend rangi/uslub**: `assets/uslublar/asosiy.json` dan nusxa → `assets/uslublar/menim.json` (`urgu` — urg'u rangi,
  `handle` — @akkaunt, `musiqa`, `subtitr_yoq`). Ishlatish: `--uslub menim`.
- **Logo**: `assets/logo.png` (shaffof PNG) — avtomatik qo'yiladi. Mahsulot logolari: `assets/logolar/` + `royxat.json` ga qator.
- **Stikerlar**: shaffof PNG → `assets/stikerlar/` + `royxat.json` ga `teglar` (qaysi so'zlarda chiqsin) va `ma'no`.
- **Musiqa**: `assets/musiqa/` + `royxat.json`. Faqat litsenziyali trek (mualliflik qo'shig'i bo'lsa Meta reklamani bloklaydi).
- **Uslub namunalari**: `assets/uslub-namunalar/01–14.png` + README — Claude'ga «05 dagidek qil» deyish mumkin.
  Yoqqan Reels bo'lsa: `montaj.py namuna <video>` → Claude harakat tilini o'rganib sizning videongizga qo'llaydi.
- **Qoidalar**: `QOIDALAR.md` — brendbuk + «Tuzatishlardan o'rganilgan». O'zingiz ham qo'shishingiz mumkin.

## 7. Papka tuzilishi (`~/VideoMontaj`)
| | |
|---|---|
| `montaj.py` | butun dvigatel (Python, faqat standart kutubxona) |
| `QOIDALAR.md` | brendbuk + o'rganilgan qoidalar (Claude har montajdan oldin o'qiydi) |
| `grafika/` | Remotion loyihasi: `src/Reel.tsx` (asosiy kompozitsiya), `Rolik.tsx`, `render.mjs` |
| `assets/` | shrift (Montserrat), stikerlar, logolar, uslublar, ovoz, musiqa, fon, iPhone mockup, uslub namunalari |
| `vosita/odam_maska.swift` | Apple Vision: odamni fondan ajratish + yuzni topish |
| `modellar/ggml-rubaistt.bin` | nutq tanish modeli |
| `app/` | Montaj.app manbasi (`build.sh` bilan qayta yig'iladi) |
| `ish/<video nomi>/` | har video ish papkasi: transkript, reja, sahna, subtitr, kadrlar (o'chirsa bo'ladi) |

## 8. Muammo bo'lsa
| Belgi | Yechim |
|---|---|
| «whisper-cli topilmadi» | `brew install whisper-cpp` |
| Subtitr chiqmayapti (oddiy rejim) | `brew install ffmpeg-full`; oddiy `ffmpeg` buzilsa — `brew upgrade ffmpeg` |
| Remotion render xatosi | `cd ~/VideoMontaj/grafika && npm_config_cache=~/.npm-kesh npm ci && npx remotion browser ensure` |
| Transkript bo'sh / noto'g'ri tilda | `--til en` yoki `--til ru`; ovozsiz videoni montaj qilib bo'lmaydi |
| Model boshqa joyda | `export MONTAJ_MODEL=/yo'l/ggml-rubaistt.bin` (whisper uchun `MONTAJ_WHISPER`) |
| Montaj.app ochilmaydi | System Settings → Privacy & Security → «Open Anyway» |

## Litsenziyalar
RubaiSTT modeli — Apache-2.0. Montserrat shrifti — SIL OFL. Ovoz effektlari va musiqa — Mixkit Free License
(onlayn reklama/ijtimoiy tarmoq uchun bepul, atributsiyasiz; o'rnatishda mixkit.co dan yuklanadi, fayl sifatida tarqatilmaydi).
Remotion — kompaniyalar uchun litsenziya shartlari bor (remotion.dev/license), shaxsiy/kichik jamoa uchun bepul.
