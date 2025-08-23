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

## Dev Containers/Codespaces

- Recommended: open this repo in a VS Code Dev Container or GitHub Codespace.
- Assumptions: all commands and paths assume a Linux devcontainer shell at the repo root.
- Benefits: consistent Node version, preinstalled tooling, and fewer host‑OS/Docker path issues.
- Local machine alternative: if not using a devcontainer, ensure Node 18+/22, Docker (optional unless using containerized SAM builds), AWS CLI v2, and SAM CLI are installed and on PATH.

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

Quick manual deploy using the included script:

1) Ensure AWS creds via SSO and create/update the secret:

   - aws configure sso
   - aws sso login --profile my-sso --no-browser
   - export AWS_PROFILE=my-sso
   - export AWS_REGION=us-east-1
   - aws secretsmanager create-secret --name yt-api-keys --region $AWS_REGION --secret-string '{"YT_API_KEYS":["YOUR_KEY"]}'

2) Deploy the stack (build + deploy + upload frontend + invalidate CloudFront):

   - npm run deploy -- \
       --secret-arn <YOUR_SECRET_ARN> \
       --allowed-origin http://localhost:5500

   Options:
   - --stack-name NAME (default: yt-grave-robber)
   - --region REGION (default from AWS_REGION)
   - --profile PROFILE (default from AWS_PROFILE)
   - --frontend-dir DIR (default: client/src)
   - --no-sync-frontend (skip S3 sync)
   - --no-invalidate (skip CloudFront invalidation)
   - --no-container (build without Docker if SAM container build has issues)

3) Fetch outputs:

   - API URL and CloudFront URL are printed at the end of the script.


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
