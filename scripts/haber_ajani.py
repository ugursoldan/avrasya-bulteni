#!/usr/bin/env python3
"""
Avrasya Haber Ajani - 5 dilde günlük haber toplama
GNews API (https://gnews.io)
"""

import json, os, hashlib, re
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.parse import quote

GNEWS_API_KEY = os.environ.get("GNEWS_API_KEY", "")
HABER_JSON = "data/haberler.json"
MAX_HABER_DIL = 5
MAX_OZET_KELIME = 300

DILLER = [
    {"dil": "tr", "etiket": "Avrasya",   "ulke": "tr"},
    {"dil": "en", "etiket": "Eurasia",   "ulke": "us"},
    {"dil": "ru", "etiket": "Евразия",   "ulke": "ru"},
    {"dil": "fa", "etiket": "اوراسیا",   "ulke": "ir"},
    {"dil": "zh", "etiket": "欧亚",      "ulke": "cn"},
]

USER_AGENT = "Mozilla/5.0 (compatible; AvrasyaBulteniBot/1.0)"


def gnews_ara(dil_kodu, sorgu, ulke_kodu):
    url = f"https://gnews.io/api/v4/search?q={quote(sorgu)}&lang={dil_kodu}&country={ulke_kodu}&max=10&apikey={GNEWS_API_KEY}"
    try:
        with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=15) as r:
            return json.loads(r.read().decode("utf-8")).get("articles", [])
    except:
        return []


def ozet_olustur(haber):
    baslik = haber.get("title", "")
    metin = (haber.get("description") or haber.get("content") or baslik)
    metin = re.sub(r"<[^>]+>", "", metin)
    metin = re.sub(r"\s+", " ", metin).strip()
    kaynak = haber.get("source", {}).get("name", "") or haber.get("source", "")
    if kaynak:
        metin = f"{baslik}. {metin} [Kaynak: {kaynak}]"
    kelimeler = metin.split()
    if len(kelimeler) > MAX_OZET_KELIME:
        kelimeler = kelimeler[:MAX_OZET_KELIME]
        metin = " ".join(kelimeler)
    return metin


def haberleri_isle(articles, dil_adi):
    islenmis = []
    for a in articles[:MAX_HABER_DIL]:
        link = a.get("url", "")
        if not link:
            continue
        islenmis.append({
            "id": hashlib.md5(link.encode()).hexdigest()[:10],
            "baslik": a.get("title", ""),
            "link": link,
            "kaynak": a.get("source", {}).get("name", ""),
            "ozet": ozet_olustur(a),
            "yayin_tarihi": (a.get("publishedAt") or "")[:10],
            "kaynak_dil": dil_adi,
            "goruntu": a.get("image"),
        })
    return islenmis


def main():
    print("=" * 60)
    print(f"AVRASYA HABER AJANI | {datetime.now().isoformat()}")
    print("=" * 60)

    if not GNEWS_API_KEY:
        print("[HATA] GNEWS_API_KEY bulunamadi!")
        return

    tum = {}
    toplam = 0
    for d in DILLER:
        print(f"\n--- {d['dil'].upper()} ({d['etiket']}) ---")
        makaleler = gnews_ara(d["dil"], d["etiket"], d["ulke"])
        if not makaleler:
            tum[d["dil"]] = []
            print("  Sonuc yok")
            continue
        islenmis = haberleri_isle(makaleler, d["dil"])
        tum[d["dil"]] = islenmis
        toplam += len(islenmis)
        print(f"  {len(islenmis)} haber")

    output = {
        "son_guncelleme": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "durum": "basarili",
        "haberler": tum,
        "toplam_haber": toplam,
    }

    os.makedirs("data", exist_ok=True)
    with open(HABER_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✓ {toplam} haber kaydedildi -> {HABER_JSON}")


if __name__ == "__main__":
    main()
