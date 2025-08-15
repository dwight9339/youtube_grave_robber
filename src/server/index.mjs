export const handler = async (event) => {
  const allowedOriginEnv = process.env.ALLOWED_ORIGIN || "*";
  const enableOriginCheck = String(process.env.ENABLE_ORIGIN_CHECK || "false").toLowerCase() === "true";
  const origin = event.headers?.origin || "";
  const referer = event.headers?.referer || "";
  const corsOrigin = enableOriginCheck ? allowedOriginEnv : (origin || allowedOriginEnv);

  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const rawPath =
    event.rawPath || event.requestContext?.http?.path || event.path || "/";
  // Some REST APIs put the matched proxy in pathParameters.proxy
  const proxyPart = event.pathParameters?.proxy ? "/" + event.pathParameters.proxy : "";
  const effectivePath = proxyPart ? proxyPart : rawPath;

  // Preflight
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With"
      },
      body: ""
    };
  }

  // Optional origin/referer check
  if (enableOriginCheck) {
    const fromAllowed = (origin && origin.startsWith(allowedOriginEnv)) || (referer && referer.startsWith(allowedOriginEnv));
    if (!fromAllowed) {
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": allowedOriginEnv,
          "Content-Type": "text/plain"
        },
        body: "Forbidden"
      };
    }
  }

  const ytKey = process.env.YT_KEY;
  if (!ytKey) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Content-Type": "text/plain"
      },
      body: "Server not configured"
    };
  }

  // Map routes by suffix so it works whether you have extra prefixes (stage/resource)
  const endsWith = (p) => effectivePath.endsWith(p);
  const targetMap = {
    "/yt/search": "https://www.googleapis.com/youtube/v3/search",
    "/yt/videos": "https://www.googleapis.com/youtube/v3/videos"
  };
  const target = endsWith("/yt/search")
    ? targetMap["/yt/search"]
    : endsWith("/yt/videos")
    ? targetMap["/yt/videos"]
    : null;

  if (!target) {
    return {
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Content-Type": "text/plain"
      },
      body: "Not found"
    };
  }

  // Forward query params and inject key
  const qp = event.queryStringParameters || {};
  const url = new URL(target);
  for (const [k, v] of Object.entries(qp)) {
    if (typeof v === "string") url.searchParams.set(k, v);
  }
  url.searchParams.set("key", ytKey);

  try {
    const res = await fetch(url.toString(), { method: "GET" });
    const body = await res.text();
    return {
      statusCode: res.status,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Expose-Headers": "Content-Type",
        "Content-Type": res.headers.get("content-type") || "application/json"
      },
      body
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Upstream fetch failed", message: String(e?.message || e), target: url.toString() })
    };
  }
};
