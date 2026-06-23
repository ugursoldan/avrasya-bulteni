"""
Her bildirinin summary alanındaki "Tam metin için tıklayınız" linkini çıkar,
ardından Railway API'ye PUT ile güncelle.
"""
import subprocess, json, re

API = "https://avrasya-bulteni-production.up.railway.app/api/admin/contents"
AUTH = ("admin", "avrasya2024")

bildiri_ids = [269, 270, 271, 272, 273]

for bid in bildiri_ids:
    # Mevcut kaydı al
    r = subprocess.run(
        ["curl", "-s", "-u", f"{AUTH[0]}:{AUTH[1]}", f"{API}/{bid}"],
        capture_output=True, text=True
    )
    data = json.loads(r.stdout)
    old_summary = data["summary"]
    
    # "Tam metin için tıklayınız" linkini çıkar
    new_summary = re.sub(
        r'<p><a href=\'https://[^\']*\' target=\'_blank\'>Tam metin i[çc]in t[ıi]klay[ıi]n[ıi]z</a></p>',
        '',
        old_summary
    ).strip()
    
    # Güncelle
    payload = json.dumps({"summary": new_summary})
    r2 = subprocess.run(
        ["curl", "-s", "-X", "PUT", "-u", f"{AUTH[0]}:{AUTH[1]}",
         "-H", "Content-Type: application/json",
         "-d", payload,
         f"{API}/{bid}"],
        capture_output=True, text=True
    )
    result = json.loads(r2.stdout)
    ok = "error" not in result
    print(f"ID={bid}: {'✅' if ok else '❌'} old={len(old_summary)} -> new={len(new_summary)} chars | {result.get('error', 'OK')}")

print("\nDone!")
