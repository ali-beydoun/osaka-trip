import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { deriveKey, seal, open, randomBytes, b64uEncode, linkSecretFromHash, envelopeSalt, gunzipToJson } from '../docs/js/vault.js';

const ITER = 1000; // fast for tests; production uses KDF_ITERATIONS

test('round trip needs both link secret and password', async () => {
  const link = randomBytes(32), salt = randomBytes(16);
  const key = await deriveKey('test-pass', link, salt, ITER);
  const data = { hello: 'world', jp: '大阪' };
  const env = await seal(key, new Uint8Array(zlib.gzipSync(JSON.stringify(data))), { salt, iterations: ITER, rev: 'r1' });

  const again = await deriveKey('test-pass', link, envelopeSalt(env), env.kdf.iter);
  assert.deepEqual(await gunzipToJson(await open(again, env)), data);

  const wrongPw = await deriveKey('test-pasS', link, salt, ITER);
  await assert.rejects(open(wrongPw, env));
  const wrongLink = await deriveKey('test-pass', randomBytes(32), salt, ITER);
  await assert.rejects(open(wrongLink, env));
});

test('header tampering is rejected (AAD)', async () => {
  const link = randomBytes(32), salt = randomBytes(16);
  const key = await deriveKey('p', link, salt, ITER);
  const env = await seal(key, new Uint8Array([1, 2, 3]), { salt, iterations: ITER, rev: 'r1' });
  await assert.rejects(open(key, { ...env, rev: 'r2' }));
});

test('derived key is non-extractable by default', async () => {
  const key = await deriveKey('p', randomBytes(32), randomBytes(16), ITER);
  assert.equal(key.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('raw', key));
});

test('link secret parsing from fragment', () => {
  const s = randomBytes(32);
  const enc = b64uEncode(s);
  assert.deepEqual(linkSecretFromHash(`#k=${enc}`), s);
  assert.deepEqual(linkSecretFromHash(`#day=3&k=${enc}`), s);
  assert.equal(linkSecretFromHash('#k=short'), null);
  assert.equal(linkSecretFromHash(''), null);
});

test('password unicode normalisation is stable', async () => {
  const link = randomBytes(32), salt = randomBytes(16);
  const a = await deriveKey('café', link, salt, ITER, true);
  const b = await deriveKey('café', link, salt, ITER, true);
  assert.deepEqual(new Uint8Array(await crypto.subtle.exportKey('raw', a)), new Uint8Array(await crypto.subtle.exportKey('raw', b)));
});
