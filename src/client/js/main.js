import { searchIds, fetchVideo } from './api.js';
import { generateFromTemplate, isSystemTitle } from './filters.js';

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

function pickTemplate() {
  const lines = (els.templates.value || '').split('\n');
  if (lines.length === 0) return 'IMG_YYYYMMDD_####';
  const idx = Math.floor(Math.random() * lines.length);
  return lines[idx];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function ytSearchRandomPick(query, maxViews) {
  // 1) Search
  const ids = await searchIds(query);
  shuffle(ids);
  // 2) Try each ID until match
  for (const id of ids) {
    const v = await fetchVideo(id);
    if (!v) continue;
    const views = parseInt(v.statistics?.viewCount || '0', 10);
    if (isNaN(views) || views > maxViews) continue;
    if (!isSystemTitle(v.snippet?.title)) continue;
    return v;
  }
  return null;
}

async function nextPick(retryBudget = 5) {
  const maxViews = parseInt(els.maxViews.value, 10) || 2000;

  els.pillQuery.textContent = '…';
  els.pillViews.textContent = '';
  els.pillChannel.textContent = '';
  els.title.textContent = '';
  els.openInYT.href = '#';
  els.player.src = '';
  els.detector.textContent = '';

  let attempt = 0;
  while (attempt < retryBudget) {
    attempt++;
    const tpl = pickTemplate();
    const query = generateFromTemplate(tpl, els.yearMin.value, els.yearMax.value);
    els.pillQuery.textContent = query;
    setDiag('Searching for ' + query + ' (attempt ' + attempt + '/' + retryBudget + ')…', true);

    try {
      const pick = await ytSearchRandomPick(query, maxViews);
      if (pick) {
        const vidId = pick.id;
        const title = pick.snippet.title;
        const views = parseInt((pick.statistics && pick.statistics.viewCount) || '0', 10);
        const chan = pick.snippet.channelTitle;
        const url = 'https://www.youtube.com/watch?v=' + vidId;

        els.player.src = 'https://www.youtube.com/embed/' + vidId + '?autoplay=1&rel=0';
        els.title.textContent = title;
        els.pillViews.textContent = new Intl.NumberFormat().format(views) + ' views';
        els.pillChannel.textContent = 'by ' + chan;
        els.openInYT.href = url;

        const regOk = isSystemTitle(title);
        els.detector.textContent = 'Title: ' + title + '\nMatches system-title regex: ' + (regOk ? 'Yes' : 'No') + '\nTemplate used: ' + tpl;
        setDiag('Found one: ' + title, true);
        toast('Found one!');
        return;
      } else {
        setDiag('No low-view results for ' + query + '. Trying another…', false);
      }
    } catch (err) {
      console.error(err);
      setDiag('API error: ' + (err?.message || err), false);
      toast('API error; see Diagnostics.');
      return;
    }
    await new Promise(r => setTimeout(r, 200));
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

