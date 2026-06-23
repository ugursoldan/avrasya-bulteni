import sqlite3, json, urllib.request, base64

# Lokal DB güncelle
new_summary = """<p>Son yıllarda Çin ile Amerika Birleşik Devletleri arasındaki rekabet, uluslararası literatürde sıklıkla "Yeni Soğuk Savaş" söylemi üzerinden ele alınmaktadır. Ancak bu yaklaşım, günümüz küresel güç ilişkilerinin çok katmanlı yapısını ve özellikle Afro-Avrasya coğrafyasındaki bölgesel aktörlerin artan stratejik özerkliğini açıklamakta yetersiz kalmaktadır. Bu çalışma, Çin–ABD rekabetini ikili ve determinist bir güç mücadelesi olarak değil; Afro-Avrasya'daki siyasal ve ekonomik aktörlerin tercihleriyle şekillenen dinamik bir etkileşim alanı olarak ele almayı amaçlamaktadır. Makale, Afro-Avrasya'nın pasif bir jeopolitik arena olmaktan ziyade, büyük güç rekabetini yönlendiren ve dönüştüren aktif bir özne haline geldiğini savunmaktadır. Bulgular, bölgesel aktörlerin klasik dengeleme ya da taraf seçme stratejilerinden ziyade, çok yönlü angajman, stratejik belirsizlik ve <a href="https://izlik.org/JA56BL86SB" target="_blank" rel="noopener noreferrer">izlik</a> politikalarını benimsediğini göstermektedir.</p>
<p><strong>Yazar:</strong> Cüneyt Yılmaz (15 Kasım Kıbrıs Üniversitesi)<br>
<strong>Dergi:</strong> Uluslararası Afro-Avrasya Araştırmaları Dergisi<br>
<strong>Cilt/Sayı:</strong> 11/22 (2026)</p>
<p><strong>DOI:</strong> </p>"""

# Lokal DB
conn = sqlite3.connect("/Users/ugursoldan/avrasya-bulteni/db/data/avrasya.db")
conn.execute("UPDATE contents SET summary = ? WHERE id = 1469", (new_summary,))
conn.commit()
print("Lokal DB OK:", conn.execute("SELECT id FROM contents WHERE id = 1469 AND summary LIKE '%izlik.org%'").fetchone())
conn.close()

# Railway API
auth = base64.b64encode(b"admin:avrasya2024").decode()
data = json.dumps({"summary": new_summary}).encode("utf-8")
req = urllib.request.Request(
    "https://avrasya-bulteni-production.up.railway.app/api/contents/1469",
    data=data,
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Basic {auth}"
    },
    method="PUT"
)
try:
    resp = urllib.request.urlopen(req)
    print("Railway API OK:", resp.status, resp.read().decode()[:200])
except Exception as e:
    print("Railway API Error:", e)
