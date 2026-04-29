import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
loadEnv({ path: path.join(projectRoot, ".env.local"), quiet: true });

const required = [
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const optional = ["OPENAI_CHAT_MODEL", "TMDB_API_KEY"];
const missing = required.filter((name) => !process.env[name]);

for (const name of required) {
  console.log(`${name}: ${process.env[name] ? "set" : "missing"}`);
}

for (const name of optional) {
  console.log(`${name}: ${process.env[name] ? "set" : "optional / not set"}`);
}

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exitCode = 1;
}