// API wrappers for the proxy endpoints
// Configure API base by setting window.API_BASE. Defaults to SAM local on localhost.
let API_BASE = '';
if (typeof window !== 'undefined') {
  if (window.API_BASE) {
    API_BASE = String(window.API_BASE).replace(/\/$/, '');
  } else if (window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    // Use the same hostname the page was loaded with to avoid localhost/127.0.0.1 mismatches
    const host = window.location.hostname;
    const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
    API_BASE = `${proto}//${host}:3000`;
  }
}

export async function searchIds(query) {
  const base = API_BASE || '';
  const url = new URL((base ? base : '') + '/yt/search', base ? undefined : window.location.origin);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('maxResults', '5');
  url.searchParams.set('q', '"' + query + '"');
  url.searchParams.set('type', 'video');
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('safeSearch', 'none');

  const res = await fetch(url);
  if (!res.ok) throw new Error('Search failed: ' + res.status);
  const data = await res.json();
  const ids = (data.items || []).map(it => it?.id?.videoId).filter(Boolean);
  return ids;
}

export async function fetchVideo(id) {
  const base = API_BASE || '';
  const url = new URL((base ? base : '') + '/yt/videos', base ? undefined : window.location.origin);
  url.searchParams.set('part', 'snippet,statistics');
  url.searchParams.set('id', id);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Videos failed: ' + res.status);
  const data = await res.json();
  return (data.items || [])[0] || null;
}
