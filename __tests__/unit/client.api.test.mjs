import {jest} from '@jest/globals';

describe('client api wrappers', () => {
  beforeEach(() => {
    jest.resetModules();
    global.window = { location: { origin: 'http://localhost:5500', hostname: 'localhost' } };
    global.fetch = jest.fn();
  });
  afterEach(() => {
    delete global.window;
    delete global.fetch;
  });

  test('searchIds calls /yt/search and returns ids', async () => {
    const items = [ { id: { videoId: 'a' } }, { id: { videoId: 'b' } }, { id: {} } ];
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ items }) });
    const { searchIds } = await import('../../src/client/js/api.js');
    const ids = await searchIds('IMG_20200101_0001');
    expect(ids).toEqual(['a','b']);
    const calledUrl = new URL(global.fetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/yt/search');
    expect(calledUrl.searchParams.get('q')).toBe('"IMG_20200101_0001"');
    expect(calledUrl.searchParams.get('part')).toBe('snippet');
  });

  test('fetchVideo calls /yt/videos and returns first item', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: 'abc' }] }) });
    const { fetchVideo } = await import('../../src/client/js/api.js');
    const v = await fetchVideo('abc');
    expect(v).toEqual({ id: 'abc' });
    const calledUrl = new URL(global.fetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/yt/videos');
    expect(calledUrl.searchParams.get('id')).toBe('abc');
    expect(calledUrl.searchParams.get('part')).toBe('snippet,statistics');
  });
});

