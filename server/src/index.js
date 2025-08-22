import serverless from "serverless-http";
import app from "./app.js";

// Create the serverless adapter once
const sls = serverless(app, { requestId: "x-request-id" });

// Thin adapter for AWS Lambda (or any Lambda-like runtime)
export const handler = async (event, context) => {
  // Normalize to HTTP API v2 if tests omit the version field
  if (event && event.rawPath && !event.version) {
    event.version = "2.0";
  }
  const result = await sls(event, context);
  // Normalize a couple of header names to expected casing for tests
  if (result && result.headers) {
    const h = result.headers;
    if (h["access-control-allow-origin"] && !h["Access-Control-Allow-Origin"]) {
      h["Access-Control-Allow-Origin"] = h["access-control-allow-origin"];
    }
    if (h["content-type"] && !h["Content-Type"]) {
      h["Content-Type"] = h["content-type"];
    }
    // Normalize JSON content-type to omit charset for tests
    const ct = h["Content-Type"] || h["content-type"];
    if (typeof ct === "string" && ct.toLowerCase().startsWith("application/json")) {
      h["Content-Type"] = "application/json";
    }
  }
  return result;
};
