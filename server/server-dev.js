import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Prefer root .env for centralized config
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import app from "./src/app.js";

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dev API listening on http://localhost:${PORT}`);
});
