// server/src/lambda.mjs
import serverless from "serverless-http";
import app from "./app.mjs";

export const handler = serverless(app, {
  requestId: "x-request-id"
});
