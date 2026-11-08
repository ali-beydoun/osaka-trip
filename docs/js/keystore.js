// "Keep unlocked on this device": stores the NON-EXTRACTABLE AES key in IndexedDB.
// Script can use it to decrypt but cannot read its bytes. Lock deletes it.
const DB = 'osaka-trip';
const STORE = 'keys';

function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { d.close(); resolve(r && r.result); };
    t.onerror = () => { d.close(); reject(t.error); };
  });
}

export async function saveKey(saltId, key) {
  try { await tx('readwrite', (s) => s.put({ saltId, key }, 'trip')); return true; } catch { return false; }
}

export async function loadKey(saltId) {
  try {
    const rec = await tx('readonly', (s) => s.get('trip'));
    return rec && rec.saltId === saltId ? rec.key : null;
  } catch { return null; }
}

export async function forgetKey() {
  try { await tx('readwrite', (s) => s.delete('trip')); } catch { /* nothing stored */ }
}
