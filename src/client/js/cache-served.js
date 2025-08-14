const keyFor = (id) => `served:${id}`;

export function markServed(id) {
  localStorage.setItem(keyFor(id), String(Date.now()));
}

export function isServed(id, ttlDays = 14) {
  const ts = parseInt(localStorage.getItem(keyFor(id)) || '0', 10);
  if (!ts) return false;
  const ageMs = Date.now() - ts;
  return ageMs < ttlDays * 24 * 60 * 60 * 1000;
}

export function purgeExpired(ttlDays = 14) {
  const now = Date.now();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('served:')) continue;
    const ts = parseInt(localStorage.getItem(k) || '0', 10);
    if (ts && now - ts > ttlMs) localStorage.removeItem(k);
  }
}

