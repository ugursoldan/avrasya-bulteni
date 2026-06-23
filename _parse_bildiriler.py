#!/usr/bin/env python3
"""Parse bildiri özetleri PDF'inden 5 bildiriyi çıkar ve API'ye gönder."""
import fitz
import json
import urllib.request
import base64
import re

PDF_PATH = "/Users/ugursoldan/.hermes/cache/documents/doc_b6376cbbd360_bildiri-özet-kitapçiği.pdf"
API_URL = "https://avrasya-bulteni-production.up.railway.app/api/admin/contents"
SOURCE_URL = "https://cdn.istanbul.edu.tr/FileHandler2.ashx?f=bildiri-o%CC%88zet-kitapc%CC%A7ig%CC%86i.pdf"
AUTH = "YWRtaW46YXZyYXN5YTIwMjQ="

doc = fitz.open(PDF_PATH)
all_text = ""
for page in doc:
    all_text += page.get_text()

# Satır satır işle
lines = all_text.split('\n')

# Her bildirinin başlangıç indeksini bul
# Bildiri başlıkları: ALL CAPS, 20+ karakter, "Özet" içermeyen, özel satırlar atla
skip_patterns = [
    'III. AVRASYA ARAŞTIRMALARI', 'LİSANSÜSTÜ ÖĞRENCİ SEMPOZYUMU',
    'Türkiyat Araştırmaları Enstitüsü', 'Avrasya Siyasi, Sosyal, Ekonomi ve Kültür',
    'Araştırmaları Anabilim Dalı', 'BİLDİRİ ÖZETLERİ', '1924-2026',
    'Kaynakça', 'Sayfa'
]

# Bildiriler: "Özet" ile ayrılır
# Yapı: [başlık satır(lar)ı]\n[Dong Seok KIM*]\nÖzet\n[metin]\nAnahtar Kelimeler: ...
sections = all_text.split('Özet')

bildiriler = []

for i in range(1, len(sections)):
    # Önceki bölümün son kısmında başlık+yazar var
    prev = sections[i-1]
    curr = sections[i]
    
    # Başlığı bul: prev'in son satırları
    prev_lines = [l.strip() for l in prev.split('\n') if l.strip()]
    
    # Yazar satırı: genellikle * veya üniversite adı içeren satır, Özet'ten hemen önce
    yazar = ""
    baslik_parts = []
    
    # Tersinden git
    in_baslik = False
    for l in reversed(prev_lines):
        lc = l.strip()
        # ORCID, email, üniversite satırları = yazar bilgisi
        if any(x in lc for x in ['@', 'ORCID', 'Üniversitesi', 'Enstitüsü', 'Öğrencisi']):
            if not yazar:
                yazar = lc
            continue
        # Başlık satırı: büyük harf, 8+ karakter
        if lc.isupper() and len(lc) >= 8:
            if all(s not in lc for s in skip_patterns):
                baslik_parts.insert(0, lc)
                in_baslik = True
        elif in_baslik:
            # Başlık bitti
            pass
    
    # Özet metni
    abstract_text = curr.strip()
    if 'Anahtar Kelimeler' in abstract_text:
        abstract_text = abstract_text.split('Anahtar Kelimeler')[0]
    if 'Anahtar' in abstract_text:
        abstract_text = abstract_text.split('Anahtar')[0]
    
    baslik = ' '.join(baslik_parts).replace('\uf02a', '').replace('\uf02b', '').strip()
    
    if baslik:
        bildiriler.append({
            'id': i,
            'baslik': baslik,
            'yazar': yazar,
            'ozet': abstract_text.strip()
        })

print(f"Toplam bildiri: {len(bildiriler)}")
for b in bildiriler:
    print(f"\n--- BİLDİRİ #{b['id']} ---")
    print(f"BAŞLIK: {b['baslik'][:90]}")
    print(f"YAZAR: {b['yazar'][:80]}")
    print(f"ÖZET: {b['ozet'][:200]}...")

# Seçilecek 5 bildiri index'leri
# En Avrasya konulu: Berlin Antlaşması Avrasya, KGAT/Kırgızistan, Kazakistan Kolektivizasyon, 
# Post-Sovyet Gürcistan, Ukrayna Diasporası
# Bildiri index'lerini gerçek numaralarından bulalım
print("\n\n=== SEÇİM ===")
# Gerçek bildiri sırası:
# 1=Güney Kore Hallyu, 2=Global Hansik, 3=Türkiye-İsrail Arkeopolitik, 4=ABD Hint-Pasifik,
# 5=Post-Sovyet Gürcistan, 6=Ukrayna Diasporası, 7=Özbekistan Diaspora, 8=Osmanlı Ölçü,
# 9=Hızlı Nötron, 10=Japonya Arktik, 11=Davud Koridoru, 12=KGAT, 13=Berlin Antlaşması,
# 14=Kazakistan Kolektivizasyon, 15=Japon Donanması, 16=Türkçe-Lehçe, 17=Rıza Tevfik,
# 18=Ali Şir Nevai, 19=Sovyet-İsrail Göç, 20=Avrasya Folkloru

# Seçilenler:
secim_indices = [5, 6, 12, 13, 14]  # Post-Sovyet Gürcistan, Ukrayna Diaspora, KGAT, Berlin, Kazakistan

print("Seçilen bildiriler:")
for idx in secim_indices:
    b = bildiriler[idx-1]  # 0-based
    print(f"  #{b['id']}: {b['baslik'][:80]}")
