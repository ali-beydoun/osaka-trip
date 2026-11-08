// Serves the live docs/ folder with SYNTHETIC encrypted data swapped in for data/trip.enc.json.
import path from 'node:path';
import { buildFixtureSite } from '../fixtures/build-fixture-site.mjs';
import { serve } from '../../scripts/serve.mjs';
import { SITE_DIR } from '../../scripts/paths.mjs';

const dir = await buildFixtureSite();
await serve(Number(process.env.PORT || 8799), SITE_DIR, { '/data/trip.enc.json': path.join(dir, 'data', 'trip.enc.json') });
console.log('fixture server ready');
