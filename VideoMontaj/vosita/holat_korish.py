#!/usr/bin/env python3
"""Montaj jonli holati: ~/VideoMontaj/holat.json ni o'qib progress chizig'ini ko'rsatadi (Ctrl+C — chiqish)."""
import json, os, sys, time
F = os.path.expanduser("~/VideoMontaj/holat.json")
BOSQICH = ["tayyorlash", "tahlil (transkripsiya)", "kesish + rang", "subtitr (qayta tanish)", "odam maskasi + yuz",
           "tekshiruv kadrlari", "kadrlar", "render", "musiqa aralashtirish", "tayyor"]


def chiziq(foiz, n=34):
    t = int(n * foiz / 100)
    return "█" * t + "░" * (n - t)


def mmss(s):
    s = max(0, int(s))
    return f"{s // 60:02d}:{s % 60:02d}"


while True:
    try:
        h = json.load(open(F))
    except Exception:
        h = {}
    now = time.time()
    b = h.get("bosqich", "—")
    foiz = h.get("foiz")
    if b == "render" and foiz is not None:
        umumiy = foiz
    else:
        i = BOSQICH.index(b) if b in BOSQICH else 0
        umumiy = 100 if b == "tayyor" else None
    faol = now - h.get("vaqt", 0) < 90 or b == "tayyor"
    sys.stdout.write("\033[H\033[2J")
    print("🎬  MONTAJ HOLATI" + ("" if faol else "   (hozir ishlayotgan montaj yo'q)"))
    print("─" * 52)
    print(f" Video:    {h.get('video', '—')}")
    if h.get("navbat"):
        print(f" Navbat:   {h['navbat']}")
    print(f" Bosqich:  {b}")
    if b in ("render", "kadrlar") and foiz is not None:
        print(f" Render:   {chiziq(foiz)} {foiz:3d}%")
    elif b == "tayyor":
        print(f" Holat:    {chiziq(100)} 100%  ✅")
    else:
        # bosqichlar bo'yicha taxminiy yo'l
        i = BOSQICH.index(b) if b in BOSQICH else 0
        print(f" Yo'l:     " + " → ".join(("●" if k <= i else "○") for k in range(len(BOSQICH) - 3)) + "  (render oldidan)")
    if h.get("boshlangan"):
        print(f" O'tdi:    {mmss(now - h['boshlangan'])}")
    if h.get("tayyorlar"):
        print("─" * 52)
        papka = os.path.dirname(h.get("oxirgi", "")) if h.get("oxirgi") else ""
        print(" Tayyor bo'lganlar" + (f" (papka: {papka.replace(os.path.expanduser('~'), '~')}):" if papka else ":"))
        for f in h["tayyorlar"][-8:]:
            print(f"   ✅ {f}")
    print("─" * 52)
    print(" (oynani yopsangiz ham montaj davom etadi)")
    sys.stdout.flush()
    time.sleep(0.7)
