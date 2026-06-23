#!/usr/bin/env python3
"""Sync local avrasya.db haber entries to Railway via admin API."""
import json
import sqlite3
import urllib.request
import base64
import sys
import os

API_BASE = "https://avrasya-bulteni-production.up.railway.app"
ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

def api_post(endpoint, data):
    url = f"{API_BASE}{endpoint}"
    auth = base64.b64encode(f"{ADMIN_USER}:{ADMIN_PASS}".encode()).decode()
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Basic {auth}"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode()[:200]}"}
    except Exception as e:
        return {"error": str(e)}

def main():
    db_path = os.path.join(os.path.dirname(__file__), "avrasya.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # Get all haber entries
    cur.execute("SELECT * FROM contents WHERE type='haber' ORDER BY id")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    
    print(f"Found {len(rows)} haber entries in local DB")
    
    success = 0
    fail = 0
    for row in rows:
        row.pop("id", None)  # Don't send id, let auto-increment
        slug = row.get("slug", "")
        
        result = api_post("/api/admin/contents", row)
        
        if "id" in result:
            success += 1
        else:
            fail += 1
            print(f"  FAILED slug={slug[:30]}: {result.get('error', str(result))[:100]}")
        
        if success % 5 == 0 and success > 0:
            print(f"  Progress: {success} ok, {fail} fail")
    
    print(f"\n=== FINAL: {success} success, {fail} failed ===")
    return 0 if fail == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
