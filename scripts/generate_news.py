#!/usr/bin/env python3
"""
Avrasya Bülteni için DeepSeek API ile haber üretimi.
Kullanım: python3 generate_news.py <dil_kodu> <dil_adi> <kaynak_adi> <konu_aciklamasi>
Örnek:   python3 generate_news.py ru "Rusça" "DeepSeek AI - Rusça" "Rusya, Kafkasya, Orta Asya"

Başlıklar ve özetler TAMAMEN TÜRKÇE üretilir.
"""

import json
import os
import re
import sqlite3
import sys
import urllib.request
import urllib.error

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(PROJECT_DIR, "avrasya.db")
ENV_PATH = os.path.join(PROJECT_DIR, ".env")

def load_env(env_path):
    """Load .env file."""
    if not os.path.exists(env_path):
        print(f"HATA: .env dosyası bulunamadı: {env_path}", file=sys.stderr)
        sys.exit(1)
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                os.environ[key.strip()] = val.strip().strip("'\"")

def slugify(text):
    """Türkçe başlıktan slug oluştur."""
    text = text.lower().strip()
    tr_map = {
        "ş": "s", "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ü": "u",
        "Ş": "s", "Ç": "c", "Ğ": "g", "İ": "i", "Ö": "o", "Ü": "u",
    }
    for tr_char, ascii_char in tr_map.items():
        text = text.replace(tr_char, ascii_char)
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s-]+", "-", text).strip("-")
    return text[:200]  # Slug max 200 karakter

def call_deepseek(prompt, api_key):
    """DeepSeek API çağrısı."""
    url = "https://api.deepseek.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    data = json.dumps({
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "system",
                "content": (
                    "Sen bir Avrasya haber editörüsün. Güncel, gerçekçi ve doğru haber metinleri üretiyorsun. "
                    "Tüm çıktın TAMAMEN TÜRKÇE olmalıdır. Her haberin başlığı ve özeti Türkçedir. "
                    "Her haber için JSON formatında şu alanları döndür:\n"
                    "{\n"
                    '  "haberler": [\n'
                    '    {\n'
                    '      "title": "Türkçe başlık",\n'
                    '      "summary": "200-300 kelimelik Türkçe özet"\n'
                    '    }\n'
                    "  ]\n"
                    "}\n"
                    "Her zaman 3 adet haber üret."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 4000,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else str(e)
        print(f"HATA - DeepSeek API hatası ({e.code}): {body}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"HATA - DeepSeek API çağrı hatası: {e}", file=sys.stderr)
        sys.exit(1)

def extract_json(text):
    """Yanıttan JSON çıkar."""
    # Önce code block içindeki JSON'ı dene
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        text = m.group(1).strip()
    
    # Süslü parantezlerle başlayan JSON'ı bul
    m = re.search(r'\{\s*"haberler"\s*:', text)
    if m:
        text = text[m.start():]
        # JSON'ın bittiği yeri bul
        depth = 0
        for i, c in enumerate(text):
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    text = text[: i + 1]
                    break
    
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"HATA - JSON ayrıştırılamadı: {e}", file=sys.stderr)
        print(f"Ham yanıt (ilk 2000 karakter): {text[:2000]}", file=sys.stderr)
        sys.exit(1)

def main():
    if len(sys.argv) < 5:
        print(
            "Kullanım: python3 generate_news.py <dil_kodu> <dil_adi> <kaynak_adi> <konu_aciklamasi>",
            file=sys.stderr,
        )
        sys.exit(1)

    lang_code = sys.argv[1]
    lang_name = sys.argv[2]
    source_name = sys.argv[3]
    topic = sys.argv[4]

    # .env'den API key'i yükle
    load_env(ENV_PATH)
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("HATA: DEEPSEEK_API_KEY bulunamadı", file=sys.stderr)
        sys.exit(1)

    # Prompt oluştur
    prompt = (
        f"{lang_name} dilindeki kaynakları kullanarak Avrasya bölgesiyle ilgili "
        f"3 adet GÜNCEL haber veya analiz üret. Odaklanılacak konular: {topic}.\n\n"
        f"Haberler gerçekçi, güncel konulara dayalı ve Avrasya coğrafyasıyla ilgili olmalı. "
        f"Kaynak olarak {lang_name} haber ajanslarını referans al.\n\n"
        f"ÖNEMLİ: Başlıklar ve özetler TAMAMEN TÜRKÇE olmalıdır. "
        f"Her haber için {'Türkçe' if lang_code == 'tr' else 'Türkçe'} başlık ve "
        f"200-300 kelimelik Türkçe özet yaz."
    )

    print(f"[{lang_code.upper()}] DeepSeek API çağrılıyor (konu: {topic})...", file=sys.stderr)
    response = call_deepseek(prompt, api_key)

    print(f"[{lang_code.upper()}] Yanıt ayrıştırılıyor...", file=sys.stderr)
    data = extract_json(response)
    articles = data.get("haberler", [])
    
    if not articles:
        print(f"HATA: Hiç haber üretilemedi", file=sys.stderr)
        print(f"Yanıt: {response[:500]}", file=sys.stderr)
        sys.exit(1)

    print(f"[{lang_code.upper()}] Veritabanına kaydediliyor ({len(articles)} haber)...", file=sys.stderr)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    import datetime
    
    added_count = 0
    for article in articles:
        title = article.get("title", "").strip()
        summary = article.get("summary", "").strip()
        
        if not title or not summary:
            print(f"Uyarı: Eksik alan, atlanıyor: {title}", file=sys.stderr)
            continue
        
        slug = slugify(title)
        today = datetime.date.today().isoformat()
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        try:
            cursor.execute(
                """INSERT INTO contents 
                   (title, slug, type, summary, full_text, source_name, source_url, 
                    lang, ai_summarized, published_at, created_at) 
                   VALUES (?, ?, 'haber', ?, '', ?, '', ?, 1, ?, ?)""",
                (title, slug, summary, source_name, lang_code, today, now),
            )
            added_count += 1
            print(f"  + Eklendi: {title[:60]}...", file=sys.stderr)
        except sqlite3.Error as e:
            print(f"HATA - DB ekleme hatası ({title[:40]}...): {e}", file=sys.stderr)
    
    conn.commit()
    conn.close()
    
    print(f"\n[{lang_code.upper()}] İşlem tamam: {added_count}/{len(articles)} haber eklendi.")
    print(f"Eklenen haberler:")
    for article in articles:
        title = article.get("title", "").strip()
        if title:
            print(f"  • {title}")
            print(f"    [{source_name} | {lang_code.upper()}]")

if __name__ == "__main__":
    main()
