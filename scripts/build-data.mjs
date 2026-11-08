// Encrypts the private trip dataset into docs/data/trip.enc.json and stamps the service worker.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { importRawKey, seal, b64uDecode } from '../docs/js/vault.js';
import { KEYS_FILE, TRIP_FILE, SITE_DIR } from './paths.mjs';

export async function buildData({ tripFile = TRIP_FILE, keysFile = KEYS_FILE, outDir = SITE_DIR } = {}) {
  const keys = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
  const trip = JSON.parse(fs.readFileSync(tripFile, 'utf8'));
  const rev = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  trip.meta = { ...(trip.meta || {}), rev };
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(trip)), { level: 9 });
  const key = await importRawKey(b64uDecode(keys.rawKey));
  const env = await seal(key, new Uint8Array(gz), { salt: b64uDecode(keys.salt), iterations: keys.iter, rev });
  fs.mkdirSync(path.join(outDir, 'data'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'data', 'trip.enc.json'), JSON.stringify(env) + '\n');
  const swPath = path.join(outDir, 'sw.js');
  if (fs.existsSync(swPath)) {
    const sw = fs.readFileSync(swPath, 'utf8').replace(/const REV = '[^']*';/, `const REV = '${rev}';`);
    fs.writeFileSync(swPath, sw);
  }
  return { rev, bytes: env.ct.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { rev, bytes } = await buildData();
  console.log(`Encrypted trip data written (rev ${rev}, ${bytes} base64 chars).`);
}
