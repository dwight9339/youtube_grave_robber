# YouTube Grave Robber

A simple web app that serves up **random low-view, system-titled YouTube videos** each time you click **Next**.

## Features

- **Random template selection** for realistic system file names.
- **Never repeats** a video within a session.
- **Configurable filters**: max view count, title regex, etc.

## Prerequisites

- **Node.js** 18+
- **YouTube Data API v3 key**
- **AWS CLI** for deployment

## Local Development

1. Copy env template and set values:

   `cp .env.example .env` then set `YT_KEYS` (JSON array, first key used).

2. Install deps from the repo root (uses npm workspaces):

   `npm install`

3. Run both apps in dev:

   `npm run dev`

   - Server: http://127.0.0.1:3000 (auto-restarts with `node --watch`)
   - Client: http://127.0.0.1:5500 (static server)

4. Run unit tests:

   `npm test`

   Tests cover the Lambda proxy contract and the client API wrappers.

## Deployment



## Configuration

- **AllowedOrigin**: The domain allowed for CORS (e.g., your CloudFront URL).
- **YT\_KEYS**: JSON array of YouTube Data API keys (server uses the first key for now; rotation can be added later).
- **CACHE\_TABLE**: DynamoDB table name for server cache.

## API Endpoints

- `GET /yt/search` — Proxies YouTube Search API.
- `GET /yt/videos` — Proxies YouTube Videos API.

## Notes

- Each `search.list` call costs **100 units** in YouTube quota; `videos.list` is 1 unit per video.
- Caching is critical to avoid burning through the daily 10,000-unit limit.

## License

MIT License.
