import {jest} from '@jest/globals';

// ESM import needs to come after we set globals if the module captures them.

describe('Lambda proxy handler', () => {
  let handler;
  const OLD_ENV = process.env;
  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...OLD_ENV, YT_KEY: 'TESTKEY', ALLOWED_ORIGIN: 'http://localhost:5500', ENABLE_ORIGIN_CHECK: 'false' };
    global.fetch = jest.fn();
    // dynamic import after stubbing fetch
    ({ handler } = await import('../../src/server/index.mjs'));
  });
  afterEach(() => {
    process.env = OLD_ENV;
    delete global.fetch;
  });

  function mkEvent(path, qs = {}) {
    return {
      requestContext: { http: { method: 'GET', path } },
      rawPath: path,
      queryStringParameters: qs,
      headers: { origin: 'http://localhost:5500' },
    };
  }

  test('proxies /yt/search with key injected', async () => {
    const body = JSON.stringify({ items: [] });
    global.fetch.mockResolvedValue({ status: 200, text: async () => body, headers: new Map([['content-type','application/json']]) });

    const res = await handler(mkEvent('/yt/search', { q: '"IMG_20200101_0001"', part: 'snippet', type: 'video' }));
    expect(res.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(global.fetch.mock.calls[0][0]);
    expect(calledUrl.origin + calledUrl.pathname).toBe('https://www.googleapis.com/youtube/v3/search');
    expect(calledUrl.searchParams.get('key')).toBe('TESTKEY');
    expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5500');
  });

  test('proxies /yt/videos with key injected', async () => {
    const body = JSON.stringify({ items: [] });
    global.fetch.mockResolvedValue({ status: 200, text: async () => body, headers: new Map([['content-type','application/json']]) });

    const res = await handler(mkEvent('/yt/videos', { id: 'abc123', part: 'snippet,statistics' }));
    expect(res.statusCode).toBe(200);
    const calledUrl = new URL(global.fetch.mock.calls[0][0]);
    expect(calledUrl.origin + calledUrl.pathname).toBe('https://www.googleapis.com/youtube/v3/videos');
    expect(calledUrl.searchParams.get('key')).toBe('TESTKEY');
  });

  test('passes through upstream error status and body', async () => {
    const body = JSON.stringify({ error: { code: 400, message: 'Invalid' } });
    global.fetch.mockResolvedValue({ status: 400, text: async () => body, headers: new Map([['content-type','application/json']]) });

    const res = await handler(mkEvent('/yt/search', { q: 'bad' }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toBe(body);
    expect(res.headers['Content-Type']).toBe('application/json');
  });

  test('network error yields 502 with minimal details', async () => {
    global.fetch.mockRejectedValue(new Error('boom'));
    const res = await handler(mkEvent('/yt/videos', { id: 'zzz' }));
    expect(res.statusCode).toBe(502);
    const parsed = JSON.parse(res.body);
    expect(parsed.error).toBe('Upstream fetch failed');
    expect(parsed.message).toContain('boom');
    expect(parsed.target).toContain('youtube');
  });
});

