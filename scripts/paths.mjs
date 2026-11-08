import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Plaintext trip data and keys live OUTSIDE the repository so they can never be committed.
export const PRIVATE_DIR = path.resolve(process.env.OSAKA_PRIVATE_DIR || path.join(ROOT, '..', 'osaka-trip-private'));
export const KEYS_FILE = path.join(PRIVATE_DIR, 'keys.local.json');
export const LINK_FILE = path.join(PRIVATE_DIR, 'access-link.local.txt');
export const TRIP_FILE = path.join(PRIVATE_DIR, 'trip.json');
export const SITE_DIR = path.join(ROOT, 'docs');
export const SITE_URL = 'https://osaka.alibeydoun.info/';
