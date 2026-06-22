import os
import json
import requests
from datetime import datetime

GNEWS_API_KEY = os.environ.get("GNEWS_API_KEY")

# Her dilde aranacak anahtar kelimeler
ARAMA_KELIMELERI = {
    "tr": "Avrasya kıtası jeopolitik ekonomi OR siyaset OR kültür OR ticaret OR enerji",
    "en": "Eurasia continent geopolitics OR economy OR politics OR trade OR energy OR security OR culture",
    "ru": "Евразия континент геополитика OR экономика OR политика OR торговля OR энергетика",
    "fa": "اوراسیا قاره ژئوپلیتیک OR اقتصاد OR سیاست OR تجارت OR انرژی",
    "zh": "欧亚大陆 地缘政治 OR 经济 OR 政治 OR 贸易 OR 能源"
}

DIL_ADLARI = {
    "tr": "Türkçe",
    "en": "İngilizce",
    "ru": "Rusça",
    "fa": "Farsça",
    "zh": "Çince"
}

KELIME_SINIRI = 300

def haberleri_getir(dil_kodu, arama_kelimesi):
    url = (
        f"https://gnews.io/api/v4/search?"
        f"q={arama_kelimesi}&lang={dil_kodu}&country=any&max=5&"
        f"apikey={GNEWS_API_KEY}"
    )
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        return r.json().get("articles", [])
    except Exception as e:
        print(f"  [{dil_kodu}] Hata: {e}")
        return []

def ozet_olustur(metin):
    if not metin:
        return "Özet oluşturulamadı."
    metin = metin.strip()
    kelimeler = metin.split()
    if len(kelimeler) > KELIME_SINIRI:
        return " ".join(kelimeler[:KELIME_SINIRI]) + "..."
    return metin

def main():
    print("=== HABER AJANI BAŞLADI ===")
    print(f"Tarih: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    
    tum_haberler = {}
    
    for dil_kodu, arama_kelimesi in ARAMA_KELIMELERI.items():
        dil_adi = DIL_ADLARI[dil_kodu]
        print(f"\n--- {dil_adi} ({dil_kodu}) haberleri taranıyor ---")
        print(f"    Arama: {arama_kelimesi[:60]}...")
        ham_haberler = haberleri_getir(dil_kodu, arama_kelimesi)
        
        # Sadece Avrasya kıtasıyla ilgili olanları filtrele
        gunun_haberleri = []
        for h in ham_haberler[:5]:
            baslik = h.get("title", "Başlık yok")
            kaynak = h.get("source", {}).get("name", "Bilinmeyen")
            url = h.get("url", "")
            aciklama = h.get("description", "")
            icerik = h.get("content", "")
            yayin_tarihi = h.get("publishedAt", "")
            
            ozet_metni = icerik or aciklama or baslik
            ozet = ozet_olustur(ozet_metni)
            
            gunun_haberleri.append({
                "baslik": baslik,
                "kaynak": kaynak,
                "url": url,
                "ozet": ozet,
                "yayin_tarihi": yayin_tarihi,
                "dil": dil_adi
            })
            
            print(f"  ✓ {baslik[:70]}...")
        
        tum_haberler[dil_kodu] = {
            "dil": dil_adi,
            "taranma_zamani": datetime.now().isoformat(),
            "haberler": gunun_haberleri
        }
    
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
    toplam = sum(len(v['haberler']) for v in tum_haberler.values())
    print(f"Toplam haber: {toplam}")
    print(f"Çıktı: data/haberler.json")

if __name__ == "__main__":
    main()
