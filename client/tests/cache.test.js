import { jest } from '@jest/globals';

function setupDom() {
  document.body.innerHTML = `
    <div>
      <input id="maxViews" />
      <input id="yearMin" />
      <input id="yearMax" />
      <textarea id="templates"></textarea>
      <button id="save"></button>
      <button id="next"></button>
      <button id="skip"></button>
      <iframe id="player"></iframe>
      <div id="title"></div>
      <span id="pillQuery"></span>
      <span id="pillViews"></span>
      <span id="pillChannel"></span>
      <a id="openInYT"></a>
      <span id="status"></span>
      <div id="detector"></div>
      <div id="diag"></div>
    </div>
  `;
  // Defaults
  document.getElementById('maxViews').value = '2000';
  document.getElementById('yearMin').value = '2006';
  document.getElementById('yearMax').value = '2025';
}

function setTemplatesValue(val) {
  document.getElementById('templates').value = val;
  localStorage.setItem('templates', val);
}

describe('frontend caching flow', () => {
  beforeEach(() => {
    jest.resetModules();
    // jsdom provides window/document/localStorage
    setupDom();
    // Use jsdom's default window.location; no reassignment to avoid jsdom navigation
    global.fetch = jest.fn();
    localStorage.clear();
  });

  afterEach(() => {
    delete global.fetch;
    document.body.innerHTML = '';
    localStorage.clear();
  });

  test('uses details cache when raw id available (no network calls)', async () => {
    setTemplatesValue('T1');
    // Seed raw pool for T1
    localStorage.setItem('raw:T1', JSON.stringify(['abc']));
    // Seed details cache for abc
    const details = { id: 'abc', snippet: { title: 'IMG_20200101_0001', channelTitle: 'Chan' }, statistics: { viewCount: '15' } };
    localStorage.setItem('details:abc', JSON.stringify(details));

    await import('../src/js/main.js');

    // Click Next
    document.getElementById('next').click();
    // Wait a tick for async handlers
    await Promise.resolve();

    expect(global.fetch).not.toHaveBeenCalled();
    // Served marker set
    expect(localStorage.getItem('served:abc')).toBeTruthy();
    // Player iframe updated
    expect(document.getElementById('player').getAttribute('src')).toContain('embed/abc');
  });

  test('fetches video details once and caches them when missing', async () => {
    setTemplatesValue('T1');
    localStorage.setItem('raw:T1', JSON.stringify(['xyz']));

    // Mock /yt/videos for xyz
    global.fetch.mockImplementation((url) => {
      const u = new URL(url);
      if (u.pathname === '/yt/videos' && u.searchParams.get('id') === 'xyz') {
        return Promise.resolve({ ok: true, json: async () => ({ items: [{ id: 'xyz', snippet: { title: 'IMG_20220101_0001', channelTitle: 'Chan' }, statistics: { viewCount: '12' } }] }) });
      }
      return Promise.reject(new Error('Unexpected fetch: ' + url));
    });

    await import('../src/js/main.js');
    document.getElementById('next').click();
    // Allow async flow to complete
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('details:xyz')).toBeTruthy();
    expect(localStorage.getItem('served:xyz')).toBeTruthy();
    expect(document.getElementById('player').getAttribute('src')).toContain('embed/xyz');
  });

  test('fills raw cache via search when empty, then consumes candidates', async () => {
    jest.useFakeTimers();
    setTemplatesValue('TPLX');
    // Ensure raw is empty
    localStorage.setItem('raw:TPLX', JSON.stringify([]));

    // Mock first a /yt/search returning two IDs, then /yt/videos for each
    const responses = [
      // /yt/search
      () => ({ ok: true, json: async () => ({ items: [ { id: { videoId: 'm1' } }, { id: { videoId: 'm2' } } ] }) }),
      // /yt/videos for m1: fail due to high views
      () => ({ ok: true, json: async () => ({ items: [ { id: 'm1', snippet: { title: 'IMG_20200101_0001', channelTitle: 'C1' }, statistics: { viewCount: '999999' } } ] }) }),
      // /yt/videos for m2: pass
      () => ({ ok: true, json: async () => ({ items: [ { id: 'm2', snippet: { title: 'IMG_20200101_0002', channelTitle: 'C2' }, statistics: { viewCount: '5' } } ] }) }),
    ];
    let call = 0;
    global.fetch.mockImplementation((url) => {
      const u = new URL(url);
      if (u.pathname === '/yt/search') return Promise.resolve(responses[call++]());
      if (u.pathname === '/yt/videos') return Promise.resolve(responses[call++]());
      return Promise.reject(new Error('Unexpected fetch: ' + url));
    });

    await import('../src/js/main.js');
    document.getElementById('next').click();

    // Advance timers to pass the 150ms sleep after search fill
    await jest.advanceTimersByTimeAsync(200);

    // Allow pending microtasks
    await Promise.resolve();
    await Promise.resolve();

    // We should have fetched 1 search + 2 videos
    expect(global.fetch).toHaveBeenCalledTimes(3);
    // Should end up playing m2
    expect(document.getElementById('player').getAttribute('src')).toContain('embed/m2');
    expect(localStorage.getItem('served:m2')).toBeTruthy();
    // Details cached for m2
    expect(localStorage.getItem('details:m2')).toBeTruthy();
    jest.useRealTimers();
  });
});
