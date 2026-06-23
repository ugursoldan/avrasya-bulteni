#!/usr/bin/env python3
import json, urllib.request, base64

summary = """
<p><strong>Regionalism in Broader Eurasia: The Dynamics and Typology of Regional Cooperation and Integration</strong>, Mario Apostolov tarafından kaleme alınmış, Springer Nature tarafından 2025 yılında yayımlanan kapsamlı bir akademik çalışma. Kitap, Soğuk Savaş sonrası dönemde bölgeselciliğin küresel ölçekte nasıl yeniden şekillendiğini, özellikle Avrasya bağlamında ele alıyor.</p>

<p>Apostolov, Birleşmiş Milletler Avrupa Ekonomik Komisyonu ve Cenevre Uluslararası Enstitüsü'nde görev yapmış bir uzman olarak, bölgesel işbirliği mekanizmalarına hem teorik hem de pratik bir perspektiften yaklaşıyor. Kitabın temel tezi, Soğuk Savaş sonrası bölgelerin küresel yapı taşları haline geldiği ve bu yeni bölgeselciliğin geleneksel işbirliği modellerinden farklı bir dinamiğe sahip olduğu yönünde.</p>

<p>Kitap, bölgesel işbirliği modellerini kategorize ederek AB (Avrupa Birliği) ve Doğu Asya modelleri arasında karşılaştırmalı bir analiz sunuyor. Bu bağlamda, Avrasya bölgesinin kendine özgü yapısını — hem Avrupa hem de Asya dinamiklerini içinde barındıran bir köprü konumunu — merkeze alıyor. Yazar, bölgesel işbirliğinin tipolojisini yeniden tanımlayarak, geleneksel entegrasyon teorilerinin ötesine geçen bir çerçeve çiziyor.</p>

<h3>Kitabın Öne Çıkan Bölümleri</h3>
<ul>
<li>Post-Cold War küresel düzen ve bölgeselciliğin yeniden yükselişi</li>
<li>Avrupa Birliği modeli: Entegrasyonun sınırları ve genişleme dinamikleri</li>
<li>Doğu Asya bölgeselciliği: Farklı bir yol mu?</li>
<li>Avrasya Ekonomik Birliği (EAEU) ve bölgesel işbirliği mekanizmaları</li>
<li>Kuşak ve Yol Girişimi (BRI) ve Avrasya bağlantısallığı</li>
<li>Bölgesel işbirliği tiplojisi: Rekabet, işbirliği ve entegrasyon arasında</li>
<li>Yeni bölgeselcilik teorisine katkılar ve eleştirel değerlendirme</li>
</ul>

<h3>Yazar Hakkında</h3>
<p><strong>Mario Apostolov</strong> — Birleşmiş Milletler Avrupa Ekonomik Komisyonu (UNECE) ve Cenevre Uluslararası Enstitüsü'nde görev yapmaktadır. Bölgesel işbirliği, ekonomik entegrasyon ve Avrasya siyaseti alanlarında uzmanlaşmıştır. Daha önce de bölgeselcilik ve uluslararası ilişkiler üzerine çeşitli yayınları bulunmaktadır.</p>

<h3>Öne Çıkan Özellikler</h3>
<ol>
<li><strong>Karşılaştırmalı Analiz:</strong> AB ve Doğu Asya modellerini sistematik biçimde karşılaştırarak, Avrasya'nın kendine özgü bölgeselcilik modelini ortaya koyuyor.</li>
<li><strong>Teorik ve Pratik Denge:</strong> Yazarın hem akademik hem de Birleşmiş Milletler bünyesindeki pratik deneyimi, analize somut bir temel kazandırıyor.</li>
<li><strong>Güncel Veri ve Vaka Çalışmaları:</strong> EAEU, BRI gibi güncel bölgesel girişimleri kapsamlı biçimde ele alıyor.</li>
<li><strong>Tipoloji Geliştirme:</strong> Bölgesel işbirliğini sınıflandırmak için özgün bir teorik çerçeve sunuyor.</li>
<li><strong>Springer Nature Yayını:</strong> Akademik açıdan güvenilir bir yayınevi tarafından yayımlanmış olması, kitabın referans değerini artırıyor.</li>
</ol>

<h3>Eleştirel Notlar</h3>
<p>Kitabın en önemli sınırlılığı, büyük ölçüde kurumsal ve hükümetler arası bölgeselciliğe odaklanması; sivil toplum, kimlik ve kültürel boyutları ikinci planda bırakması. Ayrıca, Çin'in Kuşak ve Yol Girişimi'ne ayrılan bölüm, Pekin'in resmi söylemine büyük ölçüde yaslanarak eleştirel mesafeyi korumakta zorlanıyor. Bununla birlikte, yazarın Bölgesel Kapsamlı Ekonomik Ortaklık (RCEP) ve Trans-Pasifik Ortaklığı (CPTPP) gibi mega-bölgesel anlaşmaları da analize dahil etmesi, kitabın kapsamını genişletiyor.</p>

<p><strong>Sonuç:</strong> Regionalism in Broader Eurasia, Soğuk Savaş sonrası bölgeselciliğin dönüşümünü anlamak isteyen uluslararası ilişkiler öğrencileri ve araştırmacıları için değerli bir kaynak. Apostolov'un karşılaştırmalı yaklaşımı ve tipoloji geliştirme çabası, kitabı alana özgün bir katkı haline getiriyor. Özellikle Avrasya bölgesinin hem Avrupa hem de Asya dinamiklerini bir arada barındıran eşsiz konumunu analiz eden bölümler, bölge çalışmaları literatürüne önemli bir katkı sağlıyor.</p>

<p><em>Referans: Apostolov, M. (2025). Regionalism in Broader Eurasia: The Dynamics and Typology of Regional Cooperation and Integration. Springer Nature.</em></p>
"""

data = {
    "title": "Regionalism in Broader Eurasia – Kitap Değerlendirmesi",
    "summary": summary.strip(),
    "type": "kitap",
    "category_id": 3,  # Siyaset kategorisi
    "source_name": "Springer Nature",
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
