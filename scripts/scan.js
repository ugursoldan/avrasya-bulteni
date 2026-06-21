#!/usr/bin/env node
// Avrasya Bülteni - Tam tarama + AI özetleme pipeline'ı
const { runScan } = require('./scanner');
const { processUnsummarized } = require('./ai-summarizer');

async function main() {
  console.log('='.repeat(50));
  console.log('🌏 Avrasya Bülteni Tarama Pipeline');
  console.log('='.repeat(50));

  // 1. RSS taraması
  console.log('\n📡 1. AŞAMA: Kaynak taraması');
  console.log('-'.repeat(40));
  await runScan();

  // 2. AI özetleme
  console.log('\n🤖 2. AŞAMA: AI özetleme');
  console.log('-'.repeat(40));
  await processUnsummarized();

  console.log('\n✅ Tüm pipeline tamamlandı.');
}

main().catch(err => {
  console.error('❌ Pipeline hatası:', err);
  process.exit(1);
});
