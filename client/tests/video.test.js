import {jest} from '@jest/globals';

describe('YouTube video route', () => {
  beforeEach(() => {
    jest.resetModules();
    global.window = { location: { origin: 'http://localhost:5500', hostname: 'localhost' } };
    global.fetch = jest.fn();
  });
  afterEach(() => {
    delete global.window;
    delete global.fetch;
  });

  test('fetchVideo calls /yt/videos and returns first item', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: 'abc' }] }) });
    const { fetchVideo } = await import('../src/js/api.js');
    const v = await fetchVideo('abc');
    expect(v).toEqual({ id: 'abc' });
    const calledUrl = new URL(global.fetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/yt/videos');
    expect(calledUrl.searchParams.get('id')).toBe('abc');
    expect(calledUrl.searchParams.get('part')).toBe('snippet,statistics');
  });
});
