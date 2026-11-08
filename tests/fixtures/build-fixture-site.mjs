// Builds a throwaway copy of docs/ with SYNTHETIC trip data, a test password and a test link.
// Used by browser tests and design review so real data, keys and the real link never leave the private folder.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { fixture } from './make-fixture.mjs';
import { deriveKey, seal, b64uEncode } from '../../docs/js/vault.js';
import { SITE_DIR } from '../../scripts/paths.mjs';

export const TEST_PASSWORD = 'test-password';
export const TEST_LINK_SECRET = new Uint8Array(32).map((_, i) => i + 1);
export const TEST_HASH = `#k=${b64uEncode(TEST_LINK_SECRET)}`;
const ITER = 2000; // fast for tests

export async function buildFixtureSite(outDir = path.join(os.tmpdir(), 'osaka-trip-fixture-site'), { trip = fixture, iterations = ITER } = {}) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.cpSync(SITE_DIR, outDir, { recursive: true });
  const salt = new Uint8Array(16).map((_, i) => 200 - i);
  const key = await deriveKey(TEST_PASSWORD, TEST_LINK_SECRET, salt, iterations);
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify({ ...trip, meta: { ...trip.meta, rev: 'fixture' } })));
  const env = await seal(key, new Uint8Array(gz), { salt, iterations, rev: 'fixture' });
  fs.writeFileSync(path.join(outDir, 'data', 'trip.enc.json'), JSON.stringify(env));
  fs.rmSync(path.join(outDir, 'CNAME'), { force: true });
  return outDir;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = await buildFixtureSite(process.argv[2]);
  console.log(`Fixture site at ${dir}. Test link fragment: ${TEST_HASH} (synthetic, not secret).`);
}
