#!/usr/bin/env python3
import json, urllib.request, base64

summary = """
<p><strong>New Histories of Northern Eurasia, 700–1917</strong>, Kuzey Avrasya tarih yazımında önemli bir metodolojik dönüşümü temsil ediyor. Editörler <strong>Ismael Biyashev</strong> ve <strong>Ilya V. Gerasimov</strong>, 150 yeni çevrilmiş birincil kaynağı bir araya getirerek, bölgenin bin yılı aşkın tarihine çok sesli bir perspektif sunuyor.</p>

<p>Kitabın en güçlü yönü, geleneksel "Rus merkezli" tarih anlatısını yapısöküme uğratması. Yazarların da belirttiği gibi, seçilen belgeler "hükümet yetkilileri tarafından iktidar merkezlerinde üretilen birincil Rusça kaynaklara olan geleneksel saplantıyı merkezden uzaklaştırıyor." Bu yaklaşım, Kuzey Avrasya'yı tek bir ulusal anlatının dar kalıplarına sıkıştırmak yerine, iç içe geçmiş tarihsel süreçlerin ve çok sayıda tarihsel aktörün panoramik bir manzarasını çiziyor.</p>

<h3>İçindekiler (15 Bölüm)</h3>
<ul>
<li>Bölüm 1-4: Politik ekoloji, ilk siyasi örgütlenmeler ve hiyerarşik devlet yapılarına geçiş (700-~1500)</li>
<li>Bölüm 5-6: Yeni çağ ve toplumsal hayal gücünün dönüşümü</li>
<li>Bölüm 7-9: Moskova Çarlığı'ndan "Barut İmparatorluğu"na ve modern devlete geçiş</li>
<li>Bölüm 10-12: Modern imparatorluktan ulusal imparatorluk tasarımına ve devrime</li>
<li>Bölüm 13-15: Rejim çöküşü, "İlerici İmparatorluk" örgütlenmesi ve emperyal devrim</li>
</ul>

<h3>Editörler Hakkında</h3>
<p><strong>Ismael Biyashev</strong> — Kuzey Avrasya tarihi alanında uzman, birincil kaynak çevirileri ve belge derlemeleriyle tanınıyor.</p>
<p><strong>Ilya V. Gerasimov</strong> — <em>A New Imperial History of Northern Eurasia</em> (600-1700 ve 1700-1918 başlıklı iki cilt) serisinin de editörü. Bloomsbury'de yayımlanan bu kitaplarla birlikte değerlendirildiğinde, Gerasimov'un Kuzey Avrasya tarihyazımını dönüştürmeye yönelik sistematik bir proje yürüttüğü görülüyor.</p>

<h3>Öne Çıkan Özellikler</h3>
<ol>
<li><strong>Çeviri Kalitesi:</strong> 150 belgenin tamamı yeni tercüme edilmiş — daha önce İngilizceye çevrilmemiş kaynakları içeriyor.</li>
<li><strong>Dekolonize Yaklaşım:</strong> "Farkında olmadan Ruslaştırma" tuzağından ve anakronik modernleşme anlatısından kaçınıyor.</li>
<li><strong>Pedagojik Destek:</strong> Çevrimiçi Eğitmen Rehberi (Instructor's Guide) ile destekleniyor — ders kitabı olarak kullanıma uygun.</li>
<li><strong>Geniş Zaman Aralığı:</strong> 700'den 1917'ye — bölgenin erken orta çağdan Sovyet devrimine kadar olan sürecini kapsıyor.</li>
</ol>

<h3>Eleştirel Notlar</h3>
<p>Kitap bir "birincil kaynak okuyucusu" olduğu için, her bölümün başında editörler tarafından yazılmış bağlamsal giriş yazıları bulunuyor ancak bu girişlerin derinliği — ve belgelerin seçimindeki potansiyel önyargılar — ancak kitabın tam metnine erişildiğinde değerlendirilebilir. Ayrıca kitap şu an yalnızca abonelik gerektiren Bloomsbury Collections üzerinden erişilebilir durumda. E-kitap formatında mevcut.</p>

<p><strong>Sonuç:</strong> New Histories of Northern Eurasia, bölge tarihini Rus merkezli anlatının dışında, çok aktörlü ve çok dilli bir perspektifle yeniden yazma iddiasında önemli bir kaynak. Özellikle lisans ve lisansüstü derslerde kullanılmak üzere tasarlanmış olması, onu sadece bir akademik başvuru eseri değil, aynı zamanda pedagojik bir araç haline getiriyor. Gerasimov'un daha önceki <em>A New Imperial History of Northern Eurasia</em> serisiyle birlikte okunduğunda, Kuzey Avrasya tarihyazımında "yeni imparatorluk tarihi" ekolünün olgunlaştığını gösteriyor.</p>
"""

data = {
    "title": "New Histories of Northern Eurasia, 700–1917 – Kitap Değerlendirmesi",
    "summary": summary.strip(),
    "type": "kitap",
    "category_id": 5,
    "source_name": "Bloomsbury Academic",
    "published_at": "2026-07-15",
    "lang": "tr"
}

body = json.dumps(data, ensure_ascii=False).encode('utf-8')
auth = base64.b64encode(b"admin:avrasya2024").decode()

req = urllib.request.Request(
    "https://avrasya-bulteni-production.up.railway.app/api/admin/contents",
    data=body,
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Basic {auth}"
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        print(json.dumps(result, indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()}")
