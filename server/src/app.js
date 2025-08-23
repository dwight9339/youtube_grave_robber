import express from "express";
import cors from "cors";

const app = express();

// Config from env
// Support comma-separated origins and a dev override to accept any origin
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:5500,http://127.0.0.1:5500";
const ENABLE_ORIGIN_CHECK = (process.env.ENABLE_ORIGIN_CHECK || "true").toLowerCase() !== "false";
const allowedOrigins = ALLOWED_ORIGIN.split(",").map(s => s.trim()).filter(Boolean);
console.log("CORS config:", { ENABLE_ORIGIN_CHECK, allowedOrigins });
// YouTube API key(s)
// Primary shape going forward: `YT_KEYS` is a JSON array (e.g. '["k1","k2"]')
// Backward-compat: if absent, fall back to scalar `YT_KEY`
function parseKeys(input) {
  if (!input) return [];
  try {
    const v = JSON.parse(input);
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
  } catch (_) {
    // Not JSON — accept comma-separated list
    return String(input)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

const ENV_YT_KEYS = parseKeys(process.env.YT_KEYS);
const CURRENT_YT_KEY = ENV_YT_KEYS[0] || process.env.YT_KEY || "";
if (!CURRENT_YT_KEY) {
  // Don’t crash in Lambda cold start; we’ll return 500 at request time if needed
  console.warn("Warning: YT_KEYS/YT_KEY not set");
}

// CORS
let corsOptions;
if (ENABLE_ORIGIN_CHECK) {
  corsOptions = {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      return callback(null, allowedOrigins.includes(origin));
    },
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  };
} else {
  // Reflect request origin and requested headers in dev
  corsOptions = {
    origin: true,
    methods: ["GET", "OPTIONS"],
    // undefined tells cors to reflect Access-Control-Request-Headers
    allowedHeaders: undefined,
    optionsSuccessStatus: 204,
  };
}
app.use(cors(corsOptions));
// Fallback: reflect origin header if CORS didn't set it (dev only)
app.use((req, res, next) => {
  if (!ENABLE_ORIGIN_CHECK) {
    const origin = req.headers.origin;
    if (origin && !res.get("Access-Control-Allow-Origin")) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
    }
  }
  next();
});
// Ensure preflight requests are handled for any path
app.options("*", (req, res, next) => {
  if (!ENABLE_ORIGIN_CHECK) {
    const origin = req.headers.origin;
    if (origin) res.set("Access-Control-Allow-Origin", origin);
    const reqHdr = req.headers["access-control-request-headers"];
    if (reqHdr) res.set("Access-Control-Allow-Headers", reqHdr);
    res.set("Access-Control-Allow-Methods", "GET,OPTIONS");
    return res.status(204).send();
  }
  return cors(corsOptions)(req, res, next);
});

// Basic health
app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

// Shared proxy util
async function proxyToYouTube(upstreamBase, req, res) {
  if (!CURRENT_YT_KEY) {
    return res.status(500).json({ error: "Server not configured: missing YT_KEYS/YT_KEY" });
  }
  const url = new URL(upstreamBase);
  // Forward incoming query params
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === "string") url.searchParams.set(k, v);
  }
  // Inject key
  url.searchParams.set("key", CURRENT_YT_KEY);

  try {
    const upstream = await fetch(url.toString(), { method: "GET" });
    const text = await upstream.text();
    // Pass through status and content-type
    res.status(upstream.status);
    res.set("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: "Upstream fetch failed", message: String(e?.message || e), target: upstreamBase });
  }
}

// Routes that mirror your Lambda API
app.get("/yt/search", (req, res) => {
  console.log("YT search request:", req.query);
  return proxyToYouTube("https://www.googleapis.com/youtube/v3/search", req, res);
});

app.get("/yt/videos", (req, res) => {
  return proxyToYouTube("https://www.googleapis.com/youtube/v3/videos", req, res);
});

export default app;
