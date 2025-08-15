import {jest} from '@jest/globals';

describe('YouTube search route', () => {
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
    const { searchIds } = await import('../src/js/api.js');
    const ids = await searchIds('IMG_20200101_0001');
    expect(ids).toEqual(['a','b']);
    const calledUrl = new URL(global.fetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/yt/search');
    expect(calledUrl.searchParams.get('q')).toBe('"IMG_20200101_0001"');
    expect(calledUrl.searchParams.get('part')).toBe('snippet');
  });
});
