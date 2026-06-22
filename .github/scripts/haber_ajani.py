import os
import json
import requests
from datetime import datetime

GNEWS_API_KEY = os.environ.get("GNEWS_API_KEY")
DIL_LISTESI = {
    "tr": "Turkce",
    "en": "Ingilizce",
    "ru": "Rusca",
    "fa": "Farsca",
    "zh": "Cince"
}

KELIME_SINIRI = 300

def haberleri_getir(dil_kodu):
    url = (
        f"https://gnews.io/api/v4/search?"
        f"q=Avrasya&lang={dil_kodu}&country=any&max=5&"
        f"apikey={GNEWS_API_KEY}&in=title,description"
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
        return "Ozet olusturulamadi."
    metin = metin.strip()
    kelimeler = metin.split()
    if len(kelimeler) > KELIME_SINIRI:
        return " ".join(kelimeler[:KELIME_SINIRI]) + "..."
    return metin

def main():
    print("=== HABER AJANI BASLADI ===")
    print(f"Tarih: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    
    tum_haberler = {}
    
    for dil_kodu, dil_adi in DIL_LISTESI.items():
        print(f"\n--- {dil_adi} ({dil_kodu}) haberleri taranıyor ---")
        ham_haberler = haberleri_getir(dil_kodu)
        
        gunun_haberleri = []
        for h in ham_haberler[:5]:
            baslik = h.get("title", "Baslik yok")
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
            
            print(f"  ✓ {baslik[:60]}...")
        
        tum_haberler[dil_kodu] = {
            "dil": dil_adi,
            "taranma_zamani": datetime.now().isoformat(),
            "haberler": gunun_haberleri
        }
    
    cikti = {
        "olusturma_tarihi": datetime.now().strftime("%Y-%m-%d"),
        "olusturma_zamani": datetime.now().isoformat(),
        "diller": tum_haberler
    }
    
    os.makedirs("data", exist_ok=True)
    with open("data/haberler.json", "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, indent=2)
    
    print(f"\n=== TAMAMLANDI ===")
    print(f"Toplam haber: {sum(len(v['haberler']) for v in tum_haberler.values())}")
    print(f"Cikti: data/haberler.json")

if __name__ == "__main__":
    main()
