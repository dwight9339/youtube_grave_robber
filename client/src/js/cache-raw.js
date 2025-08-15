const keyFor = (tpl) => `raw:${tpl}`;

export function addToPool(template, ids) {
  const key = keyFor(template);
  const cur = JSON.parse(localStorage.getItem(key) || '[]');
  const set = new Set(cur.concat(ids || []));
  localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

export function removeFromAll(id, templates) {
  for (const tpl of templates) {
    const key = keyFor(tpl);
    const cur = JSON.parse(localStorage.getItem(key) || '[]');
    const next = cur.filter((x) => x !== id);
    localStorage.setItem(key, JSON.stringify(next));
  }
}

export function popFromAny(templates) {
  const tpls = Array.from(templates);
  for (let i = tpls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tpls[i], tpls[j]] = [tpls[j], tpls[i]];
  }
  for (const tpl of tpls) {
    const key = keyFor(tpl);
    const cur = JSON.parse(localStorage.getItem(key) || '[]');
    if (cur.length > 0) {
      const id = cur.shift();
      localStorage.setItem(key, JSON.stringify(cur));
      return id;
    }
  }
  return null;
}

