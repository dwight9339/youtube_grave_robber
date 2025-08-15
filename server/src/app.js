import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

const app = express();

// Config from env
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:5500";
const YT_KEY = process.env.YT_KEY || "";
if (!YT_KEY) {
  // Don’t crash in Lambda cold start; we’ll return 500 at request time if needed
  console.warn("Warning: YT_KEY is not set");
}

// CORS
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

// Basic health
app.get("/api/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

// Shared proxy util
async function proxyToYouTube(upstreamBase, req, res) {
  if (!YT_KEY) {
    return res.status(500).json({ error: "Server not configured: missing YT_KEY" });
  }
  const url = new URL(upstreamBase);
  // Forward incoming query params
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === "string") url.searchParams.set(k, v);
  }
  // Inject key
  url.searchParams.set("key", YT_KEY);

  try {
    const upstream = await fetch(url.toString(), { method: "GET" });
    const text = await upstream.text();
    // Pass through status and content-type
    res.status(upstream.status);
    res.set("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: "Upstream fetch failed", message: String(e?.message || e) });
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
