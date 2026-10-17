# QOIDALAR — Reel Studio brendbuki (AI montajchi uchun)

Har montajdan OLDIN o'qiladi. Har tuzatish shu faylga yoziladi ("Tuzatishlardan o'rganilgan"),
shunda xato keyingi videoda takrorlanmaydi. Birinchi video ko'p tuzatish talab qiladi, o'ninchisi — deyarli yo'q.

## 1. Ish tartibi (Karpathy'ning 4 qoidasi, montajga moslangan)
1. **Taxmin qilma.** Format, uslub, qaysi dubl qolishi noaniq bo'lsa — qisqa savol ber. Logo/stiker kutubxonada yo'q bo'lsa — to'qima, so'ra.
2. **Ortiqcha murakkablashtirma.** Kam, lekin ma'noli grafika. "Too busy" — eng ko'p uchraydigan xato.
3. **Keraksiz o'zgarish qilma.** "3-kadrdagi stikerni kattalashtir" desa — faqat o'shani. Butun sahnani qayta rejalashtirma, "qayta render qilma" desa — qilma.
4. **"Tayyor"dan oldin tekshir.** Render oldidan 3–4 kadr (still) chiqar va ko'r: matn yuzni yopmayaptimi, stiker kesilmaganmi, xavfsiz zonadami. Keyin render. Keyin yana 2–3 kadr.

## 2. Format
- Reels: 1080×1920, 30 fps. Video kadrni to'liq to'ldiradi, qora chiziqlarsiz.
- Instagram xavfsiz zonasi: tepa 250, past 450, o'ng 120 px — o'qiladigan hech narsa bu yerga tushmaydi.

## 3. Matn
- Shrift: Montserrat Black (900), KATTA harflar, plashkasiz (fon to'rtburchagisiz), ingichka qora kontur.
- Subtitr so'zma-so'z: 1–3 so'z blok, joriy so'z urg'u rangida. Pastki xavfsiz zona ustida.
- Grafik matn (hook, katta so'z) ovozni TAKRORLAMAYDI — u fikrni kuchaytiradi (hook, kalit so'z, raqam). Butun gapni ekranga yozma.
- Hech bir yozuv yuzga tushmaydi: hook/katta so'z — tepada (yuz ustida) yoki pastda.
- Ekranda bir vaqtda ko'pi bilan 2 ta grafik element (subtitrdan tashqari).

## 4. Stikerlar va logolar
- Stikerlar kutubxonadan (`assets/stikerlar/royxat.json`) — faqat gapning MA'NOSIGA qarab, aytilgan so'z ustida chiqadi.
- Kutubxonada mos narsa bo'lmasa — iPhone emoji (Apple Color Emoji).
- Stiker hech qachon kadr chetidan kesilmaydi (dvigatel o'zi chegaralaydi — baribir still'da tekshir).
- To'q/qora ikonlar (`fon: doira`) oq doira ichida.
- Mahsulot/brend nomi aytilsa — `assets/logolar/` dagi RASMIY logo. Yo'q bo'lsa so'ra.
- Stikerlar ko'p bo'lishi mumkin, lekin har biri ma'noli; 1.5–2.5 s turadi.

## 5. Harakat
- Zoom (punch-in) — urg'u joylarida, 1.08–1.15x, silliq. Har 6–10 s da bittadan ko'p emas.
- Keraksiz "dergalanish" yo'q: har element bitta kirish animatsiyasi (pop/spring) va yumshoq chiqish.

## 6. Ovoz
- Jimliklar va parazit so'zlar kesiladi, loudnorm −14 LUFS. Musiqa bo'lsa — gap paytida pasayadi.

## 7. Musiqa va effektlar
- Fon musiqasi: faqat litsenziyali (Mixkit Stock Music Free License — onlayn reklama OK, atributsiyasiz). Mualliflik huquqi bor qo'shiq — YO'Q
  (Meta reklamani bloklaydi). Vokalsiz trek. −30 LUFS + nutqda sidechain bilan pasayadi. `assets/musiqa/royxat.json`.
- Ovoz effektlari (`assets/ovoz/`, −18 LUFS ga tekislangan): o'tish → whoosh, yozuv → light pop-whoosh, stiker → pop, raqam → tanga,
  ❌ → buzzer, ✅/CTA → ding, AI/sir → sehr, kamera ramka → shutter. Avto (`avto_ovozlar`), ko'p emas — har element bitta.

## Tuzatishlardan o'rganilgan
<!-- Har yangi qoida: - (sana) qoida — sabab. `montaj.py qoida "..."` ham qo'shadi. -->
- (2026-09-26) Stiker va logo o'ng chetda layk tugmalari ostida qolgan — endi xavfsiz zona ichida.
- (2026-09-26) RubaiSTT'ning o'z so'z vaqtlari ishonchsiz — vaqtlar pauzalar va ovoz energiyasidan olinadi.
- (2026-09-28) Avto rejimda hook qo'yilmaydi — birinchi gapni yozsa ovozni takrorlab, subtitr bilan ustma-ust chiqdi. Hook faqat ma'noli (fikrni kuchaytiradigan) bo'lsa.
- (2026-09-28) Katta so'z/hook o'ng chetdan kesilgan (DOPAMINE) — matn o'lchami eng uzun so'z kenglikka sig'adigan qilib avtomatik kichraytiriladi.
- (2026-09-28) To'liq b-roll ustida subtitr o'qilmagan — b-roll 0.62 yorqinlikka qoraytiriladi.
- (2026-09-28) Stiker kamida 1.2 s to'liq ko'rinsin (qum soat video oxirida 0.5 s turib, kichrayayotganda ko'rindi) — kerak bo'lsa oldinroq, gapning boshidan boshlansin.
- (2026-09-28) Chat pufakchasi avatari yuzni yopgan — pufakcha ham matnTepa bilan yuzga sig'masa yuz ostiga tushadi.
- (2026-09-28) Yuzdan qochgan stiker subtitr ustiga tushgan — avval ikkala yon tekshiriladi, oxirgi chora yuz ostida, pastki 14% subtitr zonasidan yuqorida.
- (2026-09-28) Pufakcha paytida subtitr yashiriladi (pufakcha gapni o'zi ko'rsatadi, namuna 03); avatar yuz ostidagi bo'sh joyga qarab kichrayadi.
- (2026-09-28) Gorizontal video 9:16 da markazdan kesilib ekran yo'qolgan — fit (o'rtada to'liq + xira fon); subtitr video ostiga, ustiga emas.
- (2026-09-29) Hook/katta so'z 2 qatorga bo'linib yuz ostiga tushgan yoki peshonani yopgan (3 LAYFXAK, MAX 2 GAP) — qisqa matn (≤14 belgi) bitta qatorga sig'adigan o'lchamda, balandlik haqiqiy qatorlar soni bo'yicha.
- (2026-09-29) Uzun so'zli subtitr (ZOOMERLARNIKIDEK) chap chetdan chiqqan — subtitr o'lchami ham eng uzun so'zga qarab kichrayadi.
- (2026-09-29) orqa_matn ingichka bo'lsa ('1') bosh uni butunlay yopadi — odam orqasidagi matn keng bo'lsin (kamida 3–7 harf, masalan '1-QOIDA', 'HI').
- (2026-09-29) ❌ emoji Remotion'da ingichka matn ko'rinishida chiqadi — muhr/belgi uchun SVG chiziladi.
- (2026-09-29) O'rtada faqat stiker kam — gap mazmunini ko'rsatadigan motion kerak (telefon misoli, 1-2-3 kartochkalar, o'tish chaqnashi). Har qoida/maslahatga vizual misol.
- (2026-09-29) Qo'lda kesish chegaralari snap() bilan qo'shni so'zga surilib ketgan ('mumkin' kesildi, suhbatdosh gapi qo'shildi) va so'z vaqtlari ~1 s adashgan — chegarani energiya grafigi + qisqa bo'lakni tanitib toping, olib_tashlash'da 4-element 'aniq' bering.
- (2026-09-29) Fonni xiralashtirishda backdrop-filter chetda odamni ko'zgudek takrorladi — video qatlamining o'zi blur+brightness bilan xiralashadi (telefon/generator paytida).
- (2026-09-29) Kartochka qatorlari qat'iy balandlikda bo'lsa uzun matn o'ralib ustma-ust tushadi — minHeight + o'z balandligi.
- (2026-09-29) Solishtirish kartochkasida '$2 000' ikki qatorga bo'linib chetdan chiqqan — narx kartochkalari whiteSpace: nowrap, o'lcham kenglikka qarab.
- (2026-09-29) Devor/fon urg'u rangiga yaqin bo'lsa (C0038 — to'q sariq devor) to'q sariq plashka singib ketadi — yozuv fon: 'oq' (oq plashka, to'q matn, urg'u rangli izoh). Kadrda fon rangini tekshir.
- (2026-09-29) CLI standart musiqa (papkadagi birinchi fayl) sahnadagi tanlovni bosib ketgan — reel'da musiqa faqat --musiqa aniq berilsa, aks holda sahna/uslub.
- (2026-09-29) Musiqa eshitilmagan (−30 LUFS + kuchli ducking) — musiqa −22 LUFS, yumshoq ducking (ratio 2.5).
- (2026-09-29) Ovoz effektlari ko'p va baland — faqat asosiy lahzalar (o'tish, raqam oxiri, CTA, tugma), balandlik 0.2–0.28; har yozuvga effekt qo'yilmaydi.
- (2026-09-29) Uzun yozuv (HOZIROQ RO'YXATDAN O'TING) nowrap bilan ekrandan chiqib ketgan — 14 belgidan uzun yozuv ikki qatorga o'raladi.
- (2026-09-29) Gapda to'xtalib/qotib qolgan joy (pauza >0.8 s, dudoqlanish) — kesiladi yoki butun gap olib tashlanadi; mazmunga kerak bo'lmasa olib tashla.
- (2026-09-29) Emoji plashka/hisoblagich bilan bir vaqtda qo'shilib 3-element bo'lgan va plashka ostida qolgan (🚀) — bir vaqtda ≤2 grafik element qoidasi emoji'ga ham tegishli.
- (2026-09-29) Chiqish fayli eski fayl ustiga yozilganda Finder 'yaratilgan' sanasi eski qoladi — foydalanuvchi videolarni eski deb o'yladi. Yozishdan oldin eski fayl o'chiriladi.
- (2026-09-29) Ekrandagi yozuvlar foydalanuvchi bergan ssenariydagi raqam/iboralarga mos bo'lsin ($500–600, $1500–2000, $1000+, AI) — ovoz aytilganidek qoladi, grafika ssenariyni to'ldiradi.
- (2026-09-29) Yuzdan qochgan emoji ko'krakdagi yozuv plashkasi ortiga tushgan (v5 👀) — yozuv bilan bir vaqtda emoji faqat yuz tepasida joy bo'lsa; bo'lmasa qo'yilmaydi.
- (2026-09-29) Remotion 30 s kutish vaqti kompyuter band bo'lganda tugab render yiqilgan — timeout 120 s + bir marta avtomatik qayta urinish.
- (2026-09-29) Emoji videoning tepasiga alohida chiqarilmaydi — matn yonida, pastdagi plashka ICHIDA (so'z bilan bir qatorda) ishlatiladi; kam va ma'noli (foydalanuvchi talabi, C0021)
