// Creates (or rotates) the private link secret and password-derived key.
// Usage: npm run keys  (prompts for the password without echo)
// Writes only to the private folder outside the repo; prints no secret values.
import fs from 'node:fs';
import { createInterface } from 'node:readline';
import { deriveKey, randomBytes, b64uEncode, KDF_ITERATIONS } from '../docs/js/vault.js';
import { PRIVATE_DIR, KEYS_FILE, LINK_FILE, SITE_URL } from './paths.mjs';

async function readPassword() {
  if (process.env.OSAKA_PASSWORD) return process.env.OSAKA_PASSWORD;
  if (!process.stdin.isTTY) throw new Error('Run in a terminal so the password can be typed without echo.');
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = () => {};
  process.stdout.write('Site password (hidden): ');
  const pw = await new Promise((resolve) => rl.question('', resolve));
  rl.close();
  process.stdout.write('\n');
  return pw;
}

const password = await readPassword();
if (!password || password.length < 4) throw new Error('Password missing or too short.');

const keepLink = process.argv.includes('--keep-link') && fs.existsSync(KEYS_FILE);
const linkSecret = keepLink
  ? Uint8Array.from(Buffer.from(JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')).linkSecret, 'base64url'))
  : randomBytes(32);
const salt = randomBytes(16);
const key = await deriveKey(password, linkSecret, salt, KDF_ITERATIONS, true);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));

fs.mkdirSync(PRIVATE_DIR, { recursive: true, mode: 0o700 });
fs.writeFileSync(KEYS_FILE, JSON.stringify({
  note: 'PRIVATE. Never commit, paste or print. Holds the link secret and derived data key.',
  created: new Date().toISOString(),
  linkSecret: b64uEncode(linkSecret),
  salt: b64uEncode(salt),
  iter: KDF_ITERATIONS,
  rawKey: b64uEncode(raw),
}, null, 1) + '\n', { mode: 0o600 });
fs.writeFileSync(LINK_FILE, `${SITE_URL}#k=${b64uEncode(linkSecret)}\n`, { mode: 0o600 });
console.log(`Keys written to the private folder (${keepLink ? 'link kept' : 'new link'}). Rebuild data with: npm run build`);
