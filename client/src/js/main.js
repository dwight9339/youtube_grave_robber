import { searchIds, fetchVideo } from './api.js';
import { generateFromTemplate, isSystemTitle } from './filters.js';
import { addToPool, popFromAny, removeFromAll } from './cache-raw.js';
import { getDetails, setDetails } from './cache-details.js';
import { markServed, isServed, purgeExpired } from './cache-served.js';

const els = {
  maxViews: document.getElementById('maxViews'),
  yearMin: document.getElementById('yearMin'),
  yearMax: document.getElementById('yearMax'),
  templates: document.getElementById('templates'),
  save: document.getElementById('save'),
  next: document.getElementById('next'),
  skip: document.getElementById('skip'),
  player: document.getElementById('player'),
  title: document.getElementById('title'),
  pillQuery: document.getElementById('pillQuery'),
  pillViews: document.getElementById('pillViews'),
  pillChannel: document.getElementById('pillChannel'),
  openInYT: document.getElementById('openInYT'),
  status: document.getElementById('status'),
  detector: document.getElementById('detector'),
  diag: document.getElementById('diag'),
};

export const DEFAULT_TEMPLATES = [
  'IMG_YYYYMMDD_####',
  'PXL_YYYYMMDD_######',
  'VID_YYYYMMDD_####',
  'VID-YYYYMMDD-WA####',
  'IMG-YYYYMMDD-WA####',
  'IMG ####',
  'MOV ####',
  'MVI_####',
  'DSC_####',
  'CIMG####',
  'GH01####',
  'GX01####',
  'DJI_####',
  'Screen Recording ####',
  'RPReplay_Final####',
].join('\n');

function setDiag(msg, ok = false) {
  els.diag.textContent = msg;
  els.diag.className = ok ? 'ok mono' : 'alert mono';
}

function loadSettings() {
  els.maxViews.value = localStorage.getItem('views') || '2000';
  els.yearMin.value = localStorage.getItem('ymin') || '2006';
  els.yearMax.value = localStorage.getItem('ymax') || '2025';
  els.templates.value = localStorage.getItem('templates') || DEFAULT_TEMPLATES;

  if (location.protocol === 'file:') {
    setDiag('Warning: Opened via file://. Use a local server like `python -m http.server 5500` and open http://localhost:5500/… so API referrer restrictions work.');
  } else {
    setDiag('Ready.', true);
  }
}

function saveSettings() {
  localStorage.setItem('views', els.maxViews.value.trim());
  localStorage.setItem('ymin', els.yearMin.value.trim());
  localStorage.setItem('ymax', els.yearMax.value.trim());
  localStorage.setItem('templates', els.templates.value);
  toast('Saved settings.');
}

function toast(msg) {
  els.status.textContent = msg;
  setTimeout(() => { els.status.textContent = ''; }, 2200);
}

function getTemplates() {
  return (els.templates.value || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

function pickFrom(list) {
  if (!list || list.length === 0) return 'IMG_YYYYMMDD_####';
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function tryCandidate(id, maxViews) {
  // Served check first
  if (isServed(id)) return null;
  // Use details cache if present
  let v = getDetails(id);
  if (!v) {
    try {
      v = await fetchVideo(id);
      if (v) setDetails(id, v);
    } catch (e) {
      return null;
    }
  }
  if (!v) return null;
  const views = parseInt(v.statistics?.viewCount || '0', 10);
  if (isNaN(views) || views > maxViews) return null;
  if (!isSystemTitle(v.snippet?.title)) return null;
  return v;
}

async function nextPick(retryBudget = 5) {
  const maxViews = parseInt(els.maxViews.value, 10) || 2000;
  const templates = getTemplates();

  // Reset UI
  els.pillQuery.textContent = '…';
  els.pillViews.textContent = '';
  els.pillChannel.textContent = '';
  els.title.textContent = '';
  els.openInYT.href = '#';
  els.player.src = '';
  els.detector.textContent = '';

  // Housekeeping
  purgeExpired();

  let fills = 0; // number of /yt/search fills performed

  // Try to consume from cache and only fill when empty
  while (fills <= retryBudget) {
    // 1) Try cached raw IDs across all templates
    for (let guard = 0; guard < 200; guard++) {
      const id = popFromAny(templates);
      if (!id) break; // no more cached IDs
      if (isServed(id)) { removeFromAll(id, templates); continue; }
      const v = await tryCandidate(id, maxViews);
      if (!v) { removeFromAll(id, templates); continue; }

      // Success: consume and display
      const vidId = v.id;
      const title = v.snippet.title;
      const views = parseInt((v.statistics && v.statistics.viewCount) || '0', 10);
      const chan = v.snippet.channelTitle;
      const url = 'https://www.youtube.com/watch?v=' + vidId;

      markServed(vidId);
      removeFromAll(vidId, templates);

      els.player.src = 'https://www.youtube.com/embed/' + vidId + '?autoplay=1&rel=0';
      els.title.textContent = title;
      els.pillViews.textContent = new Intl.NumberFormat().format(views) + ' views';
      els.pillChannel.textContent = 'by ' + chan;
      els.openInYT.href = url;

      const regOk = isSystemTitle(title);
      els.detector.textContent = 'Title: ' + title + '\nMatches system-title regex: ' + (regOk ? 'Yes' : 'No') + '\nSource: cache';
      setDiag('Found one from cache: ' + title, true);
      toast('Found one!');
      return;
    }

    // 2) Need to fill raw cache via one search
    fills++;
    const tpl = pickFrom(templates);
    const query = generateFromTemplate(tpl, els.yearMin.value, els.yearMax.value);
    els.pillQuery.textContent = query;
    setDiag('Searching for ' + query + ' (attempt ' + fills + '/' + retryBudget + ')…', true);

    try {
      const ids = await searchIds(query);
      if (ids.length === 0) {
        setDiag('No results for ' + query + '. Trying another…', false);
      } else {
        addToPool(tpl, ids);
        setDiag('Cached ' + ids.length + ' results for ' + tpl + '. Trying picks…', true);
      }
    } catch (err) {
      console.error(err);
      setDiag('API error: ' + (err?.message || err), false);
      toast('API error; see Diagnostics.');
      return;
    }
    await new Promise(r => setTimeout(r, 150));
  }

  setDiag('Out of attempts. Widen the year range or increase Max views.', false);
  toast('Try widening years or increasing Max views.');
}

// Events
els.save.addEventListener('click', saveSettings);
els.next.addEventListener('click', () => nextPick());
els.skip.addEventListener('click', () => nextPick());

// Init
loadSettings();
