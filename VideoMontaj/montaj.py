#!/usr/bin/env python3
"""montaj.py — "gapiruvchi bosh" videolarini avtomatik montaj qiladi (to'liq offline).

Buyruqlar:
  montaj.py tahlil VIDEO            — transkript (so'zma-so'z vaqt) + sukutlar + avto reja
  montaj.py render VIDEO [opsiyalar] — reja.json bo'yicha tayyor video
  montaj.py auto   VIDEO [opsiyalar] — tahlil + render (ilova shuni chaqiradi)
  montaj.py rolik  PAPKA [opsiyalar] — kamerasiz rolik: script.md + ovoz + logo → PAPKA/rolik.mp4
  montaj.py reel   VIDEO [opsiyalar] — REEL STUDIO: kesish + sahna (stiker/logo/hook/zoom/b-roll) + so'zma-so'z subtitr (Remotion)
  montaj.py kadrlar VIDEO            — faqat tekshiruv kadrlari (render oldidan)
  montaj.py studio VIDEO             — Remotion Studio'da jonli ko'rish
  montaj.py qoida "matn"             — tuzatishni QOIDALAR.md ga yozish
  montaj.py kesimlar VIDEO [--oddiy] — uzun videodan bir nechta Reels (ish/<nom>/kesimlar.json bo'yicha)
  montaj.py namuna VIDEO             — namuna (reference) Reels tahlili: kesishlar, tempo, kalit kadrlar → shu harakat tilini ko'chirish
  MONTAJ_GRADE=yoq                   — kino rang tuzatishni o'chirish (standart: kino)
  --til uz|en|ru|auto                — nutq tili (standart: uz)

Opsiyalar:
  --format asl|9:16|1:1|16:9   (standart: asl)
  --subtitr ha|yoq             (standart: ha)
  --stiker ha|yoq              (standart: yoq) — kalit so'zlarga iPhone emoji stikerlari
  --uslub NOM                  assets/uslublar/NOM.json — brend ranglari (standart: asosiy)
  --tezlik 1.2                 ovozni tezlashtirish (tovush o'zgarmaydi)
  --logo PATH|yoq              (standart: assets/logo.png bo'lsa qo'yiladi)
  --musiqa PATH|yoq            (standart: assets/musiqa/ ichidagi birinchi fayl)
  --chiqish PATH               (standart: asl video yonida <nom>_montaj.mp4)

Ish papkasi: ~/VideoMontaj/ish/<nom>/ — reja.json shu yerda. Claude (/montaj skilli)
reja.json dagi "olib_tashlash" va "grafika" ro'yxatlarini to'ldiradi, keyin render.
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ASOS = Path(__file__).resolve().parent
ISH = ASOS / "ish"
ASSETS = ASOS / "assets"
GRAFIKA = ASOS / "grafika"
def _birinchisi(*nomzodlar) -> Path:
    """Birinchi mavjud yo'l (boshqa kompyuterda ham ishlashi uchun zaxira yo'llar); hech biri bo'lmasa — birinchisi."""
    yollar = [Path(p).expanduser() for p in nomzodlar if p]
    return next((p for p in yollar if p.exists()), yollar[0])


# MONTAJ_WHISPER / MONTAJ_MODEL bilan almashtirish mumkin; aks holda shu Mac'dagi joy, keyin brew whisper-cpp / modellar/
WHISPER = _birinchisi(os.environ.get("MONTAJ_WHISPER"),
                      Path.home() / "UzbekDictationServer/whisper.cpp/build/bin/whisper-cli",
                      shutil.which("whisper-cli"))
MODEL = _birinchisi(os.environ.get("MONTAJ_MODEL"),
                    Path.home() / "UzbekDictationServer/models/ggml-rubaistt.bin",
                    ASOS / "modellar" / "ggml-rubaistt.bin")
FFMPEG_FULL = Path("/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg")
FFMPEG = str(FFMPEG_FULL) if FFMPEG_FULL.exists() else (shutil.which("ffmpeg") or "ffmpeg")
FFPROBE = str(FFMPEG_FULL.parent / "ffprobe") if FFMPEG_FULL.exists() else (shutil.which("ffprobe") or "ffprobe")
SHRIFT = "Montserrat ExtraBold"
TIL = "uz"  # --til bilan o'zgaradi (uz | en | ru | auto)

# Sukut sozlamalari: shundan uzun jimlik kesiladi, gap chetida PAD qoldiriladi
SUKUT_DB = -35
SUKUT_MIN = 0.45
PAD = 0.12
UYDIRMA = {"event", "du", "when", "store", "engine", "split", "display", "boost", "nachalnik", "vitish",
           "this", "musiqa", "bulardi", "start", "etyapti", "review", "again", "branch", "switch", "range",
           "line", "that", "explain", "community", "then", "eventi", "express", "danni", "philomeda"}
PARAZIT = {"eee", "ee", "eh", "ehh", "eeh", "mmm", "mm", "hmm", "hm", "aaa", "aa", "ııı", "ээ", "э", "мм", "эээ"}


# Kinematografik rang: balansli kontrast, tabiiy teri, yumshoq highlight, chuqur soya, me'yoriy to'yinganlik (neonsiz)
GRADE_KINO = ("eq=contrast=1.07:saturation=0.92:gamma=0.97,"
              "colorbalance=rs=-0.015:bs=0.025:rh=0.02:gh=0.008:bh=-0.015,"
              "curves=all='0/0.02 0.25/0.23 0.75/0.78 1/0.98',unsharp=5:5:0.35:5:5:0")

USLUB_STANDART = {"urgu": "#FFD400", "urgu_matn": "#111111", "subtitr": "#FFFFFF",
                  "fon": "#0B1220", "siyoh": "#FFFFFF"}


def uslub_yukla(nom):
    """assets/uslublar/<nom>.json — brend ranglari (frame.md g'oyasi). Yo'q bo'lsa standart."""
    u = dict(USLUB_STANDART, nom=nom or "asosiy")
    f = ASSETS / "uslublar" / f"{nom or 'asosiy'}.json"
    if f.exists():
        u.update(json.loads(f.read_text()))
    elif nom and nom != "asosiy":
        raise SystemExit(f"XATO: uslub topilmadi: {f}")
    return u


def ass_rang(hexr):
    h = hexr.lstrip("#")
    return f"&H00{h[4:6]}{h[2:4]}{h[0:2]}".upper()


def xavfsiz(W, H):
    """Ekranning o'qiladigan qismi. 9:16 da Instagram tepani 250, pastni 450 (izoh/musiqa),
    o'ngni 120 px (layk tugmalari) yopadi (1080x1920 hisobida)."""
    if H > W and abs(W / H - 9 / 16) < 0.02:
        k = H / 1920
        return {"top": int(250 * k), "bottom": int(450 * k), "right": int(120 * k), "left": int(60 * k)}
    return {"top": int(H * 0.06), "bottom": int(H * 0.08), "right": int(W * 0.04), "left": int(W * 0.04)}


HOLAT = ASOS / "holat.json"


def holat(bosqich, foiz=None, **kw):
    """Jonli holat — Montaj Holati ilovasi o'qiydi (video, navbat, bosqich, foiz)."""
    import time
    try:
        eski = json.loads(HOLAT.read_text()) if HOLAT.exists() else {}
    except Exception:
        eski = {}
    if kw.get("video") and kw["video"] != eski.get("video"):
        eski["boshlangan"] = time.time()
    eski.update(kw, bosqich=bosqich, foiz=foiz, vaqt=time.time(), navbat=os.environ.get("MONTAJ_NAVBAT", eski.get("navbat", "")))
    try:
        HOLAT.write_text(json.dumps(eski, ensure_ascii=False))
    except OSError:
        pass


def log(*a):
    print(*a, flush=True)


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def probe(video):
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries",
         "stream=codec_type,width,height,r_frame_rate:stream_side_data=rotation:format=duration",
         "-of", "json", str(video)],
        capture_output=True, text=True, check=True).stdout
    d = json.loads(out)
    v = next((s for s in d["streams"] if s.get("codec_type") == "video"), None)
    if not v:
        raise SystemExit("XATO: faylda video oqimi yo'q")
    if not any(s.get("codec_type") == "audio" for s in d["streams"]):
        raise SystemExit("XATO: videoda ovoz yo'q — montaj nutq bo'yicha qilinadi")
    w, h = int(v["width"]), int(v["height"])
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = abs(int(sd["rotation"]))
    if rot in (90, 270):
        w, h = h, w
    num, den = v.get("r_frame_rate", "30/1").split("/")
    fps = round(int(num) / max(int(den), 1)) or 30
    if 48000 % fps:
        fps = 30  # audio kadrlari video kadrlariga butun songa tushishi uchun
    return {"w": w, "h": h, "fps": fps, "dur": float(d["format"]["duration"])}


def ish_papka(video):
    p = ISH / Path(video).stem
    p.mkdir(parents=True, exist_ok=True)
    return p


# ---------------------------------------------------------------- tahlil

def takrorsiz(ws):
    """Whisper halqasi: 2–6 so'zli ibora ketma-ket 2+ marta takrorlansa — bittasi qoladi."""
    toza = lambda w: re.sub(r"[^\w']", "", w.lower())
    i, res = 0, []
    while i < len(ws):
        for n in range(6, 1, -1):
            blok = [toza(w) for w in ws[i:i + n]]
            if len(blok) < n:
                continue
            j = i + n
            while [toza(w) for w in ws[j:j + n]] == blok:
                j += n
            if j > i + n:
                res += ws[i:i + n]
                i = j
                break
        else:
            res.append(ws[i])
            i += 1
    return res


def transkript(video, papka, bolaklar):
    """Har nutq bo'lagini alohida transkripsiya qiladi — so'z vaqtlari jimlikka oqib ketmaydi."""
    import wave
    wav = papka / "audio.wav"
    run([FFMPEG, "-y", "-loglevel", "error", "-i", str(video), "-vn", "-ar", "16000", "-ac", "1",
         "-c:a", "pcm_s16le", str(wav)])
    bdir = papka / "bolaklar"
    shutil.rmtree(bdir, ignore_errors=True)
    bdir.mkdir()
    fayllar = []
    KON = 0.2  # whisper'ga chetidan qo'shimcha kontekst
    with wave.open(str(wav)) as src:
        sr, n = src.getframerate(), src.getnframes()
        for i, (a, b) in enumerate(bolaklar):
            a2 = max(0.0, a - KON)
            src.setpos(min(n, int(a2 * sr)))
            data = src.readframes(max(0, int((b + KON - a2) * sr)))
            f = bdir / f"{i:04d}.wav"
            with wave.open(str(f), "wb") as out:
                out.setnchannels(1)
                out.setsampwidth(2)
                out.setframerate(sr)
                out.writeframes(b"\x00\x00" * sr + data)  # 1 s jimlik — boshidagi uydirma so'zga qarshi
            fayllar.append(f)
    log(f"📝 Transkripsiya (RubaiSTT): {len(fayllar)} ta nutq bo'lagi...")
    cmd = [str(WHISPER), "-m", str(MODEL), "-l", TIL, "-ml", "1", "-sow", "-oj", "-t", "6"]
    for f in fayllar:
        cmd += ["-f", str(f)]
    run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    en = energiya(wav)
    (papka / "energiya.json").write_text(json.dumps(en, separators=(",", ":")))
    sozlar = []
    for (a, b), f in zip(bolaklar, fayllar):
        jf = Path(str(f) + ".json")
        if not jf.exists():
            continue
        ws = [seg["text"].strip() for seg in json.loads(jf.read_text())["transcription"]]
        ws = [t for t in ws if t and not t.startswith(("[", "("))]
        ws = takrorsiz(ws)
        # RubaiSTT bo'lak boshida ba'zan bitta uydirma so'z chiqaradi ("event.", "du.", "when.")
        if len(ws) > 1 and re.sub(r"[^\w']", "", ws[0].lower()) in UYDIRMA and ws[0].endswith("."):
            ws = ws[1:]
        if not ws:
            continue
        # So'zlarni bo'lakning OVOZLI vaqtiga harf soni bo'yicha taqsimlaymiz
        # (whisper'ning so'z vaqtlari ±0.5 s adashadi, bu usul aniqroq)
        i0, i1 = int(a * 100), min(len(en), int(b * 100))
        chegara = max(en[i0:i1] or [-99]) - 22
        ovozli = [i for i in range(i0, i1) if en[i] > chegara] or list(range(i0, max(i0 + 1, i1)))
        vazn = [len(t) + 1 for t in ws]
        jami, acc = sum(vazn), 0
        for t, v in zip(ws, vazn):
            j0 = ovozli[min(len(ovozli) - 1, int(acc / jami * len(ovozli)))]
            acc += v
            j1 = ovozli[min(len(ovozli) - 1, max(0, int(acc / jami * len(ovozli)) - 1))]
            sozlar.append({"s": j0 / 100, "e": (j1 + 1) / 100, "t": t})
    (papka / "sozlar.json").write_text(json.dumps(sozlar, ensure_ascii=False, indent=0))
    return sozlar


def energiya(wav):
    """Har 10 ms uchun RMS darajasi (dB, butun son)."""
    r = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-i", str(wav), "-af",
                        "asetnsamples=n=160:p=0,astats=metadata=1:reset=1,"
                        "ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
                        "-f", "null", "-"], capture_output=True, text=True, check=True)
    res = []
    for line in r.stdout.splitlines():
        if line.startswith("lavfi.astats.Overall.RMS_level="):
            v = line.split("=", 1)[1]
            res.append(-99 if "inf" in v else max(-99, int(float(v))))
    return res


def snap(t, en, oyna=0.35):
    """t ni ±oyna ichidagi eng jim nuqtaga suradi (so'z o'rtasidan kesmaslik uchun)."""
    if not en:
        return t
    i0, i1 = max(0, int((t - oyna) * 100)), min(len(en) - 1, int((t + oyna) * 100))
    if i1 <= i0:
        return t
    best = min(range(i0, i1 + 1), key=lambda i: (en[i], abs(i - t * 100)))
    return best / 100


def sukutlar(video, dur):
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(video), "-vn", "-af",
                        f"silencedetect=noise={SUKUT_DB}dB:d={SUKUT_MIN}", "-f", "null", "-"],
                       capture_output=True, text=True)
    res, start = [], None
    for line in r.stderr.splitlines():
        m = re.search(r"silence_start: (-?[\d.]+)", line)
        if m:
            start = max(0.0, float(m.group(1)))
        m = re.search(r"silence_end: ([\d.]+)", line)
        if m and start is not None:
            res.append([start, float(m.group(1))])
            start = None
    if start is not None:
        res.append([start, dur])
    return res


def gaplar(sozlar):
    """So'zlarni Claude o'qishi uchun iboralarga guruhlaydi."""
    res, cur = [], []
    for i, w in enumerate(sozlar):
        if cur and (w["s"] - cur[-1]["e"] > 0.6):
            res.append(cur)
            cur = []
        cur.append(w)
        if re.search(r"[.?!]$", w["t"]) or len(cur) >= 14:
            res.append(cur)
            cur = []
    if cur:
        res.append(cur)
    return res


def tahlil(video):
    video = Path(video).resolve()
    info = probe(video)
    papka = ish_papka(video)
    log(f"🎬 {video.name}: {info['w']}x{info['h']}, {info['fps']} fps, {info['dur']:.1f} s")
    suk = sukutlar(video, info["dur"])

    # Nutq oraliqlari = sukutlarning teskarisi (chetida PAD)
    saqlash, t = [], 0.0
    for s, e in suk:
        if s - t > 0.05:
            saqlash.append([max(0, t - PAD) if t > 0 else 0, min(info["dur"], s + PAD)])
        t = e
    if info["dur"] - t > 0.05:
        saqlash.append([max(0, t - PAD), info["dur"]])

    # qisqa bo'laklarni qo'shnisiga qo'shamiz — whisper'ga kontekst kerak
    bolaklar = []
    for a, b in saqlash:
        if bolaklar and (b - a < 1.2 or bolaklar[-1][1] - bolaklar[-1][0] < 1.2) and a - bolaklar[-1][1] < 1.5:
            bolaklar[-1][1] = b
        else:
            bolaklar.append([a, b])
    sozlar = transkript(video, papka, bolaklar)

    parazit = [[w["s"], w["e"], "parazit: " + w["t"]] for w in sozlar
               if re.sub(r"[^\wʻ']", "", w["t"].lower()) in PARAZIT]

    reja = {
        "video": str(video),
        "saqlash": [[round(a, 3), round(b, 3)] for a, b in saqlash],
        "olib_tashlash": parazit,
        "grafika": [],
        "_izoh": ("olib_tashlash: [boshi, oxiri, sabab] — ASL video vaqti (soniya). "
                  "grafika: {tur: sarlavha|raqam, matn, raqam?, boshi (asl vaqt), davom}"),
    }
    (papka / "reja.json").write_text(json.dumps(reja, ensure_ascii=False, indent=1))

    satrlar = [f"# {video.name} — {info['dur']:.1f} s, {info['w']}x{info['h']}", ""]
    for g in gaplar(sozlar):
        satrlar.append(f"[{g[0]['s']:7.2f} – {g[-1]['e']:7.2f}]  " + " ".join(w["t"] for w in g))
    (papka / "transkript.txt").write_text("\n".join(satrlar) + "\n")

    jimlik = sum(e - s for s, e in suk)
    log(f"✅ Tahlil tayyor: {papka}")
    log(f"   so'zlar: {len(sozlar)}, sukut: {jimlik:.1f} s, parazit so'z: {len(parazit)}")
    return papka


# ---------------------------------------------------------------- reja → oraliqlar

def yakuniy_oraliqlar(reja, fps, dur, en=None):
    """saqlash − olib_tashlash, kadr to'riga tekislangan."""
    oraliq = [list(x[:2]) for x in reja["saqlash"]]
    for x in reja.get("olib_tashlash", []):
        # "aniq" — qo'lda (eshitib/energiyadan) topilgan chegara: jim nuqtaga surilmaydi
        aniq = len(x) > 3 and x[3] == "aniq"
        a, b = (float(x[0]), float(x[1])) if aniq else (snap(float(x[0]), en), snap(float(x[1]), en))
        yangi = []
        for s, e in oraliq:
            if b <= s or a >= e:
                yangi.append([s, e])
                continue
            if a > s:
                yangi.append([s, a])
            if b < e:
                yangi.append([b, e])
        oraliq = yangi
    # kadr to'ri
    res = []
    for s, e in sorted(oraliq):
        s = math.floor(s * fps) / fps
        e = min(math.ceil(e * fps) / fps, math.floor(dur * fps) / fps)
        if e - s < 3 / fps:
            continue
        if res and s <= res[-1][1] + 1e-6:
            res[-1][1] = max(res[-1][1], e)
        else:
            res.append([s, e])
    if not res:
        raise SystemExit("XATO: rejada saqlanadigan qism qolmadi")
    return res


def xarita(oraliq):
    """asl vaqt → yangi vaqt funksiyasi (kesilgan joyga tushsa None)."""
    ofs, acc = [], 0.0
    for s, e in oraliq:
        ofs.append((s, e, acc))
        acc += e - s

    def f(t, clamp=False):
        for s, e, a in ofs:
            if s - 1e-6 <= t <= e + 1e-6:
                return a + (t - s)
            if clamp and t < s:
                return a
        return acc if clamp else None
    return f, acc


# ---------------------------------------------------------------- subtitr

def ass_vaqt(t):
    t = max(0, t)
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def subtitr_ass(sozlar, oraliq, W, H, fayl, uslub=None):
    f, jami = xarita(oraliq)
    kept = []
    for w in sozlar:
        mid = (w["s"] + w["e"]) / 2
        nm = f(mid)
        if nm is None:
            continue
        ns, ne = f(w["s"], clamp=True), f(w["e"], clamp=True)
        ns, ne = min(ns, nm), max(ne, nm)
        txt = w["t"].upper().strip(",.;:—-«»\"")
        if txt:
            kept.append({"s": ns, "e": ne, "t": txt, "end": bool(re.search(r"[.?!,]$", w["t"]))})

    # 3 so'z / 22 belgi, tinish belgisida yoki pauzada bo'linadi
    bloklar, cur = [], []
    for w in kept:
        if cur and (w["s"] - cur[-1]["e"] > 0.5 or len(cur) >= 3
                    or len(" ".join(x["t"] for x in cur + [w])) > 22):
            bloklar.append(cur)
            cur = []
        cur.append(w)
        if w["end"]:
            bloklar.append(cur)
            cur = []
    if cur:
        bloklar.append(cur)

    vertikal = H > W
    size = int(W * (0.075 if vertikal else 0.045))
    uslub = uslub or USLUB_STANDART
    xz = xavfsiz(W, H)
    margin = max(int(H * (0.24 if vertikal else 0.08)), xz["bottom"] + int(H * 0.02))
    sariq = "{\\c" + ass_rang(uslub["urgu"]) + "&}"  # joriy so'z — urg'u rangi
    oq = "{\\c" + ass_rang(uslub["subtitr"]) + "&}"
    ev = []
    for b in bloklar:
        for i, w in enumerate(b):
            s = b[0]["s"] if i == 0 else w["s"]
            e = b[i + 1]["s"] if i + 1 < len(b) else max(w["e"], s + 0.25)
            matn = " ".join((sariq + x["t"] + oq) if j == i else x["t"] for j, x in enumerate(b))
            ev.append(f"Dialogue: 0,{ass_vaqt(s)},{ass_vaqt(e)},Asosiy,,0,0,0,,{matn}")

    fayl.write_text(f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Asosiy,{SHRIFT},{size},{ass_rang(uslub["subtitr"])},&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,1,0,1,{max(3, size // 12)},{max(1, size // 30)},2,{max(int(W*0.06), xz["left"])},{max(int(W*0.06), xz["right"])},{margin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ev) + "\n")
    return len(ev)


# ---------------------------------------------------------------- grafika (Remotion)

STIKER_LUGAT = [  # so'z boshi → iPhone emoji (avto rejim)
    (("pul", "so'm", "mln", "million", "milliard", "dollar", "daromad", "foyda"), "💰"),
    (("sotuv", "sotish", "sotil", "savdo"), "📈"),
    (("muammo", "qiyin", "og'ir"), "😩"),
    (("xato",), "❌"),
    (("to'g'ri",), "✅"),
    (("sir", "maxfiy"), "🤫"),
    (("diqqat", "muhim", "ehtiyot"), "⚠️"),
    (("g'oya", "fikr"), "💡"),
    (("vaqt", "soat", "daqiqa", "tez"), "⏰"),
    (("telefon",), "📱"),
    (("instagram", "reels", "stories", "rils"), "📸"),
    (("target", "reklama"), "🎯"),
    (("mijoz", "klient", "odamlar", "auditoriya"), "👥"),
    (("zo'r", "ajoyib", "super", "kuchli"), "🔥"),
    (("bepul", "sovg'a", "bonus", "tekin"), "🎁"),
    (("o'sish", "natija", "rivoj"), "🚀"),
    (("dars", "kitob", "o'rgan", "kurs"), "📚"),
    (("biznes", "tadbirkor"), "💼"),
    (("rahmat",), "🙏"),
    (("sevgi", "yurak"), "❤️"),
]


def avto_stikerlar(sozlar, oraliq, oraliq_s=8.0):
    """Kalit so'zlarga iPhone emoji stikeri (kamida oraliq_s soniyada bitta)."""
    f, _ = xarita(oraliq)
    res, oxirgi, joy = [], -99.0, 0
    for w in sozlar:
        t = w["t"].lower().strip(",.?!:;\"«»")
        yt = f((w["s"] + w["e"]) / 2)
        if yt is None or yt < 1.0 or yt - oxirgi < oraliq_s:
            continue
        for bosh, em in STIKER_LUGAT:
            if t.startswith(bosh):
                res.append({"tur": "stiker", "emoji": em, "boshi": w["s"], "davom": 1.6,
                            "joy": ("yuqori-o'ng", "yuqori-chap")[joy % 2], "_avto": True})
                oxirgi, joy = yt, joy + 1
                break
    return res


def grafika_render(items, oraliq, W, H, fps, papka, uslub=None):
    """Grafikalarni shaffof .mov qiladi (Remotion, bitta bundle) → [(fayl, yangi_boshi, x, y)]."""
    if not items:
        return []
    f, _ = xarita(oraliq)
    uslub = uslub or USLUB_STANDART
    xz = xavfsiz(W, H)
    kesh = GRAFIKA / "kesh"
    kesh.mkdir(exist_ok=True)
    jobs, natija = [], []
    for i, g in enumerate(items):
        boshi = f(float(g["boshi"]), clamp=True)
        davom = float(g.get("davom", 3))
        tur = g.get("tur", "sarlavha")
        if tur == "stiker":
            S = int(min(W, H) * 0.3) // 2 * 2
            em = g.get("emoji", "🔥")
            chiq = kesh / f"stiker_{'-'.join(f'{ord(c):x}' for c in em)}_{S}_{fps}_{davom}.mov"
            if not chiq.exists():
                jobs.append({"comp": "Stiker", "out": str(chiq),
                             "props": {"matn": "", "emoji": em, "W": S, "H": S, "fps": fps, "davom": davom}})
            joy = g.get("joy", "yuqori-o'ng")
            x = {"chap": xz["left"] + int(W * 0.02), "markaz": (W - S) // 2}.get(
                joy.split("-")[-1], W - S - xz["right"] - int(W * 0.02))
            y = int(H * 0.62) if joy.startswith("past") else max(xz["top"] + int(H * 0.02), int(H * (0.26 if H > W else 0.12)))
            y = min(y, H - xz["bottom"] - S)
            natija.append((chiq, boshi, x, y))
        else:
            comp = {"sarlavha": "Sarlavha", "raqam": "Raqam"}.get(tur, "Sarlavha")
            chiq = papka / f"grafika_{i}.mov"
            props = {k: v for k, v in g.items() if not k.startswith("_")}
            props.setdefault("rang", uslub["urgu"])
            props.setdefault("matnRang", uslub["urgu_matn"])
            jobs.append({"comp": comp, "out": str(chiq),
                         "props": dict(props, W=W, H=H, fps=fps, davom=davom, xz=xz)})
            natija.append((chiq, boshi, 0, 0))
    if jobs:
        log(f"🎨 Grafika: {len(jobs)} ta chiziladi (Remotion)...")
        jf = papka / "grafika_jobs.json"
        jf.write_text(json.dumps(jobs, ensure_ascii=False))
        run(["node", "render.mjs", str(jf)], cwd=GRAFIKA, stdout=subprocess.DEVNULL)
    return natija


# ---------------------------------------------------------------- render

def chiqish_olcham(info, fmt):
    w, h = info["w"], info["h"]
    if fmt == "9:16":
        return 1080, 1920
    if fmt == "1:1":
        return 1080, 1080
    if fmt == "16:9":
        return 1920, 1080
    # asl: uzun tomoni 1920 dan oshmasin (MONTAJ_ASL_MAX — "kamera" yaqin kadri uchun kattaroq manba), juft son
    k = min(1.0, int(os.environ.get("MONTAJ_ASL_MAX", 1920)) / max(w, h))
    return int(w * k) // 2 * 2, int(h * k) // 2 * 2


def render(video, fmt="asl", subtitr=True, logo=None, musiqa=None, chiqish=None, stiker=False,
           uslub=None, tezlik=1.0, grafikasiz=False, grade=False):
    video = Path(video).resolve()
    papka = ish_papka(video)
    reja_f = papka / "reja.json"
    if not reja_f.exists() or json.loads(reja_f.read_text()).get("video") != str(video):
        tahlil(video)  # boshqa papkadagi bir xil nomli video — qayta tahlil
    reja = json.loads(reja_f.read_text())
    sozlar = json.loads((papka / "sozlar.json").read_text())
    info = probe(video)
    fps = info["fps"]
    W, H = chiqish_olcham(info, fmt)
    ef = papka / "energiya.json"
    en = json.loads(ef.read_text()) if ef.exists() else None
    oraliq = yakuniy_oraliqlar(reja, fps, info["dur"], en)
    _, jami = xarita(oraliq)
    log(f"✂️  {len(oraliq)} bo'lak, {info['dur']:.1f} s → {jami:.1f} s ({W}x{H})")

    # ffmpeg ifoda tahlilchisi ~100 bo'lakdan ko'pini ko'tarmaydi → 50 tadan guruh + concat
    eps = 0.25 / fps
    spf = 48000 // fps
    guruhlar = [oraliq[i:i + 50] for i in range(0, len(oraliq), 50)]
    K = len(guruhlar)
    vq, aq = [], []
    for gi, g in enumerate(guruhlar):
        sel = "+".join(f"gte(t,{s - eps:.4f})*lt(t,{e - eps:.4f})" for s, e in g)
        nfr = sum(round((e - s) * fps) for s, e in g)
        vq.append(f"[vs{gi}]select='{sel}',setpts=N/{fps}/TB,trim=end_frame={nfr}[vp{gi}]")
        aq.append(f"[as{gi}]aselect='{sel}',asetpts=N/SR/TB,atrim=end_sample={nfr * spf}[ap{gi}]")
    vsplit = f"split={K}" + "".join(f"[vs{i}]" for i in range(K)) if K > 1 else "null[vs0]"
    asplit = f"asplit={K}" + "".join(f"[as{i}]" for i in range(K)) if K > 1 else "anull[as0]"
    fc = [f"[0:v]fps={fps},setpts=PTS-STARTPTS,{vsplit}", *vq,
          "".join(f"[vp{i}]" for i in range(K)) + (f"concat=n={K}:v=1:a=0" if K > 1 else "null") + "[vcat]",
          f"[0:a]aresample=48000,asetnsamples=n={spf}:p=1,asetpts=PTS-STARTPTS,{asplit}", *aq,
          "".join(f"[ap{i}]" for i in range(K)) + (f"concat=n={K}:v=0:a=1" if K > 1 else "anull") + "[acat]"]

    # kesib-moslash (crop to fill)
    vf = [f"[vcat]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1"]
    if grade:
        vf.append(GRADE_KINO)
    if subtitr and sozlar:
        ass = papka / "subtitr.ass"
        n = subtitr_ass(sozlar, oraliq, W, H, ass, uslub)
        log(f"🔤 Subtitr: {n} ta hodisa")
        vf.append(f"ass={ass}:fontsdir={ASSETS / 'shrift'}")
    fc.append(",".join(vf) + "[v0]")

    inputs = ["-i", str(video)]
    idx, vlast = 1, "v0"
    if logo:
        inputs += ["-loop", "1", "-i", str(logo)]
        lw = int(W * (0.13 if H > W else 0.1))
        xz = xavfsiz(W, H)
        fc.append(f"[{idx}:v]scale={lw}:-1,format=rgba,colorchannelmixer=aa=0.92[lg]")
        fc.append(f"[{vlast}][lg]overlay=W-w-{xz['right'] + int(W * 0.02)}:{xz['top'] + int(H * 0.01)}:shortest=1[v{idx}]")
        vlast = f"v{idx}"
        idx += 1

    items = [] if grafikasiz else list(reja.get("grafika", []))
    if stiker and not any(g.get("tur") == "stiker" for g in items):
        items += avto_stikerlar(sozlar, oraliq)
    for gf, boshi, x, y in grafika_render(items, oraliq, W, H, fps, papka, uslub):
        inputs += ["-i", str(gf)]
        fc.append(f"[{idx}:v]setpts=PTS-STARTPTS+{boshi:.3f}/TB[g{idx}]")
        fc.append(f"[{vlast}][g{idx}]overlay={x}:{y}:eof_action=pass[v{idx}]")
        vlast = f"v{idx}"
        idx += 1

    fc.append("[acat]highpass=f=80,loudnorm=I=-14:LRA=11:TP=-1.5,aresample=48000[nutq]")
    if musiqa:
        inputs += ["-stream_loop", "-1", "-i", str(musiqa)]
        fc.append("[nutq]asplit=2[n1][n2]")
        fc.append(f"[{idx}:a]aresample=48000,volume=0.22,atrim=0:{jami:.3f},"
                  f"afade=t=out:st={max(0, jami - 2):.3f}:d=2[mz]")
        fc.append("[mz][n2]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[mzd]")
        fc.append("[n1][mzd]amix=inputs=2:duration=first:normalize=0[aout]")
        alast = "aout"
    else:
        alast = "nutq"

    if tezlik and abs(tezlik - 1) > 0.01:
        # ovozni tezlashtirish — tovush balandligi o'zgarmaydi (atempo)
        fc.append(f"[{vlast}]setpts=PTS/{tezlik}[vtez]")
        fc.append(f"[{alast}]atempo={tezlik}[atez]")
        vlast, alast, jami = "vtez", "atez", jami / tezlik
        log(f"⏩ Tezlik x{tezlik} → {jami:.1f} s")
    if chiqish is None:
        chiqish = video.with_name(f"{video.stem}_montaj.mp4")
    chiqish = Path(chiqish)
    fc_fayl = papka / "filter.txt"
    fc_fayl.write_text(";\n".join(fc))
    log("🎞  Render...")
    run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-stats", *inputs,
         "-/filter_complex", str(fc_fayl), "-map", f"[{vlast}]", "-map", f"[{alast}]",
         "-t", f"{jami:.3f}", "-r", str(fps),
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(chiqish)])
    log(f"✅ Tayyor: {chiqish}  ({jami:.1f} s)")
    return chiqish


# ---------------------------------------------------------------- ssenariydan rolik (kamerasiz)

def ssenariy_oqi(fayl):
    """script.md: har '# Sarlavha' bitta kadr, ostidagi qator(lar) — o'sha kadrda aytiladigan gap."""
    kadrlar, cur = [], None
    for line in Path(fayl).read_text().splitlines():
        line = line.strip()
        if line.startswith("#"):
            if cur and cur["matn"]:
                kadrlar.append(cur)
            cur = {"sarlavha": line.lstrip("#").strip(), "matn": ""}
        elif line:
            if cur is None:
                cur = {"sarlavha": "", "matn": ""}
            cur["matn"] = (cur["matn"] + " " + line).strip()
    if cur and cur["matn"]:
        kadrlar.append(cur)
    if not kadrlar:
        raise SystemExit(f"XATO: ssenariyda kadr yo'q: {fayl}")
    return kadrlar


def kadr_vaqtlari(kadrlar, wav, dur):
    """Har kadr qachon boshlanishini ovozdan topadi.
    Ovoz pauzalarda (≥ 80 ms) bo'laklarga bo'linadi, har bo'lak alohida RubaiSTT'dan o'tadi
    (uning so'z vaqtlari ishonchsiz, lekin matni yaxshi), ssenariy so'zlari shu matnga moslanadi (difflib)
    → kadr chegarasi aniq pauzaga tushadi. Moslanmasa — harf soni bo'yicha taxmin."""
    import difflib
    import wave
    en = energiya(wav)
    chegara = max(en or [-99]) - 22
    ovozli = [i for i, v in enumerate(en) if v > chegara] or [0]
    # nutq bo'laklari (pauzalar orasi)
    bolak, bosh, jim = [], None, None
    for i, v in enumerate(en + [-99] * 10):
        if v > chegara:
            if bosh is None:
                bosh = i
            jim = None
        elif bosh is not None:
            jim = i if jim is None else jim
            if i - jim >= 8:
                bolak.append([bosh / 100, jim / 100])
                bosh, jim = None, None
    birl = []
    for a_, b_ in bolak:  # 0.35 s dan qisqa bo'lak keyingisiga qo'shiladi
        if birl and birl[-1][1] - birl[-1][0] < 0.35:
            birl[-1][1] = b_
        else:
            birl.append([a_, b_])
    bolak = birl

    # har bo'lak matni (1 s jimlik prefiksi bilan)
    tmp = Path(tempfile.mkdtemp())
    sozlar = []  # (vaqt, so'z, bo'lak_boshimi)
    try:
        with wave.open(str(wav)) as src:
            sr, par = src.getframerate(), src.getparams()
            fayllar = []
            for i, (a_, b_) in enumerate(bolak):
                src.setpos(int(max(0, a_ - 0.05) * sr))
                data = src.readframes(int((b_ - a_ + 0.1) * sr))
                f = tmp / f"{i:04d}.wav"
                with wave.open(str(f), "wb") as out:
                    out.setparams(par)
                    out.writeframes(b"\x00\x00" * sr + data)
                fayllar.append(f)
        cmd = [str(WHISPER), "-m", str(MODEL), "-l", "uz", "-nt", "-oj", "-t", "6"]
        for f in fayllar:
            cmd += ["-f", str(f)]
        run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for (a_, b_), f in zip(bolak, fayllar):
            jf = Path(str(f) + ".json")
            if not jf.exists():
                continue
            matn = " ".join(seg["text"] for seg in json.loads(jf.read_text())["transcription"])
            ws = [x for x in (re.sub(r"[^\w]", "", t.lower()) for t in matn.split()) if x]
            for i, w in enumerate(ws):
                sozlar.append((a_ + (b_ - a_) * i / max(1, len(ws)), w, i == 0))
    except Exception as e:
        log(f"   (so'z moslash o'tkazib yuborildi: {e})")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # taxmin (zaxira): harf soni bo'yicha
    vazn = [len(re.sub(r"[^\w]", "", k["matn"])) + 3 for k in kadrlar]
    jami, acc, chegaralar = sum(vazn), 0, []
    for v in vazn[:-1]:
        acc += v
        chegaralar.append(ovozli[min(len(ovozli) - 1, int(acc / jami * len(ovozli)))] / 100)

    if sozlar:
        sw, kbosh = [], []
        for k in kadrlar:
            kbosh.append(len(sw))
            sw += [x for x in (re.sub(r"[^\w]", "", t.lower()) for t in k["matn"].split()) if x]
        sm = difflib.SequenceMatcher(None, sw, [x[1] for x in sozlar], autojunk=False)
        mos = {}
        for blk in sm.get_matching_blocks():
            for d in range(blk.size):
                mos[blk.a + d] = blk.b + d
        topildi = 0
        for j, kb in enumerate(kbosh[1:]):
            for d in range(4):
                if kb + d in mos:
                    wi = max(0, mos[kb + d] - d)
                    t = sozlar[wi][0]
                    chegaralar[j] = max(0.0, t - 0.08)
                    topildi += 1
                    break
        log(f"   so'z moslash: {topildi}/{len(kadrlar) - 1} chegara ovozdan topildi ({len(bolak)} bo'lak)")
    # tartibni kafolatlash
    for j in range(1, len(chegaralar)):
        if chegaralar[j] <= chegaralar[j - 1] + 0.3:
            chegaralar[j] = chegaralar[j - 1] + 0.3
    oxir = dur + 0.8
    vaqt = [0.0] + chegaralar + [oxir]
    for i, k in enumerate(kadrlar):
        k["boshi"], k["oxiri"] = round(vaqt[i], 3), round(vaqt[i + 1], 3)
    return oxir


def rolik(papka, fmt="9:16", uslub=None, tezlik=1.0, musiqa=None):
    """Kamerasiz rolik: papkada script.md (+ ovoz fayli, + logo.png) → papka/rolik.mp4"""
    papka = Path(papka).resolve()
    kadrlar = ssenariy_oqi(papka / "script.md")
    uslub = uslub or uslub_yukla(None)
    W, H = {"9:16": (1080, 1920), "1:1": (1080, 1080), "16:9": (1920, 1080)}.get(fmt, (1080, 1920))
    fps = 30
    pub = GRAFIKA / "public" / "_rolik" / papka.name
    shutil.rmtree(pub, ignore_errors=True)
    pub.mkdir(parents=True)
    rel = f"_rolik/{papka.name}"

    ovozlar = sorted(p for p in papka.iterdir() if p.suffix.lower() in (".wav", ".mp3", ".m4a", ".aac", ".ogg")
                     and not p.name.startswith("musiqa"))
    ovoz = None
    if ovozlar:
        af = ["highpass=f=80", "loudnorm=I=-14:LRA=11:TP=-1.5"]
        if tezlik and abs(tezlik - 1) > 0.01:
            af.insert(0, f"atempo={tezlik}")
        run([FFMPEG, "-y", "-loglevel", "error", "-i", str(ovozlar[0]), "-af", ",".join(af),
             "-ar", "48000", "-ac", "2", str(pub / "ovoz.wav")])
        wav16 = pub / "ovoz16.wav"
        run([FFMPEG, "-y", "-loglevel", "error", "-i", str(pub / "ovoz.wav"), "-ar", "16000", "-ac", "1", str(wav16)])
        dur = float(subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                    str(wav16)], capture_output=True, text=True).stdout)
        davom = kadr_vaqtlari(kadrlar, wav16, dur)
        wav16.unlink()
        ovoz = f"{rel}/ovoz.wav"
        log(f"🎙  Ovoz: {ovozlar[0].name} ({dur:.1f} s) — {len(kadrlar)} kadr pauzalarga moslandi")
    else:
        t = 0.0
        for k in kadrlar:
            d = max(2.2, len(k["matn"].split()) * 0.38 + 1.0)
            k["boshi"], k["oxiri"] = round(t, 3), round(t + d, 3)
            t += d
        davom = t
        log(f"🔇 Ovoz yo'q — {len(kadrlar)} kadr matn uzunligi bo'yicha ({davom:.1f} s)")

    logo = None
    for cand in [papka / "logo.png", Path(str(uslub.get("logo", ""))).expanduser(), ASSETS / "logo.png"]:
        if cand.suffix and cand.exists():
            shutil.copy(cand, pub / "logo.png")
            logo = f"{rel}/logo.png"
            break

    for k in kadrlar:
        log(f"   [{k['boshi']:6.2f}–{k['oxiri']:6.2f}] {k['sarlavha'][:18]:18} | {k['matn'][:60]}")
    (papka / "kadrlar.json").write_text(json.dumps(kadrlar, ensure_ascii=False, indent=1))

    props = {"kadrlar": kadrlar, "ovoz": ovoz, "logo": logo, "W": W, "H": H, "fps": fps, "davom": davom,
             "xz": xavfsiz(W, H), "uslub": {k: uslub[k] for k in ("urgu", "urgu_matn", "fon", "siyoh")}}
    xom = papka / ("rolik_xom.mp4" if musiqa else "rolik.mp4")
    jf = papka / "rolik_job.json"
    jf.write_text(json.dumps([{"comp": "Rolik", "out": str(xom), "props": props, "codec": "h264"}], ensure_ascii=False))
    log(f"🎨 Rolik chizilmoqda ({davom:.1f} s, {W}x{H})...")
    run(["node", "render.mjs", str(jf)], cwd=GRAFIKA, stdout=subprocess.DEVNULL)
    chiq = papka / "rolik.mp4"
    if musiqa:
        run([FFMPEG, "-y", "-loglevel", "error", "-i", str(xom), "-stream_loop", "-1", "-i", str(musiqa),
             "-filter_complex",
             f"[0:a]asplit=2[n1][n2];[1:a]aresample=48000,volume=0.22,atrim=0:{davom:.3f},"
             f"afade=t=out:st={max(0, davom - 2):.3f}:d=2[mz];"
             "[mz][n2]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[mzd];"
             "[n1][mzd]amix=inputs=2:duration=first:normalize=0[a]" if ovoz else
             f"[1:a]aresample=48000,volume=0.5,atrim=0:{davom:.3f},afade=t=out:st={max(0, davom - 2):.3f}:d=2[a]",
             "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{davom:.3f}",
             "-movflags", "+faststart", str(chiq)])
        xom.unlink()
    jf.unlink()
    log(f"✅ Tayyor: {chiq}  ({davom:.1f} s)")
    return chiq


# ---------------------------------------------------------------- Reel Studio

def soz_bloklar(sozlar, oraliq):
    """So'zlarni yangi (kesilgan) vaqtga o'tkazib, 1–3 so'zli subtitr bloklariga bo'ladi."""
    f, _ = xarita(oraliq)
    kept = []
    for w in sozlar:
        nm = f((w["s"] + w["e"]) / 2)
        if nm is None:
            continue
        ns, ne = min(f(w["s"], clamp=True), nm), max(f(w["e"], clamp=True), nm)
        t = w["t"].strip(",.;:—-«»\"")
        if t:
            kept.append({"t": t, "s": round(ns, 3), "e": round(ne, 3), "end": bool(re.search(r"[.?!,]$", w["t"]))})
    bloklar, cur = [], []
    for w in kept:
        if cur and (w["s"] - cur[-1]["e"] > 0.5 or len(cur) >= 3 or len(" ".join(x["t"] for x in cur + [w])) > 20):
            bloklar.append(cur)
            cur = []
        cur.append(w)
        if w["end"]:
            bloklar.append(cur)
            cur = []
    if cur:
        bloklar.append(cur)
    res = []
    for i, b in enumerate(bloklar):
        e = b[-1]["e"] + 0.15
        if i + 1 < len(bloklar):
            e = min(max(e, b[-1]["e"]), bloklar[i + 1][0]["s"])
        res.append({"s": b[0]["s"], "e": round(max(e, b[0]["s"] + 0.3), 3),
                    "sozlar": [{"t": w["t"], "s": w["s"], "e": w["e"]} for w in b]})
    return res, kept


def kutubxona():
    st = json.loads((ASSETS / "stikerlar" / "royxat.json").read_text()).get("stikerlar", [])
    lf = ASSETS / "logolar" / "royxat.json"
    lg = json.loads(lf.read_text()).get("logolar", []) if lf.exists() else []
    return st, lg


def avto_sahna(bloklar, kept, davom):
    """Claude'siz sahna: stiker kutubxonadan (ma'no teglari) yoki emoji, logolar, zoom, hook."""
    stik, logos = kutubxona()
    el, oxirgi, joy = [], -99.0, 0
    for w in kept:
        t = w["t"].lower().strip("?!")
        if w["s"] < 0.8 or w["s"] - oxirgi < 4.0:
            continue
        tanlov = None
        for L in logos:
            if any(t.startswith(x.lower()) for x in L.get("teglar", []) + [L.get("nom", "~")]):
                tanlov = {"tur": "logo", "fayl": "logolar/" + L["fayl"]}
                break
        if not tanlov:
            for S in stik:
                if any(t.startswith(x) for x in S["teglar"]):
                    tanlov = {"tur": "stiker", "fayl": "stikerlar/" + S["fayl"], **({"fon": S["fon"]} if S.get("fon") else {})}
                    break
        if not tanlov:
            for bosh, em in STIKER_LUGAT:
                if t.startswith(bosh):
                    tanlov = {"tur": "stiker", "emoji": em}
                    break
        if tanlov:
            tanlov.update({"boshi": w["s"], "oxiri": round(min(davom, w["s"] + 2.0), 3),
                           "joy": ("yuqori-o'ng", "yuqori-chap")[joy % 2]})
            el.append(tanlov)
            oxirgi, joy = w["s"], joy + 1
    # zoom: ! yoki ? bilan tugagan gaplar (6 s da ko'pi bilan bitta)
    oxz = -99.0
    for b in bloklar:
        last = b["sozlar"][-1]
        if b["s"] - oxz >= 6 and b["s"] > 1:
            el.append({"tur": "zoom", "boshi": b["s"], "oxiri": round(min(davom, b["e"] + 0.8), 3), "kuch": 1.1})
            oxz = b["s"]
    # hook avto qo'yilmaydi: birinchi gapni yozsa ovozni takrorlaydi (QOIDALAR 3) — ma'noli hookni Claude yozadi
    hook = None
    return {"_avto": True, "hook": hook, "elementlar": el}


def _jamoatga(manba, pub, rel):
    """Faylni grafika/public/_reel/<nom>/ ga (hardlink yoki nusxa) → staticFile yo'li."""
    manba = Path(manba).expanduser()
    if not manba.is_absolute():
        manba = ASSETS / manba
    if not manba.exists():
        raise SystemExit(f"XATO: sahnadagi fayl topilmadi: {manba}")
    nom = re.sub(r"[^\w.-]", "_", manba.name)
    dst = pub / nom
    if not dst.exists():
        try:
            os.link(manba, dst)
        except OSError:
            shutil.copy(manba, dst)
    return f"{rel}/{nom}"


def odam_va_yuz(toza, papka, kalit, kerak_odam):
    """Apple Vision: odam maskasi + yuz o'rni (keshlanadi). kerak_odam=True bo'lsa shaffof odam.webm ham."""
    vosita = ASOS / "vosita" / "odam_maska"
    manba = ASOS / "vosita" / "odam_maska.swift"
    if not vosita.exists() or vosita.stat().st_mtime < manba.stat().st_mtime:
        log("🔧 odam_maska vositasi kompilyatsiya qilinmoqda (bir marta)...")
        run(["swiftc", "-O", str(manba), "-o", str(vosita)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    maska, yuzf, kf = papka / "maska.mp4", papka / "yuz.json", papka / "maska.kalit"
    if not (maska.exists() and yuzf.exists() and kf.exists() and kf.read_text() == kalit):
        log("🧍 Odam maskasi va yuz o'rni (Apple Vision)...")
        holat("odam maskasi + yuz")
        run([str(vosita), str(toza), str(maska), str(yuzf)], stdout=subprocess.DEVNULL)
        kf.write_text(kalit)
        (papka / "odam.webm").unlink(missing_ok=True)
    odam = papka / "odam.webm"
    if kerak_odam and not odam.exists():
        log("🧍 Shaffof odam qatlami (odam orqasidagi matn uchun)...")
        run([FFMPEG, "-y", "-loglevel", "error", "-i", str(toza), "-i", str(maska), "-filter_complex",
             "[1:v]format=gray,boxblur=2[m];[0:v][m]alphamerge,format=yuva420p", "-an", "-c:v", "libvpx-vp9",
             "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-b:v", "5M", "-auto-alt-ref", "0", str(odam)])
    yuz = json.loads(yuzf.read_text())
    return (odam if kerak_odam else None), yuz


def mikro_sozlar(wav):
    """Kesilgan videoni ≥80 ms pauzalarda mayda bo'laklarga bo'lib qayta tanish → so'zlar faqat o'z bo'lagi
    (≈0.3–2 s) ichida ovozli kadrlarga taqsimlanadi. Uzluksiz nutqda (so'z vaqti ~1 s adashadigan) subtitr aniqroq."""
    import wave
    en = energiya(wav)
    chegara = max(en or [-99]) - 24
    bolak, bosh, jim = [], None, None
    for i, v in enumerate(en + [-99] * 10):
        if v > chegara:
            bosh = i if bosh is None else bosh
            jim = None
        elif bosh is not None:
            jim = i if jim is None else jim
            if i - jim >= 8:
                bolak.append([bosh / 100, jim / 100])
                bosh, jim = None, None
    birl = []
    for a, b in bolak:  # 0.6 s dan qisqa bo'lak qo'shnisiga (whisper'ga kontekst)
        if birl and (birl[-1][1] - birl[-1][0] < 0.6 or b - a < 0.35) and a - birl[-1][1] < 0.5:
            birl[-1][1] = b
        else:
            birl.append([a, b])
    tmp = Path(tempfile.mkdtemp())
    res = []
    try:
        with wave.open(str(wav)) as src:
            sr, par = src.getframerate(), src.getparams()
            fayllar = []
            for i, (a, b) in enumerate(birl):
                src.setpos(int(max(0, a - 0.05) * sr))
                data = src.readframes(int((b - a + 0.1) * sr))
                f = tmp / f"{i:04d}.wav"
                with wave.open(str(f), "wb") as out:
                    out.setparams(par)
                    out.writeframes(b"\x00\x00" * sr + data)
                fayllar.append(f)
        cmd = [str(WHISPER), "-m", str(MODEL), "-l", TIL, "-nt", "-oj", "-t", "6"]
        for f in fayllar:
            cmd += ["-f", str(f)]
        run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for (a, b), f in zip(birl, fayllar):
            jf = Path(str(f) + ".json")
            if not jf.exists():
                continue
            ws = " ".join(seg["text"] for seg in json.loads(jf.read_text())["transcription"]).split()
            ws = takrorsiz([w for w in ws if w and not w.startswith(("[", "("))])
            if len(ws) > 1 and re.sub(r"[^\w']", "", ws[0].lower()) in UYDIRMA and ws[0].endswith("."):
                ws = ws[1:]
            if not ws:
                continue
            i0, i1 = int(a * 100), min(len(en), int(b * 100))
            ovozli = [i for i in range(i0, i1) if en[i] > chegara] or list(range(i0, max(i0 + 1, i1)))
            vazn = [len(t) + 1 for t in ws]
            jami, acc = sum(vazn), 0
            for t, v in zip(ws, vazn):
                j0 = ovozli[min(len(ovozli) - 1, int(acc / jami * len(ovozli)))]
                acc += v
                j1 = ovozli[min(len(ovozli) - 1, max(0, int(acc / jami * len(ovozli)) - 1))]
                res.append({"s": j0 / 100, "e": (j1 + 1) / 100, "t": t})
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return res


def sozni_moslash(ref, mikro):
    """Matn — ref (uzun bo'lakli, sifatli), vaqt — mikro (mayda bo'lakli, aniq). difflib bilan moslab,
    moslanmagan so'zlar vaqti qo'shni langarlar orasida chiziqli taqsimlanadi."""
    import difflib
    toza = lambda w: re.sub(r"[^\w]", "", w.lower())
    sm = difflib.SequenceMatcher(None, [toza(w["t"]) for w in ref], [toza(w["t"]) for w in mikro], autojunk=False)
    langar = {}
    for blk in sm.get_matching_blocks():
        for d in range(blk.size):
            langar[blk.a + d] = mikro[blk.b + d]
    # taxminiy o'xshash so'zlar (bir xil o'rinda, 60%+ o'xshash) ham langar
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "replace" and i2 - i1 == j2 - j1:
            for d in range(i2 - i1):
                if difflib.SequenceMatcher(None, toza(ref[i1 + d]["t"]), toza(mikro[j1 + d]["t"])).ratio() >= 0.6:
                    langar[i1 + d] = mikro[j1 + d]
    if len(langar) < max(2, len(ref) * 0.3):
        return mikro  # moslik juda past — mikro natijaning o'zi
    idx = sorted(langar)
    res = []
    for i, w in enumerate(ref):
        if i in langar:
            res.append({"t": w["t"], "s": langar[i]["s"], "e": langar[i]["e"]})
            continue
        chap = max([j for j in idx if j < i], default=None)
        ong = min([j for j in idx if j > i], default=None)
        if chap is None:
            s0 = max(0.0, langar[ong]["s"] - 0.3 * (ong - i))
        elif ong is None:
            s0 = langar[chap]["e"] + 0.3 * (i - chap - 1)
        else:
            k = (i - chap) / (ong - chap)
            s0 = langar[chap]["e"] + (langar[ong]["s"] - langar[chap]["e"]) * k
        res.append({"t": w["t"], "s": round(s0, 3), "e": round(s0 + 0.25, 3)})
    for a, b in zip(res, res[1:]):  # tartib va ustma-ust tushmaslik
        b["s"] = max(b["s"], a["s"] + 0.05)
        a["e"] = min(max(a["e"], a["s"] + 0.08), b["s"])
    return res


def reel_tayyorla(video, fmt="9:16", uslub=None):
    """Kesish (keshlanadi) + sahna + props. → (props, papka)"""
    video = Path(video).resolve()
    papka = ish_papka(video)
    reja_f = papka / "reja.json"
    holat("tayyorlash", video=video.name)
    if not reja_f.exists() or json.loads(reja_f.read_text()).get("video") != str(video):
        holat("tahlil (transkripsiya)")
        tahlil(video)
    uslub = uslub or uslub_yukla(None)
    info = probe(video)
    toza = papka / "toza.mp4"
    mf = papka / "matn.txt"
    kalit = json.dumps([reja_f.read_text(), fmt, TIL, "v3-grade", os.environ.get("MONTAJ_GRADE", "kino"),
                        mf.read_text() if mf.exists() else ""])  # v2: asl nisbat, v3: kino rang
    kf = papka / "toza.kalit"
    if not toza.exists() or not kf.exists() or kf.read_text() != kalit:
        log("✂️  Kesish (jimlik, parazit, olib_tashlash) → toza.mp4")
        holat("kesish + rang")
        # asl nisbatda qoldiramiz — 9:16 ga joylashni Reel qiladi (gorizontal video markazdan kesilib ketmasin)
        render(video, "asl", subtitr=False, logo=None, musiqa=None, chiqish=toza, uslub=uslub, grafikasiz=True,
               grade=os.environ.get("MONTAJ_GRADE", "kino") != "yoq")
        kf.write_text(kalit)
    else:
        log("✂️  toza.mp4 keshdan (reja o'zgarmagan)")
    reja = json.loads(reja_f.read_text())
    ef = papka / "energiya.json"
    en = json.loads(ef.read_text()) if ef.exists() else None
    oraliq = yakuniy_oraliqlar(reja, info["fps"], info["dur"], en)
    _, davom = xarita(oraliq)
    sozlar = json.loads((papka / "sozlar.json").read_text())
    bloklar, kept = soz_bloklar(sozlar, oraliq)
    sf = papka / "subtitr.json"
    if os.environ.get("MONTAJ_MIKRO", "1") != "0" and (not sf.exists() or json.loads(sf.read_text()).get("_kalit") != kalit):
        # kesilgan videoni mayda bo'laklab qayta tanish — subtitr vaqti aniqroq
        tw = papka / "toza16.wav"
        run([FFMPEG, "-y", "-loglevel", "error", "-i", str(toza), "-ar", "16000", "-ac", "1", str(tw)])
        log("📝 Subtitr uchun kesilgan videoni mayda bo'laklab qayta tanish...")
        holat("subtitr (qayta tanish)")
        ms = mikro_sozlar(tw)
        tw.unlink(missing_ok=True)
        if ms:
            ref = [{"t": w["t"] + ("." if w.get("end") else ""), "s": w["s"], "e": w["e"]} for w in kept]
            mf = papka / "matn.txt"  # tekshirilgan to'g'ri matn bo'lsa — matn shundan, vaqt ovozdan
            if mf.exists():
                ref = [{"t": w, "s": 0, "e": 0} for w in mf.read_text().split()]
            bloklar, kept = soz_bloklar(sozni_moslash(ref, ms), [[0.0, davom]])

    # subtitr.json — tahrirlanadi (so'z xatolarini tuzatish uchun); yo'q bo'lsa yaratiladi
    sf = papka / "subtitr.json"
    if not sf.exists() or json.loads(sf.read_text()).get("_kalit") != kalit:
        sf.write_text(json.dumps({"_kalit": kalit, "_izoh": "vaqtlar toza.mp4 bo'yicha; 't' ni tuzatish mumkin",
                                  "bloklar": bloklar}, ensure_ascii=False, indent=1))
    bloklar = json.loads(sf.read_text())["bloklar"]
    # toza transkript — Claude sahna yozishi uchun (yangi vaqt)
    (papka / "toza_transkript.txt").write_text("\n".join(
        f"[{b['s']:6.2f} – {b['e']:6.2f}]  " + " ".join(f"{w['t']}@{w['s']:.2f}" for w in b["sozlar"]) for b in bloklar) + "\n")

    sh = papka / "sahna.json"
    if not sh.exists() or json.loads(sh.read_text()).get("_avto") and json.loads(sh.read_text()).get("_kalit") != kalit:
        sahna = avto_sahna(bloklar, kept, davom)
        sahna["_kalit"] = kalit
        sahna["_izoh"] = ("Vaqtlar toza.mp4 bo'yicha (toza_transkript.txt). Qo'lda tahrirlasangiz _avto ni false qiling. "
                          "fayl: stikerlar/X.png | logolar/X.png | to'liq yo'l (broll video)")
        sh.write_text(json.dumps(sahna, ensure_ascii=False, indent=1))
    sahna = json.loads(sh.read_text())

    W, H = chiqish_olcham(info, fmt)
    ti = probe(toza)
    sw, sh_ = ti["w"], ti["h"]
    joylash = "cover" if abs(math.log((sw / sh_) / (W / H))) < math.log(1.35) else "fit"
    sc = (max if joylash == "cover" else min)(W / sw, H / sh_)
    ofx, ofy = (W - sw * sc) / 2, (H - sh_ * sc) / 2
    rel = f"_reel/{papka.name}"
    pub = GRAFIKA / "public" / rel
    shutil.rmtree(pub, ignore_errors=True)
    pub.mkdir(parents=True)
    video_rel = _jamoatga(toza, pub, rel)
    kerak_odam = any(e.get("tur") in ("orqa_matn", "egri_matn") for e in sahna.get("elementlar", []))
    odam, yuz = None, []
    try:
        odam, yuz = odam_va_yuz(toza, papka, kalit, kerak_odam)
    except Exception as ex:  # Vision ishlamasa ham reel chiqsin (yuzsiz joylashuv)
        log(f"   (odam/yuz aniqlash o'tkazib yuborildi: {ex})")
    els = []
    for e in sahna.get("elementlar", []):
        e = dict(e)
        if e.get("fayl"):
            e["fayl"] = _jamoatga(e["fayl"], pub, rel)
        if e.get("fayllar"):
            e["fayllar"] = [_jamoatga(x, pub, rel) for x in e["fayllar"]]
        if e.get("avatar"):
            e["avatar"] = _jamoatga(e["avatar"], pub, rel)
        if e.get("rasm"):
            e["rasm"] = _jamoatga(e["rasm"], pub, rel)
        e["oxiri"] = min(float(e["oxiri"]), davom)
        if float(e["boshi"]) < e["oxiri"]:
            els.append(e)
    props = {"video": video_rel, "W": W, "H": H, "fps": 30, "davom": round(davom, 3), "xz": xavfsiz(W, H),
             "uslub": {k: uslub[k] for k in ("urgu", "urgu_matn", "subtitr")},
             "subtitr": bloklar, "hook": sahna.get("hook"), "elementlar": els,
             "odam": _jamoatga(odam, pub, rel) if odam else None, "joylash": joylash,
             "manba": {"w": sw, "h": sh_},
             "subtitr_yoq": bool(sahna.get("subtitr_yoq", uslub.get("subtitr_yoq", False))),
             "fon_grid": _jamoatga("fon/grid.png", pub, rel),
             # yuz: manba kadr koordinatasi → chiqish kadri (cover/fit)
             "yuz": [dict({"t": y["t"], "tepa": round((y["tepa"] * sh_ * sc + ofy) / H, 3)},
                          **({"x": round((y["x"] * sw * sc + ofx) / W, 3), "y": round((y["y"] * sh_ * sc + ofy) / H, 3),
                              "w": round(y["w"] * sw * sc / W, 3), "h": round(y["h"] * sh_ * sc / H, 3)} if "w" in y else {}))
                     for y in yuz]}
    # ovoz effektlari: sahnada "ovozlar": false — o'chiq; ro'yxat — qo'lda; yo'q — avto (elementlardan)
    if sahna.get("ovozlar") is not False:
        ov = sahna["ovozlar"] if isinstance(sahna.get("ovozlar"), list) else avto_ovozlar(props)
        # effekt fayli yuklanmagan bo'lsa (masalan, Mixkit'ga tarmoq yopiq) — o'sha effektsiz
        props["ovozlar"] = [dict(o, fayl=_jamoatga(f"ovoz/{o['fayl']}.mp3", pub, rel)) for o in ov
                            if o["boshi"] < davom and (ASSETS / "ovoz" / f"{o['fayl']}.mp3").exists()]
    props["_musiqa"] = sahna.get("musiqa", uslub.get("musiqa"))
    props["_musiqa_boshi"] = float(sahna.get("musiqa_boshi", 4.0))
    return props, papka, video


# Element → ovoz effekti (assets/ovoz, Mixkit, -18 LUFS): (fayl, kechikish s, balandlik)
SFX = {  # kam va past (foydalanuvchi: "sound effektlar kamroq va pastroq") — faqat asosiy lahzalar
    "otish": [("whoosh_tez", -0.12, 0.28)], "stiker": [("pop", 0.0, 0.16)], "logo": [("pop", 0.0, 0.22)],
    "raqam": [("pul", 0.85, 0.22)], "hisoblar": [("pul", 0.8, 0.2)], "solishtir": [("pop", 0.0, 0.22)],
    "cta": [("ding", 0.1, 0.25)], "tanishtiruv": [("sweep", 0.0, 0.28)], "oq_qora": [("kamera", 0.0, 0.28)],
    "orqa_matn": [("whoosh_kino", 0.0, 0.22)], "kartochka": [("whoosh_pop", 0.0, 0.22)],
}


def avto_ovozlar(props, fps=30):
    """Sahnadagi elementlardan ovoz effektlari ro'yxati (Reel <Audio> qatlami uchun)."""
    res = []
    add = lambda nom, t, v: res.append({"fayl": nom, "boshi": round(max(0.0, t), 3), "balandlik": v})
    if props.get("hook"):
        add("whoosh_kino", props["hook"]["boshi"], 0.25)
    for e in props["elementlar"]:
        tur, b = e["tur"], float(e["boshi"])
        for nom, dt, v in SFX.get(tur, []):
            add(nom, b + dt, v)
        if tur == "generator":
            add("tugma", float(e.get("bosish", b + 0.6)), 0.28)
        elif tur == "obuna":
            add("click", float(e.get("bosish", b + 1.1)), 0.3)
        elif tur == "telefon":
            almash = float(e.get("almash", (b + e["oxiri"]) / 2))
            add("xato", almash - 0.75, 0.22)
            add("ding", almash + 0.25, 0.22)
    return sorted(res, key=lambda x: x["boshi"])


def tekshiruv_kadrlari(props, papka):
    """Render oldidan 3–4 still: hook, birinchi stiker/logo, b-roll, o'rtasi."""
    fps, d = props["fps"], props["davom"]
    vaqt = []
    if props.get("hook"):
        vaqt.append((props["hook"]["boshi"] + props["hook"]["oxiri"]) / 2)
    for tur in ("stiker", "logo", "broll", "katta_soz"):
        e = next((x for x in props["elementlar"] if x["tur"] == tur), None)
        if e:
            vaqt.append(min(e["boshi"] + 0.7, e["oxiri"] - 0.1))
    vaqt.append(d * 0.5)
    vaqt = sorted(set(round(min(max(t, 0), d - 0.05), 2) for t in vaqt))[:4]
    for old in papka.glob("kadr_*.jpg"):
        old.unlink()
    kadrlar = [{"frame": int(t * fps), "out": str(papka / f"kadr_{i + 1}_{t:.1f}s.jpg")} for i, t in enumerate(vaqt)]
    jf = papka / "kadr_job.json"
    jf.write_text(json.dumps([{"comp": "Reel", "props": props, "kadrlar": kadrlar, "scale": 0.5}], ensure_ascii=False))
    run(["node", "render.mjs", str(jf)], cwd=GRAFIKA, stdout=subprocess.DEVNULL)
    jf.unlink()
    log(f"🖼  Tekshiruv kadrlari: {', '.join(Path(k['out']).name for k in kadrlar)}  ({papka})")
    return [k["out"] for k in kadrlar]


def reel(video, fmt="9:16", uslub=None, musiqa=None, chiqish=None, faqat_kadrlar=False):
    props, papka, video = reel_tayyorla(video, fmt, uslub)
    n_st = sum(1 for e in props["elementlar"] if e["tur"] in ("stiker", "logo"))
    log(f"🎬 Reel: {props['davom']:.1f} s, {len(props['subtitr'])} subtitr bloki, {n_st} stiker/logo, "
        f"{len(props['elementlar']) - n_st} boshqa element{', hook' if props.get('hook') else ''}")
    holat("tekshiruv kadrlari")
    tekshiruv_kadrlari(props, papka)
    if faqat_kadrlar:
        return None
    chiqish = Path(chiqish) if chiqish else video.with_name(f"{video.stem}_reel.mp4")
    if not musiqa and props.get("_musiqa"):  # sahna/uslubdagi trek nomi → assets/musiqa/<nom>.mp3
        m = props["_musiqa"]
        cand = Path(m).expanduser() if "/" in str(m) else ASSETS / "musiqa" / f"{m}.mp3"
        musiqa = cand if cand.exists() else None
    # Remotion natijasi keshlanadi: props o'zgarmasa (masalan faqat musiqa almashsa) qayta chizilmaydi
    xom = papka / "reel_xom.mp4"
    import hashlib
    pk = hashlib.md5(json.dumps({k: v for k, v in props.items() if not k.startswith("_")}, sort_keys=True).encode()).hexdigest()
    kf = papka / "reel_xom.kalit"
    if xom.exists() and kf.exists() and kf.read_text() == pk:
        log("🎞  Render keshdan (sahna o'zgarmagan)")
    else:
        jf = papka / "reel_job.json"
        jf.write_text(json.dumps([{"comp": "Reel", "out": str(xom), "props": props, "codec": "h264", "progress": True}],
                                 ensure_ascii=False))
        log("🎞  Render (Remotion)...")
        holat("render", 0)
        try:
            run(["node", "render.mjs", str(jf)], cwd=GRAFIKA)
        except subprocess.CalledProcessError:
            # kompyuter band bo'lsa Remotion kutish vaqti tugashi mumkin — bir marta qayta urinamiz
            log("⚠️  Render xatosi — qayta urinish...")
            holat("render (qayta urinish)", 0)
            run(["node", "render.mjs", str(jf)], cwd=GRAFIKA)
        jf.unlink()
        kf.write_text(pk)
    # eski faylni o'chirib, yangisini yaratamiz — Finder "yaratilgan" sanasi ham yangi bo'lsin (ustiga yozilsa eski ko'rinadi)
    chiqish.unlink(missing_ok=True)
    if not musiqa:
        shutil.copy(xom, chiqish)
    if musiqa:
        d = props["davom"]
        mb = props.get("_musiqa_boshi", 4.0)
        holat("musiqa aralashtirish", 100)
        log(f"🎵 Fon musiqasi: {Path(musiqa).name} (−22 LUFS, nutqda yumshoq pasayadi)")
        # musiqa: −30 LUFS ga tekislanadi, boshida 0.6 s kirish, oxirida 1.5 s so'nish, nutq paytida sidechain bilan yana pasayadi
        run([FFMPEG, "-y", "-loglevel", "error", "-i", str(xom), "-ss", f"{mb:.2f}", "-stream_loop", "-1", "-i", str(musiqa),
             "-filter_complex", f"[0:a]asplit=2[n1][n2];[1:a]aresample=48000,atrim=0:{d:.3f},asetpts=PTS-STARTPTS,"
             f"loudnorm=I=-22:TP=-4:LRA=11,afade=t=in:st=0:d=0.6,afade=t=out:st={max(0, d - 1.5):.3f}:d=1.5[mz];"
             "[mz][n2]sidechaincompress=threshold=0.08:ratio=2.5:attack=40:release=600[mzd];"
             "[n1][mzd]amix=inputs=2:duration=first:normalize=0[a]",
             "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(chiqish)])
    log(f"✅ Tayyor: {chiqish}  ({props['davom']:.1f} s)")
    holat("tayyor", 100, oxirgi=str(chiqish))
    try:
        tayyorlar = json.loads(HOLAT.read_text()).get("tayyorlar", [])[-11:] + [chiqish.name]
        holat("tayyor", 100, tayyorlar=tayyorlar)
    except Exception:
        pass
    if shutil.which("osascript"):  # macOS bildirishnomasi; Linux'da yo'q
        subprocess.run(["osascript", "-e", f'display notification "{chiqish.name} ({props["davom"]:.0f} s)" with title "Montaj tayyor ✅"'],
                       capture_output=True)
    return chiqish


def studio(video, fmt="9:16", uslub=None):
    """Remotion Studio'da jonli ko'rish: sahna.json ni o'zgartirib `studio` ni qayta chaqirsangiz yangilanadi."""
    props, papka, _ = reel_tayyorla(video, fmt, uslub)
    (GRAFIKA / "src" / "joriy-sahna.json").write_text(json.dumps(props, ensure_ascii=False))
    log("🖥  Remotion Studio: http://localhost:3000/Reel  (to'xtatish: Ctrl+C)")
    subprocess.run(["npx", "remotion", "studio", "src/index.ts"], cwd=GRAFIKA)


def kesimlar(video, fmt="9:16", uslub=None, rejim="reel"):
    """Uzun videodan bir nechta Reels: ish/<nom>/kesimlar.json (Claude yozadi, ASL vaqt) →
    [{"nom": "1-hook", "boshi": 12.3, "oxiri": 58.0, "sabab": "..."}] → har biri alohida kesim → reel (yoki oddiy auto)."""
    video = Path(video).absolute()  # symlink bo'lsa ham natija berilgan yo'l yonida (asl papkaga yozilmaydi)
    papka = ish_papka(video)
    kf = papka / "kesimlar.json"
    if not kf.exists():
        if not (papka / "transkript.txt").exists():
            tahlil(video)
        raise SystemExit(f"Avval {kf} ni yozing (Claude transkript.txt dan eng kuchli 30–60 s bo'laklarni tanlaydi):\n"
                         '[{"nom": "1-muammo", "boshi": 12.3, "oxiri": 58.0, "sabab": "kuchli hook"}]')
    ks = json.loads(kf.read_text())
    ks = ks.get("kesimlar", ks) if isinstance(ks, dict) else ks
    chiq = video.with_name(f"{video.stem}_kesimlar")
    chiq.mkdir(exist_ok=True)
    tayyor = []
    for i, k in enumerate(ks, 1):
        os.environ["MONTAJ_NAVBAT"] = f"{i}/{len(ks)}"
        nom = re.sub(r"[^\w-]", "_", str(k.get("nom", i)))
        klip = chiq / f"{video.stem}_{nom}.mp4"
        log(f"━━ Kesim {i}/{len(ks)}: {nom} [{k['boshi']:.1f}–{k['oxiri']:.1f}] {k.get('sabab', '')}")
        if not klip.exists():
            run([FFMPEG, "-y", "-loglevel", "error", "-ss", f"{float(k['boshi']):.3f}", "-to", f"{float(k['oxiri']):.3f}",
                 "-i", str(video), "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-c:a", "aac", "-b:a", "192k", str(klip)])
        if rejim == "reel":
            tayyor.append(reel(klip, fmt, uslub))
        else:
            tahlil(klip)
            tayyor.append(render(klip, fmt, True, None, None, None, True, uslub))
    log(f"✅ {len(tayyor)} ta Reels: {chiq}")
    return tayyor


def namuna(video):
    """Namuna (reference) Reels tahlili: sahna almashishlari, harakat intensivligi, vaqt belgili kalit kadrlar, transkript.
    → ish/namuna_<nom>/: namuna.json, varaq_XX.jpg (1 kadr/0.5 s, vaqt yozuvi bilan), sahna_XX.jpg (har kesish), transkript.txt.
    Claude varaqlarni ko'rib harakat tilini (tempo, zoom, o'tishlar, grafika turlari) foydalanuvchi videosiga ko'chiradi."""
    video = Path(video).absolute()
    info = probe(video)
    papka = ISH / f"namuna_{video.stem}"
    shutil.rmtree(papka, ignore_errors=True)
    papka.mkdir(parents=True)
    log(f"🔎 Namuna: {video.name} — {info['dur']:.1f} s, {info['w']}x{info['h']}")
    # har kadr uchun sahna o'zgarish balli (0..1)
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(video), "-an", "-vf",
                        "scale=320:-2,select='gte(scene,0)',metadata=print:key=lavfi.scene_score", "-f", "null", "-"],
                       capture_output=True, text=True)
    ballar, t = [], None
    for line in r.stderr.splitlines():
        m = re.search(r"pts_time:([\d.]+)", line)
        if m:
            t = float(m.group(1))
        m = re.search(r"lavfi\.scene_score=([\d.]+)", line)
        if m and t is not None:
            ballar.append((t, float(m.group(1))))
    kesish = [round(t, 2) for t, b in ballar if b > 0.22]
    # soniyalik harakat intensivligi (o'rtacha ball × 100)
    harakat = []
    for sn in range(int(info["dur"]) + 1):
        v = [b for t, b in ballar if sn <= t < sn + 1]
        harakat.append(round(100 * sum(v) / max(1, len(v)), 1))
    kadrlar = [0.0] + kesish
    for i, tt in enumerate(kadrlar[:40]):
        run([FFMPEG, "-y", "-loglevel", "error", "-ss", f"{tt + 0.08:.2f}", "-i", str(video), "-frames:v", "1",
             "-vf", "scale=360:-2", str(papka / f"sahna_{i + 1:02d}_{tt:.2f}s.jpg")])
    # varaqlar: har 0.5 s bir kadr, 6x3 = 9 soniya bir varaqda, vaqt yozuvi bilan
    shrift = ASSETS / "shrift" / "Montserrat-Bold.ttf"
    run([FFMPEG, "-y", "-loglevel", "error", "-i", str(video), "-vf",
         f"fps=2,scale=240:-2,drawtext=fontfile={shrift}:text='%{{pts\\:hms}}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6,"
         "tile=6x3:padding=4:color=black", str(papka / "varaq_%02d.jpg")])
    tahlil_ok = True
    try:
        global TIL
        eski, TIL = TIL, (TIL if TIL != "uz" else "auto")
        tahlil(video)
        TIL = eski
        shutil.copy(ish_papka(video) / "transkript.txt", papka / "transkript.txt")
    except SystemExit:
        tahlil_ok = False  # ovozsiz namuna — faqat vizual tahlil
    otish = [round(b - a, 2) for a, b in zip([0.0] + kesish, kesish + [info["dur"]])]
    xulosa = {"video": str(video), "davom": info["dur"], "olcham": [info["w"], info["h"]], "fps": info["fps"],
              "kesishlar": kesish, "kadr_uzunligi_s": otish,
              "ortacha_kadr_s": round(sum(otish) / max(1, len(otish)), 2),
              "harakat_soniyalik": harakat, "nutq_bor": tahlil_ok}
    (papka / "namuna.json").write_text(json.dumps(xulosa, ensure_ascii=False, indent=1))
    log(f"✅ {papka}: {len(kesish)} kesish, o'rtacha kadr {xulosa['ortacha_kadr_s']} s, "
        f"varaqlar: {len(list(papka.glob('varaq_*.jpg')))} ta")
    return papka


def qoida_qosh(matn):
    """QOIDALAR.md ga tuzatishdan o'rganilgan qoida (sana bilan)."""
    import datetime
    f = ASOS / "QOIDALAR.md"
    f.write_text(f.read_text().rstrip("\n") + f"\n- ({datetime.date.today()}) {matn.strip()}\n")
    log(f"📌 Qoidaga yozildi: {matn.strip()}")


# ---------------------------------------------------------------- CLI

def opsiyalar(args):
    o = {"fmt": "asl", "subtitr": True, "stiker": False, "uslub": None, "tezlik": 1.0, "logo": "avto", "musiqa": "avto", "chiqish": None}
    i = 0
    while i < len(args):
        k, v = args[i], args[i + 1] if i + 1 < len(args) else None
        if k == "--format":
            o["fmt"] = v
        elif k == "--subtitr":
            o["subtitr"] = v not in ("yoq", "yo'q", "no", "0")
        elif k == "--uslub":
            o["uslub"] = v
        elif k == "--tezlik":
            o["tezlik"] = float(v)
        elif k == "--stiker":
            o["stiker"] = v in ("ha", "yes", "1")
        elif k == "--logo":
            o["logo"] = v
        elif k == "--musiqa":
            o["musiqa"] = v
        elif k == "--chiqish":
            o["chiqish"] = v
        else:
            raise SystemExit(f"Noma'lum opsiya: {k}")
        i += 2
    if o["logo"] == "avto":
        o["logo"] = ASSETS / "logo.png" if (ASSETS / "logo.png").exists() else None
    elif o["logo"] in ("yoq", "yo'q", "no"):
        o["logo"] = None
    if o["musiqa"] == "avto":
        mz = sorted(p for p in (ASSETS / "musiqa").glob("*") if p.suffix.lower() in (".mp3", ".m4a", ".wav", ".aac"))
        o["musiqa"] = mz[0] if mz else None
    elif o["musiqa"] in ("yoq", "yo'q", "no"):
        o["musiqa"] = None
    return o


def main():
    global TIL
    if len(sys.argv) < 3 or sys.argv[1] not in ("tahlil", "render", "auto", "rolik", "reel", "kadrlar", "studio", "qoida", "kesimlar", "namuna"):
        print(__doc__)
        sys.exit(1)
    cmd, video = sys.argv[1], sys.argv[2]
    if cmd == "qoida":
        qoida_qosh(" ".join(sys.argv[2:]))
        return
    oddiy = "--oddiy" in sys.argv
    if oddiy:
        sys.argv.remove("--oddiy")
    if "--til" in sys.argv:
        i = sys.argv.index("--til")
        TIL = sys.argv[i + 1]
        del sys.argv[i:i + 2]
    if not Path(video).exists():
        raise SystemExit(f"XATO: fayl yo'q: {video}")
    if cmd == "tahlil":
        tahlil(video)
        return
    o = opsiyalar(sys.argv[3:])
    if cmd == "namuna":
        namuna(video)
        return
    if cmd == "kesimlar":
        kesimlar(video, o["fmt"] if o["fmt"] != "asl" else "9:16", uslub_yukla(o["uslub"]),
                 "oddiy" if oddiy else "reel")
        return
    if cmd in ("reel", "kadrlar", "studio"):
        u = uslub_yukla(o["uslub"])
        fmt = o["fmt"] if o["fmt"] != "asl" else "9:16"
        if cmd == "studio":
            studio(video, fmt, u)
        else:
            # musiqa faqat --musiqa aniq berilsa; aks holda sahna/uslubdagi trek (papkadagi birinchi fayl emas)
            mz = o["musiqa"] if "--musiqa" in sys.argv else None
            reel(video, fmt, u, mz, o["chiqish"], faqat_kadrlar=(cmd == "kadrlar"))
        return
    if cmd == "rolik":
        u = uslub_yukla(o["uslub"])
        rolik(video, o["fmt"] if o["fmt"] != "asl" else "9:16", u, o["tezlik"], o["musiqa"])
        return
    if cmd == "auto":
        tahlil(video)
    u = uslub_yukla(o["uslub"])
    if o["logo"] is None and u.get("logo") and Path(u["logo"]).expanduser().exists():
        o["logo"] = Path(u["logo"]).expanduser()
    render(video, o["fmt"], o["subtitr"], o["logo"], o["musiqa"], o["chiqish"], o["stiker"], u, o["tezlik"])


if __name__ == "__main__":
    main()
