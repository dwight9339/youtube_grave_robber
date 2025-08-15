# YouTube Grave Robber

A serverless web app that serves up **random low-view, system-titled YouTube videos** each time you click **Next**. Built with **AWS SAM** for the backend (API Gateway + Lambda + optional DynamoDB cache) and **S3 + CloudFront** for the static frontend.

## Features

- **Random template selection** for realistic system file names.
- **Client-side caching** of video IDs and details to minimize YouTube Data API usage.
- **Two-layer caching** (optional server-side with DynamoDB) to share search results between users.
- **Never repeats** a video within a session.
- **Configurable filters**: max view count, title regex, etc.
- **Serverless**: minimal infra cost, scales automatically.

## Architecture

- **Frontend**: Static HTML/JS/CSS hosted on S3 and cached via CloudFront.
- **Backend**: Lambda function behind API Gateway acting as a proxy to YouTube Data API (injects API key server-side, handles CORS).
- **Optional server-side cache**: DynamoDB table for sharing results and further reducing API calls.

## Repository Layout

```
/src
  /client              # Frontend (HTML, JS, CSS)
  /server              # Lambda handler and supporting modules
/tests                 # Unit tests
samconfig.toml         # SAM CLI config (safe to commit)
template.yaml          # SAM/CloudFormation template
package.json           # Node dependencies and scripts
PLAN.md                # Project build/deploy plan
README.md              # This file
```

## Prerequisites

- **AWS CLI** and **SAM CLI** installed
- **Docker** (for `sam local` and DynamoDB Local)
- **Node.js** 18+
- **YouTube Data API v3 key** stored in AWS Secrets Manager or SSM Parameter Store

## Local Development

1. **Run DynamoDB Local** (optional for caching):

   ```bash
   docker run --name ddb-local -p 8000:8000 amazon/dynamodb-local
   aws dynamodb create-table --endpoint-url http://localhost:8000 \
     --table-name yg_cache \
     --attribute-definitions AttributeName=pk,AttributeType=S \
     --key-schema AttributeName=pk,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST
   ```

2. **Start API locally**:

   ```bash
   sam build
   # Update env.local.json with your YouTube API key first
   sam local start-api --env-vars env.local.json
   ```

3. **Serve frontend locally**:

   ```bash
   cd src/client
   python -m http.server 5500
   ```

   Visit [http://localhost:5500](http://localhost:5500). When served on localhost, the frontend defaults to calling the SAM API at `http://127.0.0.1:3000`. To override, set `window.API_BASE` in the browser console (e.g., `window.API_BASE = 'https://<api-id>.execute-api.<region>.amazonaws.com'`) and refresh.

   The sample `env.local.json` is included. Set:
   - `ProxyFunction.YT_KEY` to your YouTube Data API v3 key
   - `ProxyFunction.ALLOWED_ORIGIN` to `http://localhost:5500` (or your local host)
   - `ProxyFunction.ENABLE_ORIGIN_CHECK` to `false` for local dev

4. **Run unit tests** (optional):

   ```bash
   npm test
   ```

   Tests cover the Lambda proxy contract and the client API wrappers.

## Deployment

1. **Deploy backend**:

   ```bash
   sam build
   sam deploy --guided
   ```

   Provide stack name, AWS region, S3 bucket for artifacts, and parameter overrides (e.g., `AllowedOrigin`, `YtKeySecretArn`).

2. **Upload frontend to S3**:

   ```bash
   aws s3 sync src/client s3://<SiteBucketName> --delete
   ```

3. **Invalidate CloudFront cache** (if using CloudFront):

   ```bash
   aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
   ```

## Configuration

- **AllowedOrigin**: The domain allowed for CORS (e.g., your CloudFront URL).
- **YT\_KEY**: YouTube Data API key (never exposed in frontend).
- **CACHE\_TABLE**: DynamoDB table name for server cache.

## API Endpoints

- `GET /yt/search` — Proxies YouTube Search API.
- `GET /yt/videos` — Proxies YouTube Videos API.

## Notes

- Each `search.list` call costs **100 units** in YouTube quota; `videos.list` is 1 unit per video.
- Caching is critical to avoid burning through the daily 10,000-unit limit.

## License

MIT License.
