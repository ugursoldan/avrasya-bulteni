import os
import json
import re
import time
import random
from datetime import datetime
from urllib.parse import quote_plus
import urllib.request
import urllib.error

# Akademik yayınları toplamak için basit bir yaklaşım
# Google Scholar, DergiPark ve diğer kaynaklardan veri çeker

ARASTIRMA_KONULARI = [
    "Avrasya jeopolitiği",
    "Avrasya ekonomik işbirliği",
    "Türkiye Avrasya ilişkileri",
    "Avrasya güvenlik politikaları",
    "Avrasya enerji koridorları",
    "Avrasya'da bölgeselcilik",
    "Şanghay İşbirliği Örgütü",
    "Avrasya kültürel etkileşim",
    "Avrasya ulaştırma koridorları",
    "Avrasya'da Türk dış politikası",
    "Rusya Avrasya politikası",
    "Çin Kuşak ve Yol Girişimi",
    "Avrasya'da bölgesel güvenlik",
    "Avrasya ekonomik entegrasyonu",
    "Türk Devletleri Teşkilatı",
    "Avrasya'da göç hareketleri",
    "Kafkasya jeopolitiği",
    "Orta Asya bölgesel işbirliği",
    "Hazar Havzası enerji politikaları",
    "Avrasya'da yumuşak güç",
    "Avrasya'da sınır güvenliği",
    "Avrasya ticaret yolları",
    "Avrasya'da çevre politikaları",
    "Türkiye-Rusya ilişkileri",
    "Türkiye-Çin ilişkileri"
]

DIL_LISTESI = {
    "Türkçe": {"q": "Avrasya", "hl": "tr"},
    "İngilizce": {"q": "Eurasia", "hl": "en"},
    "Rusça": {"q": "Евразия", "hl": "ru"}
}

def google_scholar_ara(konu, max_sonuc=5):
    """Google Scholar'da arama yapar (basit HTTP isteği ile)"""
    sonuclar = []
    try:
        url = f"https://scholar.google.com/scholar?q={quote_plus(konu)}&hl=tr&as_sdt=0%2C5&num={max_sonuc}"
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8', errors='ignore')
            
            # Basit regex ile başlık ve snippet çıkarma
            basliklar = re.findall(r'<h3[^>]*class="gs_rt"[^>]*>(.*?)</h3>', html, re.DOTALL)
            snippetler = re.findall(r'<div[^>]*class="gs_rs"[^>]*>(.*?)</div>', html, re.DOTALL)
            
            for i, baslik_html in enumerate(basliklar[:max_sonuc]):
                # HTML etiketlerini temizle
                baslik = re.sub(r'<[^>]+>', '', baslik_html).strip()
                baslik = re.sub(r'\s+', ' ', baslik)
                
                snippet = ""
                if i < len(snippetler):
                    snippet = re.sub(r'<[^>]+>', '', snippetler[i]).strip()
                    snippet = re.sub(r'\s+', ' ', snippet)
                
                if baslik:
                    sonuclar.append({
                        "baslik": baslik,
                        "ozet": snippet[:300] if snippet else "Özet mevcut değil",
                        "kaynak": "Google Scholar",
                        "tarih": datetime.now().strftime("%Y-%m-%d")
                    })
    except Exception as e:
        print(f"  Google Scholar hatası ({konu[:30]}...): {e}")
    
    return sonuclar

def main():
    print("=== ARAŞTIRMA AJANI BAŞLADI ===")
    print(f"Tarih: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"Toplam konu: {len(ARASTIRMA_KONULARI)}")
    
    tum_makaleler = []
    rastgele_konular = random.sample(ARASTIRMA_KONULARI, min(5, len(ARASTIRMA_KONULARI)))
    
    for konu in rastgele_konular:
        print(f"\n--- Araştırılıyor: {konu} ---")
        makaleler = google_scholar_ara(konu, max_sonuc=3)
        
        for makale in makaleler:
            makale["konu"] = konu
            tum_makaleler.append(makale)
            print(f"  ✓ {makale['baslik'][:60]}...")
        
        # Google'a yüklenmemek için bekle
        time.sleep(random.uniform(2, 4))
    
    # JSON olarak kaydet
    cikti = {
        "olusturma_tarihi": datetime.now().strftime("%Y-%m-%d"),
        "olusturma_zamani": datetime.now().isoformat(),
        "toplam_makale": len(tum_makaleler),
        "makaleler": tum_makaleler
    }
    
    os.makedirs("data", exist_ok=True)
    with open("data/makaleler.json", "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, indent=2)
    
    print(f"\n=== TAMAMLANDI ===")
    print(f"Toplam makale: {len(tum_makaleler)}")
    print(f"Çıktı: data/makaleler.json")

if __name__ == "__main__":
    main()
