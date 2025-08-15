exports.handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  const rawPath = event?.rawPath || event?.requestContext?.http?.path || event?.path || "/";
  const proxyPart = event?.pathParameters?.proxy ? `/${event.pathParameters.proxy}` : "";
  const path = proxyPart || rawPath;

  if (method === "GET" && path === "/ping") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ping: "pong" })
    };
  }

  return {
    statusCode: 404,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ error: "Not Found", method, path })
  };
};

