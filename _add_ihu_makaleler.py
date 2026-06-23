import sqlite3, json, urllib.request, base64, re, hashlib
from datetime import datetime

now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

makaleler = [
    {
        "title": "2022 Ukrayna Savaşının Patlamasından Sonra Kazakistan'da Etki Alanlarındaki Değişiklikler",
        "summary": """<p>Haydar Aliyev Avrasya Çalışmaları Merkezi (HACE), Ukrayna Savaşı'nın ardından Kazakistan'daki nüfuz alanlarındaki değişimi konu alan kapsamlı bir rapor yayımladı. Eldaniz Gusseinov tarafından kaleme alınan "Changes in the Spheres of Influence in Kazakhstan After the Outbreak of the Ukraine War in 2022" başlıklı rapor, İbn Haldun Üniversitesi Yayınları tarafından yayımlandı.</p>
<p>Raporda, savaş sonrası Kazakistan'daki dış aktörlerin — özellikle Rusya, Çin, Türkiye ve Avrupa Birliği'nin — ekonomik ve politik etkileri analiz ediliyor. Çalışmanın merkezinde, Rusya'nın artan etkisine rağmen bu etkinin Kazakistan ile yürütülen müzakerelerle sınırlı kaldığını öne süren "müzakere edilmiş hegemon" (negotiated hegemon) teorisi yer alıyor.</p>
<p><strong>Bulgular:</strong> Rusya, Kazakistan üzerinden ikili kullanıma sahip (dual-use) malların taşınması sayesinde siyasi ve askerî etkisini artırmış durumda. Avrupa Birliği, ekonomik alandaki en güçlü aktör olarak öne çıkıyor. Çin'in etkisi beklentilerin altında kalırken, Türkiye savaş öncesi ve sonrasında nüfuz açısından en zayıf aktör olarak değerlendiriliyor.</p>
<p><strong>Yazar:</strong> Eldaniz Gusseinov<br>
<strong>Kurum:</strong> İbn Haldun Üniversitesi, Haydar Aliyev Avrasya Çalışmaları Merkezi (HACE)<br>
<strong>Kaynak:</strong> <a href="https://avrasya.ihu.edu.tr/tr/2022-ukrayna-savasinin-patlamasindan-sonra-kazakistan-da-etki-alanlarindaki-degisiklikler" target="_blank" rel="noopener noreferrer">İHÜ Avrasya Çalışmaları Merkezi</a></p>""",
        "source_name": "İHÜ Haydar Aliyev Avrasya Çalışmaları Merkezi",
        "source_url": "https://avrasya.ihu.edu.tr/tr/2022-ukrayna-savasinin-patlamasindan-sonra-kazakistan-da-etki-alanlarindaki-degisiklikler",
        "type": "makale",
        "slug": "kazakistan-etki-alanlari-ukrayna-savasi"
    },
    {
        "title": "Sakarya Gaz Sahası, Enerji Güvenliği ve Jeopolitik",
        "summary": """<p>Türkiye'nin milli enerji şirketi TPAO tarafından yürütülen Sakarya Gaz Sahası Geliştirme Projesi, Deniz Altı Üretim Sistemi (SPS), Kıyı Üretim Tesisi (OPF) ve Deniz Altı Umbilikal, Yükselticiler ve Akış Hatlarından (SURF) oluşmaktadır. İlk doğal gaz üretimi Mayıs 2023'te gerçekleştirilmiş ve BOTAŞ aracılığıyla ulusal şebekeye aktarılmıştır.</p>
<p>Karadeniz'de, Zonguldak ili Filyos ilçesinin 170 km açığında yer alan Sakarya Gaz Sahası, Türkiye'nin Münhasır Ekonomik Bölgesi'nde (MEB) bulunuyor. Fatih sondaj gemisi 2020'de Tuna-1 kuyusunda 405 milyar metreküp (bcm), 2021'de Amasra-1'de 135 bcm, Aralık 2022'de Çaycuma-1'de 58 bcm olmak üzere toplam 710 bcm doğal gaz keşfine ulaştı.</p>
<p>Bu çalışma, doğal gaz keşfinin başarıya ulaşmasını sağlayan ulusal enerji politikasındaki paradigma değişimlerini, üretime dönüştürülecek doğal gazın Türkiye'nin enerji arz güvenliğine yansımalarını ve bölgeye sosyo-ekonomik katkılarını ortaya koymaktadır. Öngörülen Faz-1 ve Faz-2 kapsamında 40 milyon metreküp/gün doğal gaz üretilmesi hedeflenmektedir.</p>
<p><strong>Kurum:</strong> İbn Haldun Üniversitesi, Haydar Aliyev Avrasya Çalışmaları Merkezi (HACE)<br>
<strong>Kaynak:</strong> <a href="https://avrasya.ihu.edu.tr/tr/sakarya-gaz-sahasi-enerji-guvenligi-ve-jeopolitik" target="_blank" rel="noopener noreferrer">İHÜ Avrasya Çalışmaları Merkezi</a></p>""",
        "source_name": "İHÜ Haydar Aliyev Avrasya Çalışmaları Merkezi",
        "source_url": "https://avrasya.ihu.edu.tr/tr/sakarya-gaz-sahasi-enerji-guvenligi-ve-jeopolitik",
        "type": "makale",
        "slug": "sakarya-gaz-sahasi-enerji-jeopolitik"
    },
    {
        "title": "ABD-Çin İlişkileri Ortamında Tayvan'da Mikroçip Üretiminin Jeopolitiği",
        "summary": """<p>Bu rapor, Tayvan'da mikroçip üretiminin karmaşık jeopolitik dinamiklerini özellikle ABD-Çin ilişkileri bağlamında incelemektedir. 1949'dan bu yana Boğazlar arası ilişkilerin tarihsel arka planını inceleyerek Soğuk Savaş ve sonraki dönemlerdeki siyasi değişimlerin mevcut durumu nasıl etkilediğini araştırmaktadır.</p>
<p>Tayvan'ın küresel yarı iletken üretimindeki önemli rolü, adayı ABD-Çin jeopolitik gerilimlerinde stratejik bir konuma yerleştirmektedir. Analiz, bölgesel istikrar ve uluslararası ticaret üzerindeki potansiyel sonuçları göz önünde bulundurarak Tayvan'ın mikroçip endüstrisinin ekonomik karşılıklı bağımlılıklarını ve siyasi etkilerini vurgulamaktadır.</p>
<p><strong>Kurum:</strong> İbn Haldun Üniversitesi, Haydar Aliyev Avrasya Çalışmaları Merkezi (HACE)<br>
<strong>Kaynak:</strong> <a href="https://avrasya.ihu.edu.tr/tr/abd-cin-iliskileri-ortaminda-tayvan-da-mikrocip-uretiminin-jeopolitigi" target="_blank" rel="noopener noreferrer">İHÜ Avrasya Çalışmaları Merkezi</a></p>""",
        "source_name": "İHÜ Haydar Aliyev Avrasya Çalışmaları Merkezi",
        "source_url": "https://avrasya.ihu.edu.tr/tr/abd-cin-iliskileri-ortaminda-tayvan-da-mikrocip-uretiminin-jeopolitigi",
        "type": "makale",
        "slug": "tayvan-mikrocip-uretiminin-jeopolitigi"
    },
    {
        "title": "Enerji Güvenliği",
        "summary": """<p>Bu rapor, enerji güvenliği kavramının anlamını sorgulamayı amaçlamaktadır. Enerji güvenliği kavramının "çok boyutlu" ve "polisemik" yapısının tek tip bir tanımlamayı zorlaştırmasına rağmen, çeşitli tanımların ortak boyutları ve bileşenleri ile farklı bileşenlerinin analiz edilmesi yoluyla kavramın anlamını anlamak için bir çerçeve oluşturulabileceği savunulmaktadır.</p>
<p>APERC'in enerji güvenliği tanımının 4A'sı (Availability, Accessibility, Affordability, Acceptability), farklı tanımların boyutlarını ve bileşenlerini birleştirmek için bir çerçeve sağlamaktadır. Bu çerçeve enerji güvenliğini "herhangi bir tehdidin yokluğundan enerji özerkliğine sahip olmak" şeklinde tanımlayarak kavramın daha iyi anlaşılmasını sağlamaktadır.</p>
<p>Bununla birlikte, enerji güvenliği kavramının yeniden tanımlanmasının, kavramın uluslararası sistemle ve çağın insan kaynaklı enerji sistemiyle uyumsuz kalması nedeniyle anlamı hakkında bilgi sahibi olmak için yeterli olmayacağı da savunulmaktadır.</p>
<p><strong>Kurum:</strong> İbn Haldun Üniversitesi, Haydar Aliyev Avrasya Çalışmaları Merkezi (HACE)<br>
<strong>Tam Metin:</strong> <a href="https://hdl.handle.net/20.500.12154/2418" target="_blank" rel="noopener noreferrer">DSpace (20.500.12154/2418)</a><br>
<strong>Kaynak:</strong> <a href="https://avrasya.ihu.edu.tr/tr/enerji-guvenligi" target="_blank" rel="noopener noreferrer">İHÜ Avrasya Çalışmaları Merkezi</a></p>""",
        "source_name": "İHÜ Haydar Aliyev Avrasya Çalışmaları Merkezi",
        "source_url": "https://avrasya.ihu.edu.tr/tr/enerji-guvenligi",
        "type": "makale",
        "slug": "enerji-guvenligi-kavrami"
    }
]

# 1. Lokal DB'ye ekle
conn = sqlite3.connect("/Users/ugursoldan/avrasya-bulteni/db/data/avrasya.db")
cur = conn.cursor()

added_ids = []
for m in makaleler:
    # Slug'dan tekrar kontrol - daha önce eklenmiş mi?
    existing = cur.execute("SELECT id FROM contents WHERE slug = ?", (m["slug"],)).fetchone()
    if existing:
        print(f"Zaten var: {m['title']} (ID: {existing[0]})")
        added_ids.append(existing[0])
        continue
    
    cur.execute("""
        INSERT INTO contents (title, slug, summary, full_text, source_name, source_url, type, lang, created_at, ai_summarized)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'tr', datetime('now'), 1)
    """, (m["title"], m["slug"], m["summary"], m["summary"], m["source_name"], m["source_url"], m["type"]))
    last_id = cur.lastrowid
    added_ids.append(last_id)
    print(f"Eklendi: {m['title']} (ID: {last_id})")

conn.commit()
conn.close()

print(f"\nLokal DB'ye {len(added_ids)} makale eklendi/güncellendi.")

# 2. Railway API'ye ekle
auth = base64.b64encode(b"admin:avrasya2024").decode()

for i, m in enumerate(makaleler):
    data = json.dumps({
        "title": m["title"],
        "slug": m["slug"],
        "summary": m["summary"],
        "full_text": m["summary"],
        "source_name": m["source_name"],
        "source_url": m["source_url"],
        "type": m["type"],
        "lang": "tr",
        "ai_summarized": 1
    }).encode("utf-8")
    
    req = urllib.request.Request(
        "https://avrasya-bulteni-production.up.railway.app/api/admin/contents",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Basic {auth}"
        },
        method="POST"
    )
    try:
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read().decode())
        rid = result.get("id", "?")
        print(f"Railway OK: {m['title'][:40]}... (ID: {rid})")
    except Exception as e:
        print(f"Railway Error ({m['title'][:30]}...): {e}")
