# PLAN.md — YouTube Grave Robber (SAM + S3/CloudFront)

This document tells Codex CLI (and humans) how to build, run, and deploy the app. It captures the architecture, file layout, APIs, caching strategy, infra, testing, and tasks.

---

## 0) Project Goals

* Serve a simple front end that shows a **random low-view, system-titled YouTube video** for a chosen filename template each time the user clicks "Next".
* Keep **YouTube API quota usage** very low via a two-layer cache:

  * **Raw ID cache**: store video IDs from `search.list` calls (no filtering at search time).
  * **Details cache**: store `videos.list` results per ID on first use.
* Never show the same video twice during a session: maintain a **served ledger**.
* Host the front end on **S3 + CloudFront**; serve the API via **AWS SAM** (HTTP API + Lambda).
* Support **local dev and tests** with SAM CLI and Jest.

Notes:

* The repo currently contains a **SAM template** and config, a **server** folder (Lambda), and a **client** folder (HTML app). See `samconfig.toml` for defaults like `stack_name="youtube-grave-robber"`.
* NPM deps include AWS SDK v3 DynamoDB clients, enabling a future server-side cache if desired.

---

## 1) Repository Layout

```
/src
  /client
    index.html                 # browser app shell; loads /js modules
    /js
      api.js                   # fetch wrappers for proxy endpoints
      cache-raw.js              # raw ID cache (localStorage)
      cache-details.js          # details cache (localStorage)
      cache-served.js           # served ledger with TTL/cap (localStorage)
      filters.js                # regex, view-limit checks; template expansion
      main.js                   # UI wiring, "Next" orchestration
    /css
      style.css                 # styles

  /server
    handler.mjs                 # Lambda handler (Node 18+)
    /lib
      routes.mjs                 # path mapping, CORS helpers
      youtube.mjs                # server-side fetch to YouTube (inject key)
      schema.mjs                 # shared constants; optional

/tests
  unit/...                      # Jest tests for client utils and server modules

template.yaml                   # SAM template (HTTP API + Lambda)
samconfig.toml                   # SAM configs (deploy, local)
package.json                     # deps, jest config, scripts
buildspec.yml                    # (optional) CodeBuild config
README.md
PLAN.md
```

---

## 2) High-Level Architecture

* **Client (S3 + CloudFront)**: Static site. Makes GET requests to API Gateway endpoints:

  * `GET /yt/search` → proxies to YouTube Search **with server-injected key**.
  * `GET /yt/videos` → proxies `videos.list` for **one ID at a time** (by design).
* **API (HTTP API + Lambda)**:

  * Injects secret **`YT_KEY`** on the server side.
  * Enforces **CORS** and basic origin checks with **`ALLOWED_ORIGIN`**.
  * Provides **proxy** to official YouTube endpoints.
  * (Optional, later) Offers **server cache** (DynamoDB) to share raw IDs across users and reduce `search.list` frequency.

---

## 3) Front-End Runtime Logic

### 3.1 Template expansion

* Tokens: `YYYY`, `MM`, `DD`, `####`, `######`.
* Pick **one** random template → expand to **one** query string → wrap in quotes for exact match.

### 3.2 Cache-first flow (client-side only)

1. **Try details cache first** (IDs with metadata already known); skip any **served** IDs.
2. If none match current filters, **pop raw IDs** (random order) and for each:

   * Call `/yt/videos?id=<ID>` (1 unit) once per new ID; **store details** regardless of pass/fail.
   * If it passes filters → **consume** the ID (mark served + remove from raw buckets) and **play**.
3. If raw cache empty → **fill** with one `/yt/search` (100 units, `maxResults=50`), store **all returned IDs** for this template into the raw cache, then continue step 2.

### 3.3 Served policy

* Once a video is played, call `consumeVideo(id)`:

  * `markServed(id)` → prevents replays for 14 days (configurable).
  * `cacheRemoveFromAllRaw(id)` → remove from raw ID pools.
  * Optionally keep or delete details JSON to balance speed vs storage.

### 3.4 Filters (client-configurable)

* Max views (default 2,000).
* System-title regex (tunable). Default:

  ```js
  const SYS_TITLE_REGEX = /^(IMG(?:[-_E])?|PXL|VID|MOV|MVI|DSC|CIMG|GH0\\d|GX0\\d|DJI|RPReplay|Screen Recording)[\\-_ \\s]?[0-9A-Za-z_\\- ]{3,}$/;
  ```

---

## 4) API Contract (Browser → API Gateway → Lambda)

### 4.1 `GET /yt/search`

**Query params (forwarded to YouTube):**

* `part="snippet"`
* `q="\"<expanded-filename>\""`
* `type="video"`
* `maxResults="50"`
* `videoEmbeddable="true"`
* `safeSearch="none"`
* `order="relevance|date|viewCount|rating"`

**Response:** raw YouTube Search API JSON (200) or a proxy error (4xx/5xx).
**CORS:** `Access-Control-Allow-Origin: <ALLOWED_ORIGIN>`

### 4.2 `GET /yt/videos`

**Query params:**

* `part="snippet,statistics"`
* `id="<single video id>"`

**Response:** raw YouTube Videos API JSON.
**CORS:** same as above.

> Note: The Lambda **injects** `key=<YT_KEY>`; the browser **must not** send a key.

---

## 5) Security, CORS, and Envs

**Environment variables (Lambda):**

* `YT_KEY` — YouTube Data API key (secret)
* `ALLOWED_ORIGIN` — e.g., `"https://USERNAME.github.io"` or your CloudFront domain
* `ENABLE_ORIGIN_CHECK` — `"true" | "false"`

**CORS behavior:**

* For `OPTIONS`, return `204` with headers:

  ```http
  Access-Control-Allow-Origin: <ALLOWED_ORIGIN>
  Access-Control-Allow-Methods: GET,OPTIONS
  Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With
  ```
* For all responses (including 4xx/5xx), include `Access-Control-Allow-Origin`
