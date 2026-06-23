#!/usr/bin/env python3
"""5 bildiriyi parse et ve Railway API'ye gönder."""
import fitz
import json
import urllib.request
import base64

PDF_PATH = "/Users/ugursoldan/.hermes/cache/documents/doc_b6376cbbd360_bildiri-özet-kitapçiği.pdf"
API_URL = "https://avrasya-bulteni-production.up.railway.app/api/admin/contents"
SOURCE_URL = "https://cdn.istanbul.edu.tr/FileHandler2.ashx?f=bildiri-o%CC%88zet-kitapc%CC%A7ig%CC%86i.pdf"
AUTH_BASE64 = "YWRtaW46YXZyYXN5YTIwMjQ="

doc = fitz.open(PDF_PATH)
all_text = ""
for page in doc:
    all_text += page.get_text()

sections = all_text.split("Özet")

# Bildiri tanımları: [section_index, baslik_parca_index(onceden_belirle), yazar_ad]
# Her section = N. özet metni + Anahtar Kelimeler + yazar bilgisi + (N+1). başlık
bildiri_data = []

def extract_abstract(text):
    """Özet metnini Anahtar Kelimeler'den öncesine kadar al"""
    if 'Anahtar' in text:
        text = text.split('Anahtar')[0]
    return text.strip()

def extract_title_authors(text):
    """Section'ın sonundaki başlık ve yazar bilgisini çıkar"""
    lines = text.strip().split('\n')
    title_parts = []
    for line in reversed(lines):
        l = line.strip()
        if l.isupper() and len(l) >= 8 and not any(x in l for x in ['ORCID', '1924-2026', 'AVRASYA', 'LİSANSÜSTÜ', 'BİLDİRİ']):
            title_parts.insert(0, l)
        elif title_parts:
            break
    return ' '.join(title_parts).replace('\uf02a', '').replace('\uf02b', '').strip()

# 1. Post-Sovyet Gürcistan (section 4'te, Parca 1-2'de)
# Parca 1'de özet metni var, Parca 2'de Anahtar + yazar + Ukrayna başlığı
parts4 = sections[4].split("Anahtar Kelimeler")
# Parca 1 = [Anahtar: ABD'] + yazar + Post-Sovyet başlık + Post-Sovyet özet
sub_parts = parts4[1].split("Post-Sovyet GÜRCİSTAN")
# Aslında daha basit: Post-Sovyet özeti = parts4[1]'de "Post-Sovyet GÜRCİSTAN" yok ama büyük harf var
# Post-Sovyet başlık = parts4[1]'in sonlarında
lines = parts4[1].split('\n')
ps_baslik = ""
ps_ozet = ""
in_ps = False
for l in lines:
    stripped = l.strip()
    if 'POST-SOVYET GÜRCİSTAN' in stripped:
        in_ps = True
        ps_baslik = "Post-Sovyet Gürcistan'da Müslüman Kimliğinin Dönüşümü – Acara Örneği"
        continue
    if in_ps:
        ps_ozet += l + '\n'

ps_ozet = extract_abstract(ps_ozet)

# Post-Sovyet yazar: parts4[2]'de
yazar_ps = ""
for l in parts4[2].split('\n'):
    if 'ani.gogiashvili' in l.lower():
        yazar_ps = l.strip()
        break
if not yazar_ps:
    yazar_ps = "Ani Gogiashvili"

bildiri_data.append({
    "title": ps_baslik,
    "yazar": yazar_ps[:100],
    "abstract": ps_ozet
})

# 2. Ukrayna Diasporası (section 5)
s5 = sections[5]
s5_lines = s5.split('\n')
# Başlık
for l in reversed(s5_lines):
    if 'UKRAYNA DİASPORASI' in l.upper() or 'UKRAYNA DİASPORASI' in l:
        ukr_title = "Türkiye'de Ukrayna Diasporası ve Kimlik"
        break

# Özet
ukr_ozet = extract_abstract(s5)
# Yazar
yazar_ukr = ""
for l in s5_lines:
    if 'khorunzha' in l.lower() or 'valentyna' in l.lower():
        yazar_ukr = l.strip()

bildiri_data.append({
    "title": "Türkiye'de Ukrayna Diasporası ve Kimlik",
    "yazar": yazar_ukr[:100] if yazar_ukr else "Valentyna Khorunzha",
    "abstract": ukr_ozet
})

# 3. KGAT Kırgızistan (section 11)
s11 = sections[11]
s11_ozet = extract_abstract(s11)
# Başlık - section'ın sonundaki başlık
s11_title = ""
for l in reversed(s11.split('\n')):
    if 'KGAT' in l or 'KIRGIZİSTAN' in l:
        s11_title = "KGAT'ın Kolektif Müdahale Sınırları: 2009 KAMK Anlaşması ve 2010 Kırgızistan Krizi Üzerinden İnceleme"
        break

yazar_kgat = ""
for l in s11.split('\n'):
    if 'ozacar' in l.lower() or 'abdurrahman' in l.lower():
        yazar_kgat = l.strip()

bildiri_data.append({
    "title": s11_title,
    "yazar": yazar_kgat[:100] if yazar_kgat else "Abdurrahman Özacaar",
    "abstract": s11_ozet
})

# 4. Berlin Antlaşması Avrasya Jeopolitiği (section 12)
s12 = sections[12]
s12_ozet = extract_abstract(s12)

yazar_berlin = ""
for l in s12.split('\n'):
    if 'korkmaz' in l.lower() or 'ibrahim' in l.lower():
        yazar_berlin = l.strip()

bildiri_data.append({
    "title": "1878 Berlin Antlaşması'nın Avrasya Jeopolitiğine Etkisi: Kafkasya Sınırlarının Yeniden Çizilmesi ve Elviye-i Selâse",
    "yazar": yazar_berlin[:100] if yazar_berlin else "İbrahim Korkmaz",
    "abstract": s12_ozet
})

# 5. Sovyet Kazakistanı Kolektivizasyon (section 13)
s13 = sections[13]
s13_ozet = extract_abstract(s13)

yazar_kazak = ""
for l in s13.split('\n'):
    if 'abdi' in l.lower() or 'assel' in l.lower():
        yazar_kazak = l.strip()

bildiri_data.append({
    "title": "Sovyet Kazakistanı'nda Kolektivizasyon Sürecinde Müsadere Politikaları: Sırderya Bölgesi Örneği (1928-1932)",
    "yazar": yazar_kazak[:100] if yazar_kazak else "Assel Abdişami",
    "abstract": s13_ozet
})

# API'ye gönder
print("Gönderilecek bildiriler:\n")
headers = {
    "Authorization": f"Basic {AUTH_BASE64}",
    "Content-Type": "application/json"
}

for i, b in enumerate(bildiri_data):
    payload = {
        "title": b["title"],
        "summary": f"<p><strong>{b['yazar']}</strong></p><p>{b['abstract'][:300]}...</p><p><a href='{SOURCE_URL}' target='_blank'>Tam metin için tıklayınız</a></p>",
        "type": "bildiri",
        "source_name": "III. Avrasya Araştırmaları Lisansüstü Öğrenci Sempozyumu Bildiri Özetleri",
        "source_url": SOURCE_URL
    }
    
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method='POST'
    )
    
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read().decode('utf-8'))
        print(f"{i+1}. ✅ {b['title'][:60]}")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"{i+1}. ❌ {b['title'][:60]}: {e.code} - {err_body[:200]}")

print("\nİşlem tamamlandı.")
