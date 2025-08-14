const keyFor = (id) => `details:${id}`;

export function getDetails(id) {
  const raw = localStorage.getItem(keyFor(id));
  return raw ? JSON.parse(raw) : null;
}

export function setDetails(id, details) {
  localStorage.setItem(keyFor(id), JSON.stringify(details));
}

