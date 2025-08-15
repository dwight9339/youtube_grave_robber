// src/server/index.mjs
export const handler = async (event) => {
  // --- CORS ---
  const allowedOriginEnv = process.env.ALLOWED_ORIGIN || "*";
  const enableOriginCheck = String(process.env.ENABLE_ORIGIN_CHECK || "false").toLowerCase() === "true";
  const origin = event?.headers?.origin || "";
  const corsOrigin = enableOriginCheck ? allowedOriginEnv : (origin || allowedOriginEnv);

  // --- Method & path (HTTP API or REST API) ---
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  const rawPath = event?.rawPath || event?.requestContext?.http?.path || event?.path || "/";
  const proxyPart = event?.pathParameters?.proxy ? `/${event.pathParameters.proxy}` : "";
  const path = proxyPart || rawPath;

  // Helpers
  const ok = (body, headers = { "Content-Type": "application/json" }) => ({
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": corsOrigin, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });

  const err = (statusCode, body, headers = { "Content-Type": "application/json" }) => ({
    statusCode,
    headers: { "Access-Control-Allow-Origin": corsOrigin, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });

  // Preflight
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      },
      body: ""
    };
  }

  try {
    if (method === "GET" && path === "/ping") {
      console.log("PING matched", { method, path });
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ ping: "pong" })
      };
    }
    
    if (method === "GET" && path === "/yt/search") {
      const qp = event?.queryStringParameters || {};
      // Avoid quoted values like q="CIMG6788"
      const q = (qp.q || "").replace(/^"+|"+$/g, "");

      // Build upstream URL (example: YouTube Data API)
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("maxResults", qp.maxResults || "50");
      url.searchParams.set("q", q);
      url.searchParams.set("type", qp.type || "video");
      url.searchParams.set("videoEmbeddable", qp.videoEmbeddable || "true");
      url.searchParams.set("safeSearch", qp.safeSearch || "none");
      if (process.env.YT_API_KEY) url.searchParams.set("key", process.env.YT_API_KEY);

      const upstream = await fetch(url, { method: "GET" });
      const text = await upstream.text();

      // Try to pass through JSON if possible
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        // Upstream sent non-JSON; wrap it
        body = { raw: text };
      }

      return {
        statusCode: upstream.ok ? 200 : upstream.status || 502,
        headers: { "Access-Control-Allow-Origin": corsOrigin, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      };
    }

    // Example HTML response (optional)
    if (method === "GET" && path === "/") {
      const html = "<!doctype html><html><body><h1>Hello</h1></body></html>";
      return ok(html, { "Content-Type": "text/html; charset=utf-8" });
    }

    return err(404, { error: "Not Found", path, method });
  } catch (e) {
    console.error("Handler error:", e);
    return err(502, { error: "Upstream fetch failed", message: String(e?.message || e) });
  }
};
