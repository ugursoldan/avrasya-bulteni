#!/usr/bin/env node
/**
 * Avrasya Bülteni — Railway Cron Job
 * 
 * Railway cronSchedule tarafından tetiklenir.
 * GitHub JSON'dan haberleri alır, Türkçe'ye çevirir, DB'ye ekler.
 * 
 * Zamanlama: Her gün 07:00 UTC (= 10:00 TSİ)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { execSync } = require('child_process');

async function main() {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] Railway cron job başladı`);

  // scanner.js'i çalıştır
  const scannerPath = path.join(__dirname, 'scanner.js');
  const maxItems = process.env.SCAN_MAX_ITEMS || '5';

  try {
    const result = execSync(`SCAN_MAX_ITEMS=${maxItems} node ${scannerPath}`, {
      cwd: path.join(__dirname, '..'),
      timeout: 4 * 60 * 1000, // 4 dakika
      env: { ...process.env },
      stdio: 'pipe'
    });
    console.log(result.stdout.toString());
  } catch (err) {
    console.error(`Cron hatası: ${err.message}`);
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }

  console.log(`[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] Railway cron job tamamlandı`);
}

main().catch(err => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
