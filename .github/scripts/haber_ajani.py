import os
import json
import requests
from datetime import datetime

GNEWS_API_KEY = os.environ.get("GNEWS_API_KEY")

# Her dilde aranacak anahtar kelimeler - basit ve geniş
ARAMA_KELIMELERI = {
    "tr": "Avrasya",
    "en": "Eurasia",
    "ru": "Евразия",
    "fa": "اوراسیا",
    "zh": "欧亚"
}

DIL_ADLARI = {
    "tr": "Türkçe",
    "en": "İngilizce",
    "ru": "Rusça",
    "fa": "Farsça",
    "zh": "Çince"
}

KELIME_SINIRI = 300

# Avrasya Tüneli, Avrasya Hastanesi gibi yerel sonuçları elemek için
EKLENECEK_KELIMELER = {
    "tr": "kıta OR bölge OR ülke OR politika OR ekonomi OR ticaret OR enerji OR güvenlik OR kültür OR tarih OR rusya OR çin OR türkiye OR orta asya OR kafkasya",
    "en": "continent OR region OR country OR politics OR economy OR trade OR energy OR security OR culture OR history OR russia OR china OR turkey OR central asia OR caucasus",
    "ru": "континент OR регион OR страна OR политика OR экономика OR торговля OR энергетика OR безопасность OR культура OR история OR россия OR китай OR турция OR центральная азия OR кавказ",
    "fa": "قاره OR منطقه OR کشور OR سیاست OR اقتصاد OR تجارت OR انرژی OR امنیت OR فرهنگ OR تاریخ OR روسیه OR چین OR ترکیه OR آسیای مرکزی OR قفقاز",
    "zh": "大陆 OR 地区 OR 国家 OR 政治 OR 经济 OR 贸易 OR 能源 OR 安全 OR 文化 OR 历史 OR 俄罗斯 OR 中国 OR 土耳其 OR 中亚 OR 高加索"
}

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

def haberleri_getir_v2(dil_kodu, ana_kelime, ek_kelime):
    """Önce sadece ana kelime ile ara, sonuç azsa ek kelimelerle dene"""
    
    # 1. Deneme: anahtar kelime + ek kelimeler
    arama = f"{ana_kelime} {ek_kelime}"
    url = (
        f"https://gnews.io/api/v4/search?"
        f"q={arama}&lang={dil_kodu}&country=any&max=5&"
        f"apikey={GNEWS_API_KEY}"
    )
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        sonuc = r.json().get("articles", [])
        if sonuc:
            print(f"    ✓ Geniş arama ile {len(sonuc)} haber bulundu")
            return sonuc
    except:
        pass
    
    # 2. Deneme: sadece ana kelime
    url = (
        f"https://gnews.io/api/v4/search?"
        f"q={ana_kelime}&lang={dil_kodu}&country=any&max=5&"
        f"apikey={GNEWS_API_KEY}"
    )
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        sonuc = r.json().get("articles", [])
        if sonuc:
            print(f"    ✓ Basit arama ile {len(sonuc)} haber bulundu")
        return sonuc
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
    
    for dil_kodu in ARAMA_KELIMELERI:
        dil_adi = DIL_ADLARI[dil_kodu]
        ana_kelime = ARAMA_KELIMELERI[dil_kodu]
        ek_kelime = EKLENECEK_KELIMELER[dil_kodu]
        
        print(f"\n--- {dil_adi} ({dil_kodu}) ---")
        
        ham_haberler = haberleri_getir_v2(dil_kodu, ana_kelime, ek_kelime)
        
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
