import os
import json
import requests
from datetime import datetime
from xml.etree import ElementTree as ET

GNEWS_API_KEY = os.environ.get("GNEWS_API_KEY")

# RSS kaynakları - Avrasya bölgesi haberleri
RSS_KAYNAKLARI = [
    # Türkçe
    {
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        "dil": "en",
        "filtre": ["russia", "china", "eurasia", "central asia", "caucasus", "turkey", "ukraine"]
    },
    {
        "url": "https://feeds.bbci.co.uk/news/world/rss.xml",
        "dil": "en",
        "filtre": ["russia", "china", "eurasia", "central asia", "caucasus", "turkey", "ukraine"]
    },
    {
        "url": "https://www.aljazeera.com/xml/rss/all.xml",
        "dil": "en",
        "filtre": ["russia", "china", "eurasia", "central asia", "caucasus", "turkey", "ukraine", "asia"]
    },
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
    {
        "url": "https://tass.com/rss/v2.xml",
        "dil": "ru",
        "filtre": ["eurasia", "russia", "china", "central asia", "caucasus"]
    }
]

# GNews - her dilde Avrasya/Eurasia araması
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
    metin = (baslik + " " + ozet).lower()
    for kelime in filtre_kelimeleri:
        if kelime.lower() in metin:
            return True
    return False

def ozet_olustur(metin):
    if not metin:
        return "Özet oluşturulamadı."
    import re
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
        "zh": {"dil": "Çince", "haberler": []}
    }
    
    # 1. RSS kaynaklarını tara
    print("\n--- RSS Kaynakları taranıyor ---")
    for kaynak in RSS_KAYNAKLARI:
        dil = kaynak["dil"]
        filtre = kaynak["filtre"]
        print(f"\n{kaynak['url'][:50]}... ({dil})")
        
        items = rss_oku(kaynak["url"])
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
                print(f"  ✓ {item['baslik'][:70]}...")
    
    # 2. GNews API'den ara
    print("\n--- GNews API taranıyor ---")
    for dil_kodu, arama in GNEWS_ARAMALARI.items():
        print(f"\n  {DIL_ADLARI.get(dil_kodu, dil_kodu)}: {arama[:50]}...")
        articles = gnews_ara(dil_kodu, arama)
        for a in articles:
            baslik = a.get("title", "")
            tum_haberler[dil_kodu]["haberler"].append({
                "baslik": baslik,
                "kaynak": a.get("source", {}).get("name", "Bilinmeyen"),
                "url": a.get("url", ""),
                "ozet": ozet_olustur(a.get("description", "") or a.get("content", "")),
                "yayin_tarihi": a.get("publishedAt", ""),
                "dil": DIL_ADLARI.get(dil_kodu, dil_kodu)
            })
            if baslik:
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
    
    print(f"\n=== TAMAMLANDI ===")
    for dil in tum_haberler:
        print(f"  {DIL_ADLARI.get(dil, dil)}: {len(tum_haberler[dil]['haberler'])} haber")
    print(f"Çıktı: data/haberler.json")

if __name__ == "__main__":
    main()
