import os
import json
import requests
from datetime import datetime
from xml.etree import ElementTree as ET
import re

GNEWS_API_KEY = os.environ.get("GNEWS_API_KEY")

# RSS kaynakları - Avrasya bölgesi haberleri
RSS_KAYNAKLARI = [
    # İngilizce
    {
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        "dil": "en",
        "filtre": ["russia", "china", "eurasia", "central asia", "caucasus", "turkey", "ukraine", "iran", "siberia", "himalaya"]
    },
    {
        "url": "https://feeds.bbci.co.uk/news/world/rss.xml",
        "dil": "en",
        "filtre": ["russia", "china", "eurasia", "central asia", "caucasus", "turkey", "ukraine", "iran"]
    },
    {
        "url": "https://www.aljazeera.com/xml/rss/all.xml",
        "dil": "en",
        "filtre": ["russia", "china", "eurasia", "central asia", "caucasus", "turkey", "ukraine", "iran", "asia"]
    },
    # Türkçe
    {
        "url": "https://www.aa.com.tr/tr/rss/default?category=guncel",
        "dil": "tr",
        "filtre": ["avrasya", "rusya", "çin", "orta asya", "kafkasya", "ukrayna", "iran", "hazar", "sibirya"]
    },
    {
        "url": "https://www.trthaber.com/manset_articles.rss",
        "dil": "tr",
        "filtre": ["avrasya", "rusya", "çin", "orta asya", "kafkasya", "ukrayna", "iran", "hazar"]
    },
    # Rusça (İngilizce TASS)
    {
        "url": "https://tass.com/rss/v2.xml",
        "dil": "ru",
        "filtre": ["eurasia", "russia", "china", "central asia", "caucasus", "ukraine", "iran", "siberia"]
    }
]

# Farsça RSS kaynakları
FARSCA_KAYNAKLAR = [
    {
        "url": "https://www.bbc.com/persian/rss.xml",
        "filtre": ["اوراسیا", "روسیه", "چین", "آسیای مرکزی", "قفقاز", "اوکراین", "ایران", "آسیا"]
    },
    {
        "url": "https://ir.voanews.com/rssfeeds/?",
        "filtre": ["اوراسیا", "روسیه", "چین", "آسیای مرکزی", "قفقاز", "اوکراین", "ایران"]
    }
]

# Çince RSS kaynakları
CINCE_KAYNAKLAR = [
    {
        "url": "https://www.rfa.org/mandarin/rss2.xml",
        "filtre": ["欧亚", "俄罗斯", "中国", "中亚", "高加索", "乌克兰", "伊朗"]
    },
    {
        "url": "https://www.bbc.com/zhongwen/simp/rss.xml",
        "filtre": ["欧亚", "俄罗斯", "中国", "中亚", "高加索", "乌克兰", "伊朗"]
    }
]

# GNews - her dilde Avrasya/Eurasia araması (yedek)
GNEWS_ARAMALARI = {
    "tr": "Avrasya OR Rusya OR (Orta Asya) OR Kafkasya",
    "en": "Eurasia OR Russia OR China OR (Central Asia)",
    "ru": "Евразия OR Россия OR Китай OR Центральная Азия",
    "zh": "欧亚 OR 俄罗斯 OR 中国 OR 中亚"
}

DIL_ADLARI = {
    "tr": "Türkçe",
    "en": "İngilizce",
    "ru": "Rusça",
    "fa": "Farsça",
    "zh": "Çince"
}

KELIME_SINIRI = 300


def rss_oku(url):
    """RSS kaynağından haberleri oku"""
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        root = ET.fromstring(r.content)
        items = []
        for item in root.iter("item"):
            items.append({
                "baslik": item.findtext("title", ""),
                "url": item.findtext("link", ""),
                "ozet": item.findtext("description", ""),
                "yayin_tarihi": item.findtext("pubDate", ""),
                "kaynak": url.split("/")[2] if "//" in url else url
            })
        return items
    except Exception as e:
        print(f"  RSS hatası ({url[:50]}...): {e}")
        return []


def gnews_ara(dil_kodu, arama):
    if not GNEWS_API_KEY:
        print(f"  GNews API key yok, atlanıyor")
        return []
    url = f"https://gnews.io/api/v4/search?q={arama}&lang={dil_kodu}&max=3&apikey={GNEWS_API_KEY}"
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        return r.json().get("articles", [])
    except Exception as e:
        print(f"  GNews hatası ({dil_kodu}): {e}")
        return []


def ilgili_mi(baslik, ozet, filtre_kelimeleri):
    """Haber Avrasya bölgesiyle ilgili mi?"""
    metin = (baslik + " " + (ozet or "")).lower()
    for kelime in filtre_kelimeleri:
        if kelime.lower() in metin:
            return True
    return False


def ozet_olustur(metin):
    if not metin:
        return "Özet oluşturulamadı."
    metin = re.sub(r'<[^>]+>', '', metin)
    metin = metin.strip()
    kelimeler = metin.split()
    if len(kelimeler) > KELIME_SINIRI:
        return " ".join(kelimeler[:KELIME_SINIRI]) + "..."
    return metin


def main():
    print("=== HABER AJANI BAŞLADI ===")
    print(f"Tarih: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    tum_haberler = {
        "tr": {"dil": "Türkçe", "haberler": []},
        "en": {"dil": "İngilizce", "haberler": []},
        "ru": {"dil": "Rusça", "haberler": []},
        "fa": {"dil": "Farsça", "haberler": []},
        "zh": {"dil": "Çince", "haberler": []}
    }

    # 1. Ana RSS kaynaklarını tara
    print("\n--- Ana RSS kaynakları ---")
    for kaynak in RSS_KAYNAKLARI:
        dil = kaynak["dil"]
        filtre = kaynak["filtre"]
        print(f"\n{kaynak['url'][:55]}... ({dil})")
        items = rss_oku(kaynak["url"])
        avrasya_haber = 0
        for item in items:
            if ilgili_mi(item["baslik"], item.get("ozet", ""), filtre):
                tum_haberler[dil]["haberler"].append({
                    "baslik": item["baslik"],
                    "kaynak": item["kaynak"],
                    "url": item["url"],
                    "ozet": ozet_olustur(item.get("ozet", "")),
                    "yayin_tarihi": item.get("yayin_tarihi", ""),
                    "dil": DIL_ADLARI.get(dil, dil)
                })
                avrasya_haber += 1
        print(f"  → {avrasya_haber} Avrasya haberi bulundu")

    # 2. Farsça kaynaklar
    print("\n--- Farsça kaynaklar ---")
    for kaynak in FARSCA_KAYNAKLAR:
        print(f"\n{kaynak['url'][:55]}...")
        items = rss_oku(kaynak["url"])
        avrasya_haber = 0
        for item in items:
            if ilgili_mi(item["baslik"], item.get("ozet", ""), kaynak["filtre"]):
                tum_haberler["fa"]["haberler"].append({
                    "baslik": item["baslik"],
                    "kaynak": item["kaynak"],
                    "url": item["url"],
                    "ozet": ozet_olustur(item.get("ozet", "")),
                    "yayin_tarihi": item.get("yayin_tarihi", ""),
                    "dil": "Farsça"
                })
                avrasya_haber += 1
        print(f"  → {avrasya_haber} Avrasya haberi bulundu")

    # 3. Çince kaynaklar
    print("\n--- Çince kaynaklar ---")
    for kaynak in CINCE_KAYNAKLAR:
        print(f"\n{kaynak['url'][:55]}...")
        items = rss_oku(kaynak["url"])
        avrasya_haber = 0
        for item in items:
            if ilgili_mi(item["baslik"], item.get("ozet", ""), kaynak["filtre"]):
                tum_haberler["zh"]["haberler"].append({
                    "baslik": item["baslik"],
                    "kaynak": item["kaynak"],
                    "url": item["url"],
                    "ozet": ozet_olustur(item.get("ozet", "")),
                    "yayin_tarihi": item.get("yayin_tarihi", ""),
                    "dil": "Çince"
                })
                avrasya_haber += 1
        print(f"  → {avrasya_haber} Avrasya haberi bulundu")

    # 4. GNews API (yedek)
    print("\n--- GNews API (yedek) ---")
    for dil_kodu, arama in GNEWS_ARAMALARI.items():
        print(f"\n  {DIL_ADLARI.get(dil_kodu, dil_kodu)}")
        articles = gnews_ara(dil_kodu, arama)
        for a in articles:
            baslik = a.get("title", "")
            if not baslik:
                continue
            # Aynı haber varsa ekleme
            ayni_var = any(
                h["baslik"] == baslik for h in tum_haberler[dil_kodu]["haberler"]
            )
            if ayni_var:
                continue
            tum_haberler[dil_kodu]["haberler"].append({
                "baslik": baslik,
                "kaynak": a.get("source", {}).get("name", "Bilinmeyen"),
                "url": a.get("url", ""),
                "ozet": ozet_olustur(a.get("description", "") or a.get("content", "")),
                "yayin_tarihi": a.get("publishedAt", ""),
                "dil": DIL_ADLARI.get(dil_kodu, dil_kodu)
            })
            print(f"  ✓ {baslik[:70]}...")

    # Her dilde en fazla 5 haber olsun
    for dil in tum_haberler:
        tum_haberler[dil]["haberler"] = tum_haberler[dil]["haberler"][:5]
        tum_haberler[dil]["taranma_zamani"] = datetime.now().isoformat()

    # JSON olarak kaydet
    cikti = {
        "olusturma_tarihi": datetime.now().strftime("%Y-%m-%d"),
        "olusturma_zamani": datetime.now().isoformat(),
        "diller": tum_haberler
    }

    os.makedirs("data", exist_ok=True)
    with open("data/haberler.json", "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, indent=2)

    # Özet
    print(f"\n{'='*50}")
    print(f"TAMAMLANDI")
    print(f"{'='*50}")
    toplam = 0
    for dil in ["tr", "en", "ru", "fa", "zh"]:
        adet = len(tum_haberler[dil]["haberler"])
        print(f"  {DIL_ADLARI[dil]:12s} → {adet} haber")
        toplam += adet
    print(f"  {'TOPLAM':12s} → {toplam} haber")
    print(f"Çıktı: data/haberler.json")


if __name__ == "__main__":
    main()
