// Trip data protection. Platform WebCrypto only (browser and Node share this file).
//
// The trip dataset is published only as an AES-256-GCM envelope. The key needs BOTH:
//   1. the link secret: 32 random bytes carried in the private link's URL fragment
//      (fragments are never sent to the server or in Referer headers), and
//   2. the password, stretched with PBKDF2-SHA256.
// HKDF-SHA256 combines the two, so the published ciphertext cannot be attacked by
// guessing the password alone: without the link secret the key space is 2^256.

const te = new TextEncoder();
const td = new TextDecoder();

export const ENVELOPE_VERSION = 1;
export const KDF_ITERATIONS = 600000;
const HKDF_INFO = te.encode('osaka-trip/v1/aes-256-gcm');

export function b64uEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

// Reads the link secret from a URL fragment such as "#k=<43 base64url chars>".
export function linkSecretFromHash(hash) {
  const m = /(?:^#|&)k=([A-Za-z0-9_-]{43})(?:&|$)/.exec(hash || '');
  if (!m) return null;
  const bytes = b64uDecode(m[1]);
  return bytes.length === 32 ? bytes : null;
}

export async function deriveKey(password, linkSecret, salt, iterations, extractable = false) {
  if (!(linkSecret instanceof Uint8Array) || linkSecret.length !== 32) throw new Error('bad link secret');
  const pwKey = await crypto.subtle.importKey('raw', te.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const pwBits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, pwKey, 256));
  const ikm = new Uint8Array(64);
  ikm.set(linkSecret, 0);
  ikm.set(pwBits, 32);
  const hkdfKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: HKDF_INFO },
    hkdfKey, { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']);
}

export function importRawKey(raw, extractable = false) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']);
}

// The public header is bound as additional authenticated data, so it cannot be altered.
function aad(env) {
  return te.encode(JSON.stringify([env.v, env.kdf.salt, env.kdf.iter, env.rev]));
}

export async function seal(key, plaintextBytes, { salt, iterations, rev }) {
  const iv = randomBytes(12);
  const env = { v: ENVELOPE_VERSION, kdf: { alg: 'PBKDF2-SHA256+HKDF', salt: b64uEncode(salt), iter: iterations }, rev, iv: b64uEncode(iv) };
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(env) }, key, plaintextBytes);
  env.ct = b64uEncode(new Uint8Array(ct));
  return env;
}

export async function open(key, env) {
  if (env.v !== ENVELOPE_VERSION) throw new Error('unsupported envelope');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64uDecode(env.iv), additionalData: aad(env) }, key, b64uDecode(env.ct));
  return new Uint8Array(pt);
}

export function envelopeSalt(env) {
  return b64uDecode(env.kdf.salt);
}

export async function gunzipToJson(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(td.decode(await new Response(stream).arrayBuffer()));
}
