name: Gunluk Arastirma ve Haber

on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  arastirma:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Bagimliliklari yukle
        run: pip install scholarly beautifulsoup4 lxml deep-translator
      - name: Arastirma scriptini calistir
        run: python .github/scripts/arastirma.py
      - name: Degisiklikleri commit et
        run: |
          git config user.name "avrasya-bot"
          git config user.email "bot@avrasya-bulteni.vercel.app"
          git add data/makaleler.json
          git diff --quiet && git diff --staged --quiet || git commit -m "gunluk arastirma $(date +'%Y-%m-%d')"
          git push

  haber:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Haber ajani calistir
        run: python .github/scripts/haber_ajani.py
        env:
          GNEWS_API_KEY: ${{ secrets.GNEWS_API_KEY }}
      - name: Degisiklikleri commit et
        run: |
          git config user.name "avrasya-bot"
          git config user.email "bot@avrasya-bulteni.vercel.app"
          git add data/haberler.json
          git diff --quiet && git diff --staged --quiet || git commit -m "gunluk haber $(date +'%Y-%m-%d')"
          git push
